"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";
import { renderCanvas } from "./render.js";
import { showToast } from "../ui/toast.js";
import { recordHistory } from "./history.js";

export function showInspector(element) {
  if (!element) return;
  clearUnavailableAssignment(element);
  
  const inspector = document.getElementById("inspector");
  if (!inspector) return;

  const html = inspectorHtmlForElement(element);
  inspector.innerHTML = html;

  // Event listeners für alle Inputs
  inspector.querySelectorAll("input, select").forEach(input => {
    input.addEventListener("change", () => {
      const moduleChanged = input.id === "inspModule";
      const structureChanged = input.id === "inspSignalAspectMode";
      recordHistory();
      saveInspectorChanges(element);
      if (moduleChanged) {
        resetElementChannels(element);
        renderCanvas();
        showInspector(element);
      } else if (structureChanged) {
        showInspector(element);
      }
    });
  });

  // Close button
  document.getElementById("inspectorCloseBtn")?.addEventListener("click", () => {
    state.selectedElement = null;
    renderCanvas();
    inspectorLeer();
  });

  // Delete button
  document.getElementById("inspectorDeleteBtn")?.addEventListener("click", () => {
    if (!confirm("Element wirklich löschen?")) return;
    recordHistory();
    state.layout.elemente = (state.layout.elemente || []).filter(e => e.id !== element.id);
    state.layout.verbindungen = (state.layout.verbindungen || []).filter(v => v.von !== element.id && v.nach !== element.id);
    state.layoutDirty = true;
    state.selectedElement = null;
    renderCanvas();
    inspectorLeer();
    showToast("🗑️ Element gelöscht");
  });
}

function inspectorHtmlForElement(el) {
  let html = `
    <div class="inspector-header">
      <div>
        <strong>${getTypName(el.typ)}</strong>
        <small>${el.id}</small>
      </div>
      <button id="inspectorCloseBtn" class="close-button" type="button">×</button>
    </div>
  `;

  // Gemeinsame Felder für alle
  html += `
    <label class="inspector-field">
      <span>Name (optional)</span>
      <input type="text" id="inspName" value="${escape(el.name || "")}">
    </label>
    <label class="inspector-field">
      <span>Rotation (°)</span>
      <input type="number" id="inspRotation" value="${el.rotation || 0}" step="7.5">
    </label>
    <div class="inspector-coordinate-grid">
      <label class="inspector-field"><span>X (mm)</span><input type="number" id="inspX" value="${Math.round(Number(el.x || 0) * 20) / 10}" step="5"></label>
      <label class="inspector-field"><span>Y (mm)</span><input type="number" id="inspY" value="${Math.round(Number(el.y || 0) * 20) / 10}" step="5"></label>
    </div>
    <label class="inspector-field">
      <span>Modul</span>
      <select id="inspModule">
        ${getModuleOptions(el.module || "", el.typ)}
      </select>
    </label>
  `;

  // Element-spezifische Properties
  switch (el.typ) {
    case "track":
      html += inspectorTrack(el);
      break;
    case "curve":
      html += inspectorCurve(el);
      break;
    case "switch":
      html += inspectorSwitch(el);
      break;
    case "bumper":
      html += inspectorBumper(el);
      break;
    case "crossing":
      html += inspectorCrossing(el);
      break;
    case "signal":
      html += inspectorSignal(el);
      break;
    case "espSignal":
      html += inspectorEspSignal(el);
      break;
    case "transformer":
      html += inspectorTransformer(el);
      break;
  }

  html += `
    <div class="inspector-actions">
      <button id="inspectorDeleteBtn" class="danger-button" type="button">⌫ Löschen</button>
    </div>
  `;

  return html;
}

function inspectorTrack(el) {
  return `
    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
      <strong style="font-size: 12px; color: #aaa;">Gleis-Eigenschaften</strong>
      
      <label class="inspector-field">
        <span>Relay (Gleisstrom)</span>
        <select id="inspRelay">
          ${getRelayOptions(el.module || "", el.relay || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Sensor (Zugdetection)</span>
        <select id="inspSensor">
          ${getSensorOptions(el.module || "", el.sensorId || "")}
        </select>
      </label>

      <div class="inspector-info">
        Dieses Gleis kann per Relay gesteuert und hat einen optionalen Sensor zur Zugerkennung.
      </div>
    </div>
  `;
}

