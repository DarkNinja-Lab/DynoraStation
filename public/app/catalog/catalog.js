"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

export async function katalogLaden() {
  try {
    const data = await apiCall("/api/track-catalog");
    
    state.catalog = {
      tracks: data.tracks || [],
      curves: data.curves || [],
      switches: data.switches || [],
      crossings: data.crossings || [],
      signals: data.signals || [],
      transformers: data.transformers || [],
      espSignals: data.espSignals || []
    };
    
    console.log("✅ Katalog geladen:", state.catalog);
  } catch (error) {
    console.warn("⚠️ Katalog konnte nicht geladen werden, verwende Defaults");
    state.catalog = {
      tracks: [
        { kind: "track", label: "5106", length: 180 },
        { kind: "track", label: "5107", length: 90 },
        { kind: "track", label: "5108", length: 70 },
        { kind: "track", label: "5109", length: 45 },
        { kind: "track", label: "5110", length: 30 },
        { kind: "track", label: "5129", length: 22.5 }
      ],
      curves: [
        { kind: "curve", label: "5100", radius: 110, angleDeg: 30 },
        { kind: "curve", label: "5101", radius: 110, angleDeg: 15 },
        { kind: "curve", label: "5120", radius: 150, angleDeg: 30 }
      ],
      switches: [
        { kind: "weiche", label: "5202 links", handed: "left" },
        { kind: "weiche", label: "5203 rechts", handed: "right" }
      ],
      crossings: [
        { kind: "xtrack", label: "5128 Kreuzungsgleis", length: 193, crossingAngleDeg: 30 }
      ],
      signals: [
        { id: "7039", label: "Hauptsignal 7039" }
      ],
      transformers: [
        { id: "trafo", label: "Transformator" }
      ],
      espSignals: [
        { id: "esp-signal", label: "ESP-Signalmast" }
      ]
    };
  }
}

export function katalogUIInit() {
  console.log("🎨 Initialisiere Katalog UI...");
  
  // Track Types
  const trackTypeHost = document.getElementById("trackTypeSelectHost");
  if (trackTypeHost && state.catalog.tracks && state.catalog.tracks.length > 0) {
    trackTypeHost.innerHTML = `
      <select id="trackTypeSelect" style="width: 100%; padding: 4px;">
        ${state.catalog.tracks.map(t => `<option value="${t.label}">${t.label} (${t.length}mm)</option>`).join("")}
      </select>
    `;
  }

  // Curve Types
  const curveTypeHost = document.getElementById("curveTypeSelectHost");
  if (curveTypeHost && state.catalog.curves && state.catalog.curves.length > 0) {
    curveTypeHost.innerHTML = `
      <select id="curveTypeSelect" style="width: 100%; padding: 4px;">
        ${state.catalog.curves.map(c => `<option value="${c.label}">${c.label} (R${c.radius})</option>`).join("")}
      </select>
    `;
  }

  // Switch Types
  const switchTypeHost = document.getElementById("switchTypeSelectHost");
  if (switchTypeHost && state.catalog.switches && state.catalog.switches.length > 0) {
    switchTypeHost.innerHTML = `
      <select id="switchTypeSelect" style="width: 100%; padding: 4px;">
        ${state.catalog.switches.map(s => `<option value="${s.label}">${s.label}</option>`).join("")}
      </select>
    `;
  }

  // Crossing Types
  const xTrackTypeHost = document.getElementById("xTrackTypeSelectHost");
  if (xTrackTypeHost && state.catalog.crossings && state.catalog.crossings.length > 0) {
    xTrackTypeHost.innerHTML = `
      <select id="xTrackTypeSelect" style="width: 100%; padding: 4px;">
        ${state.catalog.crossings.map(x => `<option value="${x.label}">${x.label}</option>`).join("")}
      </select>
    `;
  }

  console.log("✅ Katalog UI initialisiert");
}