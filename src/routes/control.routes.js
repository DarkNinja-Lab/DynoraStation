"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");
const { cleanText, validRelay, validLedChannel, validBrightness } = require("../utils/sanitize");
const { parseState, toInt } = require("../utils/parse");

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

  function currentRelayState(moduleId, channel, module) {
    const liveState = module?.relays?.[channel - 1];
    if (typeof liveState === "boolean") return liveState;
    const stored = runtimeState.hardware?.relays?.find(
      (relay) => relay.module === moduleId && Number(relay.channel) === channel
    );
    return Boolean(stored?.state);
  }

  function operationId(prefix = "CMD") {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function requireControllableModule(moduleId) {
    const module = runtimeState.modules?.[moduleId] || moduleRegistry.getOrCreateModule(moduleId);
    if (!moduleRegistry.moduleIsOnline(module)) {
      throw apiError(503, "MODULE_OFFLINE", `${module.name || moduleId} ist offline. Schalten wurde nicht ausgeführt.`);
    }
    const compatibility = moduleRegistry.moduleCompatibility(module);
    if (!compatibility.compatible) {
      throw apiError(409, "MODULE_INCOMPATIBLE", `${module.name || moduleId}: ${compatibility.reason}`);
    }
    if (module.health?.relayDriverReady === false) {
      throw apiError(503, "RELAY_DRIVER_OFFLINE", `${module.name || moduleId}: MCP23017 nicht erreichbar. SDA, SCL, 3V3, GND, RESET und Adresse 0x20 prüfen.`);
    }
    return module;
  }

  function ensureNoPending(moduleId, matcher, label = "Element") {
    const pending = runtimeState.commandQueue.find((command) => command.module === moduleId && matcher(command));
    if (pending) throw apiError(409, "COMMAND_PENDING", `${label} wird bereits geschaltet`);
  }

  function pendingResponse(cmd, extra = {}) {
    return { ok: true, commandStatus: "pending", befehl: cmd, ...extra };
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
    const commands = [];

    for (const item of defaults.slice(0, 100)) {
      const type = String(item?.targetType || "").trim().toLowerCase();
      const targetId = String(item?.targetId || "").trim();
      const action = String(item?.action || "").trim().toLowerCase();
      if (!targetId || !action) continue;

      if (type === "relay") {
        const match = targetId.match(/^([^:]+):(\d+)$/);
        if (!match) continue;
        const moduleId = cleanText(match[1], 48) || "GLEIS_01";
        const channel = validRelay(match[2]);
        if (!channel) continue;
        requireControllableModule(moduleId);
        const on = ["on", "ein", "1", "true"].includes(action);
        commands.push(commandQueueApi.createCommand("RELAY_SET", {
          channel, state: on, operationId: operationId("DEFAULT_RELAY")
        }, moduleId));
        applied.push(item);
        continue;
      }

      const element = findElement(targetId);
      if (type === "switch" && element?.typ === "switch") {
        const state = action === "gerade" || action === "straight" ? "gerade" : "abzweig";
        const channel = validRelay(state === "gerade" ? element.relayStraight : element.relayBranch);
        const moduleId = elementModule(element);
        if (!channel || !moduleId) continue;
        requireControllableModule(moduleId);
        commands.push(commandQueueApi.createCommand("RELAY_PULSE", {
          channel, duration: 220, state, elementId: element.id, operationId: operationId("DEFAULT_SWITCH")
        }, moduleId));
        applied.push(item);
      } else if (type === "signal" && element?.typ === "signal") {
        const state = action === "fahrt" || action === "green" ? "fahrt" : "halt";
        const channel = validRelay(state === "halt" ? element.relayHp0 : element.relayHp1);
        const moduleId = elementModule(element);
        if (!channel || !moduleId) continue;
        requireControllableModule(moduleId);
        commands.push(commandQueueApi.createCommand("RELAY_PULSE", {
          channel, duration: 220, state, elementId: element.id, operationId: operationId("DEFAULT_SIGNAL")
        }, moduleId));
        applied.push(item);
      } else if ((type === "crossing" || type === "xtrack") && element?.typ === "xtrack") {
        const state = action === "gerade" || action === "straight" ? "gerade" : "abzweig";
        const channel = validRelay(state === "gerade" ? element.relayA : element.relayB);
        const moduleId = elementModule(element);
        if (!channel || !moduleId) continue;
        requireControllableModule(moduleId);
        commands.push(commandQueueApi.createCommand("RELAY_PULSE", {
          channel, duration: 220, state, elementId: element.id, operationId: operationId("DEFAULT_XTRACK")
        }, moduleId));
        applied.push(item);
      } else if ((type === "espsignal" || type === "ledsignal") && element?.typ === "ledSignal") {
        const state = ["halt", "warnung", "fahrt"].includes(action) ? action : "halt";
        const moduleId = elementModule(element);
        if (!moduleId) continue;
        requireControllableModule(moduleId);
        const channels = {
          halt: validLedChannel(element.ledChannelRed),
          warnung: validLedChannel(element.ledChannelYellow),
          fahrt: validLedChannel(element.ledChannelGreen)
        };
        if (!channels[state]) continue;
        const opId = operationId("DEFAULT_LED_SIGNAL");
        for (const [aspect, channel] of Object.entries(channels)) {
          if (!channel) continue;
          const brightness = aspect === state ? configuredLedBrightness(moduleId, channel) : 0;
          commands.push(commandQueueApi.createCommand("LED_PWM", {
            channel, brightness, state, elementId: element.id, operationId: opId
          }, moduleId));
        }
        applied.push(item);
      }
    }

    addEvent("DEFAULTS", "SYSTEM", `${applied.length} Standardzustände zur Ausführung vorgemerkt`);
    res.json({ ok: true, applied, commands, commandStatus: commands.length ? "pending" : "none" });
  }));

  const relayControlHandler = wrap(async (req, res) => {
    const channel = validRelay(req.body?.channel ?? req.body?.relayIndex);
    const moduleId = cleanText(req.body?.module || req.body?.moduleId || "", 48);
    if (!channel) throw apiError(400, "BAD_RELAY_CHANNEL", "Relaiskanal muss zwischen 1 und 256 liegen");
    if (!moduleId) throw apiError(400, "MODULE_REQUIRED", "ESP-Modul fehlt");
    const module = requireControllableModule(moduleId);
    ensureNoPending(moduleId, (command) => command.type === "RELAY_SET" && Number(command.data?.channel) === channel, `Relais ${channel}`);

    const confirmedState = currentRelayState(moduleId, channel, module);
    const state = parseState(req.body?.state);
    const cmd = commandQueueApi.createCommand("RELAY_SET", {
      channel, state, operationId: operationId("RELAY"), triggerOnConfirm: true, triggerKind: "relay"
    }, moduleId);
    addEvent("RELAIS", `${moduleId}:RELAY_${channel}`, `Relais ${channel} wird ${state ? "ein" : "aus"} geschaltet`);
    res.json(pendingResponse(cmd, { module: moduleId, requestedState: state, state: confirmedState }));
  });

  router.post("/api/relay", relayControlHandler);
  router.post("/api/control/relay", relayControlHandler);

  router.post("/api/led", wrap(async (req, res) => {
    const channel = validLedChannel(req.body?.channel);
    const moduleId = cleanText(req.body?.module || "", 48);
    if (!channel) throw apiError(400, "BAD_LED_CHANNEL", "LED-Kanal muss zwischen 1 und 256 liegen");
    if (!moduleId) throw apiError(400, "MODULE_REQUIRED", "ESP-Modul fehlt");
    requireControllableModule(moduleId);
    ensureNoPending(moduleId, (command) => ["LED_SET", "LED_PWM", "LED_BLINK"].includes(command.type) && Number(command.data?.channel) === channel, `LED ${channel}`);

    const mode = cleanText(req.body?.mode || "set", 20).toLowerCase();
    const opId = operationId("LED");
    let cmd;
    let requested;
    if (mode === "pwm") {
      const brightness = validBrightness(req.body?.brightness);
      requested = { state: brightness > 0, brightness, blinking: false };
      cmd = commandQueueApi.createCommand("LED_PWM", { channel, brightness, operationId: opId, triggerOnConfirm: true, triggerKind: "led" }, moduleId);
    } else if (mode === "blink") {
      const onMs = Math.max(20, toInt(req.body?.onMs, 300));
      const offMs = Math.max(20, toInt(req.body?.offMs, 300));
      const durationMs = Math.max(0, toInt(req.body?.durationMs, 0));
      requested = { state: true, brightness: 255, blinking: true };
      cmd = commandQueueApi.createCommand("LED_BLINK", { channel, onMs, offMs, durationMs, operationId: opId }, moduleId);
    } else {
      const state = parseState(req.body?.state);
      requested = { state, brightness: state ? 255 : 0, blinking: false };
      cmd = commandQueueApi.createCommand("LED_SET", { channel, state, operationId: opId, triggerOnConfirm: true, triggerKind: "led" }, moduleId);
    }
    addEvent("LED", `${moduleId}:LED_${channel}`, `LED ${channel} wird geschaltet`);
    const led = runtimeState.hardware.leds.find((item) => item.module === moduleId && item.channel === channel) || null;
    res.json(pendingResponse(cmd, { module: moduleId, channel, requested, led }));
  }));

  router.post("/api/switch/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || element.typ !== "switch") throw apiError(404, "SWITCH_NOT_FOUND", "Weiche nicht gefunden");
    const state = req.body?.state === "abzweig" ? "abzweig" : "gerade";
    const channel = state === "gerade" ? validRelay(element.relayStraight) : validRelay(element.relayBranch);
    if (!channel) throw apiError(400, "SWITCH_NO_RELAY", "Für diese Weichenstellung ist kein Relay zugewiesen");
    const moduleId = elementModule(element);
    if (!moduleId) throw apiError(400, "SWITCH_NO_MODULE", "Der Weiche ist kein ESP-Modul zugewiesen");
    requireControllableModule(moduleId);
    ensureNoPending(moduleId, (command) => command.data?.elementId === element.id, element.name || "Weiche");
    const cmd = commandQueueApi.createCommand("RELAY_PULSE", {
      channel, duration: 220, state, elementId: element.id, operationId: operationId("SWITCH"), triggerOnConfirm: true, triggerKind: "switch"
    }, moduleId);
    addEvent("WEICHE", `${moduleId}:${element.id}`, `${element.name || element.id} wird auf ${state} geschaltet`);
    res.json(pendingResponse(cmd, { state: element.switchState, requestedState: state, module: moduleId }));
  }));

  router.post("/api/signal/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || element.typ !== "signal") throw apiError(404, "SIGNAL_NOT_FOUND", "Signal nicht gefunden");
    const state = req.body?.state === "fahrt" ? "fahrt" : "halt";
    const channel = state === "halt" ? validRelay(element.relayHp0) : validRelay(element.relayHp1);
    if (!channel) throw apiError(400, "SIGNAL_NO_RELAY", `Für Signalzustand ${state} ist kein Relay zugewiesen`);
    const moduleId = elementModule(element);
    if (!moduleId) throw apiError(400, "SIGNAL_NO_MODULE", "Dem Signal ist kein ESP-Modul zugewiesen");
    requireControllableModule(moduleId);
    ensureNoPending(moduleId, (command) => command.data?.elementId === element.id, element.name || "Signal");
    const cmd = commandQueueApi.createCommand("RELAY_PULSE", {
      channel, duration: 220, state, elementId: element.id, operationId: operationId("SIGNAL"), triggerOnConfirm: true, triggerKind: "signal"
    }, moduleId);
    addEvent("SIGNAL", `${moduleId}:${element.id}`, `${element.name || element.id} wird auf ${state.toUpperCase()} geschaltet`);
    res.json(pendingResponse(cmd, { state: element.signalState, requestedState: state, module: moduleId }));
  }));

  router.post("/api/xtrack/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || element.typ !== "xtrack") throw apiError(404, "XTRACK_NOT_FOUND", "Kreuzungsweiche nicht gefunden");
    const state = req.body?.state === "abzweig" ? "abzweig" : "gerade";
    const channel = validRelay(state === "gerade" ? element.relayA : element.relayB);
    if (!channel) throw apiError(400, "XTRACK_NO_RELAY", "Für diese Stellung ist kein Relay zugewiesen");
    const moduleId = elementModule(element);
    if (!moduleId) throw apiError(400, "XTRACK_NO_MODULE", "Der Kreuzungsweiche ist kein ESP-Modul zugewiesen");
    requireControllableModule(moduleId);
    ensureNoPending(moduleId, (command) => command.data?.elementId === element.id, element.name || "Kreuzungsweiche");
    const cmd = commandQueueApi.createCommand("RELAY_PULSE", {
      channel, duration: 220, state, elementId: element.id, operationId: operationId("XTRACK"), triggerOnConfirm: true, triggerKind: "xtrack"
    }, moduleId);
    addEvent("KREUZUNGSWEICHE", `${moduleId}:${element.id}`, `${element.name || element.id} wird auf ${state} geschaltet`);
    res.json(pendingResponse(cmd, { state: element.xState, requestedState: state, module: moduleId }));
  }));

  router.post("/api/esp-signal/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || element.typ !== "ledSignal") throw apiError(404, "ESP_SIGNAL_NOT_FOUND", "ESP-Signal nicht gefunden");
    const aspectMode = element.signalAspectMode === "rgy" ? "rgy" : "rg";
    const allowedStates = aspectMode === "rgy" ? ["halt", "warnung", "fahrt"] : ["halt", "fahrt"];
    const state = cleanText(req.body?.state || "halt", 20).toLowerCase();
    if (!allowedStates.includes(state)) throw apiError(400, "ESP_SIGNAL_BAD_STATE", `Zustand ${state || "unbekannt"} ist nicht verfügbar`);
    const moduleId = elementModule(element);
    if (!moduleId) throw apiError(400, "ESP_SIGNAL_NO_MODULE", "Dem ESP-Signal ist kein ESP-Modul zugewiesen");
    requireControllableModule(moduleId);
    ensureNoPending(moduleId, (command) => command.data?.elementId === element.id, element.name || "ESP-Signal");
    const channels = {
      halt: validLedChannel(element.ledChannelRed),
      ...(aspectMode === "rgy" ? { warnung: validLedChannel(element.ledChannelYellow) } : {}),
      fahrt: validLedChannel(element.ledChannelGreen)
    };
    if (!channels[state]) throw apiError(400, "ESP_SIGNAL_NO_LED", `Für ${state} ist kein LED-Kanal zugewiesen`);
    const opId = operationId("LED_SIGNAL");
    const entries = Object.entries(channels).filter(([, channel]) => Boolean(channel));
    const commands = entries.map(([aspect, channel], index) => commandQueueApi.createCommand("LED_PWM", {
      channel,
      brightness: aspect === state ? configuredLedBrightness(moduleId, channel) : 0,
      state,
      elementId: element.id,
      operationId: opId,
      triggerOnConfirm: index === entries.length - 1,
      triggerKind: "ledsignal"
    }, moduleId));
    addEvent("ESP-SIGNAL", `${moduleId}:${element.id}`, `${element.name || element.id} wird auf ${state} geschaltet`);
    res.json({ ok: true, commandStatus: "pending", state: element.ledState, requestedState: state, befehle: commands, module: moduleId });
  }));

  router.post("/api/track/control", wrap(async (req, res) => {
    const element = findElement(String(req.body?.elementId || ""));
    if (!element || !["track", "curve", "transformer"].includes(element.typ)) throw apiError(404, "TRACK_NOT_FOUND", "Gleiselement nicht gefunden");
    const moduleId = elementModule(element);
    if (!moduleId) throw apiError(400, "TRACK_NO_MODULE", "Dem Gleis ist kein ESP-Modul zugewiesen");
    const module = requireControllableModule(moduleId);
    const channel = validRelay(element.relay);
    if (!channel) throw apiError(400, "TRACK_NO_RELAY", "Diesem Element ist kein Relay zugewiesen");
    const isUncoupler = String(element.trackCode || element.catalogCode || "") === "5112";
    if (isUncoupler) {
      const duration = Math.max(100, Math.min(3000, toInt(element.uncouplerDurationMs, 450)));
      ensureNoPending(moduleId, (command) => command.type === "RELAY_PULSE" && Number(command.data?.channel) === channel, element.name || "Entkupplungsgleis");
      const cmd = commandQueueApi.createCommand("RELAY_PULSE", {
        channel, duration, elementId: element.id, operationId: operationId("UNCOUPLER"), triggerOnConfirm: true, triggerKind: "uncoupler"
      }, moduleId);
      addEvent("ENTKUPPLER", `${moduleId}:${element.id}`, `${element.name || "Entkupplungsgleis"} wird für ${duration} ms aktiviert`);
      res.json(pendingResponse(cmd, { requestedState: "pulse", duration, channel, module: moduleId }));
      return;
    }
    ensureNoPending(moduleId, (command) => command.type === "RELAY_SET" && Number(command.data?.channel) === channel, element.name || "Gleis");
    const confirmedState = currentRelayState(moduleId, channel, module);
    const state = req.body?.toggle === true ? !confirmedState : parseState(req.body?.state);
    const affectedElementIds = runtimeState.layout.elemente
      .filter((item) => item.module === moduleId && Number(item.relay) === channel)
      .map((item) => item.id);
    const cmd = commandQueueApi.createCommand("RELAY_SET", {
      channel, state, elementId: element.id, affectedElementIds, operationId: operationId("TRACK"), triggerOnConfirm: true, triggerKind: "track"
    }, moduleId);
    addEvent("GLEIS", `${moduleId}:${element.id}`, `${element.name || element.id} wird ${state ? "aktiviert" : "deaktiviert"}`);
    res.json(pendingResponse(cmd, { state: confirmedState, requestedState: state, channel, affectedElementIds, module: moduleId }));
  }));

  router.post("/api/emergency-stop", wrap(async (req, res) => {
    const moduleIds = new Set([
      ...Object.keys(runtimeState.modules || {}),
      ...Object.keys(runtimeState.hardware.modules || {}),
      ...(runtimeState.hardware.relays || []).map((item) => item.module),
      ...(runtimeState.hardware.leds || []).map((item) => item.module)
    ].filter(Boolean));
    const commands = [];
    const skippedOffline = [];
    moduleIds.forEach((moduleId) => {
      const module = runtimeState.modules?.[moduleId] || moduleRegistry.getOrCreateModule(moduleId);
      if (!moduleRegistry.moduleIsOnline(module)) {
        skippedOffline.push(moduleId);
        return;
      }
      commands.push(commandQueueApi.createCommand("NOT_AUS", { operationId: operationId("EMERGENCY") }, moduleId));
    });
    addEvent("NOT-AUS", "SYSTEM", `Not-Aus an ${commands.length} Online-Modul(e) gesendet${skippedOffline.length ? ` · ${skippedOffline.length} offline` : ""}`);
    res.json({ ok: true, commandStatus: commands.length ? "pending" : "none", commands, skippedOffline });
  }));

  return router;
}

module.exports = { createControlRoutes };