function inspectorCurve(el) {
  return `
    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
      <strong style="font-size: 12px; color: #aaa;">Kurven-Eigenschaften</strong>
      
      <label class="inspector-field">
        <span>Relay (Gleisstrom)</span>
        <select id="inspRelay">
          ${getRelayOptions(el.module || "", el.relay || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Sensor (Zugdetection)</span>
        <select id="inspSensor">
          ${getSensorOptions(el.module || "", el.sensorId || "")}
        </select>
      </label>

      <div class="inspector-info">
        Kurve mit optionalem Relay und Sensor.
      </div>
    </div>
  `;
}

function inspectorSwitch(el) {
  return `
    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
      <strong style="font-size: 12px; color: #aaa;">Weichen-Eigenschaften</strong>
      
      <label class="inspector-field">
        <span>Relay GERADE</span>
        <select id="inspRelayStraight">
          ${getRelayOptions(el.module || "", el.relayStraight || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Relay ABZWEIG</span>
        <select id="inspRelayBranch">
          ${getRelayOptions(el.module || "", el.relayBranch || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Sensor (Zugdetection)</span>
        <select id="inspSensor">
          ${getSensorOptions(el.module || "", el.sensorId || "")}
        </select>
      </label>

      <div class="inspector-info">
        Weiche: Ein Relay für gerade Richtung, eines für Abzweig.
      </div>
    </div>
  `;
}

function inspectorBumper(el) {
  const article = el.bumperCode || el.catalogCode || "5129";
  return `
    <div class="inspector-info">
      <strong>Prellbock ${escape(article)}</strong><br>
      Passiver Gleisabschluss ohne Relais. Die Artikelnummer wird im Plan und Export ausgewiesen.
    </div>
  `;
}

function inspectorCrossing(el) {
  return `
    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
      <strong style="font-size: 12px; color: #aaa;">Kreuzungsweiche-Eigenschaften</strong>
      
      <label class="inspector-field">
        <span>Relay GERADE</span>
        <select id="inspRelayA">
          ${getRelayOptions(el.module || "", el.relayA || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Relay ABZWEIG</span>
        <select id="inspRelayB">${getRelayOptions(el.module || "", el.relayB || 0)}</select>
      </label>

      <label class="inspector-field">
        <span>Sensor (Zugdetection)</span>
        <select id="inspSensor">
          ${getSensorOptions(el.module || "", el.sensorId || "")}
        </select>
      </label>

      <div class="inspector-info">
        Kreuzungsweiche 5128: reale 30°-Geometrie, getrennte Relais für beide Stellungen.
      </div>
    </div>
  `;
}

function inspectorSignal(el) {
  return `
    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
      <strong style="font-size: 12px; color: #aaa;">Hauptsignal-Eigenschaften</strong>
      
      <label class="inspector-field">
        <span>Relay ROT (Halt)</span>
        <select id="inspRelayRed">
          ${getRelayOptions(el.module || "", el.relayHp0 || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Relay GRÜN (Fahrt)</span>
        <select id="inspRelayGreen">
          ${getRelayOptions(el.module || "", el.relayHp1 || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Aktueller Zustand</span>
        <select id="inspSignalState">
          <option value="halt" ${el.signalState === "halt" ? "selected" : ""}>Halt (Rot)</option>
          <option value="fahrt" ${el.signalState === "fahrt" ? "selected" : ""}>Fahrt (Grün)</option>
        </select>
      </label>

      <div class="inspector-info">
        Märklin Hauptsignal 7039: Je ein Relay für Rot (Halt) und Grün (Fahrt).
      </div>
    </div>
  `;
}

