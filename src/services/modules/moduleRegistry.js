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
        type: "GLEISSTEUERUNG",
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
    return m.lastHeartbeat > 0 && Date.now() - m.lastHeartbeat < moduleTimeout;
  }

  function listModulesStatus() {
    return Object.values(runtimeState.modules).map((m) => ({
      id: m.id,
      name: m.name,
      type: m.type,
      typ: m.type,
      ip: m.ip,
      online: moduleIsOnline(m),
      relays: m.relays,
      relais: m.relays,
      sensors: m.sensors,
      sensoren: m.sensors,
      leds: m.leds,
      lastHeartbeat: m.lastHeartbeat
    }));
  }

  function bootstrapModulesFromHardware(hardware) {
    hardware.relays.forEach((r) => {
      const m = getOrCreateModule(r.module);
      while (m.relays.length < r.channel) m.relays.push(false);
      m.relays[r.channel - 1] = Boolean(r.state);
    });

    hardware.leds.forEach((l) => {
      const m = getOrCreateModule(l.module);
      while (m.leds.length < l.channel) m.leds.push({ state: false, brightness: 0, blinking: false });
      m.leds[l.channel - 1] = {
        state: Boolean(l.state),
        brightness: validBrightness(l.brightness),
        blinking: Boolean(l.blinking)
      };
    });

    hardware.sensors.forEach((s) => {
      const m = getOrCreateModule(s.module);
      if (!m.sensors.find((x) => x.id === s.id)) {
        m.sensors.push({
          id: s.id,
          name: s.name || s.id,
          triggered: Boolean(s.triggered),
          lastEvent: Number(s.lastEvent || 0)
        });
      }
    });

    Object.values(hardware.module || {}).forEach((mi) => {
      const m = getOrCreateModule(mi.id);
      m.lastHeartbeat = toNumber(mi.lastHeartbeat, 0);
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