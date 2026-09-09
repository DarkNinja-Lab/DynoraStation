"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";
import { renderCanvas, inspectorLeer } from "./render.js";
import { showToast } from "../ui/toast.js";

export function ensureCanvasGeometry() {
  const svg = document.getElementById("builderSvg");
  if (svg && !svg.viewBox.baseVal.width) {
    svg.setAttribute("viewBox", "0 0 1600 900");
  }
}

export function setupBuilderButtons() {
  console.log("🔧 Setup Builder Buttons...");

  if (!state.layout.elemente) {
    state.layout.elemente = [];
  }

  state.selectedTool = "select";
  state.showLabels = true;
  state.snapToGrid = true;

  // Add element buttons
  document.querySelectorAll(".add-element-button").forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const type = btn.dataset.add;
      console.log(`📦 Adding element: ${type}`);
      addElement(type);
    });
  });

  // Save Layout
  const saveBtn = document.getElementById("saveLayoutButton");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      console.log("💾 Saving layout...");
      try {
        await apiCall("/layout/save", {
          method: "POST",
          body: state.layout
        });
        showToast("✅ Layout gespeichert!");
      } catch (e) {
        console.error(e);
        showToast("❌ Fehler beim Speichern!", "error");
      }
    });
  }

  // Clear Layout
  const clearBtn = document.getElementById("clearLayoutButton");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("Wirklich leeren?")) {
        state.layout.elemente = [];
        state.selectedElement = null;
        renderCanvas();
        inspectorLeer();
        showToast("🗑️ Layout geleert");
      }
    });
  }

  console.log("✅ Builder Buttons ready");
}

function addElement(type) {
  if (!["track", "curve", "switch", "crossing", "signal", "espSignal", "transformer"].includes(type)) return;

  if (!state.layout.elemente) {
    state.layout.elemente = [];
  }

  const id = "elem_" + Math.random().toString(36).substr(2, 9);
  const idx = state.layout.elemente.length;
  
  const newElement = {
    id,
    typ: type,
    name: "",
    x: 300 + (idx % 6) * 250,
    y: 250 + Math.floor(idx / 6) * 150,
    rotation: 0,
    
    // Common
    module: type === "espSignal" ? "LEDMOD_01" : "GLEIS_01",
    
    // Track/Curve/Crossing
    relay: 0,
    sensorId: "",
    
    // Switch
    relayStraight: 0,
    relayBranch: 0,
    switchState: "gerade",
    
    // Signal
    relayHp0: 0,
    relayHp1: 0,
    signalState: "halt",
    
    // ESP Signal
    ledChannelRed: 0,
    ledChannelGreen: 0,
    espState: "halt"
  };

  state.layout.elemente.push(newElement);
  state.selectedElement = id;
  renderCanvas();
  
  showToast(`✅ ${type} hinzugefügt`);
}
