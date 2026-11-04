"use strict";

const { toInt, toNumber } = require("../../utils/parse");
const { cleanText, makeId, validRelay, validLedChannel } = require("../../utils/sanitize");
const { defaultRules } = require("../defaults");
const { RULE_LIMITS, normalizeRuleKind } = require("./ruleSchema");

function normalizeRuleCondition(input) {
  const c = input && typeof input === "object" ? input : {};
  const kind = normalizeRuleKind(c.kind, "sensor", true);

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

  const kind = normalizeRuleKind(a.kind, "switch");

  return {
    kind,
    elementId: cleanText(a.elementId || "", 80),
    module: cleanText(a.module || (kind === "led" ? "LEDMOD_01" : "GLEIS_01"), 48) || (kind === "led" ? "LEDMOD_01" : "GLEIS_01"),
    channel: kind === "led" ? validLedChannel(a.channel) : validRelay(a.channel),
    state: String(a.state || (kind === "switch" || kind === "xtrack" ? "abzweig" : "on")).trim().toLowerCase()
  };
}

function normalizeRuleSteps(input, legacyActions) {
  const source = Array.isArray(input)
    ? input
    : [{ type: "actions", actions: Array.isArray(legacyActions) ? legacyActions : [] }];

  return source.slice(0, RULE_LIMITS.steps).flatMap((step) => {
    const type = String(step?.type || step?.kind || "actions").trim().toLowerCase();
    if (["delay", "wait", "timer"].includes(type)) {
      return [{
        type: "delay",
        durationMs: Math.max(0, Math.min(RULE_LIMITS.durationMs, Math.round(toNumber(step?.durationMs ?? step?.delayMs ?? step?.ms, 0))))
      }];
    }

    const actions = (Array.isArray(step?.actions) ? step.actions : [])
      .map(normalizeRuleAction)
      .slice(0, RULE_LIMITS.actionsPerStep);
    return actions.length ? [{ type: "actions", actions }] : [];
  });
}

function normalizeRules(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = defaultRules();
  out.version = 2;
  out.updatedAt = toNumber(src.updatedAt, 0);

  const ruleIds = new Set();
  out.rules = (Array.isArray(src.rules) ? src.rules : [])
    .map((r, i) => {
      const steps = normalizeRuleSteps(r?.steps, r?.actions);
      return {
        id: cleanText(r?.id || makeId("RULE"), 120) || `RULE_${i + 1}`,
        groupId: cleanText(r?.groupId || r?.id || makeId("AUTO"), 120),
        // groupName was added after the original rules format. Keeping it empty
        // for legacy rules lets the UI use their old name as the automation name.
        groupName: cleanText(r?.groupName || "", 120),
        name: cleanText(r?.name || `Regel ${i + 1}`, 120) || `Regel ${i + 1}`,
        enabled: r?.enabled !== false,
        cooldownMs: Math.max(0, Math.min(RULE_LIMITS.durationMs, toInt(r?.cooldownMs, 5000))),
        lastRun: toNumber(r?.lastRun, 0),
        condition: normalizeRuleCondition(r?.condition),
        steps,
        // Retain the flat form for older integrations and module cleanup.
        actions: steps.flatMap((step) => step.type === "actions" ? step.actions : []).slice(0, RULE_LIMITS.legacyActions)
      };
    })
    .filter((r) => {
      if (!r.id || !r.actions.length || ruleIds.has(r.id)) return false;
      ruleIds.add(r.id);
      return true;
    });

  return out;
}

module.exports = {
  normalizeRules,
  normalizeRuleAction,
  normalizeRuleCondition,
  normalizeRuleSteps
};
