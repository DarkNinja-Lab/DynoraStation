"use strict";

import { API, state } from "../core/state.js";
import { api } from "../core/api.js";
import { setText } from "../core/utils.js";
import { layoutNormalisieren } from "../layout/layout.js";

function normalizeHardware(status) {
  const moduleMap = status?.moduleMap && typeof status.moduleMap === "object" ? status.moduleMap : {};
  return {
    moduleMap,
    relays: Array.isArray(status?.hardware?.relays) ? status.hardware.relays : [],
    sensors: Array.isArray(status?.hardware?.sensors) ? status.hardware.sensors : [],
    leds: Array.isArray(status?.hardware?.leds) ? status.hardware.leds : []
  };
}

export async function statusLaden({ ruhig = false } = {}) {
  if (state.statusLadenInFlight) return;
  state.statusLadenInFlight = true;

  try {
    const status = await api(API.STATUS_URL, { method: "GET", cache: "no-store" });
    state.statusDaten = status;
    state.hardwareCache = normalizeHardware(status);

    if (status.layout) {
      state.layout = status.layout;
      layoutNormalisieren();
    }

    setText("serverStatus", "WEBSERVER ONLINE");
    setText("serverCardStatus", "ONLINE");
    setText("sidebarServerStatus", "WebServer online");
  } catch {
    if (!ruhig) {
      setText("serverStatus", "WEBSERVER OFFLINE");
      setText("serverCardStatus", "OFFLINE");
      setText("sidebarServerStatus", "WebServer offline");
    }
  } finally {
    state.statusLadenInFlight = false;
  }
}