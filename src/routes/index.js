"use strict";

const express = require("express");
const { createHealthRoutes } = require("./health.routes");
const { createStatusRoutes } = require("./status.routes");
const { createLayoutRoutes } = require("./layout.routes");
const { createRulesRoutes } = require("./rules.routes");
const { createHardwareRoutes } = require("./hardware.routes");
const { createControlRoutes } = require("./control.routes");
const { createModuleRoutes } = require("./module.routes");
const { createDebugRoutes } = require("./debug.routes");
const { apiNotFound } = require("../app/middleware/notFound");

function createRoutes(deps) {
  const router = express.Router();

  router.use(createHealthRoutes(deps));
  router.use(createStatusRoutes(deps));
  router.use(createLayoutRoutes(deps));
  router.use(createRulesRoutes(deps));
  router.use(createHardwareRoutes(deps));
  router.use(createControlRoutes(deps));
  router.use(createModuleRoutes(deps));
  router.use(createDebugRoutes(deps));

  router.use("/api", apiNotFound);
  return router;
}

module.exports = { createRoutes };