"use strict";

const express = require("express");
const { wrap } = require("../utils/errors");

function createStatusRoutes({ runtimeState, moduleRegistry }) {
  const router = express.Router();

  router.get("/api/status", wrap(async (req, res) => {
    const modules = moduleRegistry.listModulesStatus();

    // Für Frontend-Kompatibilität zusätzlich als Objekt nach ID bereitstellen
    const modulesById = {};
    for (const m of modules) {
      modulesById[m.id] = {
        id: m.id,
        name: m.name,
        type: m.type,
        ip: m.ip,
        online: m.online,
        lastHeartbeat: Number(m.lastHeartbeat || 0),
        relays: Array.isArray(m.relays) ? m.relays : [],
        sensors: Array.isArray(m.sensors) ? m.sensors : [],
        leds: Array.isArray(m.leds) ? m.leds : []
      };
    }

    // In runtimeState spiegeln (wichtig für persistente/andere Routen)
    if (!runtimeState.hardware || typeof runtimeState.hardware !== "object") {
      runtimeState.hardware = {};
    }
    runtimeState.hardware.modules = modulesById;
    runtimeState.hardware.updatedAt = Date.now();

    const relayCount = modules.reduce((sum, m) => sum + (Array.isArray(m.relays) ? m.relays.length : 0), 0);
    const relayActive = modules.reduce(
      (sum, m) => sum + (Array.isArray(m.relays) ? m.relays.filter(Boolean).length : 0),
      0
    );

    res.json({
      ok: true,
      serverTime: Date.now(),
      moduleTimeoutMs: Number(process.env.MODULE_TIMEOUT || 10000),

      // beide Formen zurückgeben (Array + Objekt), damit alte/neue Frontendteile funktionieren
      modules,
      hardware: {
        ...(runtimeState.hardware || {}),
        modules: modulesById
      },

      summary: {
        modulesTotal: modules.length,
        modulesOnline: modules.filter((m) => m.online).length,
        relaysTotal: relayCount,
        relaysActive: relayActive
      },

      // optionale Frontend-Felder, falls vorhanden
      rules: runtimeState.rulesData?.rules || [],
      events: Array.isArray(runtimeState.events) ? runtimeState.events.slice(0, 100) : []
    });
  }));

  return router;
}

module.exports = { createStatusRoutes };