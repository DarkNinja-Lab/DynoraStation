"use strict";

const { toNumber } = require("../../utils/parse");
const { cleanText, validRelay, validLedChannel, validBrightness } = require("../../utils/sanitize");
const { defaultHardware, defaultLightButtons } = require("../defaults");

function validTimezone(value) {
  const timezone = cleanText(value || "Europe/Berlin", 64) || "Europe/Berlin";
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); return timezone; }
  catch { return "Europe/Berlin"; }
}

function normalizeLightButtons(input) {
  const base = defaultLightButtons();
  if (!Array.isArray(input)) return base;

  return base.map((b, i) => {
    const src = input[i] || {};
    return {
      id: i + 1,
      name: cleanText(src.name || b.name, 64) || b.name,
      icon: ["light", "signal", "transformer", "power", "home", "device", "events", "track-straight"].includes(src.icon) ? src.icon : "light",
      module: cleanText(src.module ?? src.moduleId ?? b.module, 48),
      relay: validRelay(src.relay ?? src.relayIndex ?? 0)
    };
  });
}

function normalizeHardware(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = defaultHardware();

  out.version = 4;
  out.updatedAt = toNumber(src.updatedAt, 0);
  out.module = src.module && typeof src.module === "object" ? src.module : {};
  out.modules = {};
  const moduleMeta = src.modules && typeof src.modules === "object" ? src.modules : {};
  Object.entries(moduleMeta).forEach(([key, value]) => {
    const id = cleanText(value?.id || key, 48);
    if (!id) return;
    out.modules[id] = {
      id,
      name: cleanText(value?.name || `Modul ${id}`, 80) || `Modul ${id}`,
      customName: Boolean(value?.customName),
      type: cleanText(value?.type || value?.typ || "GLEISSTEUERUNG", 40) || "GLEISSTEUERUNG",
      capabilities: Array.isArray(value?.capabilities)
        ? value.capabilities.filter((item) => ["relay", "sensor", "led", "environment"].includes(item))
        : [],
      kind: cleanText(value?.kind || "UNKNOWN", 40) || "UNKNOWN",
      ip: cleanText(value?.ip || "", 80),
      lastHeartbeat: toNumber(value?.lastHeartbeat, 0),
      firmwareVersion: cleanText(value?.firmwareVersion || "", 40),
      protocolVersion: toNumber(value?.protocolVersion, 0),
      hardwareType: cleanText(value?.hardwareType || "", 80)
    };
  });

  const relayMap = new Map();
  (Array.isArray(src.relays) ? src.relays : []).forEach((r, idx) => {
    const channel = validRelay(r?.channel ?? idx + 1);
    if (!channel) return;
    const moduleId = cleanText(r?.module || "", 48);
    if (!moduleId) return;
    const key = `${moduleId}#${channel}`;
    if (relayMap.has(key)) return;

    relayMap.set(key, {
      id: String(r?.id || `RELAY_${moduleId}_${channel}`),
      module: moduleId,
      channel,
      name: cleanText(r?.name || `Relais ${channel}`, 64) || `Relais ${channel}`,
      role: cleanText(r?.role || "", 64),
      state: Boolean(r?.state)
    });
  });

  const ledMap = new Map();
  (Array.isArray(src.leds) ? src.leds : []).forEach((l, idx) => {
    const channel = validLedChannel(l?.channel ?? idx + 1);
    if (!channel) return;
    const moduleId = cleanText(l?.module || "", 48);
    if (!moduleId) return;
    const key = `${moduleId}#${channel}`;
    if (ledMap.has(key)) return;

    const brightness = validBrightness(l?.brightness ?? (l?.state ? 255 : 0));

    ledMap.set(key, {
      id: String(l?.id || `LED_${moduleId}_${channel}`),
      module: moduleId,
      channel,
      name: cleanText(l?.name || `LED ${channel}`, 64) || `LED ${channel}`,
      color: cleanText(l?.color || "rot", 20) || "rot",
      state: Boolean(l?.state),
      brightness,
      blinking: Boolean(l?.blinking)
    });
  });

  const sensorMap = new Map();
  (Array.isArray(src.sensors) ? src.sensors : []).forEach((s, idx) => {
    const id = cleanText(s?.id || `S${idx + 1}`, 48);
    if (!id) return;
    const moduleId = cleanText(s?.module || "", 48);
    if (!moduleId) return;
    const key = `${moduleId}#${id}`;
    if (sensorMap.has(key)) return;

    sensorMap.set(key, {
      id,
      module: moduleId,
      name: cleanText(s?.name || id, 64) || id,
      triggered: Boolean(s?.triggered),
      lastEvent: toNumber(s?.lastEvent, 0)
    });
  });

  out.relays = Array.from(relayMap.values()).sort((a, b) => {
    if (a.module === b.module) return a.channel - b.channel;
    return a.module.localeCompare(b.module);
  });

  out.leds = Array.from(ledMap.values()).sort((a, b) => {
    if (a.module === b.module) return a.channel - b.channel;
    return a.module.localeCompare(b.module);
  });

  out.sensors = Array.from(sensorMap.values()).sort((a, b) => {
    if (a.module === b.module) return a.id.localeCompare(b.id);
    return a.module.localeCompare(b.module);
  });

  out.lightButtons = normalizeLightButtons(src.lightButtons);
  const lightSystem = src.lightSystem && typeof src.lightSystem === "object" ? src.lightSystem : {};
  const inputPrograms = Array.isArray(lightSystem.programs) ? lightSystem.programs : (Array.isArray(lightSystem.steps) ? [lightSystem] : []);
  out.lightSystem = {
    location: {
      name: cleanText(lightSystem.location?.name || "Deutschland (Mitte)", 64) || "Deutschland (Mitte)",
      latitude: Math.max(-90, Math.min(90, toNumber(lightSystem.location?.latitude, 51.1657))),
      longitude: Math.max(-180, Math.min(180, toNumber(lightSystem.location?.longitude, 10.4515))),
      timezone: validTimezone(lightSystem.location?.timezone)
    },
    groups: (Array.isArray(lightSystem.groups) ? lightSystem.groups : []).slice(0, 32).map((group, groupIndex) => {
      const settings = group?.settings && typeof group.settings === "object" ? group.settings : {};
      const time = (value, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : fallback;
      const numbers = (key, fallback, min, max) => Math.max(min, Math.min(max, Math.round(toNumber(settings[key], fallback))));
      const relayKeys = new Set();
      const relays = (Array.isArray(group?.relays) ? group.relays : []).slice(0, 64).map((relay) => ({
        module: cleanText(relay?.module || "", 48), channel: validRelay(relay?.channel),
        name: cleanText(relay?.name || "", 48)
      })).filter((relay) => {
        if (!relay.module || !relay.channel) return false;
        const key = `${relay.module}:${relay.channel}`;
        if (relayKeys.has(key)) return false;
        relayKeys.add(key);
        return true;
      });
      const behavior = ["presence", "sunset", "daily", "manual"].includes(group?.behavior) ? group.behavior : "daily";
      return {
        id: cleanText(group?.id || `light-group-${groupIndex + 1}`, 48) || `light-group-${groupIndex + 1}`,
        name: cleanText(group?.name || `Lichtgruppe ${groupIndex + 1}`, 64) || `Lichtgruppe ${groupIndex + 1}`,
        kind: ["house", "street", "custom"].includes(group?.kind) ? group.kind : "custom",
        behavior, enabled: group?.enabled !== false, relays,
        settings: {
          startTime: time(settings.startTime, "18:00"), endTime: time(settings.endTime, "23:30"),
          onTime: time(settings.onTime, "18:00"), offTime: time(settings.offTime, "23:00"),
          minOnMin: numbers("minOnMin", 2, 1, 180), maxOnMin: numbers("maxOnMin", 12, 1, 240),
          minOffMin: numbers("minOffMin", 1, 1, 180), maxOffMin: numbers("maxOffMin", 8, 1, 240),
          sunsetOffsetMin: numbers("sunsetOffsetMin", 0, -180, 180), sunriseOffsetMin: numbers("sunriseOffsetMin", 15, -180, 180)
        }
      };
    }),
    activeProgramId: cleanText(lightSystem.activeProgramId || "", 48),
    outputs: (Array.isArray(lightSystem.outputs) ? lightSystem.outputs : []).slice(0, 8).map((output) => ({
      name: cleanText(output?.name || "", 48), module: cleanText(output?.module || "", 48), channel: validRelay(output?.channel)
    })),
    programs: inputPrograms.slice(0, 20).map((program, programIndex) => ({
      id: cleanText(program?.id || `program-${programIndex + 1}`, 48) || `program-${programIndex + 1}`,
      name: cleanText(program?.name || `Lichtmodus ${programIndex + 1}`, 64) || `Lichtmodus ${programIndex + 1}`,
      loop: program?.loop !== false,
      steps: (Array.isArray(program?.steps) ? program.steps : []).slice(0, 40).map((step, index) => ({
      id: cleanText(step?.id || `step-${index + 1}`, 48) || `step-${index + 1}`,
      name: cleanText(step?.name || `Szene ${index + 1}`, 64) || `Szene ${index + 1}`,
      durationSec: Math.max(1, Math.min(3600, toNumber(step?.durationSec, 300))),
      states: (Array.isArray(step?.states) ? step.states : []).slice(0, 8).map((state) => state === true ? true : state === false ? false : null)
      }))
    }))
  };
  out.defaults = Array.isArray(src.defaults) ? src.defaults.slice(0, 100) : [];
  out.ledConfig = {};
  const ledConfig = src.ledConfig && typeof src.ledConfig === "object" ? src.ledConfig : {};
  Object.entries(ledConfig).forEach(([key, value]) => {
    const split = String(key).lastIndexOf(":");
    if (split <= 0 || !value || typeof value !== "object") return;
    const moduleId = cleanText(String(key).slice(0, split), 48);
    const channel = validLedChannel(String(key).slice(split + 1));
    if (!moduleId || !channel) return;
    out.ledConfig[`${moduleId}:${channel}`] = {
      name: cleanText(value.name || `LED ${channel}`, 64) || `LED ${channel}`,
      color: cleanText(value.color || "weiss", 20) || "weiss",
      brightness: validBrightness(value.brightness ?? 255)
    };
  });
  out.leds.forEach((led) => {
    const config = out.ledConfig[`${led.module}:${led.channel}`];
    if (!config) return;
    led.name = config.name;
    led.color = config.color;
  });

  return out;
}

module.exports = {
  normalizeHardware,
  normalizeLightButtons
};
