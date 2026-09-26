"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");

function createStationRoutes({ stationControl, addEvent }) {
  const router = express.Router();

  router.get("/api/station", (req, res) => {
    const status = typeof stationControl?.status === "function"
      ? stationControl.status()
      : { state: "unavailable", managedBy: "unknown" };
    res.set("Cache-Control", "no-store");
    res.json({ ok: true, ...status });
  });

  function controlAction(action) {
    return wrap(async (req, res) => {
      if (String(req.headers["x-dynora-action"] || "") !== "station-control") {
        throw apiError(400, "STATION_CONFIRMATION_REQUIRED", "Stationsaktion wurde nicht bestätigt");
      }
      if (String(req.body?.confirm || "").toLowerCase() !== action) {
        throw apiError(400, "STATION_CONFIRMATION_REQUIRED", "Stationsaktion wurde nicht bestätigt");
      }
      const handler = stationControl?.[action];
      if (typeof handler !== "function") {
        throw apiError(503, "STATION_CONTROL_UNAVAILABLE", "Stationssteuerung ist noch nicht verfügbar");
      }

      addEvent("SYSTEM", "STATION", action === "restart"
        ? "Neustart der DynoraStation angefordert"
        : "Herunterfahren der DynoraStation angefordert");
      res.json({
        ok: true,
        action,
        message: action === "restart" ? "DynoraStation wird neu gestartet" : "DynoraStation wird beendet"
      });

      setTimeout(() => handler(`api:${action}`), 120);
    });
  }

  router.post("/api/station/restart", controlAction("restart"));
  router.post("/api/station/shutdown", controlAction("shutdown"));

  return router;
}

module.exports = { createStationRoutes };
