"use strict";

import { state } from "../core/state.js";

export function builderRender() {
  // Render builder canvas
  console.log("Builder render called");
}

export function trackRender() {
  // Render track display
  console.log("Track render called");
}

export function inspectorLeer() {
  const inspector = document.getElementById("inspector");
  if (inspector) {
    inspector.innerHTML = `
      <div class="inspector-empty">
        <div class="inspector-empty-icon">◇</div>
        <strong>Kein Element ausgewählt</strong>
        <span>Klicke ein Gleis, eine Kreuzungsweiche, eine Kurve, Weiche, Hauptsignal 7039, ESP-Signalmast oder Trafo an.</span>
      </div>
    `;
  }
}

export function renderSidebarEspStatus() {
  const espList = document.getElementById("sidebarEspList");
  if (!espList) return;

  if (!state.hardware.modules || Object.keys(state.hardware.modules).length === 0) {
    espList.innerHTML = '<div class="sidebar-esp-empty">Noch kein ESP verbunden.</div>';
    return;
  }

  espList.innerHTML = Object.values(state.hardware.modules).map(m => `
    <div class="sidebar-esp-item ${m.online ? "online" : "offline"}">
      <div class="esp-status-dot"></div>
      <div>
        <strong>${m.name || m.id}</strong>
        <small>${m.ip || "Unbekannt"}</small>
      </div>
    </div>
  `).join("");
}

export function renderCs3Tiles() {
  const grid = document.getElementById("cs3TileGrid");
  if (!grid) return;

  const tiles = (state.cs3Tiles || []).map(tile => `
    <button class="cs3-tile ${tile.active ? "active" : ""}" data-id="${tile.id}" type="button">
      <span>${tile.name}</span>
    </button>
  `).join("");

  grid.innerHTML = tiles || '<div class="empty-state">Keine Schaltfelder definiert</div>';
}

export function renderTrackLightButtons() {
  const grid = document.getElementById("trackLightGrid");
  if (!grid) return;

  const buttons = (state.lightButtons || []).map((btn, idx) => `
    <button class="light-toggle-btn ${btn.active ? "active" : ""}" data-light-index="${idx}" type="button">
      ${btn.name || `Licht ${idx + 1}`}
    </button>
  `).join("");

  grid.innerHTML = buttons || `
    <button class="light-toggle-btn" data-light-index="0" type="button">Licht 1</button>
    <button class="light-toggle-btn" data-light-index="1" type="button">Licht 2</button>
    <button class="light-toggle-btn" data-light-index="2" type="button">Licht 3</button>
    <button class="light-toggle-btn" data-light-index="3" type="button">Licht 4</button>
  `;
}
