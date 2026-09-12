"use strict";

const { parseState } = require("../../utils/parse");
const { cleanText, validRelay, validLedChannel } = require("../../utils/sanitize");
const { conditionMatches } = require("./conditionMatches");

function executeRulesForTrigger({
  runtimeState,
  moduleRegistry,
  commandQueueApi,
  addEvent,
  upsertRelay,
  upsertLed,
  updateElementsPowerByRelay,
  queueWriteHardware,
  queueWriteLayout,
  queueWriteRules,
  trigger
}) {
  const rules = Array.isArray(runtimeState?.rulesData?.rules) ? runtimeState.rulesData.rules : [];
  if (!rules.length || !trigger) return { matched: 0, executed: 0 };

  const now = Date.now();
  let matched = 0;
  let executed = 0;
  let hardwareChanged = false;
  let layoutChanged = false;
  let rulesChanged = false;

  function emit(type, key, message) {
    if (typeof addEvent === "function") addEvent(type, key, message);
  }

  function getRuleName(rule) {
    return String(rule?.name || rule?.id || "Regel");
  }

  function applyAction(rule, action) {
    const kind = String(action?.kind || "").toLowerCase();

    if (kind === "relay") {
      const channel = validRelay(action?.channel);
      if (!channel) return false;

      const moduleId = cleanText(action?.module || "", 48);
      if (!moduleId) return false;
      const state = parseState(action?.state);
      const module = moduleRegistry.getOrCreateModule(moduleId);

      upsertRelay(runtimeState.hardware, moduleId, channel, state);
      while (module.relays.length < channel) module.relays.push(false);
      module.relays[channel - 1] = state;
      updateElementsPowerByRelay(runtimeState.layout, moduleId, channel, state);

      commandQueueApi.createCommand("RELAY_SET", { channel, state, ruleId: rule.id }, moduleId);
      emit("REGEL-AKTION", `${moduleId}:RELAY_${channel}`, `${getRuleName(rule)}: Relais ${channel} ${state ? "ein" : "aus"}`);

      hardwareChanged = true;
      return true;
    }

    if (kind === "led") {
      const channel = validLedChannel(action?.channel);
      if (!channel) return false;

      const moduleId = cleanText(action?.module || "", 48);
      if (!moduleId) return false;
      const state = parseState(action?.state);
      const module = moduleRegistry.getOrCreateModule(moduleId);

      upsertLed(runtimeState.hardware, moduleId, channel, { state, brightness: state ? 255 : 0, blinking: false });
      while (module.leds.length < channel) module.leds.push({ state: false, brightness: 0, blinking: false });
      module.leds[channel - 1] = { state, brightness: state ? 255 : 0, blinking: false };

      commandQueueApi.createCommand("LED_SET", { channel, state, ruleId: rule.id }, moduleId);
      emit("REGEL-AKTION", `${moduleId}:LED_${channel}`, `${getRuleName(rule)}: LED ${channel} ${state ? "ein" : "aus"}`);

      hardwareChanged = true;
      return true;
    }

    if (kind === "switch") {
      const elementId = String(action?.elementId || "");
      const element = runtimeState.layout.elemente.find((e) => e.id === elementId && e.typ === "switch");
      if (!element) return false;

      const state = action?.state === "gerade" ? "gerade" : "abzweig";
      const channel = state === "gerade" ? validRelay(element.relayStraight) : validRelay(element.relayBranch);
      if (!channel) return false;

      const moduleId = cleanText(element.module || "", 48);
      if (!moduleId) return false;
      moduleRegistry.getOrCreateModule(moduleId);

      element.switchState = state;
      commandQueueApi.createCommand("RELAY_PULSE", { channel, duration: 220, state, elementId: element.id, ruleId: rule.id }, moduleId);
      emit("REGEL-AKTION", `${moduleId}:${element.id}`, `${getRuleName(rule)}: ${element.name || element.id} auf ${state}`);

      layoutChanged = true;
      return true;
    }

    if (kind === "signal") {
      const elementId = String(action?.elementId || "");
      const element = runtimeState.layout.elemente.find((e) => e.id === elementId && e.typ === "signal");
      if (!element) return false;

      const state = action?.state === "fahrt" ? "fahrt" : "halt";
      const channel = state === "halt" ? validRelay(element.relayHp0) : validRelay(element.relayHp1);
      if (!channel) return false;

      const moduleId = cleanText(element.module || "", 48);
      if (!moduleId) return false;
      moduleRegistry.getOrCreateModule(moduleId);

      element.signalState = state;
      commandQueueApi.createCommand("RELAY_PULSE", { channel, duration: 220, state, elementId: element.id, ruleId: rule.id }, moduleId);
      emit("REGEL-AKTION", `${moduleId}:${element.id}`, `${getRuleName(rule)}: ${element.name || element.id} auf ${state.toUpperCase()}`);

      layoutChanged = true;
      return true;
    }

    if (kind === "xtrack") {
      const elementId = String(action?.elementId || "");
      const element = runtimeState.layout.elemente.find((e) => e.id === elementId && e.typ === "xtrack");
      if (!element) return false;

      const state = action?.state === "gerade" ? "gerade" : "abzweig";
      const channel = state === "gerade" ? validRelay(element.relayA) : validRelay(element.relayB);
      if (!channel) return false;

      const moduleId = cleanText(element.module || "", 48);
      if (!moduleId) return false;
      moduleRegistry.getOrCreateModule(moduleId);

      element.xState = state;
      commandQueueApi.createCommand("RELAY_PULSE", { channel, duration: 220, state, elementId: element.id, ruleId: rule.id }, moduleId);
      emit("REGEL-AKTION", `${moduleId}:${element.id}`, `${getRuleName(rule)}: ${element.name || element.id} auf ${state}`);

      layoutChanged = true;
      return true;
    }

    if (kind === "ledsignal") {
      const elementId = String(action?.elementId || "");
      const element = runtimeState.layout.elemente.find((e) => e.id === elementId && e.typ === "ledSignal");
      if (!element) return false;
      const state = ["halt", "warnung", "fahrt"].includes(action?.state) ? action.state : "halt";
      const moduleId = cleanText(element.module || "", 48);
      if (!moduleId) return false;
      const channels = {
        halt: validLedChannel(element.ledChannelRed),
        warnung: validLedChannel(element.ledChannelYellow),
        fahrt: validLedChannel(element.ledChannelGreen)
      };
      if (!channels[state]) return false;
      const module = moduleRegistry.getOrCreateModule(moduleId);
      for (const [aspect, channel] of Object.entries(channels)) {
        if (!channel) continue;
        const on = aspect === state;
        upsertLed(runtimeState.hardware, moduleId, channel, { state: on, brightness: on ? 255 : 0, blinking: false });
        while (module.leds.length < channel) module.leds.push({ state: false, brightness: 0, blinking: false });
        module.leds[channel - 1] = { state: on, brightness: on ? 255 : 0, blinking: false };
        commandQueueApi.createCommand("LED_SET", { channel, state: on, elementId, ruleId: rule.id }, moduleId);
      }
      element.ledState = state;
      element.powerState = true;
      hardwareChanged = true;
      layoutChanged = true;
      emit("REGEL-AKTION", `${moduleId}:${element.id}`, `${getRuleName(rule)}: ${element.name || element.id} auf ${state}`);
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

  if (hardwareChanged) {
    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();
  }

  if (layoutChanged) {
    queueWriteLayout();
  }

  if (rulesChanged) {
    runtimeState.rulesData.updatedAt = Date.now();
    queueWriteRules();
  }

  return { matched, executed };
}

module.exports = { executeRulesForTrigger };
