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

const { TRACK_CATALOG } = require("../domain/trackCatalog");

function createRoutes(deps) {
  const router = express.Router();

  // Katalog-Endpoint
  router.get("/api/track-catalog", (req, res) => {
    res.set("Cache-Control", "no-store");
    const catalogItems = Object.entries(TRACK_CATALOG).map(([code, item]) => ({ code, ...item }));
    res.json({
      tracks: catalogItems.filter(t => t.kind === "track"),
      curves: catalogItems.filter(t => t.kind === "curve"),
      switches: catalogItems.filter(t => t.kind === "switch"),
      crossings: catalogItems.filter(t => t.kind === "xtrack"),
      bumpers: catalogItems.filter(t => t.kind === "bumper"),
      signals: [
        { id: "7039", label: "Hauptsignal 7039" }
      ],
      transformers: [
        { id: "6631", label: "Märklin Transformator 6631" }
      ],
      espSignals: [
        { id: "esp-signal-rg", label: "ESP-Signalmast Rot / Grün", signalAspectMode: "rg" },
        { id: "esp-signal-rgy", label: "ESP-Signalmast Rot / Gelb / Grün", signalAspectMode: "rgy" }
      ]
    });
  });

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
