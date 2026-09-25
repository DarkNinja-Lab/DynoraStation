"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";
import { showToast } from "../ui/toast.js";
import { commandFeedbackForElement, commandFeedbackForRelay, commandStatusText, moduleControlInfo, rememberPendingCommands } from "../core/commands.js";
import {
  svg, attrs, drawDoubleRailLine, drawStateSegmentLine, drawPowerLine, drawUncouplerShape, drawCurveDual, drawPowerCurve,
  drawSwitchShape, drawCrossingShape, drawBumperShape, drawSignalShape, drawEspSignalShape, drawTransformerShape, drawLabel,
  localConnectionPorts, worldConnectionPort, appendElementHitTarget
} from "../builder/shapes.js";

function uiType(type) {
  if (type === "xtrack") return "crossing";
  if (type === "ledSignal") return "espSignal";
  return type;
}

const pendingControlIds = new Set();

const pendingPowerSections = new Set();

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function relayState(moduleId, channel) {
  const relay = state.hardware?.modules?.[String(moduleId || "")]?.relays?.[Number(channel || 0) - 1];
  return typeof relay === "boolean" ? relay : Boolean(relay?.active ?? relay?.state);
}

function collectPowerSections() {
  const groups = new Map();
  const elements = Array.isArray(state.layout?.elemente) ? state.layout.elemente : [];
  for (const element of elements) {
    const type = uiType(element.typ);
    if (!["track", "curve"].includes(type)) continue;
    if (type === "track" && String(element.trackCode || element.catalogCode || "") === "5112") continue;
    const moduleId = String(element.module || "");
    const channel = Number(element.relay || 0);
    if (!moduleId || channel <= 0) continue;
    const key = `${moduleId}:${channel}`;
    if (!groups.has(key)) groups.set(key, { key, moduleId, channel, elements: [], names: [] });
    const group = groups.get(key);
    group.elements.push(element);
    const name = String(element.stromkreis || "").trim();
    if (name && !group.names.includes(name)) group.names.push(name);
  }
  return Array.from(groups.values()).map((section, index) => {
    const relayCfg = state.relayConfig?.[section.key] || {};
    const module = state.hardware?.modules?.[section.moduleId];
    const fallback = String(relayCfg.name || "").trim() || `Stromabschnitt ${index + 1}`;
    const name = section.names[0] || fallback;
    const control = moduleControlInfo(section.moduleId);
    const feedback = commandFeedbackForRelay(section.moduleId, section.channel);
    return {
      ...section,
      name,
      moduleName: module?.name || section.moduleId,
      on: relayState(section.moduleId, section.channel) || section.elements.some((element) => Boolean(element.powerState)),
      control,
      feedback
    };
  });
}

async function controlPowerSection(key) {
  const section = collectPowerSections().find((item) => item.key === key);
  if (!section || pendingPowerSections.has(key)) return;
  if (!section.control.enabled) {
    showToast(section.control.reason || "Stromabschnitt nicht schaltbereit", "warning");
    return;
  }
  if (section.feedback?.status === "pending") {
    showToast("Stromabschnitt wird bereits geschaltet", "warning");
    return;
  }
  const representative = section.elements[0];
  if (!representative?.id) return;
  pendingPowerSections.add(key);
  renderTrackPowerSections();
  try {
    const result = await apiCall("/track/control", { method: "POST", body: { elementId: representative.id, toggle: true } });
    rememberPendingCommands(result);
  } catch (error) {
    showToast(error?.message || "Gleisstrom konnte nicht geschaltet werden", "error");
  } finally {
    pendingPowerSections.delete(key);
    renderTrackPowerSections();
  }
}

export function renderTrackPowerSections() {
  const root = document.getElementById("trackPowerGrid");
  if (!root) return;
  const sections = collectPowerSections();
  if (!sections.length) {
    root.innerHTML = `<div class="track-power-empty">Keine schaltbaren Stromabschnitte. Im Bearbeiten-Modus einem Gleis oder einer Kurve ein Relais zuweisen.</div>`;
    return;
  }
  root.innerHTML = sections.map((section) => {
    const pending = pendingPowerSections.has(section.key) || section.feedback?.status === "pending";
    const disabled = !section.control.enabled || pending;
    const status = pending ? "SCHALTET" : section.on ? "EIN" : "AUS";
    const detail = `${section.elements.length} ${section.elements.length === 1 ? "Gleiselement" : "Gleiselemente"} · ${section.moduleName} · R${section.channel}`;
    const feedbackText = section.feedback && section.feedback.status !== "confirmed" ? commandStatusText(section.feedback) : "";
    return `<button class="track-power-section ${section.on ? "on" : "off"} ${pending ? "pending" : ""}" type="button" data-power-section="${esc(section.key)}" ${disabled ? "disabled" : ""} aria-pressed="${section.on ? "true" : "false"}">
      <span class="track-power-icon"><svg class="ui-icon" aria-hidden="true" focusable="false"><use href="/assets/icons.svg?v=3#icon-power"></use></svg></span>
      <span class="track-power-copy"><strong>${esc(section.name)}</strong><small>${esc(detail)}</small>${feedbackText ? `<em>${esc(feedbackText)}</em>` : ""}</span>
      <span class="track-power-state">${status}</span>
    </button>`;
  }).join("");
  root.querySelectorAll("[data-power-section]").forEach((button) => {
    button.addEventListener("click", () => controlPowerSection(button.dataset.powerSection));
  });
}

