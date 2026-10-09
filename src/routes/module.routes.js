"use strict";

const express = require("express");
const crypto = require("node:crypto");
const { wrap, apiError } = require("../utils/errors");
const { ipFromReq } = require("../utils/network");
const { cleanText, validLedChannel, validBrightness } = require("../utils/sanitize");
const { parseState } = require("../utils/parse");
const { executeRulesForTrigger } = require("../domain/rules/executeRulesForTrigger");
const { buildFirmware, SKETCHES } = require("../services/ota/buildFirmware");

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
  if (!(runtimeState.otaJobs instanceof Map)) runtimeState.otaJobs = new Map();
  if (!(runtimeState.firmwareBuilds instanceof Map)) runtimeState.firmwareBuilds = new Map();

  function requireOtaSecret(req) {
    const expected = String(env.OTA_SHARED_SECRET || "");
    const supplied = String(req.get("X-Dynora-OTA-Token") || "");
    if (!expected) throw apiError(503, "OTA_DISABLED", "OTA ist nicht aktiviert. OTA_SHARED_SECRET fehlt.");
    const left = Buffer.from(expected);
    const right = Buffer.from(supplied);
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      throw apiError(403, "OTA_FORBIDDEN", "OTA-Schlüssel ist ungültig");
    }
  }

  function commandPayload(cmd) {
    if (!cmd) return null;
    return {
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
    };
  }

  router.post("/api/module/heartbeat", wrap(async (req, res) => {
    const moduleId = cleanText(req.body?.module || "", 48);
    if (!moduleId) throw apiError(400, "MODULE_REQUIRED", "Modul-ID fehlt");
    const module = moduleRegistry.getOrCreateModule(moduleId);
    const wasOnline = moduleRegistry.moduleIsOnline(module);
    const heartbeatNow = Date.now();
    const firstRuntimeHeartbeat = module._heartbeatSeen !== true;
    module._heartbeatSeen = true;

    module.online = true;
    module.lastHeartbeat = heartbeatNow;
    module.ip = ipFromReq(req) || module.ip || "";
    const firmwareType = cleanText(req.body?.moduleType || "", 40);
    const firmwareVersion = cleanText(req.body?.firmwareVersion || "", 40);
    const protocolVersion = Number(req.body?.protocolVersion) || 0;
    const hardwareType = cleanText(req.body?.hardwareType || "", 80);
    module.firmwareVersion = firmwareVersion;
    const otaJob = runtimeState.otaJobs.get(moduleId);
    if (otaJob && firmwareVersion === otaJob.version) {
      otaJob.status = "installed";
      otaJob.updatedAt = heartbeatNow;
      otaJob.firmware = null;
    } else if (otaJob?.status === "restarting" && heartbeatNow - otaJob.updatedAt > 30000) {
      otaJob.status = "failed";
      otaJob.error = `ESP meldet Firmware ${firmwareVersion || "unbekannt"} statt ${otaJob.version}`;
      otaJob.updatedAt = heartbeatNow;
    }
    module.protocolVersion = protocolVersion;
    module.hardwareType = hardwareType;
    const reportsRelayDriver = Object.prototype.hasOwnProperty.call(req.body || {}, "mcp23017");
    const reportsEnvironmentSensor = Object.prototype.hasOwnProperty.call(req.body || {}, "bme280");
    module.health = {
      ...(module.health && typeof module.health === "object" ? module.health : {}),
      ...(reportsRelayDriver ? { relayDriverReady: req.body.mcp23017 === true } : {}),
      ...(reportsEnvironmentSensor ? { environmentSensorReady: req.body.bme280 === true } : {}),
      ...(typeof req.body?.relayActiveLow === "boolean" ? { relayActiveLow: req.body.relayActiveLow } : {}),
      ...(Number.isInteger(Number(req.body?.relayOutputLatch)) ? { relayOutputLatch: Number(req.body.relayOutputLatch) & 0xFFFF } : {}),
      ...(Number.isInteger(Number(req.body?.relayDirectionMask)) ? { relayDirectionMask: Number(req.body.relayDirectionMask) & 0xFFFF } : {}),
      ...(typeof req.body?.relayDriveMode === "string" ? { relayDriveMode: cleanText(req.body.relayDriveMode, 40) } : {})
    };
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

    const recoveredSensorTransitions = [];
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
        const nextTriggered = snapshot ? snapshot.triggered : Boolean(existing?.triggered);
        const changedFromLiveHeartbeat = Boolean(
          snapshot && existing && !firstRuntimeHeartbeat && Boolean(existing.triggered) !== nextTriggered
        );
        const nextLastEvent = changedFromLiveHeartbeat && nextTriggered
          ? heartbeatNow
          : Number(existing?.lastEvent) || 0;

        upsertSensor(runtimeState.hardware, moduleId, id, {
          name: existingName,
          triggered: nextTriggered,
          lastEvent: nextLastEvent
        });

        const moduleSensor = module.sensors.find((s) => s.id === id);
        if (moduleSensor) {
          moduleSensor.name = existingName;
          moduleSensor.triggered = nextTriggered;
          moduleSensor.lastEvent = nextLastEvent;
        } else {
          module.sensors.push({
            id,
            name: existingName,
            triggered: nextTriggered,
            lastEvent: nextLastEvent
          });
        }

        if (changedFromLiveHeartbeat) {
          recoveredSensorTransitions.push({ id, name: existingName, triggered: nextTriggered });
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
      hardwareType: module.hardwareType,
      health: module.health
    };
    runtimeState.hardware.updatedAt = heartbeatNow;

    // Heartbeats kommen standardmaessig alle 2 Sekunden. Live-Daten bleiben im RAM aktuell,
    // aber wir schreiben reine Heartbeat-Zeitstempel nur periodisch auf Disk (SD-Karten-Schonung).
    // Relevante Zustandsaenderungen ueber ACK/Sensor-Endpunkte werden weiterhin sofort gespeichert.
    const lastHeartbeatPersistAt = Number(module._lastHeartbeatPersistAt || 0);
    const shouldPersistHeartbeat = firstRuntimeHeartbeat || recoveredSensorTransitions.length > 0 ||
      (heartbeatNow - lastHeartbeatPersistAt) >= env.HEARTBEAT_PERSIST_INTERVAL_MS;
    if (shouldPersistHeartbeat) {
      module._lastHeartbeatPersistAt = heartbeatNow;
      queueWriteHardware();
    }

    // Fallback: Geht ein einzelner /sensor-Request verloren, kann der naechste Heartbeat
    // den Zustandswechsel nachziehen. Beim ersten Heartbeat nach Serverstart feuern wir
    // bewusst keine Regeln, damit gespeicherte Sensorzustaende nicht erneut ausloesen.
    for (const transition of recoveredSensorTransitions) {
      addEvent("SENSOR", `${moduleId}:${transition.id}`, `${transition.name} ${transition.triggered ? "ausgelöst" : "frei"} (per Heartbeat synchronisiert)`);
      executeRulesForTrigger({
        runtimeState, moduleRegistry, commandQueueApi, addEvent, queueWriteRules,
        trigger: {
          kind: "sensor",
          module: moduleId,
          sensorId: transition.id,
          triggered: transition.triggered
        }
      });
    }

    const compatibility = moduleRegistry.moduleCompatibility(module);
    // Der Heartbeat ist ein zweiter, robuster Zustellweg. Falls ein Router oder
    // Proxy das schnelle GET-Polling stört, erhält der ESP den Befehl spätestens
    // mit dem nächsten ohnehin funktionierenden Heartbeat.
    const heartbeatCommand = commandQueueApi.nextCommandForModule(moduleId);
    res.json({
      ok: true,
      serverTime: Date.now(),
      serverVersion: env.APP_VERSION,
      protocolVersion: env.PROTOCOL_VERSION,
      compatibility,
      health: module.health,
      command: commandPayload(heartbeatCommand),
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
    if ((await queueWriteHardware())?.ok === false) throw apiError(500, "SAVE_FAILED", "Speichern fehlgeschlagen. Änderungen sind noch nicht dauerhaft gesichert.");
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
    const writes = await Promise.all([queueWriteHardware(), queueWriteLayout(), queueWriteRules()]);
    if (writes.some(result => result?.ok === false)) throw apiError(500, "SAVE_FAILED", "Moduländerungen konnten nicht dauerhaft gespeichert werden");
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

    const otaJob = runtimeState.otaJobs.get(moduleId);
    if (otaJob && ["queued", "downloading"].includes(otaJob.status) && otaJob.firmware) {
      return res.json({
        command: null,
        ota: { version: otaJob.version, sha256: otaJob.sha256 }
      });
    }

    const cmd = commandQueueApi.nextCommandForModule(moduleId);
    if (!cmd) return res.json({ command: null });

    res.json({ command: commandPayload(cmd) });
  });

  router.post("/api/ota/build", wrap(async (req, res) => {
    const secret = String(env.OTA_SHARED_SECRET || "");
    const hardwareType = cleanText(req.body?.hardwareType || "", 80);
    if (!secret) throw apiError(503, "OTA_DISABLED", "OTA ist nicht aktiviert. OTA_SHARED_SECRET fehlt.");
    if (!SKETCHES[hardwareType]) throw apiError(400, "FIRMWARE_TYPE_UNSUPPORTED", "Für diesen ESP-Hardwaretyp gibt es keine Firmwarevorlage.");
    const previous = runtimeState.firmwareBuilds.get(hardwareType);
    if (previous?.status === "building") throw apiError(409, "OTA_BUILD_RUNNING", "Diese Firmware wird bereits gebaut.");
    const build = { hardwareType, status: "building", progress: 5, message: "Firmware-Quelle wird vorbereitet …", version: "", firmware: null, updatedAt: Date.now(), error: "" };
    runtimeState.firmwareBuilds.set(hardwareType, build);
    res.status(202).json({ ok: true, hardwareType, status: "building" });
    (async () => {
      try {
        build.progress = 15;
        build.message = "Arduino-Compiler wird gestartet …";
        const result = await buildFirmware(hardwareType, secret, env.DYNORA_DATA_DIR || "/data", percent => { build.progress = Math.min(90, 15 + Math.floor(percent * 0.75)); build.message = `Firmware wird kompiliert … ${percent}%`; build.updatedAt = Date.now(); });
        build.progress = 95;
        build.message = "Firmware wird geprüft …";
        build.version = result.version;
        build.firmware = result.firmware;
        build.sha256 = crypto.createHash("sha256").update(result.firmware).digest("hex");
        build.status = "ready";
        build.progress = 100;
        build.message = `Firmware bereit (${(result.firmware.length / 1024).toFixed(0)} KB)`;
        build.updatedAt = Date.now();
        addEvent("OTA", hardwareType, `Server-Firmware ${build.version} erfolgreich gebaut`);
      } catch (error) {
        build.status = "failed";
        build.progress = 100;
        build.message = "Firmware-Build fehlgeschlagen";
        build.error = cleanText(error.message || "Firmware-Build fehlgeschlagen", 300);
        build.updatedAt = Date.now();
        addEvent("OTA", hardwareType, `Firmware-Build fehlgeschlagen: ${build.error}`);
      }
    })();
  }));

  router.get("/api/ota/build-status", (req, res) => {
    const hardwareType = cleanText(req.query?.hardwareType || "", 80);
    const build = runtimeState.firmwareBuilds.get(hardwareType);
    if (!build) return res.json({ hardwareType, status: "idle", progress: 0, message: "Noch keine Firmware erstellt" });
    res.json({ hardwareType, status: build.status, progress: build.progress, message: build.message, version: build.version, error: build.error, updatedAt: build.updatedAt });
  });

  router.post("/api/ota/:moduleId", wrap(async (req, res) => {
    const moduleId = cleanText(req.params.moduleId || "", 48);
    const module = runtimeState.modules[moduleId];
    const build = runtimeState.firmwareBuilds.get(String(module?.hardwareType || ""));
    if (!moduleId || !module) throw apiError(404, "MODULE_NOT_FOUND", "ESP-Modul wurde nicht gefunden");
    if (!module.online) throw apiError(409, "MODULE_OFFLINE", "Das ESP-Modul ist offline");
    if (!build || build.status !== "ready" || !build.firmware) throw apiError(409, "FIRMWARE_NOT_READY", "Erstelle zuerst die passende Firmware im Update-Reiter.");
    if (build.version === String(module.firmwareVersion || "")) throw apiError(409, "FIRMWARE_VERSION_UNCHANGED", "Der ESP verwendet bereits genau diesen Firmwarestand.");
    const existing = runtimeState.otaJobs.get(moduleId);
    if (existing && ["queued", "downloading", "restarting"].includes(existing.status)) throw apiError(409, "OTA_ALREADY_RUNNING", "Für dieses Modul läuft bereits ein OTA-Auftrag.");
    const active = Array.from(runtimeState.otaJobs.values()).filter(job => ["queued", "downloading", "restarting"].includes(job.status)).length;
    if (active >= 2) throw apiError(429, "OTA_BUSY", "Es laufen bereits zwei ESP-Updates.");
    const firmware = Buffer.from(build.firmware);
    runtimeState.otaJobs.set(moduleId, { moduleId, hardwareType: module.hardwareType, version: build.version, sha256: build.sha256, firmware, status: "queued", createdAt: Date.now(), updatedAt: Date.now() });
    addEvent("OTA", moduleId, `Firmware ${build.version} für ${module.name || moduleId} zum Upload bereit`);
    res.status(202).json({ ok: true, module: moduleId, version: build.version, sha256: build.sha256, status: "queued" });
  }));

  router.get("/api/ota/status", (req, res) => {
    const moduleId = cleanText(req.query?.module || "", 48);
    const job = runtimeState.otaJobs.get(moduleId);
    if (!job) return res.json({ module: moduleId, status: "idle" });
    res.json({ module: moduleId, version: job.version, status: job.status, error: job.error || "", updatedAt: job.updatedAt });
  });

  router.get("/api/module/ota-firmware", (req, res, next) => {
    try {
      requireOtaSecret(req);
      const moduleId = cleanText(req.query?.module || "", 48);
      const job = runtimeState.otaJobs.get(moduleId);
      if (!job || !job.firmware || !["queued", "downloading"].includes(job.status)) {
        throw apiError(404, "OTA_FIRMWARE_NOT_FOUND", "Kein Firmware-Update wartet für dieses Modul");
      }
      job.status = "downloading";
      job.updatedAt = Date.now();
      res.set({
        "Content-Type": "application/octet-stream",
        "Content-Length": String(job.firmware.length),
        "Cache-Control": "no-store",
        "X-Dynora-Firmware-Version": job.version,
        "X-Dynora-Firmware-SHA256": job.sha256
      });
      res.send(job.firmware);
    } catch (error) { next(error); }
  });

  router.post("/api/module/ota-result", express.json({ limit: "2kb" }), wrap(async (req, res) => {
    requireOtaSecret(req);
    const moduleId = cleanText(req.body?.module || "", 48);
    const job = runtimeState.otaJobs.get(moduleId);
    if (!job) throw apiError(404, "OTA_JOB_NOT_FOUND", "Kein OTA-Auftrag für dieses Modul gefunden");
    const ok = req.body?.ok === true;
    if (ok) {
      job.status = "restarting";
      job.firmware = null;
      job.updatedAt = Date.now();
    } else {
      job.status = "failed";
      job.error = cleanText(req.body?.error || "ESP konnte Firmware nicht installieren", 160);
      job.firmware = null;
      job.updatedAt = Date.now();
      addEvent("OTA", moduleId, `Firmware-Update fehlgeschlagen: ${job.error}`);
    }
    res.json({ ok: true, status: job.status });
  }));

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
