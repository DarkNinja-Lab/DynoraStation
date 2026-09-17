"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");
const { normalizeLayout } = require("../domain/layout/normalizeLayout");
const { validateLayoutPayload } = require("../domain/layout/validateLayoutPayload");

function createLayoutRoutes({ runtimeState, queueWriteLayout, addEvent }) {
  const router = express.Router();

  router.get("/api/layout", (req, res) => {
    res.json(runtimeState.layout);
  });

  router.post("/api/layout", wrap(async (req, res) => {
    const err = validateLayoutPayload(req.body);
    if (err) throw apiError(400, "BAD_LAYOUT", err);

    runtimeState.layout = normalizeLayout(req.body);
    await queueWriteLayout();

    addEvent("LAYOUT", "SERVER", "Layout gespeichert");
    res.json({ ok: true, layout: runtimeState.layout });
  }));

  return router;
}

module.exports = { createLayoutRoutes };
