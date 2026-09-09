"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";
import { renderCanvas } from "./render.js";
import { showToast } from "../ui/toast.js";

export function showInspector(element) {
  if (!element) return;
  
  const inspector = document.getElementById("inspector");
  if (!inspector) return;

  const html = inspectorHtmlForElement(element);
  inspector.innerHTML = html;

  // Event listeners für alle Inputs
  inspector.querySelectorAll("input, select").forEach(el => {
    el.addEventListener("change", () => saveInspectorChanges(element));
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
    state.layout.elemente = (state.layout.elemente || []).filter(e => e.id !== element.id);
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
      <input type="number" id="inspRotation" value="${el.rotation || 0}" step="15">
    </label>
    <label class="inspector-field">
      <span>Modul</span>
      <select id="inspModule">
        ${getModuleOptions(el.module || "GLEIS_01")}
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
          ${getRelayOptions(el.module || "GLEIS_01", el.relay || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Sensor (Zugdetection)</span>
        <select id="inspSensor">
          ${getSensorOptions(el.module || "GLEIS_01", el.sensorId || "")}
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
          ${getRelayOptions(el.module || "GLEIS_01", el.relay || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Sensor (Zugdetection)</span>
        <select id="inspSensor">
          ${getSensorOptions(el.module || "GLEIS_01", el.sensorId || "")}
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
          ${getRelayOptions(el.module || "GLEIS_01", el.relayStraight || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Relay ABZWEIG</span>
        <select id="inspRelayBranch">
          ${getRelayOptions(el.module || "GLEIS_01", el.relayBranch || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Sensor (Zugdetection)</span>
        <select id="inspSensor">
          ${getSensorOptions(el.module || "GLEIS_01", el.sensorId || "")}
        </select>
      </label>

      <div class="inspector-info">
        Weiche: Ein Relay für gerade Richtung, eines für Abzweig.
      </div>
    </div>
  `;
}

function inspectorCrossing(el) {
  return `
    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
      <strong style="font-size: 12px; color: #aaa;">Kreuzungsweiche-Eigenschaften</strong>
      
      <label class="inspector-field">
        <span>Relay (Gleisstrom)</span>
        <select id="inspRelay">
          ${getRelayOptions(el.module || "GLEIS_01", el.relay || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Sensor (Zugdetection)</span>
        <select id="inspSensor">
          ${getSensorOptions(el.module || "GLEIS_01", el.sensorId || "")}
        </select>
      </label>

      <div class="inspector-info">
        Kreuzungsweiche 5128: 30° Kreuzung, 193mm, mit optionalen Relay/Sensor.
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
          ${getRelayOptions(el.module || "GLEIS_01", el.relayHp0 || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Relay GRÜN (Fahrt)</span>
        <select id="inspRelayGreen">
          ${getRelayOptions(el.module || "GLEIS_01", el.relayHp1 || 0)}
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
  return `
    <div style="border-top: 1px solid #333; margin-top: 10px; padding-top: 10px;">
      <strong style="font-size: 12px; color: #aaa;">ESP-Signalmast-Eigenschaften</strong>
      
      <label class="inspector-field">
        <span>LED ROT Kanal</span>
        <select id="inspLedRed">
          ${getLedOptions(el.module || "LEDMOD_01", el.ledChannelRed || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>LED GRÜN Kanal</span>
        <select id="inspLedGreen">
          ${getLedOptions(el.module || "LEDMOD_01", el.ledChannelGreen || 0)}
        </select>
      </label>

      <label class="inspector-field">
        <span>Aktueller Zustand</span>
        <select id="inspEspState">
          <option value="halt" ${el.espState === "halt" ? "selected" : ""}>Halt (Rot)</option>
          <option value="fahrt" ${el.espState === "fahrt" ? "selected" : ""}>Fahrt (Grün)</option>
        </select>
      </label>

      <div class="inspector-info">
        DIY ESP-Signalmast: Je ein LED-Kanal für Rot und Grün.
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
          ${getRelayOptions(el.module || "GLEIS_01", el.relay || 0)}
        </select>
      </label>

      <div class="inspector-info">
        Märklin Transformator: Optional ein Relay zur Kontrolle der Stromversorgung.
      </div>
    </div>
  `;
}

function saveInspectorChanges(element) {
  const name = document.getElementById("inspName")?.value || "";
  const rotation = parseFloat(document.getElementById("inspRotation")?.value || 0) % 360;
  const module = document.getElementById("inspModule")?.value || "GLEIS_01";

  element.name = name;
  element.rotation = rotation;
  element.module = module;

  // Element-spezifisch
  switch (element.typ) {
    case "track":
    case "curve":
    case "crossing":
      element.relay = parseInt(document.getElementById("inspRelay")?.value || 0);
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
      element.ledChannelRed = parseInt(document.getElementById("inspLedRed")?.value || 0);
      element.ledChannelGreen = parseInt(document.getElementById("inspLedGreen")?.value || 0);
      element.espState = document.getElementById("inspEspState")?.value || "halt";
      break;

    case "transformer":
      element.relay = parseInt(document.getElementById("inspRelay")?.value || 0);
      break;
  }

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

function getModuleOptions(selected) {
  const modules = ["GLEIS_01", "LEDMOD_01"];
  return `<option value="">Kein Modul</option>` + modules.map(m => 
    `<option value="${m}" ${m === selected ? "selected" : ""}>${m}</option>`
  ).join("");
}

function getRelayOptions(module, selected) {
  return `
    <option value="0">Kein Relay</option>
    ${Array.from({length: 8}, (_, i) => i + 1).map(ch =>
      `<option value="${ch}" ${parseInt(selected) === ch ? "selected" : ""}>Relay ${ch}</option>`
    ).join("")}
  `;
}

function getSensorOptions(module, selected) {
  return `
    <option value="">Kein Sensor</option>
    ${Array.from({length: 8}, (_, i) => {
      const id = `S${i + 1}`;
      return `<option value="${id}" ${selected === id ? "selected" : ""}>${id}</option>`;
    }).join("")}
  `;
}

function getLedOptions(module, selected) {
  return `
    <option value="0">Keine LED</option>
    ${Array.from({length: 8}, (_, i) => i + 1).map(ch =>
      `<option value="${ch}" ${parseInt(selected) === ch ? "selected" : ""}>LED ${ch}</option>`
    ).join("")}
  `;
}
