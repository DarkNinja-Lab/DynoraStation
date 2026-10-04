"use strict";

import { validateImport } from "../builder/model.js?v=workspace-v11";
import { state } from "../core/state.js?v=workspace-v11";
import { apiCall } from "../core/api.js?v=workspace-v11";

function normalizeElementForUi(element) {
  const e = { ...element };
  if (e.typ === "xtrack") e.typ = "crossing";
  if (e.typ === "ledSignal") e.typ = "espSignal";
  e.rotation = Number(e.rotation ?? e.winkel ?? 0);
  e.winkel = e.rotation;
  e.espState = e.espState || e.ledState || "halt";
  e.signalAspectMode = e.signalAspectMode === "rgy" ? "rgy" : "rg";
  e.showInDirectControl = e.showInDirectControl !== false;
  if (e.signalAspectMode === "rg" && e.espState === "warnung") e.espState = e.ledState = "halt";
  return e;
}

export async function layoutLaden() {
  let stationLoaded = false;
  state.recoverableDraft = null;
  try {
    const data = await apiCall("/status");
    const layout = data?.layout || (Array.isArray(data?.elemente) ? data : null);
    if (layout) {
      stationLoaded = true;
      state.layoutVersion = data.layoutVersion || layout._editVersion;
      state.layoutDirty = false;
      state.layout = {
        ...layout,
        elemente: Array.isArray(layout.elemente) ? layout.elemente.map(normalizeElementForUi) : [],
        verbindungen: Array.isArray(layout.verbindungen) ? layout.verbindungen : []
      };
    }
  } catch (error) {
    console.warn("Layout konnte nicht geladen werden", error);
  }
    try {
      const draft = JSON.parse(localStorage.getItem("dynora.layoutDraft") || localStorage.getItem("dynora.layoutDraft.backup") || "null");
      if (draft?.layout && Array.isArray(draft.layout.elemente)) {
        validateImport(draft.layout);
        if (stationLoaded) {
          state.recoverableDraft = draft;
        } else {
          state.layout = { ...draft.layout, elemente: draft.layout.elemente.map(normalizeElementForUi), verbindungen: Array.isArray(draft.layout.verbindungen) ? draft.layout.verbindungen : [] };
          state.layoutDirty = true;
        }
      }
    } catch {}
}

export function layoutNormalisieren() {
  if (!Array.isArray(state.layout.elemente)) state.layout.elemente = [];
  if (!Array.isArray(state.layout.verbindungen)) state.layout.verbindungen = [];
  state.layout.elemente = state.layout.elemente.map(normalizeElementForUi);
  if (!state.layout.metadaten) state.layout.metadaten = {};
  state.layout.metadaten.plateWidthMm = Math.max(500, Math.min(20000, Number(state.layout.metadaten.plateWidthMm) || 3200));
  state.layout.metadaten.plateHeightMm = Math.max(500, Math.min(20000, Number(state.layout.metadaten.plateHeightMm) || 1800));
  state.layout.metadaten.rasterMm = Math.max(5, Math.min(200, Number(state.layout.metadaten.rasterMm) || (Number(state.layout.metadaten.raster) || 12.5) * 2));
  state.layout.metadaten.raster = state.layout.metadaten.rasterMm * .5;
}

let pendingSave = null;

export function updateSaveStatus() {
  const label = document.getElementById("layoutMessage");
  if (label) {
    label.textContent = pendingSave ? "Wird gespeichert …" : state.layoutConflict ? "Speicherkonflikt · Entwurf erhalten" : state.layoutDirty ? "Ungespeicherte Änderungen" : "Plan gespeichert";
    label.dataset.status = pendingSave ? "saving" : state.layoutDirty ? "dirty" : "saved";
  }
  const button = document.getElementById("saveLayoutButton");
  if (button) button.disabled = Boolean(pendingSave);
}

export function persistDraft() {
  if (state.layoutDirty) {
    // Preserve an offered older draft before new edits replace the main draft.
    if (state.recoverableDraft) {
      try { localStorage.setItem("dynora.layoutDraft.backup", JSON.stringify(state.recoverableDraft)); } catch {}
    }
    try { localStorage.setItem("dynora.layoutDraft", JSON.stringify({ savedAt: Date.now(), layout: state.layout })); } catch {}
  }
  updateSaveStatus();
}

export function layoutSpeichern() {
  if (pendingSave) return pendingSave;
  const snapshot = JSON.stringify(state.layout);
  pendingSave = (async () => {
    try {
      const result = await apiCall("/layout", { method: "POST", body: snapshot, headers: { "If-Match": state.layoutVersion || "" } });
      state.layoutVersion = result.layoutVersion;
      state.layoutConflict = false;
      const conflict = document.getElementById("layoutConflict");
      if (conflict) conflict.hidden = true;
      state.relayConflicts = Array.isArray(result?.warnings?.relayConflicts) ? result.warnings.relayConflicts : [];
      if (state.recoverableDraft) {
        try { localStorage.setItem("dynora.layoutDraft.backup", JSON.stringify(state.recoverableDraft)); } catch {}
      }
      state.pendingStationLayout = null;
      state.pendingStationVersion = null;
      state.statusRevisions.layout = 0;
      if (JSON.stringify(state.layout) === snapshot) {
        if (result.layout) { state.layout = result.layout; layoutNormalisieren(); }
        state.layoutDirty = false;
        try { localStorage.removeItem("dynora.layoutDraft"); } catch {}
      } else {
        state.layoutDirty = true;
        persistDraft();
      }
      return result;
    } catch (error) {
      if (error.code === "LAYOUT_CONFLICT" || error.code === "LAYOUT_VERSION_REQUIRED") {
        state.layoutDirty = true;
        state.layoutConflict = true;
        persistDraft();
        const conflict = document.getElementById("layoutConflict");
        if (conflict) conflict.hidden = false;
      }
      throw error;
    } finally {
      pendingSave = null;
      updateSaveStatus();
    }
  })();
  updateSaveStatus();
  return pendingSave;
}
