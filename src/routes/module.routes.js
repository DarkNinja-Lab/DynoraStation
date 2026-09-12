"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");
const { ipFromReq } = require("../utils/network");
const { cleanText, validLedChannel, validBrightness } = require("../utils/sanitize");
const { parseState } = require("../utils/parse");
const { executeRulesForTrigger } = require("../domain/rules/executeRulesForTrigger");

function createModuleRoutes({
  runtimeState,
  moduleRegistry,
  queueWriteHardware,
  queueWriteLayout,
  queueWriteRules,
  commandQueueApi,
  addEvent,
  upsertRelay,
  upsertLed,
  upsertSensor,
  updateElementsPowerByRelay
}) {
  const router = express.Router();

  router.post("/api/module/heartbeat", wrap(async (req, res) => {
    const moduleId = cleanText(req.body?.module || "", 48);
    if (!moduleId) throw apiError(400, "MODULE_REQUIRED", "Modul-ID fehlt");
    const module = moduleRegistry.getOrCreateModule(moduleId);

    module.online = true;
    module.lastHeartbeat = Date.now();
    module.ip = ipFromReq(req) || module.ip || "";
    const firmwareType = cleanText(req.body?.moduleType || "", 40);
    module.name = cleanText(req.body?.moduleName || req.body?.name || module.name || `Modul ${moduleId}`, 80) || `Modul ${moduleId}`;

    const relayStates = Array.isArray(req.body?.relays) ? req.body.relays : null;
    if (relayStates) {
      module.relays = relayStates.map(Boolean);
      runtimeState.hardware.relays = runtimeState.hardware.relays.filter(
        (relay) => relay.module !== moduleId || Number(relay.channel) <= relayStates.length
      );
      relayStates.forEach((state, i) => {
        const channel = i + 1;
        upsertRelay(runtimeState.hardware, moduleId, channel, Boolean(state));
        updateElementsPowerByRelay(runtimeState.layout, moduleId, channel, Boolean(state));
      });
    }

    const ledStates = Array.isArray(req.body?.leds) ? req.body.leds : null;
    if (ledStates) {
      module.leds = [];
      runtimeState.hardware.leds = runtimeState.hardware.leds.filter((led) => led.module !== moduleId);
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

    const sensorSnapshot = Array.isArray(req.body?.sensors)
      ? req.body.sensors
          .map((sensor) => ({
            id: cleanText(sensor?.id ?? sensor?.sensor ?? "", 48),
            triggered: parseState(sensor?.triggered)
          }))
          .filter((sensor) => sensor.id)
      : [];

    if (Array.isArray(req.body?.sensorInventory) || sensorSnapshot.length) {
      const list = Array.from(new Set([
        ...(Array.isArray(req.body?.sensorInventory)
          ? req.body.sensorInventory.map((x) => cleanText(String(x), 48)).filter(Boolean)
          : []),
        ...sensorSnapshot.map((sensor) => sensor.id)
      ]));
      const inventory = new Set(list);
      const snapshotById = new Map(sensorSnapshot.map((sensor) => [sensor.id, sensor]));
      module.sensors = module.sensors.filter((sensor) => inventory.has(sensor.id));
      runtimeState.hardware.sensors = runtimeState.hardware.sensors.filter(
        (sensor) => sensor.module !== moduleId || inventory.has(sensor.id)
      );
      list.forEach((id) => {
        const existing = runtimeState.hardware.sensors.find((s) => s.module === moduleId && s.id === id);
        const existingName = existing?.name || id;
        const snapshot = snapshotById.get(id);
        upsertSensor(runtimeState.hardware, moduleId, id, {
          name: existingName,
          triggered: snapshot ? snapshot.triggered : Boolean(existing?.triggered),
          lastEvent: Number(existing?.lastEvent) || 0
        });

        const moduleSensor = module.sensors.find((s) => s.id === id);
        if (moduleSensor) {
          moduleSensor.name = existingName;
          if (snapshot) moduleSensor.triggered = snapshot.triggered;
        } else {
          module.sensors.push({
            id,
            name: existingName,
            triggered: snapshot ? snapshot.triggered : false,
            lastEvent: Number(existing?.lastEvent) || 0
          });
        }
      });
    }

    // Modultyp anhand gemeldeter Hardware erkennen, unabhängig von ID oder Anzeigename.
    const capabilities = [];
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "relays")) capabilities.push("relay");
    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, "sensorInventory") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "sensors")
    ) capabilities.push("sensor");
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "leds")) capabilities.push("led");
    const declared = firmwareType.toLowerCase();
    if (declared.includes("relay") && !capabilities.includes("relay")) capabilities.push("relay");
    if (declared.includes("sensor") && !capabilities.includes("sensor")) capabilities.push("sensor");
    if ((declared.includes("led") || declared.includes("signal")) && !capabilities.includes("led")) capabilities.push("led");
    if (capabilities.length) module.capabilities = capabilities;
    const hasLed = module.capabilities.includes("led");
    const hasRail = module.capabilities.includes("relay") || module.capabilities.includes("sensor");
    module.kind = hasLed && hasRail ? "HYBRID" : hasLed ? "SIGNAL_LED" : hasRail ? "RELAY_SENSOR" : "UNKNOWN";
    module.type = module.kind;

    if (!runtimeState.hardware.modules || typeof runtimeState.hardware.modules !== "object") {
      runtimeState.hardware.modules = {};
    }
    runtimeState.hardware.modules[moduleId] = {
      id: moduleId,
      name: module.name,
      type: module.type,
      kind: module.kind,
      capabilities: module.capabilities,
      ip: module.ip,
      lastHeartbeat: module.lastHeartbeat
    };
    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    res.json({
      ok: true,
      serverTime: Date.now(),
      accepted: {
        module: moduleId,
        relays: relayStates ? relayStates.length : 0,
        sensors: Array.isArray(req.body?.sensorInventory) || sensorSnapshot.length ? module.sensors.length : 0,
        leds: ledStates ? ledStates.length : 0
      }
    });
  }));

  router.post("/api/module/sensor", wrap(async (req, res) => {
    const moduleId = cleanText(req.body?.module || "", 48);
    if (!moduleId) throw apiError(400, "MODULE_REQUIRED", "Modul-ID fehlt");
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

    addEvent("SENSOR", `${moduleId}:${sensorId}`, `${sensorName} ${triggered ? "ausgelöst" : "frei"}`);

    const automations = executeRulesForTrigger({
      runtimeState,
      moduleRegistry,
      commandQueueApi,
      addEvent,
      upsertRelay,
      upsertLed,
      updateElementsPowerByRelay,
      queueWriteHardware,
      queueWriteLayout,
      queueWriteRules,
      trigger: {
        kind: "sensor",
        module: moduleId,
        sensorId,
        triggered
      }
    });

    res.json({ ok: true, automations });
  }));

  router.post("/api/module/delete", wrap(async (req, res) => {
    const moduleId = cleanText(req.body?.module || req.body?.moduleId || "", 48);
    if (!moduleId) throw apiError(400, "BAD_MODULE_ID", "Modul-ID fehlt");

    const exists = Boolean(
      runtimeState.modules[moduleId] ||
      runtimeState.hardware?.modules?.[moduleId] ||
      runtimeState.hardware?.relays?.some((item) => item.module === moduleId) ||
      runtimeState.hardware?.leds?.some((item) => item.module === moduleId) ||
      runtimeState.hardware?.sensors?.some((item) => item.module === moduleId)
    );
    if (!exists) throw apiError(404, "MODULE_NOT_FOUND", "ESP-Modul nicht gefunden");

    const affectedElements = new Set(
      (runtimeState.layout.elemente || [])
        .filter((element) => element.module === moduleId)
        .map((element) => element.id)
    );

    delete runtimeState.modules[moduleId];
    if (runtimeState.hardware.modules) delete runtimeState.hardware.modules[moduleId];
    runtimeState.hardware.relays = (runtimeState.hardware.relays || []).filter((item) => item.module !== moduleId);
    runtimeState.hardware.leds = (runtimeState.hardware.leds || []).filter((item) => item.module !== moduleId);
    runtimeState.hardware.sensors = (runtimeState.hardware.sensors || []).filter((item) => item.module !== moduleId);
    runtimeState.hardware.lightButtons = (runtimeState.hardware.lightButtons || []).map((button) =>
      button.module === moduleId ? { ...button, module: "", relay: 0 } : button
    );

    const channelFields = [
      "relay", "relayA", "relayB", "relayStraight", "relayBranch",
      "relayHp0", "relayHp1", "ledChannelRed", "ledChannelYellow", "ledChannelGreen"
    ];
    (runtimeState.layout.elemente || []).forEach((element) => {
      if (element.module !== moduleId) return;
      element.module = "";
      element.sensorId = "";
      element.powerState = false;
      channelFields.forEach((field) => { element[field] = 0; });
    });
    (runtimeState.layout.stromkreise || []).forEach((circuit) => {
      if (circuit.module !== moduleId) return;
      circuit.module = "";
      circuit.relay = 0;
      circuit.state = false;
    });

    let disabledRules = 0;
    (runtimeState.rulesData.rules || []).forEach((rule) => {
      const usesModule =
        rule.condition?.module === moduleId ||
        (rule.actions || []).some((action) =>
          action.module === moduleId || affectedElements.has(action.elementId)
        );
      if (usesModule && rule.enabled !== false) {
        rule.enabled = false;
        disabledRules += 1;
      }
    });

    runtimeState.commandQueue = runtimeState.commandQueue.filter((command) => command.module !== moduleId);
    runtimeState.hardware.updatedAt = Date.now();
    runtimeState.rulesData.updatedAt = Date.now();
    queueWriteHardware();
    queueWriteLayout();
    queueWriteRules();
    addEvent("MODUL", moduleId, `ESP-Modul ${moduleId} gelöscht`);

    res.json({
      ok: true,
      module: moduleId,
      clearedElements: affectedElements.size,
      disabledRules
    });
  }));

  router.get("/api/module/next-command", (req, res) => {
    const moduleId = cleanText(req.query?.module || "GLEIS_01", 48) || "GLEIS_01";

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
