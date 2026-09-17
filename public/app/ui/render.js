"use strict";

import { state } from "../core/state.js";
import { svg, drawDoubleRailLine, drawPowerLine, drawCurveDual, drawPowerCurve, drawSwitchShape, drawCrossingShape, drawSignalShape, drawEspSignalShape, drawTransformerShape } from "../builder/shapes.js";

function esc(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

function dashboardCatalogItem(element, group) {
  const code = element.trackCode || element.curveCode || element.switchCode || element.xTrackCode || element.catalogCode;
  return (state.catalog?.[group] || []).find((item) => String(item.code) === String(code)) || {};
}

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
        <small>${m.kind === "SIGNAL_LED" ? "Signal/LED" : m.kind === "RELAY_SENSOR" ? "Relay/Sensor" : m.kind === "HYBRID" ? "Hybrid" : "Typ wird erkannt"} · ${m.ip || (m.online ? "verbunden" : "keine aktuelle IP")}</small>
      </div>
    </div>
  `).join("");
}

function controlTileVisual(element) {
  const type = element.typ === "xtrack" ? "crossing" : element.typ === "ledSignal" ? "espSignal" : element.typ;
  if (type === "switch") {
    const branchRight = dashboardCatalogItem(element, "switches").handed === "right";
    const branchY = branchRight ? 43 : 13;
    const straight = element.switchState !== "abzweig";
    return `<svg class="control-symbol" viewBox="0 0 112 56" aria-hidden="true">
      <path class="symbol-base" d="M12 28H100"/>
      <path class="symbol-base" d="M12 28Q50 28 88 ${branchY}"/>
      <path class="symbol-route ${straight ? "selected" : ""}" d="M12 28H100"/>
      <path class="symbol-route ${straight ? "" : "selected"}" d="M12 28Q50 28 88 ${branchY}"/>
      <circle class="symbol-node" cx="30" cy="28" r="3"/>
    </svg>`;
  }
  if (type === "crossing") {
    const curved = element.xState === "abzweig";
    return `<svg class="control-symbol" viewBox="0 0 112 56" aria-hidden="true">
      <path class="symbol-base" d="M12 12L100 44M12 44L100 12"/>
      <path class="symbol-base" d="M12 12Q56 28 100 12M12 44Q56 28 100 44"/>
      <g class="symbol-route selected">${curved
        ? '<path d="M12 12Q56 28 100 12"/><path d="M12 44Q56 28 100 44"/>'
        : '<path d="M12 12L100 44"/><path d="M12 44L100 12"/>'}</g>
    </svg>`;
  }
  const stateValue = element.signalState || element.ledState || element.espState || "halt";
  const hasWarning = type === "espSignal" && element.signalAspectMode === "rgy";
  return `<svg class="control-symbol signal-symbol" viewBox="0 0 112 56" aria-hidden="true">
    <path class="signal-mast" d="M56 47V13"/>
    <rect class="signal-head" x="43" y="4" width="26" height="42" rx="10"/>
    <circle class="signal-lamp stop ${stateValue === "halt" ? "lit" : ""}" cx="56" cy="14" r="5"/>
    ${hasWarning ? `<circle class="signal-lamp warning ${stateValue === "warnung" ? "lit" : ""}" cx="56" cy="25" r="5"/>` : ""}
    <circle class="signal-lamp go ${stateValue === "fahrt" ? "lit" : ""}" cx="56" cy="${hasWarning ? 36 : 34}" r="5"/>
  </svg>`;
}

function readableControlState(element) {
  const value = element.typ === "switch" ? element.switchState
    : element.typ === "xtrack" || element.typ === "crossing" ? element.xState
    : element.typ === "signal" ? element.signalState
    : (element.ledState || element.espState);
  return ({ gerade: "Gerade", abzweig: "Abzweig", halt: "Halt", warnung: "Warnung", fahrt: "Fahrt" })[value] || "Nicht gemeldet";
}

export function renderCs3Tiles() {
  const grid = document.getElementById("cs3TileGrid");
  if (!grid) return;

  const controllable = (state.layout?.elemente || []).filter((element) => ["switch", "xtrack", "crossing", "signal", "ledSignal", "espSignal"].includes(element.typ));
  const tiles = controllable.map((element) => {
    const type = element.typ === "xtrack" || element.typ === "crossing" ? "Kreuzungsweiche" : element.typ === "signal" ? "Signal" : element.typ === "ledSignal" || element.typ === "espSignal" ? "ESP-Signal" : "Weiche";
    const stateText = readableControlState(element);
    const stateClass = stateText.toLowerCase().replaceAll(" ", "-");
    const active = ["Fahrt", "Abzweig", "Warnung"].includes(stateText);
    return `<button class="cs3-tile ${active ? "active" : ""} state-${stateClass}" data-element-id="${esc(element.id)}" type="button" aria-label="${esc(element.name || type)} schalten, aktuell ${esc(stateText)}">
      <span class="cs3-tile-heading"><b>${esc(element.name || type)}</b><small>${esc(type)}</small></span>
      <span class="cs3-tile-visual">${controlTileVisual(element)}</span>
      <span class="cs3-tile-state"><i></i><span>${esc(stateText)}</span><b>Schalten</b></span>
    </button>`;
  }).join("");

  grid.innerHTML = tiles || '<div class="empty-state">Keine schaltbaren Weichen oder Signale im Plan</div>';
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

export function renderDashboardOverview() {
  const modules = Object.values(state.hardware?.modules || {});
  const moduleHost = document.getElementById("dashboardModuleList");
  if (moduleHost) {
    moduleHost.innerHTML = modules.length ? modules.slice(0, 6).map((module) => {
      const kind = module.kind === "SIGNAL_LED" ? "Signal/LED" : module.kind === "RELAY_SENSOR" ? "Relay/Sensor" : module.kind === "HYBRID" ? "Hybrid" : "Noch nicht erkannt";
      const channels = `${module.relays?.length || 0} R · ${module.sensors?.length || 0} S · ${module.leds?.length || 0} LED`;
      return `<article class="dashboard-module-row"><span class="module-health-dot ${module.online ? "online" : "offline"}"></span><div><strong>${esc(module.name || module.id)}</strong><small>${kind} · ${channels}</small></div><b>${module.online ? "Online" : "Offline"}</b></article>`;
    }).join("") : '<div class="empty-state">Noch keine ESP-Module registriert.</div>';
  }

  const eventHost = document.getElementById("dashboardEventList");
  if (eventHost) {
    const events = Array.isArray(state.events) ? state.events.slice(0, 5) : [];
    eventHost.innerHTML = events.length ? events.map((event) => {
      const time = event.timestamp || event.time ? new Date(event.timestamp || event.time).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "–";
      return `<article class="dashboard-event-row"><span>${esc(event.type || "SYSTEM")}</span><div><strong>${esc(event.text || "Ereignis")}</strong><small>${esc(event.source || "System")}</small></div><time>${time}</time></article>`;
    }).join("") : '<div class="empty-state">Noch keine Ereignisse vorhanden.</div>';
  }

  renderDashboardTrack();
}

function renderDashboardTrack() {
  const layer = document.getElementById("dashboardTrackElements");
  const empty = document.getElementById("dashboardTrackEmpty");
  if (!layer) return;
  const elements = state.layout?.elemente || [];
  layer.replaceChildren();
  if (empty) empty.style.display = elements.length ? "none" : "block";
  elements.slice(0, 120).forEach((element) => {
    const group = svg("g");
    group.setAttribute("transform", `translate(${Number(element.x || 0)} ${Number(element.y || 0)}) rotate(${Number(element.rotation ?? element.winkel ?? 0)})`);
    const type = element.typ === "xtrack" ? "crossing" : element.typ === "ledSignal" ? "espSignal" : element.typ;
    if (type === "track") { const item = dashboardCatalogItem(element, "tracks"); const half = Math.max(12, Number(item.length || 180) * .25); drawDoubleRailLine(group, -half, 0, half, 0, "#d5dbe0", 8); if (element.powerState) drawPowerLine(group, -half + 3, 0, half - 3, 0); }
    if (type === "curve") { const item = dashboardCatalogItem(element, "curves"); const radius = Number(item.radius || 360) * .5; const angle = Number(item.angleDeg || 30); drawCurveDual(group, radius, angle, "#d5dbe0"); if (element.powerState) drawPowerCurve(group, radius, angle); }
    if (type === "switch") { const item = dashboardCatalogItem(element, "switches"); drawSwitchShape(group, item.handed || "left", element.switchState !== "abzweig", item); }
    if (type === "crossing") { const item = dashboardCatalogItem(element, "crossings"); drawCrossingShape(group, item, element.xState || "gerade"); }
    if (type === "signal") drawSignalShape(group, element.signalState);
    if (type === "espSignal") drawEspSignalShape(group, element.espState || element.ledState, element.signalAspectMode);
    if (type === "transformer") drawTransformerShape(group);
    layer.appendChild(group);
  });
}
