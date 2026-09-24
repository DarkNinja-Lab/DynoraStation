"use strict";

import { state } from "../core/state.js";
import { showInspector, inspectorLeer } from "./inspect.js";
import {
  svg, attrs, drawDoubleRailLine, drawStateSegmentLine, drawPowerLine, drawUncouplerShape, drawCurveDual, drawPowerCurve,
  drawSwitchShape, drawCrossingShape, drawBumperShape, drawSignalShape, drawEspSignalShape, drawTransformerShape, drawLabel,
  localConnectionPorts, worldConnectionPort
} from "./shapes.js";
import { recordHistory } from "./history.js";
import { refreshPlanValidation } from "./validation.js";

export function canvasSize() {
  return {
    width: Math.max(250, Number(state.layout?.metadaten?.plateWidthMm || 3200) * .5),
    height: Math.max(250, Number(state.layout?.metadaten?.plateHeightMm || 1800) * .5)
  };
}

export function canvasPointFromEvent(root, event) {
  const matrix = root.getScreenCTM();
  if (matrix && typeof DOMPoint !== "undefined") {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  }
  const rect = root.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvasSize().width,
    y: ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvasSize().height
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function snap(value) {
  const size = Number(state.layout?.metadaten?.raster) || 25;
  return state.snapToGrid === false ? value : Math.round(value / size) * size;
}

export function snapCanvasPoint(point) {
  const size = canvasSize();
  return {
    x: clamp(snap(point.x), 40, size.width - 40),
    y: clamp(snap(point.y), 40, size.height - 40)
  };
}

function catalogItem(element, group) {
  const code = element.trackCode || element.curveCode || element.switchCode || element.xTrackCode || element.catalogCode;
  return (state.catalog?.[group] || []).find((item) => String(item.code) === String(code)) || {};
}

function elementCatalogItem(element) {
  const group = element.typ === "track" ? "tracks"
    : element.typ === "curve" ? "curves"
    : element.typ === "switch" ? "switches"
    : element.typ === "bumper" ? "bumpers"
    : (element.typ === "crossing" || element.typ === "xtrack") ? "crossings"
    : "";
  return group ? catalogItem(element, group) : {};
}

function portAt(element, portIndex = 0) {
  const ports = localConnectionPorts(element, elementCatalogItem(element));
  const local = ports[Math.max(0, Math.min(ports.length - 1, Number(portIndex) || 0))] || ports[0];
  return worldConnectionPort(element, local);
}

function drawConnections(layer, elements) {
  const byId = new Map(elements.map((element) => [element.id, element]));
  for (const connection of state.layout.verbindungen || []) {
    const from = byId.get(connection.von);
    const to = byId.get(connection.nach);
    if (!from || !to) continue;
    const a = portAt(from, connection.vonPort);
    const b = portAt(to, connection.nachPort);
    const line = svg("line");
    attrs(line, {
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      stroke: "#536779", "stroke-width": 3, "stroke-dasharray": "5 5", opacity: .7,
      "data-from": from.id, "data-to": to.id
    });
    layer.appendChild(line);
  }
}
function updateConnectedLines(element) {
  document.querySelectorAll("#builderConnectionLayer line").forEach((line) => {
    const connection = (state.layout.verbindungen || []).find((item) => item.von === line.dataset.from && item.nach === line.dataset.to);
    if (!connection) return;
    if (line.dataset.from === element.id) {
      const p = portAt(element, connection.vonPort);
      attrs(line, { x1: p.x, y1: p.y });
    }
    if (line.dataset.to === element.id) {
      const p = portAt(element, connection.nachPort);
      attrs(line, { x2: p.x, y2: p.y });
    }
  });
}

export function renderPlacementPreview() {
  const layer = document.getElementById("builderPlacementLayer");
  if (!layer) return;
  layer.replaceChildren();
  const placement = state.placement;
  if (!placement) return;

  if (placement.previewConnection) {
    const target = svg("g");
    target.classList.add("placement-snap-target");
    const outer = svg("circle");
    attrs(outer, { cx: placement.previewConnection.snapX, cy: placement.previewConnection.snapY, r: 15, fill: "rgba(50,242,154,.13)", stroke: "#32f29a", "stroke-width": 3 });
    const inner = svg("circle");
    attrs(inner, { cx: placement.previewConnection.snapX, cy: placement.previewConnection.snapY, r: 4, fill: "#eafff4" });
    target.append(outer, inner);
    layer.appendChild(target);
  }

  const group = svg("g");
  group.classList.add("placement-preview");
  if (placement.magnetic) group.classList.add("magnetic");
  group.setAttribute("transform", `translate(${Number(placement.x || 0)}, ${Number(placement.y || 0)}) rotate(${Number(placement.rotation || 0)})`);
  const halo = svg("circle");
  attrs(halo, { cx: 0, cy: 0, r: 24, fill: "none", stroke: placement.magnetic ? "#4ac181" : "#d9a649", "stroke-width": placement.magnetic ? 3 : 2, "stroke-dasharray": placement.magnetic ? "" : "5 5" });
  group.appendChild(halo);
  drawElementShape(group, placement);
  layer.appendChild(group);
}

export function renderCanvas() {
  const root = document.getElementById("builderSvg");
  const elementLayer = document.getElementById("builderElementLayer");
  const connectionLayer = document.getElementById("builderConnectionLayer");
  if (!root || !elementLayer || !connectionLayer) return;
  const { width, height } = canvasSize();
  const background = document.getElementById("builderBackground");
  if (background) attrs(background, { width, height });
  const emptyHint = document.getElementById("builderEmptyHint");
  if (emptyHint) attrs(emptyHint, { x: width / 2, y: height / 2 });
  const grid = document.getElementById("builderGrid");
  const gridSize = Math.max(5, Number(state.layout?.metadaten?.raster) || 25);
  if (grid) {
    const major = gridSize * 4;
    attrs(grid, { width: major, height: major });
    const paths = grid.querySelectorAll("path");
    if (paths[0]) paths[0].setAttribute("d", `M${gridSize} 0V${major} M${gridSize * 2} 0V${major} M${gridSize * 3} 0V${major} M0 ${gridSize}H${major} M0 ${gridSize * 2}H${major} M0 ${gridSize * 3}H${major}`);
    if (paths[1]) paths[1].setAttribute("d", `M0 0H${major}V${major}H0Z`);
  }

  if (state.layoutDirty) {
    try { localStorage.setItem("dynora.layoutDraft", JSON.stringify({ savedAt: Date.now(), layout: state.layout })); } catch {}
  }

  elementLayer.replaceChildren();
  connectionLayer.replaceChildren();
  const elements = Array.isArray(state.layout?.elemente) ? state.layout.elemente : [];
  drawConnections(connectionLayer, elements);
  elements.forEach((element) => drawElement(root, element, elementLayer));
  renderPlacementPreview();

  const empty = document.getElementById("builderEmptyHint");
  if (empty) empty.style.display = elements.length || state.placement ? "none" : "block";
  const count = document.getElementById("elementCount");
  if (count) count.textContent = String(elements.length);
  const connectionCount = document.getElementById("connectionCount");
  if (connectionCount) connectionCount.textContent = String(state.layout.verbindungen?.length || 0);
  refreshPlanValidation();

  root.onpointerdown = (event) => {
    if (event.target.closest?.(".layout-element")) return;
    if (state.selectedTool === "place") return;
    state.selectedElement = null;
    state.connectFrom = null;
    renderCanvas();
    inspectorLeer();
  };
}

function angleDistance(a, b) {
  let d = Math.abs((((a - b) % 360) + 540) % 360 - 180);
  return d;
}

function connectElement(element) {
  if (!state.connectFrom) {
    state.connectFrom = element.id;
    state.selectedElement = element.id;
    renderCanvas();
    return;
  }

  const source = state.layout.elemente?.find((item) => item.id === state.connectFrom);
  const target = element;
  if (source && source.id !== target.id) {
    const sourcePorts = localConnectionPorts(source, elementCatalogItem(source));
    const targetPorts = localConnectionPorts(target, elementCatalogItem(target));
    let best = null;

    sourcePorts.forEach((sourcePort, sourceIndex) => {
      targetPorts.forEach((targetPort, targetIndex) => {
        const targetWorld = worldConnectionPort(target, targetPort);
        const desiredRotation = ((targetWorld.angle + 180 - sourcePort.angle) % 360 + 360) % 360;
        const oldRotation = Number(source.rotation ?? source.winkel ?? 0);
        const rotationPenalty = angleDistance(desiredRotation, oldRotation) * .65;
        const sourceWorldNow = worldConnectionPort(source, sourcePort);
        const distance = Math.hypot(sourceWorldNow.x - targetWorld.x, sourceWorldNow.y - targetWorld.y);
        const score = distance + rotationPenalty;
        if (!best || score < best.score) best = { sourceIndex, targetIndex, sourcePort, targetWorld, desiredRotation, score };
      });
    });

    if (best) {
      recordHistory();
      source.rotation = best.desiredRotation;
      source.winkel = best.desiredRotation;
      const rotatedSourcePort = worldConnectionPort({ ...source, x: 0, y: 0 }, best.sourcePort);
      const size = canvasSize();
      source.x = clamp(best.targetWorld.x - rotatedSourcePort.x, 40, size.width - 40);
      source.y = clamp(best.targetWorld.y - rotatedSourcePort.y, 40, size.height - 40);

      if (!Array.isArray(state.layout.verbindungen)) state.layout.verbindungen = [];
      const existing = state.layout.verbindungen.find((item) =>
        (item.von === source.id && item.nach === target.id) ||
        (item.von === target.id && item.nach === source.id)
      );
      if (existing) {
        if (existing.von === source.id) {
          existing.vonPort = best.sourceIndex;
          existing.nachPort = best.targetIndex;
        } else {
          existing.vonPort = best.targetIndex;
          existing.nachPort = best.sourceIndex;
        }
      } else {
        state.layout.verbindungen.push({
          id: `connection_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          von: source.id,
          vonPort: best.sourceIndex,
          nach: target.id,
          nachPort: best.targetIndex
        });
      }
      state.layoutDirty = true;
    }
  }
  state.connectFrom = null;
  state.selectedElement = element.id;
  renderCanvas();
}
function drawElement(root, element, layer) {
  const size = canvasSize();
  element.x = clamp(element.x, 40, size.width - 40);
  element.y = clamp(element.y, 40, size.height - 40);
  element.rotation = Number(element.rotation ?? element.winkel ?? 0);
  const group = svg("g");
  group.classList.add("layout-element");
  if (element.id === state.selectedElement) group.classList.add("selected");
  if (element.id === state.connectFrom) group.classList.add("connection-source");
  group.dataset.id = element.id;
  group.setAttribute("transform", `translate(${element.x}, ${element.y}) rotate(${element.rotation})`);

  const hitbox = svg("rect");
  const is5141 = element.typ === "switch" && elementCatalogItem(element).switchGeometry === "5141";
  attrs(hitbox, is5141
    ? { x: -68, y: -55, width: 140, height: 85, rx: 12, fill: "transparent", "pointer-events": "all" }
    : { x: -80, y: -55, width: 160, height: 110, rx: 12, fill: "transparent", "pointer-events": "all" });
  group.appendChild(hitbox);
  drawElementShape(group, element);
  if (state.showLabels !== false) drawLabel(group, element, element.rotation);

  let drag = null;
  let suppressClick = false;
  group.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
    if (state.selectedTool === "connect") return;
    if (state.selectedTool === "place") return;
    const point = canvasPointFromEvent(root, event);
    drag = {
      id: event.pointerId,
      dx: point.x - element.x,
      dy: point.y - element.y,
      startX: element.x,
      startY: element.y,
      moved: false
    };
    group.setPointerCapture?.(event.pointerId);
    state.selectedElement = element.id;
    group.classList.add("selected", "dragging");
  });
  group.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const point = canvasPointFromEvent(root, event);
    const x = clamp(point.x - drag.dx, 40, size.width - 40);
    const y = clamp(point.y - drag.dy, 40, size.height - 40);
    if (!drag.moved && Math.hypot(x - drag.startX, y - drag.startY) < 5) return;
    if (!drag.moved) {
      recordHistory();
      drag.moved = true;
    }
    element.x = x;
    element.y = y;
    group.setAttribute("transform", `translate(${x}, ${y}) rotate(${element.rotation})`);
    updateConnectedLines(element);
  });
  const finishDrag = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const moved = drag.moved;
    suppressClick = moved;
    drag = null;
    group.classList.remove("dragging");
    if (!moved) return;
    element.x = clamp(snap(element.x), 40, size.width - 40);
    element.y = clamp(snap(element.y), 40, size.height - 40);
    state.layoutDirty = true;
    renderCanvas();
    showInspector(element);
  };
  group.addEventListener("pointerup", finishDrag);
  group.addEventListener("pointercancel", finishDrag);
  group.addEventListener("click", (event) => {
    event.stopPropagation();
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (state.selectedTool === "connect") {
      connectElement(element);
      return;
    }
    if (state.selectedTool === "place") return;
    state.selectedElement = element.id;
    renderCanvas();
    showInspector(element);
  });
  layer.appendChild(group);
}

function drawElementShape(group, element) {
  switch (element.typ) {
    case "track":
      {
        const item = catalogItem(element, "tracks");
        if (item.trackStyle === "uncoupler") {
          drawUncouplerShape(group, item, element.powerState, false);
        } else {
          const half = Math.max(12, Number(item.length || 180) * .25);
          drawDoubleRailLine(group, -half, 0, half, 0, "#d5dbe0", 8);
          if (element.powerState) drawPowerLine(group, -half + 3, 0, half - 3, 0);
          else drawStateSegmentLine(group, -Math.min(half - 3, 16), 0, Math.min(half - 3, 16), 0, "#607080");
        }
      }
      break;
    case "curve":
      {
        const item = catalogItem(element, "curves");
        drawCurveDual(group, Number(item.radius || 360) * .5, Number(item.angleDeg || 30), "#d5dbe0");
        if (element.powerState) drawPowerCurve(group, Number(item.radius || 360) * .5, Number(item.angleDeg || 30));
      }
      break;
    case "switch":
      const item = catalogItem(element, "switches");
        drawSwitchShape(group, item.handed || "left", element.switchState !== "abzweig", item);
      break;
    case "bumper":
      drawBumperShape(group, catalogItem(element, "bumpers"));
      break;
    case "crossing":
      {
        const item = catalogItem(element, "crossings");
        drawCrossingShape(group, item, element.xState || "gerade");
      }
      break;
    case "signal":
      drawSignalShape(group, element.signalState);
      break;
    case "espSignal":
      drawEspSignalShape(group, element.espState || element.ledState, element.signalAspectMode);
      break;
    case "transformer":
      drawTransformerShape(group);
      break;
  }
}

export { inspectorLeer, showInspector };
