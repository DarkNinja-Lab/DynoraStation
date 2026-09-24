"use strict";

const express = require("express");
const { wrap } = require("../utils/errors");
const { findRelayConflicts } = require("../domain/hardware/relayConflicts");

function createStatusRoutes({ runtimeState, moduleRegistry, commandQueueApi, env, connectionInfo }) {
  const router = express.Router();

  router.get("/api/status", wrap(async (req, res) => {
    res.set("Cache-Control", "no-store");
    const layoutRevision = Number(runtimeState.revisions?.layout || 1);
    const eventRevision = Number(runtimeState.revisions?.events || 1);
    const layoutChanged = Number(req.query?.layoutRevision || 0) !== layoutRevision;
    const eventsChanged = Number(req.query?.eventRevision || 0) !== eventRevision;
    const modules = moduleRegistry.listModulesStatus();

    const modulesById = {};
    for (const m of modules) {
      modulesById[m.id] = {
        id: m.id,
        name: m.name,
        customName: Boolean(m.customName),
        type: m.type,
        kind: m.kind,
        capabilities: Array.isArray(m.capabilities) ? m.capabilities : [],
        ip: m.ip,
        online: m.online,
        lastHeartbeat: Number(m.lastHeartbeat || 0),
        firmwareVersion: m.firmwareVersion || "",
        protocolVersion: Number(m.protocolVersion) || 0,
        hardwareType: m.hardwareType || "",
        compatibility: m.compatibility,
        health: m.health,
        relays: Array.isArray(m.relays) ? m.relays : [],
        sensors: Array.isArray(m.sensors) ? m.sensors : [],
        leds: Array.isArray(m.leds) ? m.leds : [],
        environment: m.environment && typeof m.environment === "object" ? m.environment : null
      };
    }

    if (!runtimeState.hardware || typeof runtimeState.hardware !== "object") runtimeState.hardware = {};
    runtimeState.hardware.modules = modulesById;

    const relayCount = modules.reduce((sum, m) => sum + (Array.isArray(m.relays) ? m.relays.length : 0), 0);
    const relayActive = modules.reduce(
      (sum, m) => sum + (Array.isArray(m.relays) ? m.relays.filter(Boolean).length : 0),
      0
    );
    const relayConflicts = findRelayConflicts(runtimeState.layout);

    res.json({
      ok: true,
      serverTime: Date.now(),
      serverVersion: env.APP_VERSION,
      protocolVersion: env.PROTOCOL_VERSION,
      systemProfile: { manufacturer: "Märklin", trackSystem: "M-Gleis", scale: "H0" },
      moduleTimeoutMs: env.MODULE_TIMEOUT,
      uiStatusIntervalMs: env.UI_STATUS_INTERVAL_MS,
      revisions: { layout: layoutRevision, events: eventRevision },
      connection: connectionInfo,
      modules,
      hardware: {
        ...(runtimeState.hardware || {}),
        modules: modulesById
      },
      commands: commandQueueApi.getCommandResults(250),
      warnings: { relayConflicts },
      summary: {
        modulesTotal: modules.length,
        modulesOnline: modules.filter((m) => m.online).length,
        modulesCompatible: modules.filter((m) => m.compatibility?.compatible).length,
        relaysTotal: relayCount,
        relaysActive: relayActive,
        relayConflicts: relayConflicts.length
      },
      layout: layoutChanged ? runtimeState.layout : null,
      lightButtons: runtimeState.hardware?.lightButtons || [],
      defaults: runtimeState.hardware?.defaults || [],
      ledConfig: runtimeState.hardware?.ledConfig || {},
      rules: runtimeState.rulesData?.rules || [],
      events: eventsChanged && Array.isArray(runtimeState.events) ? runtimeState.events.slice(0, 100) : null
    });
  }));

  return router;
}

module.exports = { createStatusRoutes };
