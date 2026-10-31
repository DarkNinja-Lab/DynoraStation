"use strict";

const express = require("express");
const { wrap, apiError } = require("../utils/errors");
const { cleanText, validRelay, makeOperationId } = require("../utils/sanitize");

const DEFAULT_LOCATION = { name: "Deutschland (Mitte)", latitude: 51.1657, longitude: 10.4515, timezone: "Europe/Berlin" };
const timeOr = (value, fallback) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : fallback;
const clampInt = (value, fallback, min, max) => Math.max(min, Math.min(max, Math.round(Number.isFinite(Number(value)) ? Number(value) : fallback)));
function validTimezone(value) {
  const timezone = cleanText(value || DEFAULT_LOCATION.timezone, 64) || DEFAULT_LOCATION.timezone;
  try { new Intl.DateTimeFormat("en", { timeZone: timezone }).format(); return timezone; }
  catch { return DEFAULT_LOCATION.timezone; }
}

function normalizeLightSystem(input) {
  const source = input && typeof input === "object" ? input : {};
  const location = source.location && typeof source.location === "object" ? source.location : {};
  const groups = (Array.isArray(source.groups) ? source.groups : []).slice(0, 32).map((group, index) => {
    const settings = group?.settings && typeof group.settings === "object" ? group.settings : {};
    const seen = new Set();
    const relays = (Array.isArray(group?.relays) ? group.relays : []).slice(0, 64).map((relay) => ({
      module: cleanText(relay?.module || "", 48), channel: validRelay(relay?.channel), name: cleanText(relay?.name || "", 48)
    })).filter((relay) => {
      if (!relay.module || !relay.channel) return false;
      const key = `${relay.module}:${relay.channel}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {
      id: cleanText(group?.id || `light-group-${index + 1}`, 48) || `light-group-${index + 1}`,
      name: cleanText(group?.name || `Lichtgruppe ${index + 1}`, 64) || `Lichtgruppe ${index + 1}`,
      kind: ["house", "street", "custom"].includes(group?.kind) ? group.kind : "custom",
      behavior: ["presence", "sunset", "daily", "manual"].includes(group?.behavior) ? group.behavior : "daily",
      enabled: group?.enabled !== false,
      relays,
      settings: {
        startTime: timeOr(settings.startTime, "18:00"), endTime: timeOr(settings.endTime, "23:30"),
        onTime: timeOr(settings.onTime, "18:00"), offTime: timeOr(settings.offTime, "23:00"),
        minOnMin: clampInt(settings.minOnMin, 2, 1, 180), maxOnMin: clampInt(settings.maxOnMin, 12, 1, 240),
        minOffMin: clampInt(settings.minOffMin, 1, 1, 180), maxOffMin: clampInt(settings.maxOffMin, 8, 1, 240),
        sunsetOffsetMin: clampInt(settings.sunsetOffsetMin, 0, -180, 180),
        sunriseOffsetMin: clampInt(settings.sunriseOffsetMin, 15, -180, 180)
      }
    };
  });
  groups.forEach((group) => {
    group.settings.maxOnMin = Math.max(group.settings.minOnMin, group.settings.maxOnMin);
    group.settings.maxOffMin = Math.max(group.settings.minOffMin, group.settings.maxOffMin);
  });
  return {
    location: {
      name: cleanText(location.name || DEFAULT_LOCATION.name, 64) || DEFAULT_LOCATION.name,
      latitude: Math.max(-90, Math.min(90, Number.isFinite(Number(location.latitude)) ? Number(location.latitude) : DEFAULT_LOCATION.latitude)),
      longitude: Math.max(-180, Math.min(180, Number.isFinite(Number(location.longitude)) ? Number(location.longitude) : DEFAULT_LOCATION.longitude)),
      timezone: validTimezone(location.timezone)
    },
    groups,
    // Keep the old editor data until users have moved any saved scene programs into groups.
    outputs: Array.isArray(source.outputs) ? source.outputs.slice(0, 8) : [],
    programs: Array.isArray(source.programs) ? source.programs.slice(0, 20) : [],
    activeProgramId: cleanText(source.activeProgramId || "", 48)
  };
}

function dateParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

function localMinutes(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  return Number(parts.find((part) => part.type === "hour")?.value || 0) * 60 + Number(parts.find((part) => part.type === "minute")?.value || 0);
}

function timeMinutes(value) {
  const [hour, minute] = String(value || "00:00").split(":").map(Number);
  return (hour || 0) * 60 + (minute || 0);
}

function isTimeWindow(now, startText, endText, timezone) {
  const nowMinute = localMinutes(now, timezone);
  const start = timeMinutes(startText);
  const end = timeMinutes(endText);
  if (start === end) return false;
  return start < end ? nowMinute >= start && nowMinute < end : nowMinute >= start || nowMinute < end;
}

const rad = (degrees) => degrees * Math.PI / 180;
const degrees = (radians) => radians * 180 / Math.PI;
const normalizeDegrees = (value) => (value % 360 + 360) % 360;

function solarEvent(date, latitude, longitude, isSunrise) {
  const { year, month, day } = date;
  const n = Math.floor((Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 0)) / 86400000);
  const lngHour = longitude / 15;
  const t = n + ((isSunrise ? 6 : 18) - lngHour) / 24;
  const m = 0.9856 * t - 3.289;
  const l = normalizeDegrees(m + 1.916 * Math.sin(rad(m)) + 0.020 * Math.sin(2 * rad(m)) + 282.634);
  let ra = normalizeDegrees(degrees(Math.atan(0.91764 * Math.tan(rad(l)))));
  ra += Math.floor(l / 90) * 90 - Math.floor(ra / 90) * 90;
  ra /= 15;
  const sinDec = 0.39782 * Math.sin(rad(l));
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(rad(90.833)) - sinDec * Math.sin(rad(latitude))) / (cosDec * Math.cos(rad(latitude)));
  if (cosH < -1 || cosH > 1) return null;
  const h = (isSunrise ? 360 - degrees(Math.acos(cosH)) : degrees(Math.acos(cosH))) / 15;
  const localMean = h + ra - 0.06571 * t - 6.622;
  const utcHours = (localMean - lngHour + 24 * 4) % 24;
  return Date.UTC(year, month - 1, day) + utcHours * 3600000;
}

function groupDescription(group, location) {
  if (group.behavior === "presence") return `Zufällige Beleuchtung ${group.settings.startTime}–${group.settings.endTime}`;
  if (group.behavior === "sunset") return `Sonnenuntergang bis Sonnenaufgang · ${location.name}`;
  if (group.behavior === "daily") return `Täglich ${group.settings.onTime} an · ${group.settings.offTime} aus`;
  return "Manuell schalten";
}

function createLightSystemRoutes({ runtimeState, moduleRegistry, commandQueueApi, queueWriteHardware, addEvent }) {
  const router = express.Router();
  runtimeState.hardware.lightSystem = normalizeLightSystem(runtimeState.hardware.lightSystem || {});
  const runtime = runtimeState.lightSystemRuntime || (runtimeState.lightSystemRuntime = { groups: {}, updatedAt: Date.now() });
  if (!runtime.groups) runtime.groups = {};

  function relayLiveState(relay) {
    const module = runtimeState.modules?.[relay.module];
    return typeof module?.relays?.[relay.channel - 1] === "boolean" ? module.relays[relay.channel - 1] : null;
  }

  function controlRelay(group, relay, desired) {
    const module = runtimeState.modules?.[relay.module];
    if (!moduleRegistry.moduleIsOnline(module) || !moduleRegistry.moduleCompatibility(module).compatible || module?.health?.relayDriverReady === false) return false;
    if (!Array.isArray(module.relays) || relay.channel > module.relays.length || !module.capabilities?.includes("relay")) return false;
    if (relayLiveState(relay) === desired) return true;
    const pending = runtimeState.commandQueue.find((command) => command.module === relay.module && command.type === "RELAY_SET" && Number(command.data?.channel) === relay.channel);
    if (pending && Boolean(pending.data?.state) === desired) return true;
    commandQueueApi.createCommand("RELAY_SET", {
      channel: relay.channel, state: desired, operationId: makeOperationId("LIGHT_GROUP"),
      triggerOnConfirm: true, triggerKind: "relay"
    }, relay.module);
    return true;
  }

  function randomBetween(min, max) { return min + Math.random() * (Math.max(min, max) - min); }

  function updatePresence(group, groupRuntime, now, timezone) {
    const within = isTimeWindow(now, group.settings.startTime, group.settings.endTime, timezone);
    const localDate = dateParts(now, timezone);
    const dateKey = `${localDate.year}-${localDate.month}-${localDate.day}`;
    if (!within) {
      group.relays.forEach((relay) => controlRelay(group, relay, false));
      groupRuntime.inWindow = false;
      groupRuntime.dateKey = dateKey;
      groupRuntime.nextAt = 0;
      return;
    }
    if (!groupRuntime.inWindow || groupRuntime.dateKey !== dateKey) {
      groupRuntime.inWindow = true;
      groupRuntime.dateKey = dateKey;
      groupRuntime.outputs = {};
      group.relays.forEach((relay) => {
        const key = `${relay.module}:${relay.channel}`;
        groupRuntime.outputs[key] = { nextAt: now.getTime() + randomBetween(5000, 45000) };
      });
    }
    let nextAt = Infinity;
    for (const relay of group.relays) {
      const key = `${relay.module}:${relay.channel}`;
      const entry = groupRuntime.outputs[key] || (groupRuntime.outputs[key] = { nextAt: now.getTime() + randomBetween(5000, 45000) });
      if (now.getTime() >= entry.nextAt) {
        const live = relayLiveState(relay);
        const currentlyOn = live === true;
        const turnOn = !currentlyOn && Math.random() < 0.56;
        const desired = currentlyOn ? Math.random() >= 0.52 : turnOn;
        controlRelay(group, relay, desired);
        const minutes = desired
          ? randomBetween(group.settings.minOnMin, group.settings.maxOnMin)
          : randomBetween(group.settings.minOffMin, group.settings.maxOffMin);
        entry.nextAt = now.getTime() + minutes * 60000;
      }
      nextAt = Math.min(nextAt, entry.nextAt);
    }
    groupRuntime.nextAt = Number.isFinite(nextAt) ? nextAt : 0;
  }

  function desiredSunState(group, system, now) {
    const location = system.location;
    let parts;
    try { parts = dateParts(now, location.timezone); } catch { parts = dateParts(now, "Europe/Berlin"); }
    const sunrise = solarEvent(parts, location.latitude, location.longitude, true);
    const sunset = solarEvent(parts, location.latitude, location.longitude, false);
    if (sunrise == null || sunset == null) return false;
    const sunriseOff = sunrise + group.settings.sunriseOffsetMin * 60000;
    const sunsetOn = sunset + group.settings.sunsetOffsetMin * 60000;
    return now.getTime() < sunriseOff || now.getTime() >= sunsetOn;
  }

  function evaluateSchedules() {
    const system = runtimeState.hardware.lightSystem;
    const now = new Date();
    const known = new Set();
    for (const group of system.groups || []) {
      known.add(group.id);
      const groupRuntime = runtime.groups[group.id] || (runtime.groups[group.id] = { active: false, state: "bereit", nextAt: 0, outputs: {} });
      if (!group.enabled) {
        if (group.behavior !== "manual") group.relays.forEach((relay) => controlRelay(group, relay, false));
        groupRuntime.active = false; groupRuntime.state = "Pausiert"; groupRuntime.nextAt = 0;
        continue;
      }
      if (group.behavior === "presence") {
        updatePresence(group, groupRuntime, now, system.location.timezone);
        groupRuntime.active = true;
        groupRuntime.state = isTimeWindow(now, group.settings.startTime, group.settings.endTime, system.location.timezone) ? "Zufällige Beleuchtung läuft" : "Wartet auf Startzeit";
      } else if (group.behavior === "sunset" || group.behavior === "daily") {
        const desired = group.behavior === "sunset"
          ? desiredSunState(group, system, now)
          : isTimeWindow(now, group.settings.onTime, group.settings.offTime, system.location.timezone);
        group.relays.forEach((relay) => controlRelay(group, relay, desired));
        groupRuntime.active = true;
        groupRuntime.state = desired ? "Licht ist an" : "Wartet auf Einschaltzeit";
        groupRuntime.nextAt = 0;
      } else {
        groupRuntime.active = false; groupRuntime.state = "Manuell"; groupRuntime.nextAt = 0;
      }
      groupRuntime.updatedAt = now.getTime();
    }
    Object.keys(runtime.groups).forEach((id) => { if (!known.has(id)) delete runtime.groups[id]; });
    runtime.updatedAt = now.getTime();
  }

  function response() {
    const lightSystem = runtimeState.hardware.lightSystem;
    return {
      ok: true, lightSystem, runtime,
      groups: lightSystem.groups.map((group) => ({
        ...group, description: groupDescription(group, lightSystem.location),
        runtime: runtime.groups[group.id] || { active: false, state: group.enabled ? "Wird gestartet" : "Pausiert", nextAt: 0 }
      }))
    };
  }

  router.get("/api/light-system", (_req, res) => res.json(response()));

  router.post("/api/light-system", wrap(async (req, res) => {
    const lightSystem = normalizeLightSystem(req.body?.lightSystem || req.body);
    const retained = new Set(lightSystem.groups.map((group) => group.id));
    for (const oldGroup of runtimeState.hardware.lightSystem.groups || []) {
      if (!retained.has(oldGroup.id) && oldGroup.behavior !== "manual") oldGroup.relays.forEach((relay) => controlRelay(oldGroup, relay, false));
    }
    runtimeState.hardware.lightSystem = lightSystem;
    runtimeState.hardware.updatedAt = Date.now();
    if ((await queueWriteHardware())?.ok === false) throw apiError(500, "SAVE_FAILED", "Lichtgruppen konnten nicht gespeichert werden");
    evaluateSchedules();
    addEvent("LICHTSYSTEM", "SYSTEM", "Lichtgruppen gespeichert");
    res.json(response());
  }));

  router.post("/api/light-system/groups/:id/control", wrap(async (req, res) => {
    const group = runtimeState.hardware.lightSystem.groups.find((item) => item.id === req.params.id);
    if (!group) throw apiError(404, "LIGHT_GROUP_NOT_FOUND", "Lichtgruppe nicht gefunden");
    if (group.behavior !== "manual") throw apiError(409, "LIGHT_GROUP_AUTOMATED", "Direktes Schalten ist nur bei manuellen Lichtgruppen möglich.");
    if (!group.enabled) throw apiError(409, "LIGHT_GROUP_PAUSED", "Setze die Gruppe zuerst fort.");
    const on = req.body?.state === true;
    let queued = 0;
    group.relays.forEach((relay) => { if (controlRelay(group, relay, on)) queued += 1; });
    addEvent("LICHTSYSTEM", group.id, `${group.name}: manuell ${on ? "eingeschaltet" : "ausgeschaltet"}`);
    res.json({ ...response(), queued });
  }));

  const scheduler = setInterval(evaluateSchedules, 15000);
  scheduler.unref?.();
  evaluateSchedules();
  return router;
}

module.exports = { createLightSystemRoutes, normalizeLightSystem, solarEvent };
