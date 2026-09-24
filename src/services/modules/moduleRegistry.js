"use strict";

const { cleanText, validBrightness } = require("../../utils/sanitize");
const { toNumber } = require("../../utils/parse");

function createModuleRegistry({ runtimeState, moduleTimeout, protocolVersion = 2 }) {
  function compatibilityFor(m) {
    const reportedProtocol = Number(m?.protocolVersion);
    if (!Number.isFinite(reportedProtocol) || reportedProtocol <= 0) {
      return { compatible: false, status: "unknown", reason: "Protokollversion fehlt" };
    }
    if (reportedProtocol !== Number(protocolVersion)) {
      return {
        compatible: false,
        status: "incompatible",
        reason: `Protokoll ${reportedProtocol} ist nicht mit Server-Protokoll ${protocolVersion} kompatibel`
      };
    }
    const missing = [];
    if (!cleanText(m?.firmwareVersion || "", 40)) missing.push("Firmwareversion");
    if (!cleanText(m?.hardwareType || "", 80)) missing.push("Hardwaretyp");
    return {
      compatible: true,
      status: missing.length ? "warning" : "compatible",
      reason: missing.length ? `${missing.join(" und ")} fehlt` : "Kompatibel"
    };
  }

  function getOrCreateModule(moduleId) {
    const id = cleanText(moduleId || "GLEIS_01", 48) || "GLEIS_01";
    if (!runtimeState.modules[id]) {
      runtimeState.modules[id] = {
        id,
        name: `Modul ${id}`,
        customName: false,
        type: "GLEISSTEUERUNG",
        capabilities: [],
        kind: "UNKNOWN",
        ip: "",
        online: false,
        lastHeartbeat: 0,
        firmwareVersion: "",
        protocolVersion: 0,
        hardwareType: "",
        relays: [],
        sensors: [],
        leds: [],
        environment: null,
        health: { relayDriverReady: null, environmentSensorReady: null, relayActiveLow: null, relayOutputLatch: null, relayDirectionMask: null, relayDriveMode: "" }
      };
    }
    return runtimeState.modules[id];
  }

  function moduleIsOnline(m) {
    const hb = Number(m?.lastHeartbeat || 0);
    return hb > 0 && (Date.now() - hb) < moduleTimeout;
  }

  function moduleCompatibility(m) {
    return compatibilityFor(m);
  }

  function moduleCanControl(m) {
    return moduleIsOnline(m) && compatibilityFor(m).compatible;
  }

  function statusObject(m) {
    const online = moduleIsOnline(m);
    const compatibility = compatibilityFor(m);
    return {
      id: m.id,
      name: m.name,
      customName: Boolean(m.customName),
      type: m.type,
      typ: m.type,
      capabilities: Array.isArray(m.capabilities) ? m.capabilities : [],
      kind: m.kind || "UNKNOWN",
      ip: m.ip,
      online,
      firmwareVersion: cleanText(m.firmwareVersion || "", 40),
      protocolVersion: Number(m.protocolVersion) || 0,
      hardwareType: cleanText(m.hardwareType || "", 80),
      compatibility,
      relays: Array.isArray(m.relays) ? m.relays : [],
      relais: Array.isArray(m.relays) ? m.relays : [],
      sensors: Array.isArray(m.sensors) ? m.sensors : [],
      sensoren: Array.isArray(m.sensors) ? m.sensors : [],
      leds: Array.isArray(m.leds) ? m.leds : [],
      environment: m.environment && typeof m.environment === "object" ? m.environment : null,
      health: m.health && typeof m.health === "object" ? m.health : { relayDriverReady: null, environmentSensorReady: null, relayActiveLow: null, relayOutputLatch: null },
      lastHeartbeat: Number(m.lastHeartbeat || 0)
    };
  }

  function listModulesStatus() {
    return Object.values(runtimeState.modules).map(statusObject);
  }

  function bootstrapModulesFromHardware(hardware) {
    const safeHw = hardware && typeof hardware === "object" ? hardware : {};

    const relays = Array.isArray(safeHw.relays) ? safeHw.relays : [];
    relays.forEach((r) => {
      const moduleId = cleanText(r?.module || "GLEIS_01", 48) || "GLEIS_01";
      const channel = toNumber(r?.channel, 0);
      if (channel <= 0) return;
      const m = getOrCreateModule(moduleId);
      if (!m.capabilities.includes("relay")) m.capabilities.push("relay");
      while (m.relays.length < channel) m.relays.push(false);
      m.relays[channel - 1] = Boolean(r?.state);
    });

    const leds = Array.isArray(safeHw.leds) ? safeHw.leds : [];
    leds.forEach((l) => {
      const moduleId = cleanText(l?.module || "GLEIS_01", 48) || "GLEIS_01";
      const channel = toNumber(l?.channel, 0);
      if (channel <= 0) return;
      const m = getOrCreateModule(moduleId);
      if (!m.capabilities.includes("led")) m.capabilities.push("led");
      while (m.leds.length < channel) m.leds.push({ state: false, brightness: 0, blinking: false });
      m.leds[channel - 1] = {
        state: Boolean(l?.state),
        brightness: validBrightness(l?.brightness),
        blinking: Boolean(l?.blinking)
      };
    });

    const sensors = Array.isArray(safeHw.sensors) ? safeHw.sensors : [];
    sensors.forEach((s) => {
      const moduleId = cleanText(s?.module || "GLEIS_01", 48) || "GLEIS_01";
      const sensorId = cleanText(s?.id || "", 48);
      if (!sensorId) return;
      const m = getOrCreateModule(moduleId);
      if (!m.capabilities.includes("sensor")) m.capabilities.push("sensor");
      const idx = m.sensors.findIndex((x) => x.id === sensorId);
      const sensorObj = { id: sensorId, name: s?.name || sensorId, triggered: Boolean(s?.triggered), lastEvent: Number(s?.lastEvent || 0) };
      if (idx >= 0) m.sensors[idx] = sensorObj;
      else m.sensors.push(sensorObj);
    });

    const modulesMeta = safeHw.modules && typeof safeHw.modules === "object" ? safeHw.modules : {};
    Object.values(modulesMeta).forEach((mi) => {
      const moduleId = cleanText(mi?.id || "", 48);
      if (!moduleId) return;
      const m = getOrCreateModule(moduleId);
      m.name = cleanText(mi?.name || m.name, 80) || m.name;
      m.customName = Boolean(mi?.customName);
      m.type = cleanText(mi?.type || m.type, 40) || m.type;
      if (Array.isArray(mi?.capabilities) && mi.capabilities.length) {
        m.capabilities = mi.capabilities.filter((x) => ["relay", "sensor", "led", "environment"].includes(x));
      }
      m.kind = cleanText(mi?.kind || m.kind, 40) || m.kind;
      m.ip = cleanText(mi?.ip || m.ip, 80) || m.ip;
      m.lastHeartbeat = toNumber(mi?.lastHeartbeat, m.lastHeartbeat || 0);
      m.firmwareVersion = cleanText(mi?.firmwareVersion || "", 40);
      m.protocolVersion = toNumber(mi?.protocolVersion, 0);
      m.hardwareType = cleanText(mi?.hardwareType || "", 80);
      if (mi?.health && typeof mi.health === "object") {
        m.health = {
          relayDriverReady: typeof mi.health.relayDriverReady === "boolean" ? mi.health.relayDriverReady : null,
          environmentSensorReady: typeof mi.health.environmentSensorReady === "boolean" ? mi.health.environmentSensorReady : null,
          relayActiveLow: typeof mi.health.relayActiveLow === "boolean" ? mi.health.relayActiveLow : null,
          relayOutputLatch: Number.isInteger(Number(mi.health.relayOutputLatch)) ? Number(mi.health.relayOutputLatch) & 0xFFFF : null,
          relayDirectionMask: Number.isInteger(Number(mi.health.relayDirectionMask)) ? Number(mi.health.relayDirectionMask) & 0xFFFF : null,
          relayDriveMode: cleanText(mi.health.relayDriveMode || "", 40)
        };
      }
      m.online = moduleIsOnline(m);
    });

    Object.values(runtimeState.modules).forEach((m) => {
      const hasLed = m.capabilities.includes("led");
      const hasRail = m.capabilities.includes("relay") || m.capabilities.includes("sensor");
      m.kind = hasLed && hasRail ? "HYBRID" : hasLed ? "SIGNAL_LED" : hasRail ? "RELAY_SENSOR" : (m.kind || "UNKNOWN");
      m.type = m.kind;
      m.online = moduleIsOnline(m);
    });
  }

  return {
    getOrCreateModule,
    moduleIsOnline,
    moduleCompatibility,
    moduleCanControl,
    listModulesStatus,
    bootstrapModulesFromHardware
  };
}

module.exports = { createModuleRegistry };
