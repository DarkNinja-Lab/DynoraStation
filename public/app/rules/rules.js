"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

export async function rulesLaden() {
  try {
    const data = await apiCall("/status");
    if (data.rules) {
      state.rules = data.rules;
    }
    console.log("Regeln geladen:", state.rules);
  } catch (error) {
    console.warn("Regeln konnte nicht geladen werden");
    state.rules = [];
  }
}

export async function ruleSpeichern(rule) {
  try {
    await apiCall("/rules/save", {
      method: "POST",
      body: rule
    });
    console.log("Regel gespeichert");
  } catch (error) {
    console.error("Regel speichern fehlgeschlagen:", error);
  }
}
