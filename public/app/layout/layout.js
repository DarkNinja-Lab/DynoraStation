"use strict";

import { API, DEFAULT_LAYOUT, state } from "../core/state.js";
import { api } from "../core/api.js";
import { clone, ganzzahl, gueltigerLedKanal, gueltigesRelais, nummer, normalizeWinkel } from "../core/utils.js";

export async function layoutLaden() {
  try {
    state.layout = await api(API.LAYOUT_URL, { method: "GET", cache: "no-store" });
    layoutNormalisieren();
    localStorage.setItem("h0_bahn_server_layout", JSON.stringify(state.layout));
  } catch {
    const local = localStorage.getItem("h0_bahn_server_layout");
    if (local) {
      try { state.layout = JSON.parse(local); layoutNormalisieren(); return; } catch {}
    }
    state.layout = clone(DEFAULT_LAYOUT);
  }
}

export function layoutNormalisieren() {
  const layout = state.layout;
  if (!layout || typeof layout !== "object") state.layout = clone(DEFAULT_LAYOUT);

  state.layout.version = 30;
  state.layout.metadaten = state.layout.metadaten || {};
  state.layout.metadaten.name = String(state.layout.metadaten.name || "Meine Modellbahn");
  state.layout.metadaten.massstab = String(state.layout.metadaten.massstab || "H0");
  state.layout.metadaten.raster = ganzzahl(state.layout.metadaten.raster, 25);

  state.layout.elemente = Array.isArray(state.layout.elemente) ? state.layout.elemente : [];
  state.layout.verbindungen = Array.isArray(state.layout.verbindungen) ? state.layout.verbindungen : [];
  state.layout.stromkreise = Array.isArray(state.layout.stromkreise) ? state.layout.stromkreise : [];

  const map = new Map();

  state.layout.elemente.filter(Boolean).forEach((e) => {
    const typ = ["track", "crossing", "curve", "switch", "signal", "espSignal", "transformer"].includes(e.typ) ? e.typ : "track";
    const id = String(e.id || `ID_${Date.now()}`);
    if (map.has(id)) return;

    map.set(id, {
      id,
      typ,
      name: String(e.name ?? ""),
      x: nummer(e.x, 300),
      y: nummer(e.y, 250),
      winkel: normalizeWinkel(nummer(e.winkel, 0)),
      module: String(e.module || (typ === "espSignal" ? "LEDMOD_01" : "GLEIS_01")),
      trackCode: typ === "track" ? String(e.trackCode || "5106") : "",
      crossingCode: typ === "crossing" ? String(e.crossingCode || "5128") : "",
      curveCode: typ === "curve" ? String(e.curveCode || "5100") : "",
      switchCode: typ === "switch" ? String(e.switchCode || "5202") : "",
      signalCode: typ === "signal" ? String(e.signalCode || "7039") : "",
      espSignalCode: typ === "espSignal" ? String(e.espSignalCode || "ESP_SIGNALMST") : "",
      relay: gueltigesRelais(e.relay || 0),
      sensorId: (typ === "transformer" || typ === "espSignal") ? "" : String(e.sensorId || ""),
      powerState: Boolean(e.powerState),
      relayStraight: gueltigesRelais(e.relayStraight || 0),
      relayBranch: gueltigesRelais(e.relayBranch || 0),
      switchState: e.switchState === "abzweig" ? "abzweig" : "gerade",
      defaultSwitchState: e.defaultSwitchState === "abzweig" ? "abzweig" : "gerade",
      relayHp0: gueltigesRelais(e.relayHp0 || 0),
      relayHp1: gueltigesRelais(e.relayHp1 || 0),
      signalState: e.signalState === "fahrt" ? "fahrt" : "halt",
      defaultSignalState: e.defaultSignalState === "fahrt" ? "fahrt" : "halt",
      linkedSignalId: String(e.linkedSignalId || ""),
      ledChannelRed: gueltigerLedKanal(e.ledChannelRed || 0),
      ledChannelGreen: gueltigerLedKanal(e.ledChannelGreen || 0),
      espState: e.espState === "fahrt" ? "fahrt" : "halt",
      defaultEspState: e.defaultEspState === "fahrt" ? "fahrt" : "halt"
    });
  });

  state.layout.elemente = Array.from(map.values());
}