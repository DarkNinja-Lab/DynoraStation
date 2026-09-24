"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";
import { renderCanvas, inspectorLeer, canvasSize, canvasPointFromEvent, snapCanvasPoint, renderPlacementPreview } from "./render.js";
import { showToast } from "../ui/toast.js";
import { recordHistory, undoHistory, redoHistory } from "./history.js";
import { exportBuildPlan } from "./export.js";
import { localConnectionPorts, worldConnectionPort } from "./shapes.js";


export function ensureCanvasGeometry() {
  const svg = document.getElementById("builderSvg");
  if (svg && !svg.viewBox.baseVal.width) {
    svg.setAttribute("viewBox", "0 0 1600 900");
  }
}

export function setupBuilderButtons() {
  console.log("🔧 Setup Builder Buttons...");

  if (!state.layout.elemente) {
    state.layout.elemente = [];
  }

  state.selectedTool = "select";
  state.showLabels = true;
  state.snapToGrid = true;

  // Bauteil wählen, anschließend direkt im Plan positionieren.
  document.querySelectorAll(".add-element-button").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      beginPlacement(btn.dataset.add, btn.dataset.signalAspects || "", btn.dataset.catalogCode || "");
    });
  });
  const componentSearch = document.getElementById("componentSearch");
  componentSearch?.addEventListener("input", () => {
    const query = componentSearch.value.trim().toLocaleLowerCase("de");
    document.querySelectorAll(".builder-library-group .catalog-group, .builder-control-grid .add-element-button").forEach((item) => {
      const text = `${item.textContent || ""} ${item.dataset.searchable || ""}`.toLocaleLowerCase("de");
      item.classList.toggle("search-hidden", Boolean(query && !text.includes(query)));
    });
    document.querySelectorAll(".builder-library-group").forEach((group) => {
      if (query && group.querySelector(":scope > .catalog-group:not(.search-hidden), :scope > .builder-control-grid .add-element-button:not(.search-hidden)")) group.open = true;
    });
  });
  bindPlacementCanvas();

  // Save Layout
  const saveBtn = document.getElementById("saveLayoutButton");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      console.log("💾 Saving layout...");
      try {
        const result = await apiCall("/layout", {
          method: "POST",
          body: state.layout
        });
        state.relayConflicts = Array.isArray(result?.warnings?.relayConflicts) ? result.warnings.relayConflicts : [];
        state.layoutDirty = false;
        try { localStorage.removeItem("dynora.layoutDraft"); } catch {}
        if (state.relayConflicts.length) {
          const first = state.relayConflicts[0];
          showToast(`Layout gespeichert · Warnung: ${state.relayConflicts.length} Relais-Konflikt(e), z. B. ${first.module}: Relais ${first.channel}`, "warning");
        } else {
          showToast("Layout gespeichert");
        }
      } catch (e) {
        console.error(e);
        showToast("❌ Fehler beim Speichern!", "error");
      }
    });
  }

  const exportButton = document.getElementById("exportPlanButton");
  if (exportButton && exportButton.dataset.exportBound !== "true") {
    exportButton.dataset.exportBound = "true";
    exportButton.addEventListener("click", exportBuildPlan);
  }

  // Clear Layout
  const clearBtn = document.getElementById("clearLayoutButton");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("Wirklich leeren?")) {
        recordHistory();
        state.layout.elemente = [];
        state.layout.verbindungen = [];
        state.layoutDirty = true;
        state.selectedElement = null;
        renderCanvas();
        inspectorLeer();
        showToast("🗑️ Layout geleert");
      }
    });
  }

  document.getElementById("undoButton")?.addEventListener("click", () => {
    if (!undoHistory()) return;
    renderCanvas(); inspectorLeer(); showToast("Letzte Änderung rückgängig gemacht");
  });
  document.getElementById("redoButton")?.addEventListener("click", () => {
    if (!redoHistory()) return;
    renderCanvas(); inspectorLeer(); showToast("Änderung wiederhergestellt");
  });

  console.log("✅ Builder Buttons ready");
}

const PLACEABLE_TYPES = ["track", "curve", "switch", "crossing", "bumper", "signal", "espSignal", "transformer"];
const TRACK_TYPES = new Set(["track", "curve", "switch", "crossing", "bumper"]);

function placementLabel(type) {
  return ({
    track: "Gerades Gleis", curve: "Kurve", switch: "Weiche", crossing: "Kreuzungsweiche",
    bumper: "Prellbock", signal: "Hauptsignal", espSignal: "ESP-Signal", transformer: "Transformator"
  })[type] || "Bauteil";
}

function placementDisplayLabel(type, catalogCode = "") {
  if (type === "track" && String(catalogCode) === "5112") return "Entkupplungsgleis";
  return placementLabel(type);
}

function selectedCatalogCode(type) {
  const ids = { track: "trackTypeSelect", curve: "curveTypeSelect", switch: "switchTypeSelect", crossing: "xTrackTypeSelect", bumper: "bumperTypeSelect" };
  return ids[type] ? document.getElementById(ids[type])?.value || "" : "";
}

