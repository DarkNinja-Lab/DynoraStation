"use strict";

const { cleanText, validBrightness } = require("../../utils/sanitize");
const { toNumber } = require("../../utils/parse");

function createModuleRegistry({ runtimeState, moduleTimeout }) {
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
        relays: [],
        sensors: [],
        leds: []
      };
    }
    return runtimeState.modules[id];
  }

  function moduleIsOnline(m) {
    const hb = Number(m?.lastHeartbeat || 0);
    return hb > 0 && (Date.now() - hb) < moduleTimeout;
  }

  function listModulesStatus() {
    return Object.values(runtimeState.modules).map((m) => {
      const online = moduleIsOnline(m);
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
        relays: Array.isArray(m.relays) ? m.relays : [],
        relais: Array.isArray(m.relays) ? m.relays : [],
        sensors: Array.isArray(m.sensors) ? m.sensors : [],
        sensoren: Array.isArray(m.sensors) ? m.sensors : [],
        leds: Array.isArray(m.leds) ? m.leds : [],
        lastHeartbeat: Number(m.lastHeartbeat || 0)
      };
    });
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
      while (m.leds.length < channel) {
        m.leds.push({ state: false, brightness: 0, blinking: false });
      }
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
      const sensorObj = {
        id: sensorId,
        name: s?.name || sensorId,
        triggered: Boolean(s?.triggered),
        lastEvent: Number(s?.lastEvent || 0)
      };

      if (idx >= 0) m.sensors[idx] = sensorObj;
      else m.sensors.push(sensorObj);
    });

    // FIX: modules (Plural) statt module
    const modulesMeta = safeHw.modules && typeof safeHw.modules === "object" ? safeHw.modules : {};
    Object.values(modulesMeta).forEach((mi) => {
      const moduleId = cleanText(mi?.id || "", 48);
      if (!moduleId) return;

      const m = getOrCreateModule(moduleId);
      m.name = cleanText(mi?.name || m.name, 80) || m.name;
      m.customName = Boolean(mi?.customName);
      m.type = cleanText(mi?.type || m.type, 40) || m.type;
      if (Array.isArray(mi?.capabilities) && mi.capabilities.length) {
        m.capabilities = mi.capabilities.filter((x) => ["relay", "sensor", "led"].includes(x));
      }
      m.kind = cleanText(mi?.kind || m.kind, 40) || m.kind;
      m.ip = cleanText(mi?.ip || m.ip, 80) || m.ip;
      m.lastHeartbeat = toNumber(mi?.lastHeartbeat, m.lastHeartbeat || 0);
      m.online = moduleIsOnline(m);
    });

    // Final konsistent setzen
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
    listModulesStatus,
    bootstrapModulesFromHardware
  };
}

module.exports = { createModuleRegistry };
