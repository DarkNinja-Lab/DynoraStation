"use strict";

import { API, CONST, state } from "../core/state.js";
import { api } from "../core/api.js";
import { gueltigesRelais } from "../core/utils.js";

function createDefaultTrackLightConfig() {
  return Array.from({ length: CONST.TRACK_LIGHT_COUNT }, (_, i) => ({
    id: i + 1,
    name: `Licht ${i + 1}`,
    module: "GLEIS_01",
    relay: 0
  }));
}

function normalizeTrackLightConfig(raw) {
  const base = createDefaultTrackLightConfig();
  if (!Array.isArray(raw)) return base;
  return base.map((entry, i) => {
    const src = raw[i] || {};
    return {
      id: i + 1,
      name: String(src.name || entry.name),
      module: String(src.module || entry.module),
      relay: gueltigesRelais(src.relay || 0)
    };
  });
}

export async function lightButtonsLaden() {
  try {
    const out = await api(API.LIGHT_BUTTONS_URL, { method: "GET", cache: "no-store" });
    state.trackLightConfig = normalizeTrackLightConfig(out.lightButtons);
  } catch {
    state.trackLightConfig = createDefaultTrackLightConfig();
  }
}

export function renderTrackLightButtons() {
  const grid = document.getElementById("trackLightGrid");
  if (!grid) return;

  const buttons = grid.querySelectorAll(".light-toggle-btn");
  buttons.forEach((btn) => {
    const idx = Number(btn.dataset.lightIndex || -1);
    const cfg = state.trackLightConfig[idx];
    if (!cfg) return;
    btn.textContent = cfg.name || `Licht ${idx + 1}`;
  });
}