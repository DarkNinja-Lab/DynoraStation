"use strict";

const { validRelay, validLedChannel } = require("../../utils/sanitize");
const { executeRulesForTrigger } = require("../rules/executeRulesForTrigger");

function createConfirmedCommandApplier({
  runtimeState,
  moduleRegistry,
  commandQueueApi,
  upsertRelay,
  upsertLed,
  updateElementsPowerByRelay,
  queueWriteHardware,
  queueWriteLayout,
  queueWriteRules,
  addEvent
}) {
  function operationIsConfirmed(operationId) {
    if (!operationId) return true;
    const related = commandQueueApi.getCommandResults(500).filter((item) => item.data?.operationId === operationId);
    return related.length > 0 && related.every((item) => item.status === "confirmed");
  }

  function applyElementLogicalState(command) {
    const elementId = String(command?.data?.elementId || "");
    if (!elementId || !operationIsConfirmed(command.data?.operationId)) return false;
    const element = runtimeState.layout?.elemente?.find((item) => item.id === elementId);
    if (!element) return false;
    const state = command.data?.logicalState ?? command.data?.state;
    if (element.typ === "switch" && ["gerade", "abzweig"].includes(state)) element.switchState = state;
    else if (element.typ === "xtrack" && ["gerade", "abzweig"].includes(state)) element.xState = state;
    else if (element.typ === "signal" && ["halt", "fahrt"].includes(state)) element.signalState = state;
    else if (element.typ === "ledSignal" && ["halt", "warnung", "fahrt"].includes(state)) {
      element.ledState = state;
      element.powerState = true;
    } else return false;
    return true;
  }

  function confirmedTrigger(command) {
    if (!command?.data?.triggerOnConfirm) return null;
    const kind = String(command.data.triggerKind || "");
    const elementId = String(command.data.elementId || "");
    const logicalState = command.data.logicalState ?? command.data.state;
    if (kind === "relay") return { kind, module: command.module, channel: Number(command.data.channel), state: Boolean(command.data.state) ? "on" : "off" };
    if (kind === "led") {
      const state = command.type === "LED_PWM" ? Number(command.data.brightness) > 0 : Boolean(command.data.state);
      return { kind, module: command.module, channel: Number(command.data.channel), state: state ? "on" : "off" };
    }
    if (["switch", "signal", "xtrack", "ledsignal"].includes(kind) && elementId) {
      return { kind, elementId, state: logicalState };
    }
    return null;
  }

  async function apply(command) {
    if (!command) return;
    const moduleId = command.module;
    const module = moduleRegistry.getOrCreateModule(moduleId);
    let hardwareChanged = false;
    let layoutChanged = false;

    if (command.type === "RELAY_SET") {
      const channel = validRelay(command.data?.channel);
      if (channel) {
        const state = Boolean(command.data?.state);
        upsertRelay(runtimeState.hardware, moduleId, channel, state);
        while (module.relays.length < channel) module.relays.push(false);
        module.relays[channel - 1] = state;
        updateElementsPowerByRelay(runtimeState.layout, moduleId, channel, state);
        (runtimeState.hardware.lightButtons || []).forEach((button) => {
          if ((button.moduleId || button.module) === moduleId && Number(button.relayIndex ?? button.relay) === channel) button.active = state;
        });
        hardwareChanged = true;
        layoutChanged = true;
      }
    } else if (command.type === "RELAY_PULSE") {
      layoutChanged = applyElementLogicalState(command) || layoutChanged;
    } else if (["LED_SET", "LED_PWM", "LED_BLINK"].includes(command.type)) {
      const channel = validLedChannel(command.data?.channel);
      if (channel) {
        let state = Boolean(command.data?.state);
        let brightness = state ? 255 : 0;
        let blinking = false;
        if (command.type === "LED_PWM") {
          brightness = Math.max(0, Math.min(255, Number(command.data?.brightness) || 0));
          state = brightness > 0;
        } else if (command.type === "LED_BLINK") {
          state = true;
          brightness = 255;
          blinking = true;
        }
        upsertLed(runtimeState.hardware, moduleId, channel, { state, brightness, blinking });
        while (module.leds.length < channel) module.leds.push({ state: false, brightness: 0, blinking: false });
        module.leds[channel - 1] = { state, brightness, blinking };
        hardwareChanged = true;
      }
      layoutChanged = applyElementLogicalState(command) || layoutChanged;
    } else if (command.type === "NOT_AUS") {
      (runtimeState.hardware.relays || []).filter((item) => item.module === moduleId).forEach((item) => { item.state = false; });
      (runtimeState.hardware.leds || []).filter((item) => item.module === moduleId).forEach((item) => {
        item.state = false;
        item.brightness = 0;
        item.blinking = false;
      });
      if (Array.isArray(module.relays)) module.relays = module.relays.map(() => false);
      if (Array.isArray(module.leds)) module.leds = module.leds.map(() => ({ state: false, brightness: 0, blinking: false }));
      (runtimeState.layout.elemente || []).filter((item) => item.module === moduleId).forEach((item) => { item.powerState = false; });
      (runtimeState.layout.stromkreise || []).filter((item) => item.module === moduleId).forEach((item) => { item.state = false; });
      (runtimeState.hardware.lightButtons || []).forEach((button) => {
        if ((button.moduleId || button.module) === moduleId) button.active = false;
      });
      hardwareChanged = true;
      layoutChanged = true;
    }

    if (hardwareChanged) {
      runtimeState.hardware.updatedAt = Date.now();
      await queueWriteHardware();
    }
    if (layoutChanged) await queueWriteLayout();

    const trigger = confirmedTrigger(command);
    if (trigger && operationIsConfirmed(command.data?.operationId)) {
      executeRulesForTrigger({
        runtimeState, moduleRegistry, commandQueueApi, addEvent, queueWriteRules, trigger
      });
    }
    addEvent("COMMAND", `${moduleId}:${command.type}`, `Befehl #${command.id} vom ESP bestätigt`);
  }

  return { apply };
}

module.exports = { createConfirmedCommandApplier };
