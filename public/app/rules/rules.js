"use strict";

import { API, state } from "../core/state.js";
import { api } from "../core/api.js";

export function normalizeRuleClient(r) {
  const src = r && typeof r === "object" ? r : {};
  return {
    id: String(src.id || `RULE_${Date.now()}`),
    name: String(src.name || "Regel"),
    enabled: src.enabled !== false,
    cooldownMs: Math.max(0, Number(src.cooldownMs || 500)),
    lastRun: Number(src.lastRun || 0),
    condition: {
      kind: src.condition?.kind === "switch" ? "switch" : "sensor",
      module: String(src.condition?.module || "GLEIS_01"),
      sensorId: String(src.condition?.sensorId || ""),
      elementId: String(src.condition?.elementId || ""),
      state: ["abzweig", "gerade", "fahrt", "halt"].includes(String(src.condition?.state || "")) ? String(src.condition.state) : "triggered",
      triggered: src.condition?.triggered !== false
    },
    actions: (Array.isArray(src.actions) ? src.actions : []).slice(0, 10)
  };
}

export async function rulesLaden() {
  try {
    const out = await api(API.RULES_URL, { method: "GET", cache: "no-store" });
    state.rulesCache = Array.isArray(out.rules) ? out.rules.map(normalizeRuleClient) : [];
  } catch {
    state.rulesCache = [];
  }
}