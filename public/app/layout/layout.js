"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

export async function layoutLaden() {
  try {
    const data = await apiCall("/status");
    if (data.layout) {
      state.layout = data.layout;
    }
    console.log("Layout geladen:", state.layout);
  } catch (error) {
    console.warn("Layout konnte nicht geladen werden");
    state.layout = { elements: [], connections: [] };
  }
}

export function layoutNormalisieren() {
  if (!state.layout.elements) state.layout.elements = [];
  if (!state.layout.connections) state.layout.connections = [];
  console.log("Layout normalisiert");
}

export async function layoutSpeichern() {
  try {
    await apiCall("/layout/save", {
      method: "POST",
      body: state.layout
    });
    console.log("Layout gespeichert");
  } catch (error) {
    console.error("Layout speichern fehlgeschlagen:", error);
  }
}
