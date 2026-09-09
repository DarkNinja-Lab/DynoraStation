"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

export async function lightButtonsLaden() {
  try {
    const data = await apiCall("/status");
    if (data.lightButtons) {
      state.lightButtons = data.lightButtons;
    } else {
      state.lightButtons = createDefaultLightButtons();
    }
    console.log("Light Buttons geladen:", state.lightButtons);
  } catch (error) {
    console.warn("Light Buttons konnte nicht geladen werden");
    state.lightButtons = createDefaultLightButtons();
  }
}

export function renderTrackLightButtons() {
  const grid = document.getElementById("trackLightGrid");
  if (!grid) return;

  const buttons = (state.lightButtons || []).map((btn, idx) => `
    <button class="light-toggle-btn" data-light-index="${idx}" type="button">
      ${btn.name || `Licht ${idx + 1}`}
    </button>
  `).join("");

  grid.innerHTML = buttons || `
    <button class="light-toggle-btn" data-light-index="0" type="button">Licht 1</button>
    <button class="light-toggle-btn" data-light-index="1" type="button">Licht 2</button>
    <button class="light-toggle-btn" data-light-index="2" type="button">Licht 3</button>
    <button class="light-toggle-btn" data-light-index="3" type="button">Licht 4</button>
  `;

  // Add event listeners
  grid.querySelectorAll(".light-toggle-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = parseInt(btn.dataset.lightIndex);
      try {
        await apiCall("/control/light", {
          method: "POST",
          body: { index: idx, toggle: true }
        });
      } catch (error) {
        console.error("Light control error:", error);
      }
    });
  });
}

function createDefaultLightButtons() {
  return [
    { id: "light-1", name: "Licht 1", index: 0, module: null, relay: null },
    { id: "light-2", name: "Licht 2", index: 1, module: null, relay: null },
    { id: "light-3", name: "Licht 3", index: 2, module: null, relay: null },
    { id: "light-4", name: "Licht 4", index: 3, module: null, relay: null }
  ];
}
