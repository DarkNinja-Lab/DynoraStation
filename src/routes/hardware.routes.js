"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");
const { cleanText, validRelay, validLedChannel } = require("../utils/sanitize");
const { defaultLightButtons } = require("../domain/defaults");
const { normalizeLightButtons } = require("../domain/hardware/normalizeHardware");

function createHardwareRoutes({
  runtimeState,
  queueWriteHardware,
  addEvent,
  upsertLed
}) {
  const router = express.Router();

  router.get("/api/hardware", (req, res) => {
    res.json({ ok: true, hardware: runtimeState.hardware });
  });

  router.post("/api/hardware/relay-config", wrap(async (req, res) => {
    const channel = validRelay(req.body?.channel);
    const moduleId = cleanText(req.body?.module || "GLEIS_01", 48) || "GLEIS_01";

    if (!channel) throw apiError(400, "BAD_RELAY_CHANNEL", "Ungültiger Relay-Kanal");

    const relay = runtimeState.hardware.relays.find(
      (r) => r.module === moduleId && Number(r.channel) === Number(channel)
    );
    if (!relay) throw apiError(404, "RELAY_NOT_FOUND", "Relay nicht gefunden");

    relay.name = cleanText(req.body?.name || relay.name || `Relais ${channel}`, 64) || `Relais ${channel}`;
    relay.role = cleanText(req.body?.role || "", 64);

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    addEvent("HARDWARE", relay.id, `${moduleId} Relay ${channel} konfiguriert`);
    res.json({ ok: true, relay });
  }));

  router.post("/api/hardware/led-config", wrap(async (req, res) => {
    const channel = validLedChannel(req.body?.channel);
    const moduleId = cleanText(req.body?.module || "LEDMOD_01", 48) || "LEDMOD_01";
    if (!channel) throw apiError(400, "BAD_LED_CHANNEL", "Ungültiger LED-Kanal");

    upsertLed(runtimeState.hardware, moduleId, channel, {
      name: cleanText(req.body?.name || `LED ${channel}`, 64) || `LED ${channel}`,
      color: cleanText(req.body?.color || "rot", 20) || "rot"
    });

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    const led = runtimeState.hardware.leds.find((l) => l.module === moduleId && l.channel === channel);
    addEvent("LED", `${moduleId}:LED_${channel}`, `LED ${channel} konfiguriert`);
    res.json({ ok: true, led });
  }));

  router.post("/api/hardware/sensor-rename", wrap(async (req, res) => {
    const id = cleanText(req.body?.id || "", 48);
    const moduleId = cleanText(req.body?.module || "GLEIS_01", 48) || "GLEIS_01";
    const name = cleanText(req.body?.name || "", 64);

    if (!id) throw apiError(400, "BAD_SENSOR_ID", "Sensor-ID fehlt");
    if (!name) throw apiError(400, "BAD_SENSOR_NAME", "Sensor-Name fehlt");

    const sensor = runtimeState.hardware.sensors.find((s) => s.module === moduleId && s.id === id);
    if (!sensor) throw apiError(404, "SENSOR_NOT_FOUND", "Sensor nicht gefunden");

    sensor.name = name;
    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    addEvent("HARDWARE", `${moduleId}:${id}`, `Sensor umbenannt: ${name}`);
    res.json({ ok: true, sensor });
  }));

  router.get("/api/light-buttons", (req, res) => {
    if (!Array.isArray(runtimeState.hardware.lightButtons)) {
      runtimeState.hardware.lightButtons = defaultLightButtons();
      queueWriteHardware();
    }
    res.json({ ok: true, lightButtons: runtimeState.hardware.lightButtons });
  });

  router.post("/api/light-buttons", wrap(async (req, res) => {
    const list = req.body?.lightButtons;
    if (!Array.isArray(list) || list.length !== 4) {
      throw apiError(400, "BAD_LIGHT_BUTTONS", "lightButtons muss ein Array mit 4 Einträgen sein");
    }

    runtimeState.hardware.lightButtons = normalizeLightButtons(list);
    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    addEvent("HARDWARE", "LIGHT_BUTTONS", "Licht-Button-Konfiguration gespeichert");
    res.json({ ok: true, lightButtons: runtimeState.hardware.lightButtons });
  }));

  return router;
}

module.exports = { createHardwareRoutes };