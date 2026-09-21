"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");
const { ipFromReq } = require("../utils/network");
const { cleanText, validLedChannel, validBrightness } = require("../utils/sanitize");
const { parseState } = require("../utils/parse");
const { executeRulesForTrigger } = require("../domain/rules/executeRulesForTrigger");

function createModuleRoutes({
  runtimeState,
  moduleRegistry,
  queueWriteHardware,
  queueWriteLayout,
  queueWriteRules,
  commandQueueApi,
  addEvent,
  upsertRelay,
  upsertLed,
  upsertSensor,
  updateElementsPowerByRelay,
  confirmedCommandApplier,
  env
}) {
  const router = express.Router();

  router.post("/api/module/heartbeat", wrap(async (req, res) => {
    const moduleId = cleanText(req.body?.module || "", 48);
    if (!moduleId) throw apiError(400, "MODULE_REQUIRED", "Modul-ID fehlt");
    const module = moduleRegistry.getOrCreateModule(moduleId);
    const wasOnline = moduleRegistry.moduleIsOnline(module);

    module.online = true;
    module.lastHeartbeat = Date.now();
    module.ip = ipFromReq(req) || module.ip || "";
    const firmwareType = cleanText(req.body?.moduleType || "", 40);
    const firmwareVersion = cleanText(req.body?.firmwareVersion || "", 40);
    const protocolVersion = Number(req.body?.protocolVersion) || 0;
    const hardwareType = cleanText(req.body?.hardwareType || "", 80);
    module.firmwareVersion = firmwareVersion;
    module.protocolVersion = protocolVersion;
    module.hardwareType = hardwareType;
    const reportedName = cleanText(req.body?.moduleName || req.body?.name || "", 80);
    const environmentInput = req.body?.environment && typeof req.body.environment === "object"
      ? req.body.environment
      : null;
    // Ein im Webinterface gesetzter Anzeigename darf nicht vom naechsten
    // Heartbeat der Firmware wieder ueberschrieben werden.
    if (!module.customName) {
      module.name = reportedName || module.name || `Modul ${moduleId}`;
    }
    if (!wasOnline) {
      console.log(`[ESP] online · ${module.name} · ID ${moduleId} · ${module.ip || "IP unbekannt"}`);
    }

    const pendingModuleCommands = runtimeState.commandQueue.filter((command) => command.module === moduleId);
    const pendingEmergency = pendingModuleCommands.some((command) => command.type === "NOT_AUS");
    const pendingRelayChannels = new Set(pendingModuleCommands
      .filter((command) => command.type === "RELAY_SET")
      .map((command) => Number(command.data?.channel))
      .filter((channel) => channel > 0));
    const pendingLedChannels = new Set(pendingModuleCommands
      .filter((command) => ["LED_SET", "LED_PWM", "LED_BLINK"].includes(command.type))
      .map((command) => Number(command.data?.channel))
      .filter((channel) => channel > 0));

    const relayStates = Array.isArray(req.body?.relays) ? req.body.relays : null;
    if (relayStates) {
      const previousRelays = Array.isArray(module.relays) ? module.relays.slice() : [];
      module.relays = relayStates.map((reportedState, index) => {
        const channel = index + 1;
        if (pendingEmergency || pendingRelayChannels.has(channel)) return Boolean(previousRelays[index]);
        return Boolean(reportedState);
      });
      runtimeState.hardware.relays = runtimeState.hardware.relays.filter(
        (relay) => relay.module !== moduleId || Number(relay.channel) <= relayStates.length
      );
      module.relays.forEach((state, i) => {
        const channel = i + 1;
        if (pendingEmergency || pendingRelayChannels.has(channel)) return;
        upsertRelay(runtimeState.hardware, moduleId, channel, Boolean(state));
        updateElementsPowerByRelay(runtimeState.layout, moduleId, channel, Boolean(state));
        (runtimeState.hardware.lightButtons || []).forEach((button) => {
          if ((button.moduleId || button.module) === moduleId && Number(button.relayIndex ?? button.relay) === channel) button.active = Boolean(state);
        });
      });
    }

    const ledStates = Array.isArray(req.body?.leds) ? req.body.leds : null;
    if (ledStates) {
      const previousLeds = Array.isArray(module.leds) ? module.leds.slice() : [];
      module.leds = [];
      const reportedLedChannels = new Set(ledStates
        .map((item, index) => validLedChannel(item?.channel ?? (index + 1)))
        .filter(Boolean));
      runtimeState.hardware.leds = runtimeState.hardware.leds.filter(
        (led) => led.module !== moduleId || reportedLedChannels.has(Number(led.channel))
      );
      ledStates.forEach((x, i) => {
        const channel = validLedChannel(x?.channel ?? (i + 1));
        if (!channel) return;
        const blockedByPendingAck = pendingEmergency || pendingLedChannels.has(channel);
        const previous = previousLeds[channel - 1] || { state: false, brightness: 0, blinking: false };
        const state = blockedByPendingAck ? Boolean(previous.state) : Boolean(x?.state);
        const brightness = blockedByPendingAck
          ? validBrightness(previous.brightness)
          : validBrightness(x?.brightness ?? (state ? 255 : 0));
        const blinking = blockedByPendingAck ? Boolean(previous.blinking) : Boolean(x?.blinking);

        if (!blockedByPendingAck) upsertLed(runtimeState.hardware, moduleId, channel, { state, brightness, blinking });

        while (module.leds.length < channel) module.leds.push({ state: false, brightness: 0, blinking: false });
        module.leds[channel - 1] = { state, brightness, blinking };
      });
    }

    const sensorSnapshot = Array.isArray(req.body?.sensors)
      ? req.body.sensors
          .map((sensor) => ({
            id: cleanText(sensor?.id ?? sensor?.sensor ?? "", 48),
            triggered: parseState(sensor?.triggered)
          }))
          .filter((sensor) => sensor.id)
      : [];

    if (Array.isArray(req.body?.sensorInventory) || sensorSnapshot.length) {
      const list = Array.from(new Set([
        ...(Array.isArray(req.body?.sensorInventory)
          ? req.body.sensorInventory.map((x) => cleanText(String(x), 48)).filter(Boolean)
          : []),
        ...sensorSnapshot.map((sensor) => sensor.id)
      ]));
      const inventory = new Set(list);
      const snapshotById = new Map(sensorSnapshot.map((sensor) => [sensor.id, sensor]));
      module.sensors = module.sensors.filter((sensor) => inventory.has(sensor.id));
      runtimeState.hardware.sensors = runtimeState.hardware.sensors.filter(
        (sensor) => sensor.module !== moduleId || inventory.has(sensor.id)
      );
      list.forEach((id) => {
        const existing = runtimeState.hardware.sensors.find((s) => s.module === moduleId && s.id === id);
        const existingName = existing?.name || id;
        const snapshot = snapshotById.get(id);
        upsertSensor(runtimeState.hardware, moduleId, id, {
          name: existingName,
          triggered: snapshot ? snapshot.triggered : Boolean(existing?.triggered),
          lastEvent: Number(existing?.lastEvent) || 0
        });

        const moduleSensor = module.sensors.find((s) => s.id === id);
        if (moduleSensor) {
          moduleSensor.name = existingName;
          if (snapshot) moduleSensor.triggered = snapshot.triggered;
        } else {
          module.sensors.push({
            id,
            name: existingName,
            triggered: snapshot ? snapshot.triggered : false,
            lastEvent: Number(existing?.lastEvent) || 0
          });
        }
      });
    }

    // Modultyp anhand gemeldeter Hardware erkennen, unabhängig von ID oder Anzeigename.
    const capabilities = [];
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "relays")) capabilities.push("relay");
    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, "sensorInventory") ||
      Object.prototype.hasOwnProperty.call(req.body || {}, "sensors")
    ) capabilities.push("sensor");
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "leds")) capabilities.push("led");
    const declared = firmwareType.toLowerCase();
    if (declared.includes("relay") && !capabilities.includes("relay")) capabilities.push("relay");
    if (declared.includes("sensor") && !capabilities.includes("sensor")) capabilities.push("sensor");
    if ((declared.includes("led") || declared.includes("signal")) && !capabilities.includes("led")) capabilities.push("led");
    if (environmentInput) {
      const temperatureC = Number(environmentInput.temperatureC);
      const humidityPct = Number(environmentInput.humidityPct);
      const pressureHpa = Number(environmentInput.pressureHpa);
      if (
        Number.isFinite(temperatureC) && temperatureC >= -40 && temperatureC <= 85 &&
        Number.isFinite(humidityPct) && humidityPct >= 0 && humidityPct <= 100 &&
        Number.isFinite(pressureHpa) && pressureHpa >= 300 && pressureHpa <= 1100
      ) {
        module.environment = {
          sensor: cleanText(environmentInput.sensor || "BME280", 24) || "BME280",
          temperatureC: Math.round(temperatureC * 10) / 10,
          humidityPct: Math.round(humidityPct * 10) / 10,
          pressureHpa: Math.round(pressureHpa * 10) / 10,
          updatedAt: Date.now()
        };
        capabilities.push("environment");
      }
    }
    if (capabilities.length) module.capabilities = capabilities;
    const hasLed = module.capabilities.includes("led");
    const hasRail = module.capabilities.includes("relay") || module.capabilities.includes("sensor");
    module.kind = hasLed && hasRail ? "HYBRID" : hasLed ? "SIGNAL_LED" : hasRail ? "RELAY_SENSOR" : "UNKNOWN";
    module.type = module.kind;

    if (!runtimeState.hardware.modules || typeof runtimeState.hardware.modules !== "object") {
      runtimeState.hardware.modules = {};
    }
    runtimeState.hardware.modules[moduleId] = {
      id: moduleId,
      name: module.name,
      customName: Boolean(module.customName),
      type: module.type,
      kind: module.kind,
      capabilities: module.capabilities,
      ip: module.ip,
      lastHeartbeat: module.lastHeartbeat,
      firmwareVersion: module.firmwareVersion,
      protocolVersion: module.protocolVersion,
      hardwareType: module.hardwareType
    };
    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    const compatibility = moduleRegistry.moduleCompatibility(module);
    res.json({
      ok: true,
      serverTime: Date.now(),
      serverVersion: env.APP_VERSION,
      protocolVersion: env.PROTOCOL_VERSION,
      compatibility,
      accepted: {
        module: moduleId,
        relays: relayStates ? relayStates.length : 0,
        sensors: Array.isArray(req.body?.sensorInventory) || sensorSnapshot.length ? module.sensors.length : 0,
        leds: ledStates ? ledStates.length : 0
      }
    });
  }));

  router.post("/api/module/rename", wrap(async (req, res) => {
    const moduleId = cleanText(req.body?.module || req.body?.moduleId || "", 48);
    const name = cleanText(req.body?.name || "", 80);
    if (!moduleId) throw apiError(400, "BAD_MODULE_ID", "Modul-ID fehlt");
    if (!name) throw apiError(400, "BAD_MODULE_NAME", "Modulname fehlt");

    const known = runtimeState.modules[moduleId] || runtimeState.hardware?.modules?.[moduleId];
    if (!known) throw apiError(404, "MODULE_NOT_FOUND", "ESP-Modul nicht gefunden");

    const module = moduleRegistry.getOrCreateModule(moduleId);
    module.name = name;
    module.customName = true;
    if (!runtimeState.hardware.modules || typeof runtimeState.hardware.modules !== "object") {
      runtimeState.hardware.modules = {};
    }
    runtimeState.hardware.modules[moduleId] = {
      ...(runtimeState.hardware.modules[moduleId] || {}),
      id: moduleId,
      name,
      customName: true
    };
    runtimeState.hardware.updatedAt = Date.now();
    await queueWriteHardware();
    addEvent("MODUL", moduleId, `ESP-Modul umbenannt: ${name}`);

    res.json({ ok: true, module: moduleId, name });
  }));

  router.post("/api/module/sensor", wrap(async (req, res) => {
    const moduleId = cleanText(req.body?.module || "", 48);
    if (!moduleId) throw apiError(400, "MODULE_REQUIRED", "Modul-ID fehlt");
    const sensorId = cleanText(req.body?.sensor || "", 48);
    if (!sensorId) throw apiError(400, "BAD_SENSOR_ID", "Sensor-ID fehlt");

    const module = moduleRegistry.getOrCreateModule(moduleId);
    module.online = true;
    module.lastHeartbeat = Date.now();
    module.ip = ipFromReq(req) || module.ip || "";

    const triggered = parseState(req.body?.triggered);

    upsertSensor(runtimeState.hardware, moduleId, sensorId, {
      triggered,
      lastEvent: triggered ? Date.now() : runtimeState.hardware.sensors.find((s) => s.module === moduleId && s.id === sensorId)?.lastEvent || 0
    });

    const sensorName = runtimeState.hardware.sensors.find((s) => s.module === moduleId && s.id === sensorId)?.name || sensorId;
    const i = module.sensors.findIndex((s) => s.id === sensorId);
    if (i >= 0) {
      module.sensors[i].triggered = triggered;
      if (triggered) module.sensors[i].lastEvent = Date.now();
      module.sensors[i].name = sensorName;
    } else {
      module.sensors.push({ id: sensorId, name: sensorName, triggered, lastEvent: triggered ? Date.now() : 0 });
    }

    runtimeState.hardware.updatedAt = Date.now();
    queueWriteHardware();

    addEvent("SENSOR", `${moduleId}:${sensorId}`, `${sensorName} ${triggered ? "ausgelöst" : "frei"}`);

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
        kind: "sensor",
        module: moduleId,
        sensorId,
        triggered
      }
    });

    res.json({ ok: true, automations });
  }));

  router.post("/api/module/delete", wrap(async (req, res) => {
    const moduleId = cleanText(req.body?.module || req.body?.moduleId || "", 48);
    if (!moduleId) throw apiError(400, "BAD_MODULE_ID", "Modul-ID fehlt");

    const exists = Boolean(
      runtimeState.modules[moduleId] ||
      runtimeState.hardware?.modules?.[moduleId] ||
      runtimeState.hardware?.relays?.some((item) => item.module === moduleId) ||
      runtimeState.hardware?.leds?.some((item) => item.module === moduleId) ||
      runtimeState.hardware?.sensors?.some((item) => item.module === moduleId)
    );
    if (!exists) throw apiError(404, "MODULE_NOT_FOUND", "ESP-Modul nicht gefunden");

    const affectedElements = new Set(
      (runtimeState.layout.elemente || [])
        .filter((element) => element.module === moduleId)
        .map((element) => element.id)
    );

    delete runtimeState.modules[moduleId];
    if (runtimeState.hardware.modules) delete runtimeState.hardware.modules[moduleId];
    runtimeState.hardware.relays = (runtimeState.hardware.relays || []).filter((item) => item.module !== moduleId);
    runtimeState.hardware.leds = (runtimeState.hardware.leds || []).filter((item) => item.module !== moduleId);
    runtimeState.hardware.sensors = (runtimeState.hardware.sensors || []).filter((item) => item.module !== moduleId);
    if (runtimeState.hardware.ledConfig && typeof runtimeState.hardware.ledConfig === "object") {
      Object.keys(runtimeState.hardware.ledConfig).forEach((key) => {
        if (key.startsWith(`${moduleId}:`)) delete runtimeState.hardware.ledConfig[key];
      });
    }
    runtimeState.hardware.lightButtons = (runtimeState.hardware.lightButtons || []).map((button) =>
      button.module === moduleId ? { ...button, module: "", relay: 0 } : button
    );

    const channelFields = [
      "relay", "relayA", "relayB", "relayStraight", "relayBranch",
      "relayHp0", "relayHp1", "ledChannelRed", "ledChannelYellow", "ledChannelGreen"
    ];
    (runtimeState.layout.elemente || []).forEach((element) => {
      if (element.module !== moduleId) return;
      element.module = "";
      element.sensorId = "";
      element.powerState = false;
      channelFields.forEach((field) => { element[field] = 0; });
    });
    (runtimeState.layout.stromkreise || []).forEach((circuit) => {
      if (circuit.module !== moduleId) return;
      circuit.module = "";
      circuit.relay = 0;
      circuit.state = false;
    });

    let disabledRules = 0;
    (runtimeState.rulesData.rules || []).forEach((rule) => {
      const usesModule =
        rule.condition?.module === moduleId ||
        (rule.actions || []).some((action) =>
          action.module === moduleId || affectedElements.has(action.elementId)
        );
      if (usesModule && rule.enabled !== false) {
        rule.enabled = false;
        disabledRules += 1;
      }
    });

    commandQueueApi.cancelCommandsForModule(moduleId, "Modul gelöscht");
    runtimeState.hardware.updatedAt = Date.now();
    runtimeState.rulesData.updatedAt = Date.now();
    await Promise.all([queueWriteHardware(), queueWriteLayout(), queueWriteRules()]);
    addEvent("MODUL", moduleId, `ESP-Modul ${moduleId} gelöscht`);

    res.json({
      ok: true,
      module: moduleId,
      clearedElements: affectedElements.size,
      disabledRules
    });
  }));

  router.get("/api/module/next-command", (req, res) => {
    const moduleId = cleanText(req.query?.module || "GLEIS_01", 48) || "GLEIS_01";

    const cmd = commandQueueApi.nextCommandForModule(moduleId);
    if (!cmd) return res.json({ command: null });

    res.json({
      command: {
        id: cmd.id,
        type: cmd.type,
        channel: Number(cmd.data.channel) || 0,
        state: Boolean(cmd.data.state),
        brightness: Number(cmd.data.brightness) || 0,
        onMs: Number(cmd.data.onMs) || 0,
        offMs: Number(cmd.data.offMs) || 0,
        durationMs: Number(cmd.data.durationMs) || 0,
        duration: Number(cmd.data.duration) || 0,
        elementId: String(cmd.data.elementId || ""),
        line: String(cmd.data.line || "")
      }
    });
  });

  router.post("/api/module/ack", wrap(async (req, res) => {
    const id = Number(req.body?.id);
    if (!Number.isInteger(id)) throw apiError(400, "BAD_COMMAND_ID", "Ungültige Befehls-ID");
    const moduleId = cleanText(req.body?.module || "", 48);
    const success = req.body?.ok !== false;
    const reason = cleanText(req.body?.error || req.body?.reason || "", 160);
    const queued = runtimeState.commandQueue.find((item) => item.id === id);
    if (queued && moduleId && queued.module !== moduleId) {
      throw apiError(409, "COMMAND_MODULE_MISMATCH", "Befehl gehört zu einem anderen ESP-Modul");
    }
    const settled = commandQueueApi.ackCommand(id, { success, reason });
    if (settled.command && success) await confirmedCommandApplier.apply(settled.command);
    if (settled.command && !success) {
      addEvent("COMMAND", `${settled.command.module}:${settled.command.type}`, `Befehl #${id} fehlgeschlagen: ${reason || "ESP-Fehler"}`);
    }
    res.json({
      ok: true,
      bereitsBestaetigt: Boolean(settled.alreadySettled),
      commandStatus: settled.result?.status || "unknown"
    });
  }));

  return router;
}

module.exports = { createModuleRoutes };
