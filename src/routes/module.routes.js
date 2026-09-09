"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");
const { ipFromReq } = require("../utils/network");
const { cleanText, validLedChannel, validBrightness } = require("../utils/sanitize");
const { parseState } = require("../utils/parse");

function createModuleRoutes({
  runtimeState,
  moduleRegistry,
  queueWriteHardware,
  commandQueueApi,
  upsertRelay,
  upsertLed,
  upsertSensor,
  updateElementsPowerByRelay
}) {
  const router = express.Router();

  router.post("/api/module/heartbeat", wrap(async (req, res) => {
    const moduleId = cleanText(req.body?.module || "GLEIS_01", 48) || "GLEIS_01";
    const module = moduleRegistry.getOrCreateModule(moduleId);

    module.online = true;
    module.lastHeartbeat = Date.now();
    module.ip = ipFromReq(req) || module.ip || "";
    module.type = cleanText(req.body?.moduleType || module.type || "GLEISSTEUERUNG", 40) || "GLEISSTEUERUNG";

    const relayStates = Array.isArray(req.body?.relays) ? req.body.relays : null;
    if (relayStates) {
      module.relays = relayStates.map(Boolean);
      relayStates.forEach((state, i) => {
        const channel = i + 1;
        upsertRelay(runtimeState.hardware, moduleId, channel, Boolean(state));
        updateElementsPowerByRelay(runtimeState.layout, moduleId, channel, Boolean(state));
      });
    }

    const ledStates = Array.isArray(req.body?.leds) ? req.body.leds : null;
    if (ledStates) {
      ledStates.forEach((x, i) => {
        const channel = validLedChannel(x?.channel ?? (i + 1));
        if (!channel) return;
        const state = Boolean(x?.state);
        const brightness = validBrightness(x?.brightness ?? (state ? 255 : 0));
        const blinking = Boolean(x?.blinking);

        upsertLed(runtimeState.hardware, moduleId, channel, { state, brightness, blinking });

        while (module.leds.length < channel) module.leds.push({ state: false, brightness: 0, blinking: false });
        module.leds[channel - 1] = { state, brightness, blinking };
      });
    }

    if (Array.isArray(req.body?.sensorInventory)) {
      const list = req.body.sensorInventory.map((x) => cleanText(String(x), 48)).filter(Boolean);
      list.forEach((id) => {
        const existingName = runtimeState.hardware.sensors.find((s) => s.module === moduleId && s.id === id)?.name || id;
        upsertSensor(runtimeState.hardware, moduleId, id, { name: existingName });

        if (!module.sensors.find((s) => s.id === id)) {
          module.sensors.push({ id, name: existingName, triggered: false, lastEvent: 0 });
        }
      });
    }

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    res.json({ ok: true, serverTime: Date.now() });
  }));

  router.post("/api/module/sensor", wrap(async (req, res) => {
    const moduleId = cleanText(req.body?.module || "GLEIS_01", 48) || "GLEIS_01";
    const sensorId = cleanText(req.body?.sensor || "", 48);
    if (!sensorId) throw apiError(400, "BAD_SENSOR_ID", "Sensor-ID fehlt");

    const module = moduleRegistry.getOrCreateModule(moduleId);
    module.online = true;
    module.lastHeartbeat = Date.now();
    module.ip = ipFromReq(req) || module.ip || "";

    const triggered = parseState(req.body?.triggered);

    upsertSensor(runtimeState.hardware, moduleId, sensorId, {
      triggered,
      lastEvent: triggered ? Date.now() : runtimeState.hardware.sensors.find((s) => s.module === moduleId && s.id === sensorId)?.lastEvent || 0
    });

    const sensorName = runtimeState.hardware.sensors.find((s) => s.module === moduleId && s.id === sensorId)?.name || sensorId;
    const i = module.sensors.findIndex((s) => s.id === sensorId);
    if (i >= 0) {
      module.sensors[i].triggered = triggered;
      if (triggered) module.sensors[i].lastEvent = Date.now();
      module.sensors[i].name = sensorName;
    } else {
      module.sensors.push({ id: sensorId, name: sensorName, triggered, lastEvent: triggered ? Date.now() : 0 });
    }

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    res.json({ ok: true });
  }));

  router.get("/api/module/next-command", (req, res) => {
    const moduleId = cleanText(req.query?.module || "GLEIS_01", 48) || "GLEIS_01";
    const module = moduleRegistry.getOrCreateModule(moduleId);

    module.online = true;
    module.lastHeartbeat = Date.now();

    const cmd = commandQueueApi.nextCommandForModule(moduleId);
    if (!cmd) return res.json({ command: null });

    res.json({
      command: {
        id: cmd.id,
        type: cmd.type,
        channel: Number(cmd.data.channel) || 0,
        state: Boolean(cmd.data.state),
        brightness: Number(cmd.data.brightness) || 0,
        onMs: Number(cmd.data.onMs) || 0,
        offMs: Number(cmd.data.offMs) || 0,
        durationMs: Number(cmd.data.durationMs) || 0,
        duration: Number(cmd.data.duration) || 0,
        elementId: String(cmd.data.elementId || ""),
        line: String(cmd.data.line || "")
      }
    });
  });

  router.post("/api/module/ack", (req, res, next) => {
    const id = Number(req.body?.id);
    if (!Number.isInteger(id)) return next(apiError(400, "BAD_COMMAND_ID", "Ungültige Befehls-ID"));
    const removed = commandQueueApi.ackCommand(id);
    res.json({ ok: true, bereitsBestaetigt: !removed });
  });

  return router;
}

module.exports = { createModuleRoutes };