"use strict";

const { toInt, toNumber } = require("../../utils/parse");
const { cleanText, makeId, validRelay, validLedChannel } = require("../../utils/sanitize");
const { defaultRules } = require("../defaults");

function normalizeRuleCondition(input) {
  const c = input && typeof input === "object" ? input : {};
  const kind = c.kind === "switch" ? "switch" : "sensor";

  return {
    kind,
    module: cleanText(c.module || "GLEIS_01", 48) || "GLEIS_01",
    sensorId: cleanText(c.sensorId || "", 48),
    elementId: cleanText(c.elementId || "", 80),
    state: c.state === "abzweig" || c.state === "gerade" || c.state === "fahrt" || c.state === "halt" ? c.state : "triggered",
    triggered: c.triggered !== false
  };
}

function normalizeRuleAction(input) {
  const a = input && typeof input === "object" ? input : {};

  let kind = String(a.kind || "switch").trim().toLowerCase();
  if (kind === "crossing") kind = "xtrack";
  if (!["switch", "signal", "relay", "led", "xtrack"].includes(kind)) kind = "switch";

  return {
    kind,
    elementId: cleanText(a.elementId || "", 80),
    module: cleanText(a.module || (kind === "led" ? "LEDMOD_01" : "GLEIS_01"), 48) || (kind === "led" ? "LEDMOD_01" : "GLEIS_01"),
    channel: kind === "led" ? validLedChannel(a.channel) : validRelay(a.channel),
    state: String(a.state || (kind === "switch" || kind === "xtrack" ? "abzweig" : "on")).trim().toLowerCase()
  };
}

function normalizeRules(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = defaultRules();
  out.version = 1;
  out.updatedAt = toNumber(src.updatedAt, 0);

  out.rules = (Array.isArray(src.rules) ? src.rules : [])
    .map((r, i) => ({
      id: cleanText(r?.id || makeId("RULE"), 120) || `RULE_${i + 1}`,
      name: cleanText(r?.name || `Regel ${i + 1}`, 120) || `Regel ${i + 1}`,
      enabled: r?.enabled !== false,
      cooldownMs: Math.max(0, toInt(r?.cooldownMs, 500)),
      lastRun: toNumber(r?.lastRun, 0),
      condition: normalizeRuleCondition(r?.condition),
      actions: (Array.isArray(r?.actions) ? r.actions : []).map(normalizeRuleAction).slice(0, 10)
    }))
    .filter((r) => r.id && r.actions.length > 0);

  return out;
}

module.exports = {
  normalizeRules,
  normalizeRuleAction,
  normalizeRuleCondition
};