"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");
const { cleanText, validRelay, validLedChannel, validBrightness } = require("../utils/sanitize");
const { parseState, toInt } = require("../utils/parse");
const { executeRulesForTrigger } = require("../domain/rules/executeRulesForTrigger");

function createControlRoutes({
  runtimeState,
  queueWriteHardware,
  queueWriteLayout,
  moduleRegistry,
  commandQueueApi,
  addEvent,
  upsertRelay,
  upsertLed,
  updateElementsPowerByRelay,
  syncAllElementStatesFromRelaysAndLeds,
  queueWriteRules
}) {
  const router = express.Router();

  function findElement(id) {
    return runtimeState.layout.elemente.find((e) => e.id === id) || null;
  }

  router.post("/api/relay", wrap(async (req, res) => {
    const channel = validRelay(req.body?.channel);
    const moduleId = cleanText(req.body?.module || "GLEIS_01", 48) || "GLEIS_01";

    if (!channel) throw apiError(400, "BAD_RELAY_CHANNEL", "Relaiskanal muss zwischen 1 und 256 liegen");

    const state = parseState(req.body?.state);
    const m = moduleRegistry.getOrCreateModule(moduleId);

    upsertRelay(runtimeState.hardware, moduleId, channel, state);
    while (m.relays.length < channel) m.relays.push(false);
    m.relays[channel - 1] = state;

    updateElementsPowerByRelay(runtimeState.layout, moduleId, channel, state);

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    const cmd = commandQueueApi.createCommand("RELAY_SET", { channel, state }, moduleId);
    addEvent("RELAIS", `${moduleId}:RELAY_${channel}`, `Relais ${channel} ${state ? "ein" : "aus"}`);

    res.json({ ok: true, befehl: cmd, module: moduleId, relays: m.relays });
  }));

  router.post("/api/led", wrap(async (req, res) => {
    const channel = validLedChannel(req.body?.channel);
    const moduleId = cleanText(req.body?.module || "LEDMOD_01", 48) || "LEDMOD_01";
    if (!channel) throw apiError(400, "BAD_LED_CHANNEL", "LED-Kanal muss zwischen 1 und 256 liegen");

    const mode = cleanText(req.body?.mode || "set", 20).toLowerCase();
    const m = moduleRegistry.getOrCreateModule(moduleId);

    let cmd;

    if (mode === "pwm") {
      const brightness = validBrightness(req.body?.brightness);
      const state = brightness > 0;
      upsertLed(runtimeState.hardware, moduleId, channel, { state, brightness, blinking: false });

      while (m.leds.length < channel) m.leds.push({ state: false, brightness: 0, blinking: false });
      m.leds[channel - 1] = { state, brightness, blinking: false };

      cmd = commandQueueApi.createCommand("LED_PWM", { channel, brightness }, moduleId);
      addEvent("LED", `${moduleId}:LED_${channel}`, `LED ${channel} Helligkeit ${brightness}`);
    } else if (mode === "blink") {
      const onMs = Math.max(20, toInt(req.body?.onMs, 300));
      const offMs = Math.max(20, toInt(req.body?.offMs, 300));
      const durationMs = Math.max(0, toInt(req.body?.durationMs, 0));

      upsertLed(runtimeState.hardware, moduleId, channel, { state: true, brightness: 255, blinking: true });

      while (m.leds.length < channel) m.leds.push({ state: false, brightness: 0, blinking: false });
      m.leds[channel - 1] = { state: true, brightness: 255, blinking: true };

      cmd = commandQueueApi.createCommand("LED_BLINK", { channel, onMs, offMs, durationMs }, moduleId);
      addEvent("LED", `${moduleId}:LED_${channel}`, `LED ${channel} blinkt (${onMs}/${offMs} ms)`);
    } else {
      const state = parseState(req.body?.state);
      upsertLed(runtimeState.hardware, moduleId, channel, { state, brightness: state ? 255 : 0, blinking: false });

      while (m.leds.length < channel) m.leds.push({ state: false, brightness: 0, blinking: false });
      m.leds[channel - 1] = { state, brightness: state ? 255 : 0, blinking: false };

      cmd = commandQueueApi.createCommand("LED_SET", { channel, state }, moduleId);
      addEvent("LED", `${moduleId}:LED_${channel}`, `LED ${channel} ${state ? "ein" : "aus"}`);
    }

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    res.json({
      ok: true,
      module: moduleId,
      channel,
      befehl: cmd,
      led: runtimeState.hardware.leds.find((l) => l.module === moduleId && l.channel === channel) || null
    });
  }));

  router.post("/api/switch/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || element.typ !== "switch") throw apiError(404, "SWITCH_NOT_FOUND", "Weiche nicht gefunden");

    const state = req.body?.state === "abzweig" ? "abzweig" : "gerade";
    const channel = state === "gerade" ? validRelay(element.relayStraight) : validRelay(element.relayBranch);
    if (!channel) throw apiError(400, "SWITCH_NO_RELAY", "Für diese Weichenstellung ist kein Relay zugewiesen");

    const moduleId = cleanText(element.module || "GLEIS_01", 48) || "GLEIS_01";
    moduleRegistry.getOrCreateModule(moduleId);

    element.switchState = state;
    queueWriteLayout();

    const cmd = commandQueueApi.createCommand("RELAY_PULSE", { channel, duration: 220, state, elementId: element.id }, moduleId);
    addEvent("WEICHE", `${moduleId}:${element.id}`, `${element.name || element.id} auf ${state}`);

    const automations = executeRulesForTrigger({
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
      trigger: {
        kind: "switch",
        elementId: element.id,
        state
      }
    });

    res.json({ ok: true, state, befehl: cmd, module: moduleId, automations });
  }));

  router.post("/api/signal/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || element.typ !== "signal") throw apiError(404, "SIGNAL_NOT_FOUND", "Signal nicht gefunden");

    const state = req.body?.state === "fahrt" ? "fahrt" : "halt";
    const channel = state === "halt" ? validRelay(element.relayHp0) : validRelay(element.relayHp1);
    if (!channel) throw apiError(400, "SIGNAL_NO_RELAY", `Für Signalzustand ${state} ist kein Relay zugewiesen`);

    const moduleId = cleanText(element.module || "GLEIS_01", 48) || "GLEIS_01";
    moduleRegistry.getOrCreateModule(moduleId);

    element.signalState = state;
    queueWriteLayout();

    const cmd = commandQueueApi.createCommand("RELAY_PULSE", { channel, duration: 220, state, elementId: element.id }, moduleId);
    addEvent("SIGNAL", `${moduleId}:${element.id}`, `${element.name || element.id} auf ${state.toUpperCase()}`);

    const automations = executeRulesForTrigger({
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
      trigger: {
        kind: "switch",
        elementId: element.id,
        state
      }
    });

    res.json({ ok: true, state, befehl: cmd, module: moduleId, automations });
  }));

  router.post("/api/track/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || !["track", "curve", "transformer"].includes(element.typ)) {
      throw apiError(404, "TRACK_NOT_FOUND", "Gleiselement nicht gefunden");
    }

    const state = parseState(req.body?.state);
    const moduleId = cleanText(element.module || "GLEIS_01", 48) || "GLEIS_01";
    const m = moduleRegistry.getOrCreateModule(moduleId);

    if (validRelay(element.relay) <= 0) throw apiError(400, "TRACK_NO_RELAY", "Diesem Element ist kein Relay zugewiesen");
    const channel = validRelay(element.relay);

    upsertRelay(runtimeState.hardware, moduleId, channel, state);
    while (m.relays.length < channel) m.relays.push(false);
    m.relays[channel - 1] = state;

    updateElementsPowerByRelay(runtimeState.layout, moduleId, channel, state);

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    const cmd = commandQueueApi.createCommand("RELAY_SET", { channel, state, elementId: element.id }, moduleId);
    addEvent("GLEIS", `${moduleId}:${element.id}`, `${element.name || element.id} ${state ? "aktiv" : "inaktiv"}`);

    res.json({ ok: true, state, befehl: cmd, module: moduleId });
  }));

  router.post("/api/emergency-stop", wrap(async (req, res) => {
    runtimeState.hardware.relays.forEach((r) => { r.state = false; });
    runtimeState.hardware.leds.forEach((l) => { l.state = false; l.brightness = 0; l.blinking = false; });

    runtimeState.layout.elemente.forEach((e) => { e.powerState = false; });
    runtimeState.layout.stromkreise.forEach((s) => { s.state = false; });

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();
    queueWriteLayout();

    Object.keys(runtimeState.modules).forEach((moduleId) => commandQueueApi.createCommand("NOT_AUS", {}, moduleId));

    syncAllElementStatesFromRelaysAndLeds(runtimeState.layout, runtimeState.hardware);
    addEvent("NOT-AUS", "SYSTEM", "Alle Relais/LEDs ausgeschaltet");

    res.json({ ok: true });
  }));

  return router;
}

module.exports = { createControlRoutes };