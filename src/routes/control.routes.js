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

  function elementModule(element) {
    return cleanText(element?.module || "", 48);
  }

  function configuredLedBrightness(moduleId, channel) {
    return validBrightness(runtimeState.hardware?.ledConfig?.[`${moduleId}:${channel}`]?.brightness ?? 255);
  }

  router.post("/api/control/settings", wrap(async (req, res) => {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (Array.isArray(body.lightButtons)) {
      const { normalizeLightButtons } = require("../domain/hardware/normalizeHardware");
      runtimeState.hardware.lightButtons = normalizeLightButtons(body.lightButtons);
    }

    if (body.relayConfig && typeof body.relayConfig === "object") {
      for (const [key, cfg] of Object.entries(body.relayConfig)) {
        const split = String(key).lastIndexOf(":");
        if (split <= 0) continue;
        const moduleId = cleanText(String(key).slice(0, split), 48);
        const channelText = String(key).slice(split + 1);
        const channel = validRelay(channelText);
        if (!moduleId || !channel || !cfg || typeof cfg !== "object") continue;
        const relay = runtimeState.hardware.relays.find(
          (r) => r.module === moduleId && Number(r.channel) === channel
        );
        if (relay) {
          relay.name = cleanText(cfg.name || relay.name, 64) || relay.name;
          relay.role = cleanText(cfg.role || "", 64);
        }
      }
    }

    if (Array.isArray(body.defaults)) {
      runtimeState.hardware.defaults = body.defaults.slice(0, 100).map((x) => ({
        targetType: cleanText(x?.targetType || "", 32),
        targetId: cleanText(x?.targetId || "", 80),
        action: cleanText(x?.action || "", 32)
      }));
    }

    if (body.ledConfig && typeof body.ledConfig === "object") {
      const nextLedConfig = {};
      for (const [key, cfg] of Object.entries(body.ledConfig)) {
        const split = String(key).lastIndexOf(":");
        if (split <= 0 || !cfg || typeof cfg !== "object") continue;
        const moduleId = cleanText(String(key).slice(0, split), 48);
        const channel = validLedChannel(String(key).slice(split + 1));
        if (!moduleId || !channel) continue;
        const safe = {
          name: cleanText(cfg.name || `LED ${channel}`, 64) || `LED ${channel}`,
          color: cleanText(cfg.color || "weiss", 20) || "weiss",
          brightness: validBrightness(cfg.brightness ?? 255)
        };
        nextLedConfig[`${moduleId}:${channel}`] = safe;
        const led = runtimeState.hardware.leds.find(
          (item) => item.module === moduleId && Number(item.channel) === channel
        );
        if (led) {
          led.name = safe.name;
          led.color = safe.color;
        }
      }
      runtimeState.hardware.ledConfig = nextLedConfig;
    }

    if (body.sensorConfig && typeof body.sensorConfig === "object") {
      for (const [key, cfg] of Object.entries(body.sensorConfig)) {
        const split = String(key).lastIndexOf(":");
        if (split <= 0 || !cfg || typeof cfg !== "object") continue;
        const moduleId = cleanText(String(key).slice(0, split), 48);
        const sensorId = cleanText(String(key).slice(split + 1), 48);
        const sensor = runtimeState.hardware.sensors.find(
          (x) => x.module === moduleId && x.id === sensorId
        );
        if (sensor && cfg.name) {
          sensor.name = cleanText(cfg.name, 64) || sensor.name;
          const live = runtimeState.modules?.[moduleId]?.sensors?.find((item) => item.id === sensorId);
          if (live) live.name = sensor.name;
        }
      }
    }

    runtimeState.hardware.updatedAt = Date.now();
    await queueWriteHardware();
    addEvent("HARDWARE", "SETTINGS", "Einstellungen gespeichert");
    res.json({ ok: true, hardware: runtimeState.hardware });
  }));

  router.post("/api/control/defaults/apply", wrap(async (req, res) => {
    const defaults = Array.isArray(req.body?.defaults) ? req.body.defaults : [];
    const applied = [];

    for (const item of defaults.slice(0, 100)) {
      const type = String(item?.targetType || "").trim().toLowerCase();
      const targetId = String(item?.targetId || "").trim();
      const action = String(item?.action || "").trim().toLowerCase();

      if (!targetId || !action) continue;

      if (type === "relay") {
        const match = targetId.match(/^([^:]+):(\\d+)$/);
        if (!match) continue;
        const moduleId = cleanText(match[1], 48) || "GLEIS_01";
        const channel = validRelay(match[2]);
        if (!channel) continue;
        const on = ["on", "ein", "1", "true"].includes(action);
        const m = moduleRegistry.getOrCreateModule(moduleId);
        upsertRelay(runtimeState.hardware, moduleId, channel, on);
        while (m.relays.length < channel) m.relays.push(false);
        m.relays[channel - 1] = on;
        updateElementsPowerByRelay(runtimeState.layout, moduleId, channel, on);
        commandQueueApi.createCommand("RELAY_SET", { channel, state: on }, moduleId);
        applied.push(item);
        continue;
      }

      const element = findElement(targetId);
      if (type === "switch" && element?.typ === "switch") {
        const next = action === "gerade" || action === "straight" ? "gerade" : "abzweig";
        const channel = validRelay(next === "gerade" ? element.relayStraight : element.relayBranch);
        if (!channel) continue;
        const moduleId = elementModule(element);
        if (!moduleId) continue;
        element.switchState = next;
        commandQueueApi.createCommand("RELAY_PULSE", { channel, duration: 220, state: next, elementId: element.id }, moduleId);
        applied.push(item);
      } else if (type === "signal" && element?.typ === "signal") {
        const next = action === "fahrt" || action === "green" ? "fahrt" : "halt";
        const channel = validRelay(next === "halt" ? element.relayHp0 : element.relayHp1);
        if (!channel) continue;
        const moduleId = elementModule(element);
        if (!moduleId) continue;
        element.signalState = next;
        commandQueueApi.createCommand("RELAY_PULSE", { channel, duration: 220, state: next, elementId: element.id }, moduleId);
        applied.push(item);
      } else if ((type === "crossing" || type === "xtrack") && element?.typ === "xtrack") {
        const next = action === "gerade" || action === "straight" ? "gerade" : "abzweig";
        const channel = validRelay(next === "gerade" ? element.relayA : element.relayB);
        if (!channel) continue;
        const moduleId = elementModule(element);
        if (!moduleId) continue;
        element.xState = next;
        commandQueueApi.createCommand("RELAY_PULSE", { channel, duration: 220, state: next, elementId: element.id }, moduleId);
        applied.push(item);
      } else if ((type === "espsignal" || type === "ledsignal") && element?.typ === "ledSignal") {
        const next = ["halt", "warnung", "fahrt"].includes(action) ? action : "halt";
        const moduleId = elementModule(element);
        if (!moduleId) continue;
        const module = moduleRegistry.getOrCreateModule(moduleId);
        const channels = {
          halt: validLedChannel(element.ledChannelRed),
          warnung: validLedChannel(element.ledChannelYellow),
          fahrt: validLedChannel(element.ledChannelGreen)
        };
        if (!channels[next]) continue;
        for (const [aspect, ledChannel] of Object.entries(channels)) {
          if (!ledChannel) continue;
          const on = aspect === next;
          const brightness = on ? configuredLedBrightness(moduleId, ledChannel) : 0;
          upsertLed(runtimeState.hardware, moduleId, ledChannel, { state: brightness > 0, brightness, blinking: false });
          while (module.leds.length < ledChannel) module.leds.push({ state: false, brightness: 0, blinking: false });
          module.leds[ledChannel - 1] = { state: brightness > 0, brightness, blinking: false };
          commandQueueApi.createCommand("LED_PWM", { channel: ledChannel, brightness, elementId: element.id }, moduleId);
        }
        element.ledState = next;
        applied.push(item);
      }
    }

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();
    queueWriteLayout();
    addEvent("DEFAULTS", "SYSTEM", `${applied.length} Standardzustände angewendet`);
    res.json({ ok: true, applied });
  }));

  const relayControlHandler = wrap(async (req, res) => {
    const channel = validRelay(req.body?.channel ?? req.body?.relayIndex);
    const moduleId = cleanText(req.body?.module || req.body?.moduleId || "", 48);

    if (!channel) throw apiError(400, "BAD_RELAY_CHANNEL", "Relaiskanal muss zwischen 1 und 256 liegen");
    if (!moduleId) throw apiError(400, "MODULE_REQUIRED", "ESP-Modul fehlt");

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

    const automations = executeRulesForTrigger({
      runtimeState, moduleRegistry, commandQueueApi, addEvent, upsertRelay, upsertLed,
      updateElementsPowerByRelay, queueWriteHardware, queueWriteLayout, queueWriteRules,
      trigger: { kind: "relay", module: moduleId, channel, state: state ? "on" : "off" }
    });

    res.json({ ok: true, befehl: cmd, module: moduleId, relays: m.relays, automations });
  });

  // Beide Routen unterstützen: alte API und die konsistente /control/*-API.
  router.post("/api/relay", relayControlHandler);
  router.post("/api/control/relay", relayControlHandler);

  router.post("/api/led", wrap(async (req, res) => {
    const channel = validLedChannel(req.body?.channel);
    const moduleId = cleanText(req.body?.module || "", 48);
    if (!channel) throw apiError(400, "BAD_LED_CHANNEL", "LED-Kanal muss zwischen 1 und 256 liegen");
    if (!moduleId) throw apiError(400, "MODULE_REQUIRED", "ESP-Modul fehlt");

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

    const led = runtimeState.hardware.leds.find((l) => l.module === moduleId && l.channel === channel) || null;
    const automations = executeRulesForTrigger({
      runtimeState, moduleRegistry, commandQueueApi, addEvent, upsertRelay, upsertLed,
      updateElementsPowerByRelay, queueWriteHardware, queueWriteLayout, queueWriteRules,
      trigger: { kind: "led", module: moduleId, channel, state: led?.state ? "on" : "off" }
    });

    res.json({
      ok: true,
      module: moduleId,
      channel,
      befehl: cmd,
      led,
      automations
    });
  }));

  router.post("/api/switch/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || element.typ !== "switch") throw apiError(404, "SWITCH_NOT_FOUND", "Weiche nicht gefunden");

    const state = req.body?.state === "abzweig" ? "abzweig" : "gerade";
    const channel = state === "gerade" ? validRelay(element.relayStraight) : validRelay(element.relayBranch);
    if (!channel) throw apiError(400, "SWITCH_NO_RELAY", "Für diese Weichenstellung ist kein Relay zugewiesen");

    const moduleId = elementModule(element);
    if (!moduleId) throw apiError(400, "SWITCH_NO_MODULE", "Der Weiche ist kein ESP-Modul zugewiesen");
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

    const moduleId = elementModule(element);
    if (!moduleId) throw apiError(400, "SIGNAL_NO_MODULE", "Dem Signal ist kein ESP-Modul zugewiesen");
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
        kind: "signal",
        elementId: element.id,
        state
      }
    });

    res.json({ ok: true, state, befehl: cmd, module: moduleId, automations });
  }));

  router.post("/api/xtrack/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || element.typ !== "xtrack") throw apiError(404, "XTRACK_NOT_FOUND", "Kreuzungsweiche nicht gefunden");
    const state = req.body?.state === "abzweig" ? "abzweig" : "gerade";
    const channel = validRelay(state === "gerade" ? element.relayA : element.relayB);
    if (!channel) throw apiError(400, "XTRACK_NO_RELAY", "Für diese Stellung ist kein Relay zugewiesen");
    const moduleId = elementModule(element);
    if (!moduleId) throw apiError(400, "XTRACK_NO_MODULE", "Der Kreuzungsweiche ist kein ESP-Modul zugewiesen");
    moduleRegistry.getOrCreateModule(moduleId);
    element.xState = state;
    queueWriteLayout();
    const cmd = commandQueueApi.createCommand("RELAY_PULSE", { channel, duration: 220, state, elementId: element.id }, moduleId);
    addEvent("KREUZUNGSWEICHE", `${moduleId}:${element.id}`, `${element.name || element.id} auf ${state}`);
    const automations = executeRulesForTrigger({
      runtimeState, moduleRegistry, commandQueueApi, addEvent, upsertRelay, upsertLed,
      updateElementsPowerByRelay, queueWriteHardware, queueWriteLayout, queueWriteRules,
      trigger: { kind: "xtrack", elementId: element.id, state }
    });
    res.json({ ok: true, state, befehl: cmd, module: moduleId, automations });
  }));

  router.post("/api/esp-signal/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || element.typ !== "ledSignal") throw apiError(404, "ESP_SIGNAL_NOT_FOUND", "ESP-Signal nicht gefunden");
    const aspectMode = element.signalAspectMode === "rgy" ? "rgy" : "rg";
    const allowedStates = aspectMode === "rgy" ? ["halt", "warnung", "fahrt"] : ["halt", "fahrt"];
    const requestedState = cleanText(req.body?.state || "halt", 20).toLowerCase();
    if (!allowedStates.includes(requestedState)) {
      throw apiError(400, "ESP_SIGNAL_BAD_STATE", `Zustand ${requestedState || "unbekannt"} ist für den ${aspectMode === "rgy" ? "3-begriffigen" : "2-begriffigen"} Signalmast nicht verfügbar`);
    }
    const state = requestedState;
    const moduleId = elementModule(element);
    if (!moduleId) throw apiError(400, "ESP_SIGNAL_NO_MODULE", "Dem ESP-Signal ist kein ESP-Modul zugewiesen");
    const channels = {
      halt: validLedChannel(element.ledChannelRed),
      ...(aspectMode === "rgy" ? { warnung: validLedChannel(element.ledChannelYellow) } : {}),
      fahrt: validLedChannel(element.ledChannelGreen)
    };
    if (!channels[state]) throw apiError(400, "ESP_SIGNAL_NO_LED", `Für ${state} ist kein LED-Kanal zugewiesen`);
    const module = moduleRegistry.getOrCreateModule(moduleId);
    const commands = [];
    for (const [aspect, channel] of Object.entries(channels)) {
      if (!channel) continue;
      const on = aspect === state;
      const brightness = on ? configuredLedBrightness(moduleId, channel) : 0;
      upsertLed(runtimeState.hardware, moduleId, channel, { state: brightness > 0, brightness, blinking: false });
      while (module.leds.length < channel) module.leds.push({ state: false, brightness: 0, blinking: false });
      module.leds[channel - 1] = { state: brightness > 0, brightness, blinking: false };
      commands.push(commandQueueApi.createCommand("LED_PWM", { channel, brightness, elementId: element.id }, moduleId));
    }
    element.ledState = state;
    element.powerState = true;
    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();
    queueWriteLayout();
    addEvent("ESP-SIGNAL", `${moduleId}:${element.id}`, `${element.name || element.id} auf ${state}`);
    const automations = executeRulesForTrigger({
      runtimeState, moduleRegistry, commandQueueApi, addEvent, upsertRelay, upsertLed,
      updateElementsPowerByRelay, queueWriteHardware, queueWriteLayout, queueWriteRules,
      trigger: { kind: "ledsignal", elementId: element.id, state }
    });
    res.json({ ok: true, state, befehle: commands, module: moduleId, automations });
  }));

  router.post("/api/track/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || !["track", "curve", "transformer"].includes(element.typ)) {
      throw apiError(404, "TRACK_NOT_FOUND", "Gleiselement nicht gefunden");
    }

    const state = parseState(req.body?.state);
    const moduleId = elementModule(element);
    if (!moduleId) throw apiError(400, "TRACK_NO_MODULE", "Dem Gleis ist kein ESP-Modul zugewiesen");
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

    Object.values(runtimeState.modules).forEach((module) => {
      if (Array.isArray(module.relays)) module.relays = module.relays.map(() => false);
      if (Array.isArray(module.leds)) {
        module.leds = module.leds.map(() => ({ state: false, brightness: 0, blinking: false }));
      }
    });

    runtimeState.layout.elemente.forEach((e) => { e.powerState = false; });
    runtimeState.layout.stromkreise.forEach((s) => { s.state = false; });

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();
    queueWriteLayout();

    const moduleIds = new Set([
      ...Object.keys(runtimeState.modules || {}),
      ...Object.keys(runtimeState.hardware.modules || {}),
      ...runtimeState.hardware.relays.map((item) => item.module),
      ...runtimeState.hardware.leds.map((item) => item.module)
    ].filter(Boolean));
    moduleIds.forEach((moduleId) => commandQueueApi.createCommand("NOT_AUS", {}, moduleId));

    syncAllElementStatesFromRelaysAndLeds(runtimeState.layout, runtimeState.hardware);
    addEvent("NOT-AUS", "SYSTEM", "Alle Relais/LEDs ausgeschaltet");

    res.json({ ok: true, modules: moduleIds.size });
  }));

  return router;
}

module.exports = { createControlRoutes };