function inspectorEspSignal(el) {
  const availableChannels = ledChannelsForModule(el.module || "");
  const threeAspect = el.signalAspectMode === "rgy";
  return `
    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
      <strong style="font-size: 12px; color: #aaa;">ESP-Signalmast-Eigenschaften</strong>

      <label class="inspector-field">
        <span>Signaltyp</span>
        <select id="inspSignalAspectMode">
          <option value="rg" ${!threeAspect ? "selected" : ""}>2-begriffig · Rot / Grün</option>
          <option value="rgy" ${threeAspect ? "selected" : ""}>3-begriffig · Rot / Gelb / Grün</option>
        </select>
      </label>
      
      <label class="inspector-field">
        <span>LED ROT Kanal</span>
        <select id="inspLedRed">
          ${getLedOptions(el.module || "", el.ledChannelRed || 0)}
        </select>
      </label>

      ${threeAspect ? `<label class="inspector-field">
        <span>LED GELB Kanal</span>
        <select id="inspLedYellow">${getLedOptions(el.module || "", el.ledChannelYellow || 0)}</select>
      </label>` : ""}
      <label class="inspector-field">
        <span>LED GRÜN Kanal</span>
        <select id="inspLedGreen">
          ${getLedOptions(el.module || "", el.ledChannelGreen || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Aktueller Zustand</span>
        <select id="inspEspState">
          <option value="halt" ${el.espState === "halt" ? "selected" : ""}>Halt (Rot)</option>
          ${threeAspect ? `<option value="warnung" ${el.espState === "warnung" ? "selected" : ""}>Warnung (Gelb)</option>` : ""}
          <option value="fahrt" ${el.espState === "fahrt" ? "selected" : ""}>Fahrt (Grün)</option>
        </select>
      </label>

      <div class="inspector-info">
        ${el.module
          ? `${availableChannels.length} LED-Kanal${availableChannels.length === 1 ? "" : "e"} erkannt. ${threeAspect ? "Kanäle für Rot, Gelb und Grün" : "Kanäle für Rot und Grün"} wählen.`
          : `Zuerst den LED-ESP auswählen. Danach erscheinen seine Kanäle für ${threeAspect ? "Rot, Gelb und Grün" : "Rot und Grün"}.`}
      </div>
    </div>
  `;
}

function inspectorTransformer(el) {
  return `
    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
      <strong style="font-size: 12px; color: #aaa;">Trafo-Eigenschaften</strong>
      
      <label class="inspector-field">
        <span>Relay (Stromversorgung)</span>
        <select id="inspRelay">
          ${getRelayOptions(el.module || "", el.relay || 0)}
        </select>
      </label>

      <div class="inspector-info">
        Märklin Transformator 6631: Optional ein Relay zur Kontrolle der Stromversorgung.
      </div>
    </div>
  `;
}

