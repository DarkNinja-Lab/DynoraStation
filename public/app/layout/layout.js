"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

function normalizeElementForUi(element) {
  const e = { ...element };
  if (e.typ === "xtrack") e.typ = "crossing";
  if (e.typ === "ledSignal") e.typ = "espSignal";
  e.rotation = Number(e.rotation ?? e.winkel ?? 0);
  e.winkel = Number(e.winkel ?? e.rotation ?? 0);
  e.espState = e.espState || e.ledState || "halt";
  return e;
}

export async function layoutLaden() {
  try {
    const data = await apiCall("/status");
    const layout = data?.layout || (Array.isArray(data?.elemente) ? data : null);
    if (layout) {
      state.layout = {
        ...layout,
        elemente: Array.isArray(layout.elemente) ? layout.elemente.map(normalizeElementForUi) : [],
        verbindungen: Array.isArray(layout.verbindungen) ? layout.verbindungen : []
      };
    }
    try {
      const draft = JSON.parse(localStorage.getItem("dynora.layoutDraft") || "null");
      if (draft?.layout && Array.isArray(draft.layout.elemente)) {
        state.layout = { ...draft.layout, elemente: draft.layout.elemente.map(normalizeElementForUi), verbindungen: Array.isArray(draft.layout.verbindungen) ? draft.layout.verbindungen : [] };
        state.layoutDirty = true;
      }
    } catch {}
  } catch (error) {
    console.warn("Layout konnte nicht geladen werden", error);
    state.layout = {
      version: 30,
      metadaten: { name: "Meine Modellbahn", massstab: "H0", raster: 25 },
      stromkreise: [],
      elemente: [],
      verbindungen: []
    };
  }
}

export function layoutNormalisieren() {
  if (!Array.isArray(state.layout.elemente)) state.layout.elemente = [];
  if (!Array.isArray(state.layout.verbindungen)) state.layout.verbindungen = [];
  state.layout.elemente = state.layout.elemente.map(normalizeElementForUi);
}

export async function layoutSpeichern() {
  await apiCall("/layout", { method: "POST", body: state.layout });
}