function catalogItem(element, group) {
  const code = element.trackCode || element.curveCode || element.switchCode || element.xTrackCode || element.bumperCode || element.catalogCode;
  return (state.catalog?.[group] || []).find((item) => String(item.code) === String(code)) || {};
}

function elementCatalogItem(element) {
  const type = uiType(element.typ);
  const group = type === "track" ? "tracks" : type === "curve" ? "curves" : type === "switch" ? "switches" : type === "crossing" ? "crossings" : type === "bumper" ? "bumpers" : "";
  return group ? catalogItem(element, group) : {};
}

function hasControlAssignment(element) {
  if (!element || !String(element.module || "")) return false;
  const type = uiType(element.typ);
  const channel = (value) => Number(value || 0) > 0;
  if (type === "track" || type === "curve" || type === "transformer") return channel(element.relay);
  if (type === "switch") return channel(element.relayStraight) && channel(element.relayBranch);
  if (type === "crossing") return channel(element.relayA) && channel(element.relayB);
  if (type === "signal") return channel(element.relayHp0) && channel(element.relayHp1);
  if (type === "espSignal") {
    const base = channel(element.ledChannelRed) && channel(element.ledChannelGreen);
    return base && (element.signalAspectMode !== "rgy" || channel(element.ledChannelYellow));
  }
  return false;
}

function isSensorTriggered(element) {
  const moduleId = String(element?.module || "");
  const sensorId = String(element?.sensorId || "");
  if (!moduleId || !sensorId) return false;
  const sensors = state.hardware?.modules?.[moduleId]?.sensors;
  if (!Array.isArray(sensors)) return false;
  const sensor = sensors.find((item, index) => String(item?.id || `S${index + 1}`) === sensorId);
  return Boolean(sensor?.triggered ?? sensor?.active ?? sensor?.state);
}

function drawOccupancyBadge(group, rotation) {
  const badge = svg("g");
  badge.classList.add("occupancy-badge");
  badge.setAttribute("transform", `translate(0 -48) rotate(${-rotation})`);
  const background = svg("rect");
  attrs(background, { x: -31, y: -10, width: 62, height: 20, rx: 7 });
  const dot = svg("circle");
  attrs(dot, { cx: -20, cy: 0, r: 3.5 });
  const label = svg("text");
  attrs(label, { x: -12, y: 3.5, "font-size": 8, "font-weight": 850, "letter-spacing": .7 });
  label.textContent = "BELEGT";
  badge.append(background, dot, label);
  group.appendChild(badge);
}


const TRACK_FEEDBACK_TTL_MS = 3000;
let trackFeedbackExpiryTimer = 0;
let trackFeedbackExpiryAt = 0;

function trackFeedbackVisible(feedback) {
  if (!feedback) return false;
  if (feedback.status === "pending") return true;
  const updatedAt = Number(feedback.updatedAt || 0);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return true;
  return Date.now() - updatedAt < TRACK_FEEDBACK_TTL_MS;
}

function scheduleTrackFeedbackExpiry(feedback) {
  if (!feedback || feedback.status === "pending") return;
  const updatedAt = Number(feedback.updatedAt || 0);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0) return;
  const remaining = TRACK_FEEDBACK_TTL_MS - (Date.now() - updatedAt);
  if (remaining <= 0) return;

  const expiryAt = updatedAt + TRACK_FEEDBACK_TTL_MS;
  if (trackFeedbackExpiryTimer && trackFeedbackExpiryAt <= expiryAt) return;
  if (trackFeedbackExpiryTimer) clearTimeout(trackFeedbackExpiryTimer);
  trackFeedbackExpiryAt = expiryAt;
  trackFeedbackExpiryTimer = window.setTimeout(() => {
    trackFeedbackExpiryTimer = 0;
    trackFeedbackExpiryAt = 0;
    renderTrackLayout();
  }, remaining + 40);
}