function saveInspectorChanges(element) {
  const name = document.getElementById("inspName")?.value || "";
  const rotation = parseFloat(document.getElementById("inspRotation")?.value || 0) % 360;
  const module = document.getElementById("inspModule")?.value || "";

  element.name = name;
  element.rotation = rotation;
  element.winkel = rotation;
  const boardWidth = Math.max(250, Number(state.layout?.metadaten?.plateWidthMm || 3200) * .5);
  const boardHeight = Math.max(250, Number(state.layout?.metadaten?.plateHeightMm || 1800) * .5);
  element.x = Math.max(40, Math.min(boardWidth - 40, Number(document.getElementById("inspX")?.value || element.x * 2) * .5));
  element.y = Math.max(40, Math.min(boardHeight - 40, Number(document.getElementById("inspY")?.value || element.y * 2) * .5));
  element.module = module;

  // Element-spezifisch
  switch (element.typ) {
    case "track":
    case "curve":
      element.relay = parseInt(document.getElementById("inspRelay")?.value || 0);
      element.sensorId = document.getElementById("inspSensor")?.value || "";
      break;

    case "crossing":
      element.relayA = parseInt(document.getElementById("inspRelayA")?.value || 0);
      element.relayB = parseInt(document.getElementById("inspRelayB")?.value || 0);
      element.sensorId = document.getElementById("inspSensor")?.value || "";
      break;

    case "switch":
      element.relayStraight = parseInt(document.getElementById("inspRelayStraight")?.value || 0);
      element.relayBranch = parseInt(document.getElementById("inspRelayBranch")?.value || 0);
      element.sensorId = document.getElementById("inspSensor")?.value || "";
      break;

    case "signal":
      element.relayHp0 = parseInt(document.getElementById("inspRelayRed")?.value || 0);
      element.relayHp1 = parseInt(document.getElementById("inspRelayGreen")?.value || 0);
      element.signalState = document.getElementById("inspSignalState")?.value || "halt";
      break;

    case "espSignal":
      element.signalAspectMode = document.getElementById("inspSignalAspectMode")?.value === "rgy" ? "rgy" : "rg";
      element.ledChannelRed = parseInt(document.getElementById("inspLedRed")?.value || 0);
      element.ledChannelYellow = element.signalAspectMode === "rgy" ? parseInt(document.getElementById("inspLedYellow")?.value || 0) : 0;
      element.ledChannelGreen = parseInt(document.getElementById("inspLedGreen")?.value || 0);
      element.espState = document.getElementById("inspEspState")?.value || "halt";
      if (element.signalAspectMode === "rg" && element.espState === "warnung") element.espState = "halt";
      element.ledState = element.espState;
      break;

    case "transformer":
      element.relay = parseInt(document.getElementById("inspRelay")?.value || 0);
      break;
    case "bumper":
      break;
  }

  state.layoutDirty = true;
  renderCanvas();
  showToast("✅ Änderungen übernommen");
}

export function inspectorLeer() {
  const inspector = document.getElementById("inspector");
  if (inspector) {
    inspector.innerHTML = `
      <div class="inspector-empty">
        <div class="inspector-empty-icon">◇</div>
        <strong>Kein Element ausgewählt</strong>
        <span>Klicke ein Element an zum Bearbeiten.</span>
      </div>
    `;
  }
}

// Helper Functions

function getTypName(typ) {
  const map = {
    track: "Gleis",
    curve: "Kurve",
    switch: "Weiche",
    bumper: "Prellbock",
    crossing: "Kreuzungsweiche",
    signal: "Hauptsignal",
    espSignal: "ESP-Signalmast",
    transformer: "Transformator"
  };
  return map[typ] || "Element";
}

