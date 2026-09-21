"use strict";

const { parseState } = require("../../utils/parse");
const { cleanText, validRelay, validLedChannel } = require("../../utils/sanitize");
const { conditionMatches } = require("./conditionMatches");

function executeRulesForTrigger({
  runtimeState,
  moduleRegistry,
  commandQueueApi,
  addEvent,
  queueWriteRules,
  trigger
}) {
  const rules = Array.isArray(runtimeState?.rulesData?.rules) ? runtimeState.rulesData.rules : [];
  if (!rules.length || !trigger) return { matched: 0, executed: 0 };

  const now = Date.now();
  let matched = 0;
  let executed = 0;
  let rulesChanged = false;

  function emit(type, key, message) {
    if (typeof addEvent === "function") addEvent(type, key, message);
  }

  function getRuleName(rule) {
    return String(rule?.name || rule?.id || "Regel");
  }

  function operationId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function controllable(moduleId, rule) {
    const module = runtimeState.modules?.[moduleId] || moduleRegistry.getOrCreateModule(moduleId);
    if (moduleRegistry.moduleCanControl(module)) return true;
    const compatibility = moduleRegistry.moduleCompatibility(module);
    const reason = !moduleRegistry.moduleIsOnline(module) ? "offline" : compatibility.reason;
    emit("REGEL-WARNUNG", moduleId, `${getRuleName(rule)}: Aktion übersprungen (${reason})`);
    return false;
  }

  function applyAction(rule, action) {
    const kind = String(action?.kind || "").toLowerCase();

    if (kind === "relay") {
      const channel = validRelay(action?.channel);
      const moduleId = cleanText(action?.module || "", 48);
      if (!channel || !moduleId || !controllable(moduleId, rule)) return false;
      const state = parseState(action?.state);
      commandQueueApi.createCommand("RELAY_SET", {
        channel, state, ruleId: rule.id, operationId: operationId("RULE_RELAY")
      }, moduleId);
      emit("REGEL-AKTION", `${moduleId}:RELAY_${channel}`, `${getRuleName(rule)}: Relais ${channel} wird ${state ? "ein" : "aus"} geschaltet`);
      return true;
    }

    if (kind === "led") {
      const channel = validLedChannel(action?.channel);
      const moduleId = cleanText(action?.module || "", 48);
      if (!channel || !moduleId || !controllable(moduleId, rule)) return false;
      const state = parseState(action?.state);
      commandQueueApi.createCommand("LED_SET", {
        channel, state, ruleId: rule.id, operationId: operationId("RULE_LED")
      }, moduleId);
      emit("REGEL-AKTION", `${moduleId}:LED_${channel}`, `${getRuleName(rule)}: LED ${channel} wird ${state ? "ein" : "aus"} geschaltet`);
      return true;
    }

    if (["switch", "signal", "xtrack"].includes(kind)) {
      const elementId = String(action?.elementId || "");
      const expectedType = kind === "switch" ? "switch" : kind === "signal" ? "signal" : "xtrack";
      const element = runtimeState.layout.elemente.find((e) => e.id === elementId && e.typ === expectedType);
      if (!element) return false;
      const moduleId = cleanText(element.module || "", 48);
      if (!moduleId || !controllable(moduleId, rule)) return false;

      let state;
      let channel;
      if (kind === "switch") {
        state = action?.state === "gerade" ? "gerade" : "abzweig";
        channel = validRelay(state === "gerade" ? element.relayStraight : element.relayBranch);
      } else if (kind === "signal") {
        state = action?.state === "fahrt" ? "fahrt" : "halt";
        channel = validRelay(state === "halt" ? element.relayHp0 : element.relayHp1);
      } else {
        state = action?.state === "gerade" ? "gerade" : "abzweig";
        channel = validRelay(state === "gerade" ? element.relayA : element.relayB);
      }
      if (!channel) return false;
      commandQueueApi.createCommand("RELAY_PULSE", {
        channel, duration: 220, state, elementId: element.id, ruleId: rule.id,
        operationId: operationId(`RULE_${kind.toUpperCase()}`)
      }, moduleId);
      emit("REGEL-AKTION", `${moduleId}:${element.id}`, `${getRuleName(rule)}: ${element.name || element.id} wird auf ${state} geschaltet`);
      return true;
    }

    if (kind === "ledsignal") {
      const elementId = String(action?.elementId || "");
      const element = runtimeState.layout.elemente.find((e) => e.id === elementId && e.typ === "ledSignal");
      if (!element) return false;
      const state = ["halt", "warnung", "fahrt"].includes(action?.state) ? action.state : "halt";
      const moduleId = cleanText(element.module || "", 48);
      if (!moduleId || !controllable(moduleId, rule)) return false;
      const channels = {
        halt: validLedChannel(element.ledChannelRed),
        warnung: validLedChannel(element.ledChannelYellow),
        fahrt: validLedChannel(element.ledChannelGreen)
      };
      if (!channels[state]) return false;
      const opId = operationId("RULE_LED_SIGNAL");
      for (const [aspect, channel] of Object.entries(channels)) {
        if (!channel) continue;
        commandQueueApi.createCommand("LED_SET", {
          channel, state: aspect === state, logicalState: state, elementId, ruleId: rule.id, operationId: opId
        }, moduleId);
      }
      emit("REGEL-AKTION", `${moduleId}:${element.id}`, `${getRuleName(rule)}: ${element.name || element.id} wird auf ${state} geschaltet`);
      return true;
    }

    return false;
  }

  for (const rule of rules) {
    if (!rule || rule.enabled === false) continue;
    if (!conditionMatches(rule, trigger)) continue;
    matched += 1;

    const cooldownMs = Math.max(0, Number(rule.cooldownMs) || 0);
    const lastRun = Number(rule.lastRun) || 0;
    if (now - lastRun < cooldownMs) continue;

    let anyActionRan = false;
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    actions.forEach((action) => {
      if (applyAction(rule, action)) {
        executed += 1;
        anyActionRan = true;
      }
    });

    if (anyActionRan) {
      rule.lastRun = now;
      rulesChanged = true;
      emit("REGEL", rule.id || "RULE", `${getRuleName(rule)} ausgelöst`);
    }
  }

  if (rulesChanged) {
    runtimeState.rulesData.updatedAt = Date.now();
    queueWriteRules();
  }

  return { matched, executed };
}

module.exports = { executeRulesForTrigger };
