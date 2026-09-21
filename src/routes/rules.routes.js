"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");
const { normalizeRules } = require("../domain/rules/normalizeRules");

function createRulesRoutes({ runtimeState, queueWriteRules, addEvent }) {
  const router = express.Router();

  router.get("/api/rules", (req, res) => {
    res.json({ ok: true, rules: runtimeState.rulesData.rules });
  });

  router.post("/api/rules", wrap(async (req, res) => {
    const list = req.body?.rules;
    if (!Array.isArray(list)) throw apiError(400, "BAD_RULES", "rules muss ein Array sein");

    runtimeState.rulesData = normalizeRules({
      version: 1,
      updatedAt: Date.now(),
      rules: list
    });

    runtimeState.rulesData.updatedAt = Date.now();
    await queueWriteRules();

    addEvent("RULE", "SYSTEM", "Regeln gespeichert");
    res.json({ ok: true, rules: runtimeState.rulesData.rules });
  }));

  return router;
}

module.exports = { createRulesRoutes };
