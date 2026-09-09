"use strict";

const express = require("express");
const path = require("path");

const env = require("../config/env");
const { runtimeState } = require("../state/runtimeState");

const { loadLayout, loadHardware, loadRules } = require("../services/storage/files");
const {
  queueWriteLayout: makeQueueWriteLayout,
  queueWriteHardware: makeQueueWriteHardware,
  queueWriteRules: makeQueueWriteRules
} = require("../services/storage/queuedWriter");
const { addEventFactory } = require("../services/events/eventBus");
const { createCommandQueue } = require("../services/commandQueue/commandQueue");
const { createModuleRegistry } = require("../services/modules/moduleRegistry");

const { rateLimitFactory } = require("./middleware/rateLimit");
const { errorHandler } = require("./middleware/errorHandler");

const { createRoutes } = require("../routes");
const { upsertRelay, upsertLed, upsertSensor } = require("../domain/hardware/relayLedSensorOps");
const {
  updateElementsPowerByRelay,
  syncAllElementStatesFromRelaysAndLeds
} = require("../domain/hardware/syncStates");

function createApp() {
  const app = express();

  runtimeState.layout = loadLayout(runtimeState.paths);
  runtimeState.hardware = loadHardware(runtimeState.paths);
  runtimeState.rulesData = loadRules(runtimeState.paths);

  const addEvent = addEventFactory(runtimeState, env.MAX_EVENTS);
  const queueWriteLayout = () => makeQueueWriteLayout(runtimeState, addEvent);
  const queueWriteHardware = () => makeQueueWriteHardware(runtimeState, addEvent);
  const queueWriteRules = () => makeQueueWriteRules(runtimeState, addEvent);

  const commandQueueApi = createCommandQueue({
    runtimeState,
    maxCommands: env.MAX_COMMANDS,
    commandMaxAgeMs: env.COMMAND_MAX_AGE_MS,
    commandMaxAttempts: env.COMMAND_MAX_ATTEMPTS,
    addEvent
  });

  const moduleRegistry = createModuleRegistry({
    runtimeState,
    moduleTimeout: env.MODULE_TIMEOUT
  });

  moduleRegistry.bootstrapModulesFromHardware(runtimeState.hardware);

  app.set("trust proxy", env.TRUST_PROXY);
  app.use(express.json({ limit: env.JSON_LIMIT }));
  app.use(express.urlencoded({ extended: false }));

  if (env.ENABLE_SECURITY_HEADERS) {
    app.use((req, res, next) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
      res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
      next();
    });
  }

  if (env.CORS_ENABLED) {
    app.use((req, res, next) => {
      const origin = String(req.headers.origin || "");
      if (!origin) return next();

      const allowed =
        env.CORS_ALLOWED_ORIGINS.includes("*") ||
        env.CORS_ALLOWED_ORIGINS.includes(origin);

      if (!allowed) {
        return next(require("../utils/errors").apiError(403, "CORS_FORBIDDEN", "Origin nicht erlaubt"));
      }

      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      if (req.method === "OPTIONS") return res.status(204).end();
      next();
    });
  }

  const rateLimit = rateLimitFactory(runtimeState.rateBuckets);

  app.use(rateLimit({
    keyPrefix: "global",
    windowMs: env.RL_GLOBAL_WINDOW_MS,
    max: env.RL_GLOBAL_MAX
  }));

  app.use("/api/module", rateLimit({
    keyPrefix: "module",
    windowMs: env.RL_MODULE_WINDOW_MS,
    max: env.RL_MODULE_MAX
  }));

  app.use(express.static(path.join(process.cwd(), "public")));

  app.get("/", (req, res) => {
    res.sendFile(path.join(process.cwd(), "public", "index.html"));
  });

  app.get("/favicon.ico", (req, res) => {
    res.status(204).end();
  });

  const deps = {
    env,
    runtimeState,
    addEvent,
    queueWriteLayout,
    queueWriteHardware,
    queueWriteRules,
    commandQueueApi,
    moduleRegistry,
    upsertRelay,
    upsertLed,
    upsertSensor,
    updateElementsPowerByRelay,
    syncAllElementStatesFromRelaysAndLeds,
    enableDebugEndpoints: env.ENABLE_DEBUG_ENDPOINTS
  };

  app.use(createRoutes(deps));
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };