"use strict";

const { toNumber } = require("../../utils/parse");
const { cleanText, validRelay, validLedChannel, validBrightness } = require("../../utils/sanitize");
const { defaultHardware, defaultLightButtons } = require("../defaults");

function normalizeLightButtons(input) {
  const base = defaultLightButtons();
  if (!Array.isArray(input)) return base;

  return base.map((b, i) => {
    const src = input[i] || {};
    return {
      id: i + 1,
      name: cleanText(src.name || b.name, 64) || b.name,
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
