"use strict";

import { state } from "../core/state.js";
import { commandFeedbackForElement, commandStatusText, moduleControlInfo } from "../core/commands.js";
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

  espList.innerHTML = Object.values(state.hardware.modules).map(m => {
    const incompatible = m.compatibility?.compatible === false;
    const metadataWarning = !incompatible && m.compatibility?.status === "warning";
    const kind = m.kind === "SIGNAL_LED" ? "Signal/LED" : m.kind === "RELAY_SENSOR" ? "Relay/Sensor" : m.kind === "HYBRID" ? "Hybrid" : "Typ wird erkannt";
    const version = `FW ${m.firmwareVersion || "?"} · P${m.protocolVersion ?? "?"} · ${m.hardwareType || kind}`;
    const status = !m.online ? "OFFLINE" : incompatible ? "INKOMPATIBEL" : metadataWarning ? "WARNUNG" : "ONLINE";
    return `
    <div class="sidebar-esp-item ${m.online ? "online" : "offline"} ${incompatible ? "incompatible" : metadataWarning ? "compat-warning" : ""}">
      <div class="esp-status-dot" aria-hidden="true"></div>
      <div class="esp-status-copy">
        <strong>${esc(m.name || m.id)}</strong>
        <small>${esc(version)} · ${esc(m.ip || (m.online ? "verbunden" : "keine aktuelle IP"))}</small>
        ${incompatible || metadataWarning ? `<small class="compatibility-warning">${esc(m.compatibility?.reason || "Kompatibilitätsdaten unvollständig")}</small>` : ""}
      </div>
      <span class="esp-connection-state">${status}</span>
    </div>`;
  }).join("");
}