function createElement(type, x, y, rotation = 0, requestedCatalogCode = "", signalAspectMode = "rg") {
  const catalogCode = requestedCatalogCode || selectedCatalogCode(type);
  return {
    id: `elem_${Math.random().toString(36).slice(2, 11)}`,
    typ: type,
    name: "",
    x,
    y,
    rotation,
    winkel: rotation,
    catalogCode,
    trackCode: type === "track" ? catalogCode : "",
    curveCode: type === "curve" ? catalogCode : "",
    switchCode: type === "switch" ? catalogCode : "",
    xTrackCode: type === "crossing" ? catalogCode : "",
    bumperCode: type === "bumper" ? catalogCode : "",
    module: preferredModule(type === "espSignal" ? "led" : "relay"),
    relay: 0, relayA: 0, relayB: 0, xState: "gerade", sensorId: "",
    relayStraight: 0, relayBranch: 0, switchState: "gerade",
    relayHp0: 0, relayHp1: 0, signalState: "halt",
    signalAspectMode: signalAspectMode === "rgy" ? "rgy" : "rg",
    ledChannelRed: 0, ledChannelYellow: 0, ledChannelGreen: 0, espState: "halt", ledState: "halt",
    showInDirectControl: true
  };
}

function catalogGeometry(element) {
  const group = element.typ === "track" ? "tracks"
    : element.typ === "curve" ? "curves"
    : element.typ === "switch" ? "switches"
    : element.typ === "crossing" ? "crossings"
    : element.typ === "bumper" ? "bumpers" : "";
  if (!group) return {};
  const code = element.trackCode || element.curveCode || element.switchCode || element.xTrackCode || element.bumperCode || element.catalogCode;
  return (state.catalog?.[group] || []).find((item) => String(item.code) === String(code)) || {};
}

