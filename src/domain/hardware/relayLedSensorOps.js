"use strict";

const { cleanText, validRelay, validLedChannel, validBrightness } = require("../../utils/sanitize");

function upsertRelay(hardware, moduleId, channel, state) {
  const mId = cleanText(moduleId || "GLEIS_01", 48) || "GLEIS_01";
  const idx = hardware.relays.findIndex(
    (r) => r.module === mId && Number(r.channel) === Number(channel)
  );

  if (idx >= 0) {
    hardware.relays[idx].state = Boolean(state);
  } else {
    hardware.relays.push({
      id: `RELAY_${mId}_${channel}`,
      module: mId,
      channel,
      name: `Relais ${channel}`,
      role: "",
      state: Boolean(state)
    });
  }
}

function upsertLed(hardware, moduleId, channel, patch = {}) {
  const mId = cleanText(moduleId || "LEDMOD_01", 48) || "LEDMOD_01";
  const ch = validLedChannel(channel);
  if (!ch) return;

  const idx = hardware.leds.findIndex((l) => l.module === mId && Number(l.channel) === Number(ch));

  const nextObj = {
    id: `LED_${mId}_${ch}`,
    module: mId,
    channel: ch,
    name: `LED ${ch}`,
    color: "rot",
    state: false,
    brightness: 0,
    blinking: false,
    ...patch
  };

  nextObj.brightness = validBrightness(nextObj.brightness);
  nextObj.state = Boolean(nextObj.state);

  if (idx >= 0) {
    hardware.leds[idx] = { ...hardware.leds[idx], ...nextObj };
  } else {
    hardware.leds.push(nextObj);
  }
}

function upsertSensor(hardware, moduleId, sensorId, patch = {}) {
  const mId = cleanText(moduleId || "GLEIS_01", 48) || "GLEIS_01";
  const sId = cleanText(sensorId || "", 48);
  if (!sId) return;

  const idx = hardware.sensors.findIndex((s) => s.module === mId && s.id === sId);

  if (idx >= 0) {
    hardware.sensors[idx] = {
      ...hardware.sensors[idx],
      ...patch,
      module: mId,
      id: sId
    };
  } else {
    hardware.sensors.push({
      id: sId,
      module: mId,
      name: sId,
      triggered: false,
      lastEvent: 0,
      ...patch
    });
  }
}

function relayState(hardware, moduleId, channel) {
  const mId = cleanText(moduleId || "GLEIS_01", 48) || "GLEIS_01";
  const rr = hardware.relays.find((r) => r.module === mId && Number(r.channel) === Number(channel));
  return Boolean(rr?.state);
}

function ledState(hardware, moduleId, channel) {
  const mId = cleanText(moduleId || "LEDMOD_01", 48) || "LEDMOD_01";
  const ll = hardware.leds.find((l) => l.module === mId && Number(l.channel) === Number(channel));
  return Boolean(ll?.state);
}

module.exports = {
  upsertRelay,
  upsertLed,
  upsertSensor,
  relayState,
  ledState,
  validRelay
};