"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";
import { renderCanvas, inspectorLeer } from "./render.js";
import { showToast } from "../ui/toast.js";
import { recordHistory, undoHistory, redoHistory } from "./history.js";

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
        await apiCall("/layout", {
          method: "POST",
          body: state.layout
        });
        state.layoutDirty = false;
        try { localStorage.removeItem("dynora.layoutDraft"); } catch {}
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
        recordHistory();
        state.layout.elemente = [];
        state.layout.verbindungen = [];
        state.layoutDirty = true;
        state.selectedElement = null;
        renderCanvas();
        inspectorLeer();
        showToast("🗑️ Layout geleert");
      }
    });
  }

  document.getElementById("undoButton")?.addEventListener("click", () => {
    if (!undoHistory()) return;
    renderCanvas(); inspectorLeer(); showToast("Letzte Änderung rückgängig gemacht");
  });
  document.getElementById("redoButton")?.addEventListener("click", () => {
    if (!redoHistory()) return;
    renderCanvas(); inspectorLeer(); showToast("Änderung wiederhergestellt");
  });

  console.log("✅ Builder Buttons ready");
}

function addElement(type) {
  if (!["track", "curve", "switch", "crossing", "signal", "espSignal", "transformer"].includes(type)) return;

  if (!state.layout.elemente) {
    state.layout.elemente = [];
  }

  const id = "elem_" + Math.random().toString(36).slice(2, 11);
  const occupied = new Set(state.layout.elemente.map((element) =>
    `${Math.round(Number(element.x || 0) / 25)}:${Math.round(Number(element.y || 0) / 25)}`
  ));
  let position = { x: 300, y: 250 };
  let found = false;
  for (let y = 150; y <= 750 && !found; y += 100) {
    for (let x = 200; x <= 1400; x += 125) {
      if (!occupied.has(`${Math.round(x / 25)}:${Math.round(y / 25)}`)) {
        position = { x, y };
        found = true;
        break;
      }
    }
  }
  
  const catalogSelectIds = { track: "trackTypeSelect", curve: "curveTypeSelect", switch: "switchTypeSelect", crossing: "xTrackTypeSelect" };
  const catalogSelectId = catalogSelectIds[type];
  const catalogCode = catalogSelectId ? document.getElementById(catalogSelectId)?.value || "" : "";

  const newElement = {
    id,
    typ: type,
    name: "",
    x: position.x,
    y: position.y,
    rotation: 0,
    winkel: 0,
    catalogCode,
    trackCode: type === "track" ? catalogCode : "",
    curveCode: type === "curve" ? catalogCode : "",
    switchCode: type === "switch" ? catalogCode : "",
    xTrackCode: type === "crossing" ? catalogCode : "",
    
    // Common
    module: preferredModule(type === "espSignal" ? "led" : "relay"),
    
    // Track/Curve/Crossing
    relay: 0,
    relayA: 0,
    relayB: 0,
    xState: "gerade",
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
    ledChannelYellow: 0,
    ledChannelGreen: 0,
    espState: "halt"
  };

  recordHistory();
  state.layout.elemente.push(newElement);
  state.layoutDirty = true;
  state.selectedElement = id;
  renderCanvas();
  
  showToast(`✅ ${type} hinzugefügt`);
}

function preferredModule(capability) {
  const modules = Object.values(state.hardware?.modules || {});
  const exact = modules.find((module) => Array.isArray(module.capabilities) && module.capabilities.includes(capability));
  if (exact) return exact.id;
  const byKind = modules.find((module) => capability === "led"
    ? ["SIGNAL_LED", "HYBRID"].includes(module.kind)
    : ["RELAY_SENSOR", "HYBRID"].includes(module.kind));
  return byKind?.id || "";
}