function drawCommandBadge(group, feedback, rotation, disabledReason = "") {
  const text = disabledReason || commandStatusText(feedback);
  if (!text) return;
  const status = disabledReason ? "disabled" : (feedback?.status || "");
  const badge = svg("g");
  badge.classList.add("command-state-badge", `status-${status}`);
  badge.setAttribute("transform", `translate(0 50) rotate(${-rotation})`);
  const width = Math.max(94, Math.min(190, 24 + text.length * 5.4));
  const background = svg("rect");
  attrs(background, { x: -width / 2, y: -11, width, height: 22, rx: 6 });
  const label = svg("text");
  attrs(label, { x: 0, y: 3.5, "text-anchor": "middle", "font-size": 8.5, "font-weight": 800 });
  label.textContent = text;
  badge.append(background, label);
  group.appendChild(badge);
}

function drawTransformerTemperature(group, element, rotation) {
  if (uiType(element.typ) !== "transformer") return;
  const module = state.hardware?.modules?.[String(element.module || "")];
  const value = Number(module?.environment?.temperatureC);
  if (!module?.online || !Number.isFinite(value)) return;
  const badge = svg("g");
  badge.classList.add("transformer-temperature");
  badge.setAttribute("transform", `translate(0 -52) rotate(${-rotation})`);
  const background = svg("rect");
  attrs(background, { x: -31, y: -12, width: 62, height: 24, rx: 4 });
  const label = svg("text");
  attrs(label, { x: 0, y: 4, "text-anchor": "middle", "font-size": 11, "font-weight": 800 });
  label.textContent = `${value.toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`;
  badge.append(background, label);
  group.appendChild(badge);
}

function drawConnections(layer, elements, connections) {
  const byId = new Map(elements.map((e) => [e.id, e]));
  connections.forEach((connection) => {
    const from = byId.get(connection.von);
    const to = byId.get(connection.nach);
    if (!from || !to) return;
    const fromPorts = localConnectionPorts(from, elementCatalogItem(from));
    const toPorts = localConnectionPorts(to, elementCatalogItem(to));
    const a = worldConnectionPort(from, fromPorts[Math.max(0, Math.min(fromPorts.length - 1, Number(connection.vonPort) || 0))] || fromPorts[0]);
    const b = worldConnectionPort(to, toPorts[Math.max(0, Math.min(toPorts.length - 1, Number(connection.nachPort) || 0))] || toPorts[0]);
    const line = svg("line");
    attrs(line, { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: "#59626d", "stroke-width": 2.5, "stroke-dasharray": "5 5", opacity: .6 });
    layer.appendChild(line);
  });
}
function drawShape(group, element, occupied = false) {
  const type = uiType(element.typ);
  if (type === "track") {
    const item = catalogItem(element, "tracks");
    if (item.trackStyle === "uncoupler") {
      drawUncouplerShape(group, item, element.powerState, occupied);
    } else {
      const half = Math.max(12, Number(item.length || 180) * .25);
      drawDoubleRailLine(group, -half, 0, half, 0, occupied ? "#ff5f69" : "#d5dbe0", 8);
      if (element.powerState) drawPowerLine(group, -half + 3, 0, half - 3, 0, occupied ? "#ff5f69" : "#32f29a");
      else drawStateSegmentLine(group, -Math.min(half - 3, 16), 0, Math.min(half - 3, 16), 0, "#566675");
    }
  } else if (type === "curve") {
    const item = catalogItem(element, "curves");
    drawCurveDual(group, Number(item.radius || 360) * .5, Number(item.angleDeg || 30), occupied ? "#ff5f69" : "#89949d");
    if (element.powerState) drawPowerCurve(group, Number(item.radius || 360) * .5, Number(item.angleDeg || 30), occupied ? "#ff5f69" : "#32f29a");
  } else if (type === "switch") {
    const item = catalogItem(element, "switches");
    drawSwitchShape(group, item.handed || "left", element.switchState !== "abzweig", item, occupied);
  } else if (type === "crossing") {
    const item = catalogItem(element, "crossings");
    drawCrossingShape(group, item, element.xState || "gerade", occupied);
  } else if (type === "bumper") {
    drawBumperShape(group, catalogItem(element, "bumpers"), occupied);
  } else if (type === "signal") {
    drawSignalShape(group, element.signalState);
  } else if (type === "espSignal") {
    drawEspSignalShape(group, element.espState || element.ledState, element.signalAspectMode);
  } else if (type === "transformer") {
    drawTransformerShape(group);
  }
}