function escape(str) {
  return String(str || "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function getModuleOptions(selected, elementType = "track") {
  const needed = elementType === "espSignal" ? "led" : "relay";
  const list = Object.values(state.hardware?.modules || {}).filter((module) => moduleSupports(module, needed));
  const emptyLabel = needed === "led" ? "Kein LED-ESP gewählt" : "Kein Modul";
  const unavailable = list.length ? "" : `<option value="" disabled>Kein ${needed === "led" ? "LED-ESP" : "Relais-ESP"} erkannt</option>`;
  return `<option value="">${emptyLabel}</option>${unavailable}` + list.map((module) => {
    const label = moduleKindLabel(module);
    return `<option value="${escape(module.id)}" ${module.id === selected ? "selected" : ""}>${escape(module.name || module.id)} · ${label}</option>`;
  }).join("");
}

function getRelayOptions(module, selected) {
  const count = Array.isArray(state.hardware?.modules?.[module]?.relays) ? state.hardware.modules[module].relays.length : 0;
  return `<option value="0">Kein Relay</option>${Array.from({ length: count }, (_, i) => i + 1).map((channel) => {
    const configured = state.relayConfig?.[`${module}:${channel}`]?.name;
    const label = configured ? `${configured} (Relay ${channel})` : `Relay ${channel}`;
    return `<option value="${channel}" ${parseInt(selected) === channel ? "selected" : ""}>${escape(label)}</option>`;
  }).join("")}`;
}

function getSensorOptions(module, selected) {
  const sensors = Array.isArray(state.hardware?.modules?.[module]?.sensors) ? state.hardware.modules[module].sensors : [];
  return `<option value="">Kein Sensor</option>${sensors.map((sensor, index) => {
    const id = sensor?.id || `S${index + 1}`;
    const configured = state.sensorConfig?.[`${module}:${id}`]?.name;
    const label = configured || sensor?.name || id;
    return `<option value="${escape(id)}" ${selected === id ? "selected" : ""}>${escape(label)}</option>`;
  }).join("")}`;
}

function getLedOptions(module, selected) {
  const channels = ledChannelsForModule(module);
  return `<option value="0">Keine LED</option>${channels.map((channel) => {
    const config = state.ledConfig?.[`${module}:${channel}`] || {};
    const hardwareLed = (state.hardware?.leds || []).find((item) => item.module === module && Number(item.channel) === channel)
      || state.hardware?.modules?.[module]?.leds?.[channel - 1]
      || {};
    const name = config.name || hardwareLed.name || `LED ${channel}`;
    const color = config.color ? ` · ${config.color}` : "";
    return `<option value="${channel}" ${parseInt(selected) === channel ? "selected" : ""}>${escape(name)} (Kanal ${channel})${escape(color)}</option>`;
  }).join("")}`;
}

function ledChannelsForModule(moduleId) {
  if (!moduleId) return [];
  const channels = new Set();
  const live = state.hardware?.modules?.[moduleId]?.leds;
  if (Array.isArray(live)) live.forEach((item, index) => channels.add(Number(item?.channel) || index + 1));
  (Array.isArray(state.hardware?.leds) ? state.hardware.leds : []).forEach((item) => {
    if (item?.module === moduleId && Number(item.channel) > 0) channels.add(Number(item.channel));
  });
  Object.keys(state.ledConfig || {}).forEach((key) => {
    if (!key.startsWith(`${moduleId}:`)) return;
    const channel = Number(key.slice(moduleId.length + 1));
    if (Number.isInteger(channel) && channel > 0) channels.add(channel);
  });
  return Array.from(channels).sort((a, b) => a - b);
}

function moduleSupports(module, capability) {
  const caps = Array.isArray(module?.capabilities) ? module.capabilities : [];
  if (caps.includes(capability)) return true;
  if (capability === "relay" && Array.isArray(module?.relays) && module.relays.length > 0) return true;
  if (capability === "led" && ledChannelsForModule(module?.id).length > 0) return true;
  if (capability === "relay" && (module?.kind === "RELAY_SENSOR" || module?.kind === "HYBRID")) return true;
  if (capability === "led" && (module?.kind === "SIGNAL_LED" || module?.kind === "HYBRID")) return true;
  return module?.kind === "UNKNOWN";
}

document.addEventListener("dynora:modules-updated", () => {
  if (!document.getElementById("page-builder")?.classList.contains("active")) return;
  const inspector = document.getElementById("inspector");
  if (!inspector || inspector.contains(document.activeElement)) return;
  const element = (state.layout?.elemente || []).find((item) => item.id === state.selectedElement);
  if (element) showInspector(element);
});

function moduleKindLabel(module) {
  if (module?.kind === "SIGNAL_LED") return "Signal/LED";
  if (module?.kind === "RELAY_SENSOR") return "Relay/Sensor";
  if (module?.kind === "HYBRID") return "Hybrid";
  return "noch nicht erkannt";
}

function clearUnavailableAssignment(element) {
  const list = state.hardware?.modules || {};
  if (!Object.keys(list).length || !element.module || list[element.module]) return;
  element.module = "";
  resetElementChannels(element);
  state.layoutDirty = true;
}

function resetElementChannels(element) {
  element.relay = 0;
  element.relayA = 0;
  element.relayB = 0;
  element.relayStraight = 0;
  element.relayBranch = 0;
  element.relayHp0 = 0;
  element.relayHp1 = 0;
  element.ledChannelRed = 0;
  element.ledChannelYellow = 0;
  element.ledChannelGreen = 0;
  element.sensorId = "";
  state.layoutDirty = true;
}