function controlTileVisual(element) {
  const type = element.typ === "xtrack" ? "crossing" : element.typ === "ledSignal" ? "espSignal" : element.typ;
  if (type === "switch") {
    const switchItem = dashboardCatalogItem(element, "switches");
    const branchRight = switchItem.handed === "right";
    const branchY = branchRight ? 43 : 13;
    const straight = element.switchState !== "abzweig";
    if (switchItem.switchStyle === "curved") {
      if (switchItem.switchGeometry === "5141") {
        const throughPath = branchRight ? "M10 12A94 94 0 0 1 103 38" : "M10 44A94 94 0 0 0 103 18";
        const branchPath = branchRight ? "M10 12A76 76 0 0 1 83 34" : "M10 44A76 76 0 0 0 83 22";
        return `<svg class="control-symbol" viewBox="0 0 112 56" aria-hidden="true">
          <path class="symbol-base" d="${throughPath}"/><path class="symbol-base" d="${branchPath}"/>
          <path class="symbol-route ${straight ? "selected" : ""}" d="${throughPath}"/>
          <path class="symbol-route ${straight ? "" : "selected"}" d="${branchPath}"/>
          <circle class="symbol-node" cx="28" cy="${branchRight ? 13 : 43}" r="3"/>
        </svg>`;
      }
      const innerPath = branchRight ? "M12 10Q57 10 99 34" : "M12 46Q57 46 99 22";
      const outerPath = branchRight ? "M12 10Q57 10 99 47" : "M12 46Q57 46 99 9";
      return `<svg class="control-symbol" viewBox="0 0 112 56" aria-hidden="true">
        <path class="symbol-base" d="${innerPath}"/><path class="symbol-base" d="${outerPath}"/>
        <path class="symbol-route ${straight ? "selected" : ""}" d="${innerPath}"/>
        <path class="symbol-route ${straight ? "" : "selected"}" d="${outerPath}"/>
        <circle class="symbol-node" cx="28" cy="${branchRight ? 12 : 44}" r="3"/>
      </svg>`;
    }
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
  const stateValue = directControlState(element);
  const hasWarning = type === "espSignal" && element.signalAspectMode === "rgy";
  return `<svg class="control-symbol signal-symbol" viewBox="0 0 112 56" aria-hidden="true">
    <path class="signal-mast" d="M56 47V13"/>
    <rect class="signal-head" x="43" y="4" width="26" height="42" rx="10"/>
    <circle class="signal-lamp stop ${stateValue === "halt" ? "lit" : ""}" cx="56" cy="14" r="5"/>
    ${hasWarning ? `<circle class="signal-lamp warning ${stateValue === "warnung" ? "lit" : ""}" cx="56" cy="25" r="5"/>` : ""}
    <circle class="signal-lamp go ${stateValue === "fahrt" ? "lit" : ""}" cx="56" cy="${hasWarning ? 36 : 34}" r="5"/>
  </svg>`;
}

export function directControlState(element) {
  const type = element.typ === "xtrack" ? "crossing" : element.typ === "ledSignal" ? "espSignal" : element.typ;
  if (type === "switch") return element.switchState === "abzweig" ? "abzweig" : "gerade";
  if (type === "crossing") return element.xState === "abzweig" ? "abzweig" : "gerade";
  if (type === "signal") return element.signalState === "fahrt" ? "fahrt" : "halt";
  if (type === "espSignal") {
    const stateValue = element.ledState || element.espState || "halt";
    return ["halt", "warnung", "fahrt"].includes(stateValue) ? stateValue : "halt";
  }
  return "halt";
}

function readableControlState(element) {
  const value = directControlState(element);
  return ({ gerade: "Gerade", abzweig: "Abzweig", halt: "Halt", warnung: "Warnung", fahrt: "Fahrt" })[value] || "Nicht gemeldet";
}

export function renderCs3Tiles() {
  const grid = document.getElementById("cs3TileGrid");
  if (!grid) return;

  const controllable = (state.layout?.elemente || []).filter((element) =>
    element.showInDirectControl !== false && ["switch", "xtrack", "crossing", "signal", "ledSignal", "espSignal"].includes(element.typ)
  );
  const tiles = controllable.map((element) => {
    const type = element.typ === "xtrack" || element.typ === "crossing" ? "Kreuzungsweiche" : element.typ === "signal" ? "Signal" : element.typ === "ledSignal" || element.typ === "espSignal" ? "ESP-Signal" : "Weiche";
    const stateText = readableControlState(element);
    const stateClass = stateText.toLowerCase().replaceAll(" ", "-");
    const active = ["Fahrt", "Abzweig", "Warnung"].includes(stateText);
    const control = moduleControlInfo(element.module);
    const feedback = commandFeedbackForElement(element.id);
    const commandText = commandStatusText(feedback);
    const pending = feedback?.status === "pending";
    const disabled = !control.enabled || pending;
    const secondary = commandText || (!control.enabled ? control.reason : "Schalten");
    return `<button class="cs3-tile ${active ? "active" : ""} state-${stateClass} ${!control.enabled ? "control-disabled" : ""} ${control.module && !control.module.online ? "offline" : ""} ${control.module?.compatibility?.compatible === false ? "incompatible" : ""} ${feedback?.status ? `command-${feedback.status}` : ""}" data-element-id="${esc(element.id)}" type="button" ${disabled ? "disabled" : ""} aria-label="${esc(element.name || type)}: ${esc(stateText)}. ${esc(secondary)}">
      <span class="cs3-tile-heading"><b>${esc(element.name || type)}</b><small>${esc(type)}</small></span>
      <span class="cs3-tile-visual">${controlTileVisual(element)}</span>
      <span class="cs3-tile-state"><i></i><span>${esc(stateText)}</span><b>${esc(secondary)}</b></span>
    </button>`;
  }).join("");

  grid.innerHTML = tiles || '<div class="empty-state">Keine schaltbaren Weichen oder Signale im Plan</div>';
}

export function renderTrackLightButtons() {
  const grid = document.getElementById("trackLightGrid");
  if (!grid) return;

  const buttons = (state.lightButtons || []).map((btn, idx) => `
    <button class="light-toggle-btn ${btn.active ? "active" : ""}" data-light-index="${idx}" type="button">
      ${esc(btn.name || `Licht ${idx + 1}`)}
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
  renderHardwareOverview(modules);
  const moduleHost = document.getElementById("dashboardModuleList");
  if (moduleHost) {
    moduleHost.innerHTML = modules.length ? modules.slice(0, 6).map((module) => {
      const kind = module.kind === "SIGNAL_LED" ? "Signal/LED" : module.kind === "RELAY_SENSOR" ? "Relay/Sensor" : module.kind === "HYBRID" ? "Hybrid" : "Noch nicht erkannt";
      const channels = `${module.relays?.length || 0} R · ${module.sensors?.length || 0} S · ${module.leds?.length || 0} LED`;
      const incompatible = module.compatibility?.compatible === false;
      const metadataWarning = !incompatible && module.compatibility?.status === "warning";
      const version = `FW ${module.firmwareVersion || "?"} · P${module.protocolVersion ?? "?"} · ${module.hardwareType || kind}`;
      return `<article class="dashboard-module-row ${incompatible ? "incompatible" : metadataWarning ? "compat-warning" : ""}"><span class="module-health-dot ${module.online && !incompatible ? "online" : "offline"}"></span><div><strong>${esc(module.name || module.id)}</strong><small>${esc(version)} · ${channels}</small>${incompatible || metadataWarning ? `<small class="compatibility-warning">${esc(module.compatibility?.reason || "Kompatibilitätsdaten unvollständig")}</small>` : ""}</div><b>${!module.online ? "Offline" : incompatible ? "Inkompatibel" : metadataWarning ? "Warnung" : "Online"}</b></article>`;
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

function renderHardwareOverview(modules) {
  const online = modules.filter((module) => module.online).length;
  const relays = modules.reduce((sum, module) => sum + (module.relays?.length || 0), 0);
  const leds = modules.reduce((sum, module) => sum + (module.leds?.length || 0), 0);
  const sensors = modules.reduce((sum, module) => sum + (module.sensors?.length || 0), 0);
  const assigned = (state.hardware?.relays || []).filter((item) => item.name || item.role).length
    + (state.hardware?.sensors || []).filter((item) => item.name && item.name !== item.id).length
    + Object.keys(state.ledConfig || {}).length;
  const setText = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  setText("settingsModulesSummary", `${online} / ${modules.length}`);
  setText("settingsOutputsSummary", String(relays + leds));
  setText("settingsSensorsSummary", String(sensors));
  setText("settingsConfigSummary", String(assigned));
  const health = document.getElementById("settingsHealthStatus");
  if (health) {
    const incompatible = modules.filter((module) => module.compatibility?.compatible === false).length;
    const conflicts = Array.isArray(state.relayConflicts) ? state.relayConflicts.length : 0;
    const healthy = modules.length > 0 && online === modules.length && incompatible === 0 && conflicts === 0;
    health.classList.toggle("healthy", healthy);
    health.classList.toggle("warning", !healthy);
    health.lastChild.textContent = modules.length === 0
      ? "Noch keine Module registriert"
      : conflicts > 0 ? `${conflicts} Relais-Konflikt(e) erkannt`
      : incompatible > 0 ? `${incompatible} inkompatible(s) Modul(e)`
      : healthy ? "Alle Module erreichbar und kompatibel" : `${modules.length - online} Modul(e) nicht erreichbar`;
  }
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
