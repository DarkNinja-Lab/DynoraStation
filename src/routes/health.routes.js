"use strict";

const express = require("express");

function createHealthRoutes({ runtimeState, moduleRegistry }) {
  const router = express.Router();

  router.get("/healthz", (req, res) => {
    res.json({
      ok: true,
      serverTime: Date.now(),
      uptimeSec: Math.round(process.uptime()),
      modulesOnline: Object.values(runtimeState.modules).filter((m) => moduleRegistry.moduleIsOnline(m)).length,
      queueLength: runtimeState.commandQueue.length,
      writeErrors: {
        layout: runtimeState.writeState.layout.lastError,
        hardware: runtimeState.writeState.hardware.lastError,
        rules: runtimeState.writeState.rules.lastError
      }
    });
  });

  return router;
}

module.exports = { createHealthRoutes };