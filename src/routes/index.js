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

const TRACK_CATALOG = {
  "5106": { kind: "track", label: "5106", length: 180 },
  "5107": { kind: "track", label: "5107", length: 90 },
  "5108": { kind: "track", label: "5108", length: 70 },
  "5109": { kind: "track", label: "5109", length: 45 },
  "5110": { kind: "track", label: "5110", length: 30 },
  "5129": { kind: "track", label: "5129", length: 22.5 },
  "5128": {
    kind: "xtrack",
    label: "5128 Kreuzungsgleis",
    length: 193,
    crossingAngleDeg: 30,
    hasLantern: true
  },
  "5100": { kind: "curve", label: "5100", radius: 110, angleDeg: 30 },
  "5101": { kind: "curve", label: "5101", radius: 110, angleDeg: 15 },
  "5120": { kind: "curve", label: "5120", radius: 150, angleDeg: 30 },
  "5202": { kind: "weiche", label: "5202 links", handed: "left" },
  "5203": { kind: "weiche", label: "5203 rechts", handed: "right" }
};

function createRoutes(deps) {
  const router = express.Router();

  // Katalog-Endpoint
  router.get("/api/track-catalog", (req, res) => {
    res.json({
      tracks: Object.values(TRACK_CATALOG).filter(t => t.kind === "track"),
      curves: Object.values(TRACK_CATALOG).filter(t => t.kind === "curve"),
      switches: Object.values(TRACK_CATALOG).filter(t => t.kind === "weiche"),
      crossings: Object.values(TRACK_CATALOG).filter(t => t.kind === "xtrack"),
      signals: [
        { id: "7039", label: "Hauptsignal 7039" }
      ],
      transformers: [
        { id: "trafo", label: "Transformator" }
      ],
      espSignals: [
        { id: "esp-signal", label: "ESP-Signalmast" }
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