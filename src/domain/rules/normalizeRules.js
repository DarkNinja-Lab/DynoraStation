"use strict";

const { toInt, toNumber } = require("../../utils/parse");
const { cleanText, makeId, validRelay, validLedChannel } = require("../../utils/sanitize");
const { defaultRules } = require("../defaults");

function normalizeRuleCondition(input) {
  const c = input && typeof input === "object" ? input : {};
  let kind = String(c.kind || "sensor").trim().toLowerCase();
  if (kind === "crossing") kind = "xtrack";
  if (kind === "espsignal") kind = "ledsignal";
  if (!["sensor", "switch", "signal", "xtrack", "ledsignal", "relay", "led"].includes(kind)) kind = "sensor";

  return {
    kind,
    module: cleanText(c.module || "", 48),
    sensorId: cleanText(c.sensorId || "", 48),
    channel: kind === "led" ? validLedChannel(c.channel) : validRelay(c.channel),
    elementId: cleanText(c.elementId || "", 80),
    state: cleanText(c.state || (kind === "sensor" ? "triggered" : ""), 24).toLowerCase(),
    triggered: c.triggered !== false
  };
}

function normalizeRuleAction(input) {
  const a = input && typeof input === "object" ? input : {};

  let kind = String(a.kind || "switch").trim().toLowerCase();
  if (kind === "crossing") kind = "xtrack";
  if (kind === "espsignal") kind = "ledsignal";
  if (!["switch", "signal", "relay", "led", "xtrack", "ledsignal"].includes(kind)) kind = "switch";

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
      cooldownMs: Math.max(0, Math.min(86400000, toInt(r?.cooldownMs, 5000))),
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