async function controlElement(element, group) {
  if (!element?.id || pendingControlIds.has(element.id)) return;
  const control = moduleControlInfo(element.module);
  const feedback = commandFeedbackForElement(element.id);
  if (!control.enabled) {
    showToast(control.reason || "ESP nicht schaltbereit", "warning");
    return;
  }
  if (feedback?.status === "pending") {
    showToast("Schaltvorgang läuft bereits", "warning");
    return;
  }
  const type = uiType(element.typ);
  let path = "";
  let nextState;

  if (["track", "curve", "transformer"].includes(type)) {
    path = "/track/control";
    nextState = !element.powerState;
  } else if (type === "switch") {
    path = "/switch/control";
    nextState = element.switchState === "abzweig" ? "gerade" : "abzweig";
  } else if (type === "crossing") {
    path = "/xtrack/control";
    nextState = element.xState === "abzweig" ? "gerade" : "abzweig";
  } else if (type === "signal") {
    path = "/signal/control";
    nextState = element.signalState === "fahrt" ? "halt" : "fahrt";
  } else if (type === "espSignal") {
    path = "/esp-signal/control";
    const cycle = element.signalAspectMode === "rgy"
      ? { halt: "warnung", warnung: "fahrt", fahrt: "halt" }
      : { halt: "fahrt", fahrt: "halt", warnung: "halt" };
    nextState = cycle[element.espState || element.ledState || "halt"] || "halt";
  } else {
    return;
  }

  group.classList.add("busy");
  group.setAttribute("aria-disabled", "true");
  pendingControlIds.add(element.id);
  try {
    const body = ["track", "curve", "transformer"].includes(type)
      ? { elementId: element.id, toggle: true }
      : { elementId: element.id, state: nextState };
    const result = await apiCall(path, { method: "POST", body });
    rememberPendingCommands(result);
  } catch (error) {
    showToast(error?.message || "Element konnte nicht geschaltet werden", "error");
  } finally {
    pendingControlIds.delete(element.id);
    group.classList.remove("busy");
    group.removeAttribute("aria-disabled");
    renderTrackLayout();
  }
}


function trackOverlayInsets(svgRoot) {
  const wrapper = svgRoot?.closest(".track-plan-wrapper");
  const overlay = wrapper?.querySelector(".track-plan-overlay");
  if (!wrapper || !overlay || getComputedStyle(overlay).display === "none") return { top: 0, bottom: 0 };

  const wrapperRect = wrapper.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  if (wrapperRect.height <= 0 || overlayRect.height <= 0) return { top: 0, bottom: 0 };

  const overlapTop = Math.max(wrapperRect.top, overlayRect.top);
  const overlapBottom = Math.min(wrapperRect.bottom, overlayRect.bottom);
  const overlapHeight = Math.max(0, overlapBottom - overlapTop);
  if (overlapHeight <= 0) return { top: 0, bottom: 0 };

  const gap = 10;
  const maxInset = wrapperRect.height * 0.45;
  const overlayCenter = (overlayRect.top + overlayRect.bottom) / 2;
  const wrapperCenter = (wrapperRect.top + wrapperRect.bottom) / 2;
  if (overlayCenter <= wrapperCenter) {
    return { top: Math.min(maxInset, Math.max(0, overlayRect.bottom - wrapperRect.top + gap)), bottom: 0 };
  }
  return { top: 0, bottom: Math.min(maxInset, Math.max(0, wrapperRect.bottom - overlayRect.top + gap)) };
}

