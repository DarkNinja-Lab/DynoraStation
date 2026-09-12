"use strict";

import { state } from "../core/state.js";
import { renderCanvas } from "./render.js";
import { showToast } from "../ui/toast.js";
import { recordHistory } from "./history.js";


function isTypingTarget(target) {
  return !!target?.closest?.("input, textarea, select, [contenteditable=\"true\"]");
}

function selectedElement() {
  return state.layout.elemente?.find((e) => e.id === state.selectedElement) || null;
}

function nudgeSelected(dx, dy) {
  const el = selectedElement();
  if (!el) return;
  const step = state.snapToGrid ? 25 : 5;
  recordHistory();
  el.x = Number(el.x || 0) + dx * step;
  el.y = Number(el.y || 0) + dy * step;
  state.layoutDirty = true;
  renderCanvas();
}

function bindKeyboardShortcuts() {
  document.addEventListener("keydown", (event) => {
    if (isTypingTarget(event.target)) return;
    const key = event.key.toLowerCase();
    const mod = event.ctrlKey || event.metaKey;

    if (mod && key === "s") {
      event.preventDefault();
      document.getElementById("saveLayoutButton")?.click();
      return;
    }
    if (mod && key === "d") {
      event.preventDefault();
      document.getElementById("duplicateButton")?.click();
      return;
    }
    if (key === "delete" || key === "backspace") {
      if (!state.selectedElement) return;
      event.preventDefault();
      document.getElementById("deleteButton")?.click();
      return;
    }
    if (key === "v") {
      document.getElementById("selectToolButton")?.click();
      return;
    }
    if (key === "c") {
      document.getElementById("connectToolButton")?.click();
      return;
    }
    if (key === "r") {
      event.preventDefault();
      document.getElementById(event.shiftKey ? "rotateLeftButton" : "rotateRightButton")?.click();
      return;
    }
    if (key === "0") {
      document.getElementById("zoomResetButton")?.click();
      return;
    }
    if (key === "+" || key === "=") {
      document.getElementById("zoomInButton")?.click();
      return;
    }
    if (key === "-") {
      document.getElementById("zoomOutButton")?.click();
      return;
    }
    if (event.key === "ArrowLeft") { event.preventDefault(); nudgeSelected(-1, 0); }
    if (event.key === "ArrowRight") { event.preventDefault(); nudgeSelected(1, 0); }
    if (event.key === "ArrowUp") { event.preventDefault(); nudgeSelected(0, -1); }
    if (event.key === "ArrowDown") { event.preventDefault(); nudgeSelected(0, 1); }
  });
}

export function initializeTools() {
  console.log("🔧 Initialize Tools...");
  state.zoom = Number(state.zoom) || 1;
  state.panX = Number(state.panX) || 0;
  state.panY = Number(state.panY) || 0;

  // Select Tool
  const selectToolBtn = document.getElementById("selectToolButton");
  if (selectToolBtn) {
    selectToolBtn.addEventListener("click", () => {
      state.selectedTool = "select";
      updateToolButtons();
      console.log("✅ Select Tool aktiv");
    });
  }

  // Connect Tool
  const connectToolBtn = document.getElementById("connectToolButton");
  if (connectToolBtn) {
    connectToolBtn.addEventListener("click", () => {
      state.selectedTool = "connect";
      updateToolButtons();
      console.log("✅ Connect Tool aktiv");
    });
  }

  // Duplicate Button
  const duplicateBtn = document.getElementById("duplicateButton");
  if (duplicateBtn) {
    duplicateBtn.addEventListener("click", () => {
      if (!state.selectedElement) {
        showToast("⚠️ Bitte zuerst Element auswählen!", "warning");
        return;
      }
      duplicateElement();
    });
  }

  // Rotate Left
  const rotateLeftBtn = document.getElementById("rotateLeftButton");
  if (rotateLeftBtn) {
    rotateLeftBtn.addEventListener("click", () => {
      if (!state.selectedElement) {
        showToast("⚠️ Bitte zuerst Element auswählen!", "warning");
        return;
      }
      rotateElement(-15);
    });
  }

  // Rotate Right
  const rotateRightBtn = document.getElementById("rotateRightButton");
  if (rotateRightBtn) {
    rotateRightBtn.addEventListener("click", () => {
      if (!state.selectedElement) {
        showToast("⚠️ Bitte zuerst Element auswählen!", "warning");
        return;
      }
      rotateElement(15);
    });
  }

  // Delete Button
  const deleteBtn = document.getElementById("deleteButton");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", () => {
      if (!state.selectedElement) {
        showToast("⚠️ Bitte zuerst Element auswählen!", "warning");
        return;
      }
      deleteElement();
    });
  }

  // Grid Checkbox
  const gridCheckbox = document.getElementById("gridCheckbox");
  if (gridCheckbox) {
    gridCheckbox.addEventListener("change", (e) => {
      const grid = document.getElementById("builderGrid");
      if (grid) {
        grid.style.display = e.target.checked ? "block" : "none";
      }
    });
  }

  // Snap Checkbox
  const snapCheckbox = document.getElementById("snapCheckbox");
  if (snapCheckbox) {
    snapCheckbox.addEventListener("change", (e) => {
      state.snapToGrid = e.target.checked;
      console.log(`Snap to Grid: ${e.target.checked}`);
    });
  }

  // Labels Checkbox
  const labelsCheckbox = document.getElementById("labelsCheckbox");
  if (labelsCheckbox) {
    labelsCheckbox.addEventListener("change", (e) => {
      state.showLabels = e.target.checked;
      renderCanvas();
    });
  }

  // Zoom Buttons
  const zoomOutBtn = document.getElementById("zoomOutButton");
  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      state.zoom = Math.max(0.25, state.zoom - 0.1);
      updateZoom();
    });
  }

  const zoomInBtn = document.getElementById("zoomInButton");
  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      state.zoom = Math.min(3, state.zoom + 0.1);
      updateZoom();
    });
  }

  const zoomResetBtn = document.getElementById("zoomResetButton");
  if (zoomResetBtn) {
    zoomResetBtn.addEventListener("click", () => {
      state.zoom = 1;
      state.panX = 0;
      state.panY = 0;
      updateZoom();
    });
  }

  const centerBtn = document.getElementById("centerLayoutButton");
  if (centerBtn) {
    centerBtn.addEventListener("click", () => {
      const elements = state.layout.elemente || [];
      if (elements.length) {
        const xs = elements.map((element) => Number(element.x) || 0);
        const ys = elements.map((element) => Number(element.y) || 0);
        state.panX = (Math.min(...xs) + Math.max(...xs)) / 2 - 800 / state.zoom;
        state.panY = (Math.min(...ys) + Math.max(...ys)) / 2 - 450 / state.zoom;
      } else {
        state.panX = 0;
        state.panY = 0;
      }
      updateZoom();
    });
  }

  bindKeyboardShortcuts();
  bindCanvasNavigation();
  console.log("✅ Tools initialized");
}

