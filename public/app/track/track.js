"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";
import { showToast } from "../ui/toast.js";
import { commandFeedbackForElement, commandStatusText, moduleControlInfo, rememberPendingCommands } from "../core/commands.js";
import {
  svg, attrs, drawDoubleRailLine, drawStateSegmentLine, drawPowerLine, drawUncouplerShape, drawCurveDual, drawPowerCurve,
  drawSwitchShape, drawCrossingShape, drawBumperShape, drawSignalShape, drawEspSignalShape, drawTransformerShape, drawLabel,
  localConnectionPorts, worldConnectionPort
} from "../builder/shapes.js";

function uiType(type) {
  if (type === "xtrack") return "crossing";
  if (type === "ledSignal") return "espSignal";
  return type;
}

const pendingControlIds = new Set();

function catalogItem(element, group) {
  const code = element.trackCode || element.curveCode || element.switchCode || element.xTrackCode || element.bumperCode || element.catalogCode;
  return (state.catalog?.[group] || []).find((item) => String(item.code) === String(code)) || {};
}

function elementCatalogItem(element) {
  const type = uiType(element.typ);
  const group = type === "track" ? "tracks" : type === "curve" ? "curves" : type === "switch" ? "switches" : type === "crossing" ? "crossings" : type === "bumper" ? "bumpers" : "";
  return group ? catalogItem(element, group) : {};
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
  const aspect = rect.width > 0 && rect.height > 0 ? rect.width / rect.height : 16 / 9;
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

  // Nur wenig Sicherheitsrand: Das Gleisbild soll die verfügbare Fläche ausnutzen.
  const zoomOut = 1.02;
  const extraW = width * (zoomOut - 1);
  const extraH = height * (zoomOut - 1);
  minX -= extraW / 2;
  minY -= extraH / 2;
  width += extraW;
  height += extraH;
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
    const hardwareInteractive = uiType(element.typ) !== "bumper";
    const interactive = hardwareInteractive && control.enabled && feedback?.status !== "pending";
    const rotation = Number(element.rotation ?? element.winkel ?? 0);
    const occupied = isSensorTriggered(element);
    if (hardwareInteractive) group.classList.add("track-control-element");
    if (!control.enabled && hardwareInteractive) group.classList.add("control-disabled", control.module?.online ? "incompatible" : "offline");
    if (feedback?.status) group.classList.add(`command-${feedback.status}`);
    if (pendingControlIds.has(element.id) || feedback?.status === "pending") group.classList.add("busy");
    if (occupied) group.classList.add("sensor-triggered");
    group.dataset.id = element.id;
    group.setAttribute("transform", `translate(${Number(element.x || 0)}, ${Number(element.y || 0)}) rotate(${rotation})`);
    group.setAttribute("role", hardwareInteractive ? "button" : "img");
    if (hardwareInteractive) group.setAttribute("tabindex", interactive ? "0" : "-1");
    if (hardwareInteractive && !interactive) group.setAttribute("aria-disabled", "true");
    const feedbackText = commandStatusText(feedback);
    const disabledText = !control.enabled && hardwareInteractive ? control.reason : "";
    group.setAttribute("aria-label", hardwareInteractive
      ? `${element.name || uiType(element.typ)}${occupied ? ", Sensor belegt" : ""}${disabledText ? `, ${disabledText}` : ""}${feedbackText ? `, ${feedbackText}` : ""}`
      : `${element.name || "Prellbock"} 5129`);

    const hitbox = svg("rect");
    const is5141 = uiType(element.typ) === "switch" && elementCatalogItem(element).switchGeometry === "5141";
    attrs(hitbox, is5141
      ? { x: -68, y: -55, width: 140, height: 85, fill: "transparent", "pointer-events": "all" }
      : { x: -80, y: -55, width: 160, height: 115, fill: "transparent", "pointer-events": "all" });
    group.appendChild(hitbox);
    drawShape(group, element, occupied);
    if (occupied) drawOccupancyBadge(group, rotation);
    drawTransformerTemperature(group, element, rotation);
    // Verbindungsprobleme werden einmal zentral über dem Gleisbild angezeigt.
    // Direkt am Element erscheinen nur laufende bzw. bestätigte Schaltvorgänge.
    if (hardwareInteractive && feedback) drawCommandBadge(group, feedback, rotation);
    drawLabel(group, element, rotation);
    if (interactive) group.addEventListener("click", () => controlElement(element, group));
    if (interactive) group.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      controlElement(element, group);
    });
    elementLayer.appendChild(group);
  });
}
