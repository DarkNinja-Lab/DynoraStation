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
    console.warn("⚠️ Katalog konnte nicht geladen werden");
    state.catalog = {
      tracks: [],
      curves: [],
      switches: [],
      crossings: [],
      signals: [],
      transformers: [],
      espSignals: []
    };
  }
}

export function katalogUIInit() {
  console.log("🎨 Initialisiere Katalog UI mit Bildern...");
  
  // Track Types
  const trackTypeHost = document.getElementById("trackTypeSelectHost");
  if (trackTypeHost && state.catalog.tracks?.length > 0) {
    trackTypeHost.innerHTML = `
      <select id="trackTypeSelect" style="width: 100%; padding: 6px;">
        ${state.catalog.tracks.map(t => `
          <option value="${t.label}" data-image="/assets/track/${t.label}.jpg">
            ${t.label} (${t.length || "?"}mm)
          </option>
        `).join("")}
      </select>
    `;
    addImagePreview("trackTypeSelect");
  }

  // Curve Types
  const curveTypeHost = document.getElementById("curveTypeSelectHost");
  if (curveTypeHost && state.catalog.curves?.length > 0) {
    curveTypeHost.innerHTML = `
      <select id="curveTypeSelect" style="width: 100%; padding: 6px;">
        ${state.catalog.curves.map(c => `
          <option value="${c.label}" data-image="/assets/track/${c.label}.jpg">
            ${c.label} (R${c.radius || "?"}mm)
          </option>
        `).join("")}
      </select>
    `;
    addImagePreview("curveTypeSelect");
  }

  // Switch Types
  const switchTypeHost = document.getElementById("switchTypeSelectHost");
  if (switchTypeHost && state.catalog.switches?.length > 0) {
    switchTypeHost.innerHTML = `
      <select id="switchTypeSelect" style="width: 100%; padding: 6px;">
        ${state.catalog.switches.map(s => `
          <option value="${s.label}" data-image="/assets/track/${s.label}.jpg">
            ${s.label}
          </option>
        `).join("")}
      </select>
    `;
    addImagePreview("switchTypeSelect");
  }

  // Crossing Types
  const xTrackTypeHost = document.getElementById("xTrackTypeSelectHost");
  if (xTrackTypeHost && state.catalog.crossings?.length > 0) {
    xTrackTypeHost.innerHTML = `
      <select id="xTrackTypeSelect" style="width: 100%; padding: 6px;">
        ${state.catalog.crossings.map(x => `
          <option value="${x.label}" data-image="/assets/track/${x.label}.jpg">
            ${x.label}
          </option>
        `).join("")}
      </select>
    `;
    addImagePreview("xTrackTypeSelect");
  }

  console.log("✅ Katalog UI initialisiert");
}

function addImagePreview(selectId) {
  const select = document.getElementById(selectId);
  if (!select) return;

  // Create preview container
  const preview = document.createElement("div");
  preview.style.cssText = `
    width: 100%;
    height: 60px;
    margin-top: 6px;
    background: #222;
    border: 1px solid #444;
    border-radius: 3px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  `;

  const img = document.createElement("img");
  img.style.cssText = `
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  `;

  // Set initial image
  const firstOption = select.options[0];
  if (firstOption?.dataset.image) {
    img.src = firstOption.dataset.image;
    img.onerror = () => {
      img.style.display = "none";
      preview.textContent = "Kein Bild verfügbar";
    };
  }

  preview.appendChild(img);
  select.parentElement.insertBefore(preview, select.nextSibling);

  // Update image on select change
  select.addEventListener("change", () => {
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption?.dataset.image) {
      img.src = selectedOption.dataset.image;
      img.style.display = "block";
      preview.textContent = "";
      preview.appendChild(img);
    }
  });
}