"use strict";

import { state, API, CONST } from "../core/state.js";
import { api } from "../core/api.js";

export async function katalogLaden() {
  try {
    const out = await api(API.CATALOG_URL, { method: "GET", cache: "no-store" });
    if (out?.trackCatalog && typeof out.trackCatalog === "object") state.trackCatalog = out.trackCatalog;
    if (out?.defaults) {
      state.selectedCodes.trackCode = String(out.defaults.trackCode || state.selectedCodes.trackCode);
      state.selectedCodes.crossingCode = String(out.defaults.crossingCode || state.selectedCodes.crossingCode);
      state.selectedCodes.curveCode = String(out.defaults.curveCode || state.selectedCodes.curveCode);
      state.selectedCodes.switchCode = String(out.defaults.switchCode || state.selectedCodes.switchCode);
      state.selectedCodes.signalCode = String(out.defaults.signalCode || state.selectedCodes.signalCode);
      state.selectedCodes.espSignalCode = String(out.defaults.espSignalCode || state.selectedCodes.espSignalCode);
    }
  } catch {}
}

export function catalogImagePath(code) {
  return `${CONST.TRACK_IMAGE_DIR}/${String(code)}.jpg`;
}

// UI-Init später separat auslagern
export function katalogUIInit() {}