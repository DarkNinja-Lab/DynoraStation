"use strict";

const express = require("express");
const { apiError } = require("../utils/errors");

function createDebugRoutes({ runtimeState, enableDebugEndpoints, moduleRegistry, commandQueueApi }) {
  const router = express.Router();

  if (enableDebugEndpoints) {
    router.get("/api/debug/commands", (req, res) => {
      commandQueueApi.cleanupCommandQueue();
      res.json({ commands: runtimeState.commandQueue });
    });

    router.get("/api/debug/hardware", (req, res) => {
      res.json({
        hardware: runtimeState.hardware,
        modules: moduleRegistry.listModulesStatus(),
        rules: runtimeState.rulesData.rules
      });
    });
  } else {
    router.get("/api/debug/commands", (req, res, next) => {
      next(apiError(404, "DEBUG_DISABLED", "Debug-Endpunkte sind deaktiviert"));
    });
    router.get("/api/debug/hardware", (req, res, next) => {
      next(apiError(404, "DEBUG_DISABLED", "Debug-Endpunkte sind deaktiviert"));
    });
  }

  return router;
}

module.exports = { createDebugRoutes };