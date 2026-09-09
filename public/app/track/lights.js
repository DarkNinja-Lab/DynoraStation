"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

export async function lightButtonsLaden() {
  try {
    const data = await apiCall("/status");
    if (Array.isArray(data?.lightButtons) && data.lightButtons.length) {
      state.lightButtons = data.lightButtons.slice(0, 4);
    } else if (!Array.isArray(state.lightButtons) || state.lightButtons.length < 4) {
      state.lightButtons = [
        { name: "Licht 1", moduleId: "", relayIndex: 0, active: false },
        { name: "Licht 2", moduleId: "", relayIndex: 1, active: false },
        { name: "Licht 3", moduleId: "", relayIndex: 2, active: false },
        { name: "Licht 4", moduleId: "", relayIndex: 3, active: false }
      ];
    }
  } catch {
    if (!Array.isArray(state.lightButtons) || state.lightButtons.length < 4) {
      state.lightButtons = [
        { name: "Licht 1", moduleId: "", relayIndex: 0, active: false },
        { name: "Licht 2", moduleId: "", relayIndex: 1, active: false },
        { name: "Licht 3", moduleId: "", relayIndex: 2, active: false },
        { name: "Licht 4", moduleId: "", relayIndex: 3, active: false }
      ];
    }
  }
}

export async function lightButtonToggle(index) {
  const btn = state.lightButtons?.[index];
  if (!btn) return;

  try {
    await apiCall("/control/relay", {
      method: "POST",
      body: {
        moduleId: btn.moduleId,
        relayIndex: btn.relayIndex,
        state: !btn.active
      }
    });
    btn.active = !btn.active;
  } catch (err) {
    console.warn("Licht schalten fehlgeschlagen:", err?.message || err);
  }
}

export function renderTrackLightButtons() {
  const grid = document.getElementById("trackLightGrid");
  if (!grid) return;

  const src = Array.isArray(state.lightButtons) ? state.lightButtons : [];
  const html = src.map((btn, idx) => `
    <button class="light-toggle-btn ${btn?.active ? "active" : ""}" data-light-index="${idx}" type="button">
      ${btn?.name || `Licht ${idx + 1}`}
    </button>
  `).join("");

  grid.innerHTML = html || `
    <button class="light-toggle-btn" data-light-index="0" type="button">Licht 1</button>
    <button class="light-toggle-btn" data-light-index="1" type="button">Licht 2</button>
    <button class="light-toggle-btn" data-light-index="2" type="button">Licht 3</button>
    <button class="light-toggle-btn" data-light-index="3" type="button">Licht 4</button>
  `;
}