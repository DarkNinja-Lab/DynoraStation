"use strict";

const RULE_LIMITS = Object.freeze({
  steps: 32,
  actionsPerStep: 24,
  legacyActions: 96,
  durationMs: 86400000
});

const CONDITION_KINDS = new Set(["sensor", "switch", "signal", "xtrack", "ledsignal", "relay", "led"]);
const ACTION_KINDS = new Set(["switch", "signal", "relay", "led", "xtrack", "ledsignal"]);

function normalizeRuleKind(value, fallback, condition = false) {
  const raw = String(value || fallback).trim().toLowerCase();
  const kind = { crossing: "xtrack", espsignal: "ledsignal" }[raw] || raw;
  return (condition ? CONDITION_KINDS : ACTION_KINDS).has(kind) ? kind : fallback;
}

function executionSteps(rule) {
  if (Array.isArray(rule?.steps) && rule.steps.length) return rule.steps;
  return [{ type: "actions", actions: Array.isArray(rule?.actions) ? rule.actions : [] }];
}

function hasActions(steps) {
  return steps.some((step) => step?.type === "actions" && Array.isArray(step.actions) && step.actions.length > 0);
}

module.exports = { RULE_LIMITS, normalizeRuleKind, executionSteps, hasActions };