function updateToolButtons() {
  document.querySelectorAll(".palette-button").forEach(btn => {
    const isSelect = btn.id === "selectToolButton" && state.selectedTool === "select";
    const isConnect = btn.id === "connectToolButton" && state.selectedTool === "connect";
    btn.classList.toggle("active", isSelect || isConnect);
  });
}

function duplicateElement() {
  const el = state.layout.elemente?.find(e => e.id === state.selectedElement);
  if (!el) return;

  const newElement = {
    ...JSON.parse(JSON.stringify(el)),
    id: "elem_" + Math.random().toString(36).substr(2, 9),
    x: el.x + 40,
    y: el.y + 40
  };

  if (!state.layout.elemente) state.layout.elemente = [];
  recordHistory();
  state.layout.elemente.push(newElement);
  state.selectedElement = newElement.id;
  state.layoutDirty = true;
  renderCanvas();
  showToast("✅ Element dupliziert");
}

function rotateElement(degrees) {
  const el = state.layout.elemente?.find(e => e.id === state.selectedElement);
  if (!el) return;

  recordHistory();
  el.rotation = (el.rotation + degrees) % 360;
  state.layoutDirty = true;
  renderCanvas();
  showToast(`↻ Rotiert um ${degrees}°`);
}

function deleteElement() {
  if (!confirm("Element wirklich löschen?")) return;

  recordHistory();
  state.layout.elemente = (state.layout.elemente || []).filter(
    e => e.id !== state.selectedElement
  );
  state.layout.verbindungen = (state.layout.verbindungen || []).filter(
    connection => connection.von !== state.selectedElement && connection.nach !== state.selectedElement
  );
  state.layoutDirty = true;
  state.selectedElement = null;
  renderCanvas();
  showToast("🗑️ Element gelöscht");
}

function updateZoom() {
  const label = document.getElementById("zoomLabel");
  if (label) {
    label.textContent = Math.round(state.zoom * 100) + " %";
  }

  const svg = document.getElementById("builderSvg");
  if (svg) {
    const width = 1600 / state.zoom;
    const height = 900 / state.zoom;
    svg.setAttribute("viewBox", `${state.panX} ${state.panY} ${width} ${height}`);
  }
}

function bindCanvasNavigation() {
  const svg = document.getElementById("builderSvg");
  if (!svg || svg.dataset.navigationBound === "true") return;
  svg.dataset.navigationBound = "true";
  let drag = null;

  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const oldWidth = 1600 / state.zoom;
    const oldHeight = 900 / state.zoom;
    const ratioX = (event.clientX - rect.left) / Math.max(1, rect.width);
    const ratioY = (event.clientY - rect.top) / Math.max(1, rect.height);
    const nextZoom = Math.max(.25, Math.min(3, state.zoom * (event.deltaY < 0 ? 1.12 : .89)));
    const nextWidth = 1600 / nextZoom;
    const nextHeight = 900 / nextZoom;
    state.panX += ratioX * (oldWidth - nextWidth);
    state.panY += ratioY * (oldHeight - nextHeight);
    state.zoom = nextZoom;
    updateZoom();
  }, { passive: false });

  svg.addEventListener("pointerdown", (event) => {
    const background = !event.target.closest?.(".layout-element");
    const shouldPan = event.button === 1 || (background && event.button === 0);
    if (!shouldPan) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = svg.getBoundingClientRect();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY, width: 1600 / state.zoom, height: 900 / state.zoom, rect };
    svg.setPointerCapture?.(event.pointerId);
    svg.classList.add("is-panning");
  }, true);

  svg.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    state.panX = drag.panX - (event.clientX - drag.x) * drag.width / Math.max(1, drag.rect.width);
    state.panY = drag.panY - (event.clientY - drag.y) * drag.height / Math.max(1, drag.rect.height);
    updateZoom();
  });

  const finish = (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    svg.classList.remove("is-panning");
  };
  svg.addEventListener("pointerup", finish);
  svg.addEventListener("pointercancel", finish);
}

export { updateZoom };
