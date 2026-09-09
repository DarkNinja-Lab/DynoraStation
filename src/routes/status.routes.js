"use strict";

const express = require("express");
const { defaultLightButtons } = require("../domain/defaults");

function createStatusRoutes({
  runtimeState,
  moduleRegistry,
  commandQueueApi,
  syncAllElementStatesFromRelaysAndLeds
}) {
  const router = express.Router();

  router.get("/api/status", (req, res) => {
    Object.values(runtimeState.modules).forEach((m) => {
      m.online = moduleRegistry.moduleIsOnline(m);
    });

    syncAllElementStatesFromRelaysAndLeds(runtimeState.layout, runtimeState.hardware);
    commandQueueApi.cleanupCommandQueue();

    const moduleMap = {};
    Object.values(runtimeState.modules).forEach((m) => {
      moduleMap[m.id] = {
        id: m.id,
        name: m.name,
        online: m.online,
        ip: m.ip,
        lastHeartbeat: m.lastHeartbeat,
        relayCount: m.relays.length,
        sensorCount: m.sensors.length,
        ledCount: m.leds.length
      };
    });

    runtimeState.hardware.module = moduleMap;
    if (!Array.isArray(runtimeState.hardware.lightButtons)) {
      runtimeState.hardware.lightButtons = defaultLightButtons();
    }

    res.json({
      server: { online: true, ip: process.env.SERVER_IP || "127.0.0.1", port: Number(process.env.SERVER_PORT || 8181) },
      layout: runtimeState.layout,
      hardware: runtimeState.hardware,
      lightButtons: runtimeState.hardware.lightButtons,
      module: moduleRegistry.listModulesStatus(),
      moduleMap,
      rules: runtimeState.rulesData.rules,
      ereignisse: runtimeState.events,
      events: runtimeState.events
    });
  });

  router.get("/api/events", (req, res) => {
    res.json({ ereignisse: runtimeState.events, events: runtimeState.events });
  });

  return router;
}

module.exports = { createStatusRoutes };