function attachToNearestTrack(element) {
  if (!TRACK_TYPES.has(element.typ)) return null;
  const targets = (state.layout.elemente || []).filter((item) => TRACK_TYPES.has(item.typ));
  if (!targets.length) return null;
  const sourcePorts = localConnectionPorts(element, catalogGeometry(element));
  const occupiedPorts = new Set();
  (state.layout.verbindungen || []).forEach((connection) => {
    occupiedPorts.add(`${connection.von}:${Number(connection.vonPort) || 0}`);
    occupiedPorts.add(`${connection.nach}:${Number(connection.nachPort) || 0}`);
  });
  const threshold = Math.max(28, Math.min(72, 52 / Math.max(.45, Number(state.zoom) || 1)));
  let best = null;

  targets.forEach((target) => {
    const targetPorts = localConnectionPorts(target, catalogGeometry(target));
    sourcePorts.forEach((sourcePort, sourceIndex) => {
      const sourceWorld = worldConnectionPort(element, sourcePort);
      targetPorts.forEach((targetPort, targetIndex) => {
        if (occupiedPorts.has(`${target.id}:${targetIndex}`)) return;
        const targetWorld = worldConnectionPort(target, targetPort);
        const distance = Math.hypot(sourceWorld.x - targetWorld.x, sourceWorld.y - targetWorld.y);
        if (distance <= threshold && (!best || distance < best.distance)) {
          best = { target, targetWorld, sourcePort, sourceIndex, targetIndex, distance };
        }
      });
    });
  });

  if (!best) return null;
  const desiredRotation = ((best.targetWorld.angle + 180 - best.sourcePort.angle) % 360 + 360) % 360;
  const rotatedPort = worldConnectionPort({ ...element, x: 0, y: 0, rotation: desiredRotation, winkel: desiredRotation }, best.sourcePort);
  const size = canvasSize();
  element.rotation = desiredRotation;
  element.winkel = desiredRotation;
  element.x = Math.max(40, Math.min(size.width - 40, best.targetWorld.x - rotatedPort.x));
  element.y = Math.max(40, Math.min(size.height - 40, best.targetWorld.y - rotatedPort.y));
  return {
    id: `connection_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    von: best.target.id,
    vonPort: best.targetIndex,
    nach: element.id,
    nachPort: best.sourceIndex,
    snapX: best.targetWorld.x,
    snapY: best.targetWorld.y,
    targetName: best.target.name || placementLabel(best.target.typ)
  };
}

function syncPlacementUi() {
  const placement = state.placement;
  const bar = document.getElementById("placementBar");
  const svg = document.getElementById("builderSvg");
  if (bar) bar.hidden = !placement;
  svg?.classList.toggle("is-placing", Boolean(placement));
  document.getElementById("selectToolButton")?.classList.toggle("active", !placement && state.selectedTool === "select");
  document.getElementById("connectToolButton")?.classList.toggle("active", !placement && state.selectedTool === "connect");
  document.querySelectorAll(".add-element-button").forEach((button) => button.classList.toggle("placing-active", Boolean(placement && button.dataset.add === placement.typ)));
  if (!placement) return;
  const code = placement.catalogCode ? ` · ${placement.catalogCode}` : "";
  const title = document.getElementById("placementTitle");
  const hint = document.getElementById("placementHint");
  if (title) title.textContent = `${placementDisplayLabel(placement.typ, placement.catalogCode)}${code}`;
  if (hint) {
    const magnetic = placement.magnetic
      ? `Freier Anschluss an ${placement.previewConnection?.targetName || "Gleis"} · klicken zum Verbinden`
      : "Position anklicken · freie Gleisenden rasten präzise ein";
    hint.textContent = placement.count ? `${placement.count} platziert · ${magnetic}` : magnetic;
  }
}

export function beginPlacement(type, signalAspectMode = "", requestedCatalogCode = "") {
  if (!["track", "curve", "switch", "crossing", "bumper", "signal", "espSignal", "transformer"].includes(type)) return;
  const size = canvasSize();
  const center = snapCanvasPoint({
    x: (Number(state.panX) || 0) + size.width / (2 * (Number(state.zoom) || 1)),
    y: (Number(state.panY) || 0) + size.height / (2 * (Number(state.zoom) || 1))
  });
  state.selectedTool = "place";
  state.connectFrom = null;
  state.placement = { ...createElement(type, center.x, center.y, 0, requestedCatalogCode, signalAspectMode), id: "placement-preview", count: 0, magnetic: false };
  syncPlacementUi();
  renderCanvas();
  if (window.matchMedia("(max-width: 900px)").matches) {
    document.querySelector('[data-builder-panel="canvas"]')?.click();
  }
}

export function rotatePlacement(degrees) {
  if (!state.placement) return false;
  state.placement.rotation = ((Number(state.placement.rotation) || 0) + degrees + 360) % 360;
  state.placement.winkel = state.placement.rotation;
  renderPlacementPreview();
  return true;
}

export function cancelPlacement() {
  if (!state.placement) return false;
  state.placement = null;
  state.selectedTool = "select";
  syncPlacementUi();
  renderCanvas();
  return true;
}

function commitPlacement(point) {
  const placement = state.placement;
  if (!placement) return;
  if (!Array.isArray(state.layout.elemente)) state.layout.elemente = [];
  if (!Array.isArray(state.layout.verbindungen)) state.layout.verbindungen = [];
  const position = snapCanvasPoint(point);
  const element = createElement(placement.typ, position.x, position.y, Number(placement.rotation) || 0, placement.catalogCode, placement.signalAspectMode);
  recordHistory();
  const connection = attachToNearestTrack(element);
  state.layout.elemente.push(element);
  if (connection) state.layout.verbindungen.push(connection);
  state.layoutDirty = true;
  state.selectedElement = element.id;
  placement.count = Number(placement.count || 0) + 1;
  placement.x = position.x;
  placement.y = position.y;
  syncPlacementUi();
  renderCanvas();
  showToast(connection ? "Gleis platziert und magnetisch verbunden" : `${placementDisplayLabel(element.typ, element.catalogCode)} platziert`);
}

function bindPlacementCanvas() {
  const root = document.getElementById("builderSvg");
  if (!root || root.dataset.placementBound === "true") return;
  root.dataset.placementBound = "true";
  root.addEventListener("pointermove", (event) => {
    if (!state.placement) return;
    const point = snapCanvasPoint(canvasPointFromEvent(root, event));
    state.placement.x = point.x;
    state.placement.y = point.y;
    state.placement.previewConnection = attachToNearestTrack(state.placement);
    state.placement.magnetic = Boolean(state.placement.previewConnection);
    syncPlacementUi();
    renderPlacementPreview();
  });
  root.addEventListener("pointerdown", (event) => {
    if (!state.placement || event.button !== 0 || event.target.closest?.(".layout-element")) return;
    event.preventDefault();
    event.stopPropagation();
    commitPlacement(canvasPointFromEvent(root, event));
  });
  root.addEventListener("contextmenu", (event) => {
    if (!state.placement) return;
    event.preventDefault();
    cancelPlacement();
  });
  document.getElementById("placementRotateLeft")?.addEventListener("click", () => rotatePlacement(-7.5));
  document.getElementById("placementRotateRight")?.addEventListener("click", () => rotatePlacement(7.5));
  document.getElementById("placementDone")?.addEventListener("click", cancelPlacement);
}

function preferredModule(capability) {
  const modules = Object.values(state.hardware?.modules || {});
  const exact = modules.find((module) => Array.isArray(module.capabilities) && module.capabilities.includes(capability));
  if (exact) return exact.id;
  const byInventory = modules.find((module) => capability === "led"
    ? (Array.isArray(module.leds) && module.leds.length > 0) ||
      (Array.isArray(state.hardware?.leds) && state.hardware.leds.some((led) => led.module === module.id)) ||
      Object.keys(state.ledConfig || {}).some((key) => key.startsWith(`${module.id}:`))
    : Array.isArray(module.relays) && module.relays.length > 0);
  if (byInventory) return byInventory.id;
  const byKind = modules.find((module) => capability === "led"
    ? ["SIGNAL_LED", "HYBRID"].includes(module.kind)
    : ["RELAY_SENSOR", "HYBRID"].includes(module.kind));
  return byKind?.id || "";
}