function fitTrackViewBox(svgRoot, elements) {
  if (!svgRoot || !elements.length) {
    svgRoot?.setAttribute("viewBox", "0 0 1600 900");
    return;
  }
  const padding = 48;
  const xs = elements.map((e) => Number(e.x || 0));
  const ys = elements.map((e) => Number(e.y || 0));
  let minX = Math.min(...xs) - padding;
  let maxX = Math.max(...xs) + padding;
  let minY = Math.min(...ys) - padding;
  let maxY = Math.max(...ys) + padding;
  let width = Math.max(360, maxX - minX);
  let height = Math.max(240, maxY - minY);

  const rect = svgRoot.getBoundingClientRect();
  const insets = trackOverlayInsets(svgRoot);
  const usableHeight = Math.max(140, rect.height - insets.top - insets.bottom);
  const aspect = rect.width > 0 && usableHeight > 0 ? rect.width / usableHeight : 16 / 9;
  const current = width / height;
  if (current < aspect) {
    const expanded = height * aspect;
    minX -= (expanded - width) / 2;
    width = expanded;
  } else {
    const expanded = width / aspect;
    minY -= (expanded - height) / 2;
    height = expanded;
  }

  const zoomOut = 1.02;
  const extraW = width * (zoomOut - 1);
  const extraH = height * (zoomOut - 1);
  minX -= extraW / 2;
  minY -= extraH / 2;
  width += extraW;
  height += extraH;

  const topPad = usableHeight > 0 ? height * (insets.top / usableHeight) : 0;
  const bottomPad = usableHeight > 0 ? height * (insets.bottom / usableHeight) : 0;
  minY -= topPad;
  height += topPad + bottomPad;

  svgRoot.setAttribute("viewBox", `${minX} ${minY} ${width} ${height}`);
}
export function renderTrackLayout() {
  const elementLayer = document.getElementById("trackElementLayer");
  const connectionLayer = document.getElementById("trackConnectionLayer");
  const empty = document.getElementById("trackEmptyHint");
  if (!elementLayer || !connectionLayer) return;

  const elements = Array.isArray(state.layout?.elemente) ? state.layout.elemente : [];
  const connections = Array.isArray(state.layout?.verbindungen) ? state.layout.verbindungen : [];
  elementLayer.innerHTML = "";
  connectionLayer.innerHTML = "";
  if (empty) empty.style.display = elements.length ? "none" : "block";
  fitTrackViewBox(document.getElementById("trackSvg"), elements);
  drawConnections(connectionLayer, elements, connections);

  elements.forEach((element) => {
    const group = svg("g");
    const control = moduleControlInfo(element.module);
    const feedback = commandFeedbackForElement(element.id);
    const visibleFeedback = trackFeedbackVisible(feedback) ? feedback : null;
    const hardwareInteractive = uiType(element.typ) !== "bumper";
    const controlAssigned = hardwareInteractive && hasControlAssignment(element);
    const interactive = controlAssigned && control.enabled && feedback?.status !== "pending";
    const rotation = Number(element.rotation ?? element.winkel ?? 0);
    const occupied = isSensorTriggered(element);
    if (hardwareInteractive) group.classList.add("track-control-element");
    if (hardwareInteractive && !controlAssigned) group.classList.add("control-unconfigured");
    if (controlAssigned && !control.enabled) group.classList.add("control-disabled", control.module?.online ? "incompatible" : "offline");
    if (visibleFeedback?.status) group.classList.add(`command-${visibleFeedback.status}`);
    if (pendingControlIds.has(element.id) || feedback?.status === "pending") group.classList.add("busy");
    if (occupied) group.classList.add("sensor-triggered");
    group.dataset.id = element.id;
    group.setAttribute("transform", `translate(${Number(element.x || 0)}, ${Number(element.y || 0)}) rotate(${rotation})`);
    group.setAttribute("role", controlAssigned ? "button" : "img");
    if (controlAssigned) group.setAttribute("tabindex", interactive ? "0" : "-1");
    if (controlAssigned && !interactive) group.setAttribute("aria-disabled", "true");
    const feedbackText = commandStatusText(visibleFeedback);
    const disabledText = controlAssigned && !control.enabled ? control.reason : "";
    const unconfiguredText = hardwareInteractive && !controlAssigned ? ", keine Schaltkanäle zugewiesen" : "";
    group.setAttribute("aria-label", hardwareInteractive
      ? `${element.name || uiType(element.typ)}${occupied ? ", Sensor belegt" : ""}${unconfiguredText}${disabledText ? `, ${disabledText}` : ""}${feedbackText ? `, ${feedbackText}` : ""}`
      : `${element.name || "Prellbock"} 5129`);

    drawShape(group, element, occupied);
    if (controlAssigned) appendElementHitTarget(group, element, elementCatalogItem(element), 18);
    if (occupied) drawOccupancyBadge(group, rotation);
    drawTransformerTemperature(group, element, rotation);
    // Verbindungsprobleme werden einmal zentral über dem Gleisbild angezeigt.
    // Direkt am Element erscheinen nur laufende bzw. bestätigte Schaltvorgänge.
    if (hardwareInteractive && visibleFeedback) {
      drawCommandBadge(group, visibleFeedback, rotation);
      scheduleTrackFeedbackExpiry(visibleFeedback);
    }
    drawLabel(group, element, rotation);
    if (interactive) group.addEventListener("click", () => controlElement(element, group));
    if (interactive) group.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      controlElement(element, group);
    });
    elementLayer.appendChild(group);
  });
  renderTrackPowerSections();
  requestAnimationFrame(() => fitTrackViewBox(document.getElementById("trackSvg"), elements));
}
