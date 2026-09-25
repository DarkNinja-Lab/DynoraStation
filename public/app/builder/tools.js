"use strict";

import { state } from "../core/state.js?v=mobile-v5-cachefix";
import { apiCall } from "../core/api.js?v=mobile-v5-cachefix";
import { renderCanvas, canvasSize } from "./render.js?v=mobile-v5-cachefix";
import { showToast } from "../ui/toast.js?v=mobile-v5-cachefix";
import { recordHistory } from "./history.js?v=mobile-v5-cachefix";
import { cancelPlacement, rotatePlacement } from "./canvas.js?v=mobile-v5-cachefix";


function isTypingTarget(target) {
  return !!target?.closest?.("input, textarea, select, [contenteditable=\"true\"]");
}

function selectedElement() {
  return state.layout.elemente?.find((e) => e.id === state.selectedElement) || null;
}

function nudgeSelected(dx, dy) {
  const el = selectedElement();
  if (!el) return;
  const step = state.snapToGrid ? (Number(state.layout?.metadaten?.raster) || 25) : 5;
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

    if (key === "escape" && cancelPlacement()) {
      event.preventDefault();
      return;
    }

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
      if (rotatePlacement(event.shiftKey ? -7.5 : 7.5)) return;
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
  state.zoom = Number(state.zoom) || 1;
  state.panX = Number(state.panX) || 0;
  state.panY = Number(state.panY) || 0;

  // Select Tool
  const selectToolBtn = document.getElementById("selectToolButton");
  if (selectToolBtn) {
    selectToolBtn.addEventListener("click", () => {
      cancelPlacement();
      state.selectedTool = "select";
      updateToolButtons();
    });
  }

  // Connect Tool
  const connectToolBtn = document.getElementById("connectToolButton");
  if (connectToolBtn) {
    connectToolBtn.addEventListener("click", () => {
      cancelPlacement();
      state.selectedTool = "connect";
      updateToolButtons();
    });
  }

  // Duplicate Button
  const duplicateBtn = document.getElementById("duplicateButton");
  if (duplicateBtn) {
    duplicateBtn.addEventListener("click", () => {
      if (!state.selectedElement) {
        showToast("Bitte zuerst Element auswählen!", "warning");
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
        showToast("Bitte zuerst Element auswählen!", "warning");
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
        showToast("Bitte zuerst Element auswählen!", "warning");
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
        showToast("Bitte zuerst Element auswählen!", "warning");
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
      state.zoom = Math.max(0.25, state.zoom / 1.15);
      updateZoom();
    });
  }

  const zoomInBtn = document.getElementById("zoomInButton");
  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      state.zoom = Math.min(3, state.zoom * 1.15);
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
        const size = canvasSize();
        state.panX = (Math.min(...xs) + Math.max(...xs)) / 2 - size.width / (2 * state.zoom);
        state.panY = (Math.min(...ys) + Math.max(...ys)) / 2 - size.height / (2 * state.zoom);
      } else {
        state.panX = 0;
        state.panY = 0;
      }
      updateZoom();
    });
  }

  setupBoardSettings();

  bindKeyboardShortcuts();
  bindCanvasNavigation();
  updateZoom();
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
  showToast("Element dupliziert");
}

function rotateElement(degrees) {
  const el = state.layout.elemente?.find(e => e.id === state.selectedElement);
  if (!el) return;

  recordHistory();
  el.rotation = (el.rotation + degrees) % 360;
  state.layoutDirty = true;
  renderCanvas();
  showToast(`Rotiert um ${degrees}°`);
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
  showToast("Element gelöscht");
}

function updateZoom() {
  const label = document.getElementById("zoomLabel");
  if (label) {
    label.textContent = Math.round(state.zoom * 100) + " %";
  }

  const svg = document.getElementById("builderSvg");
  if (svg) {
    const size = canvasSize();
    const width = size.width / state.zoom;
    const height = size.height / state.zoom;
    svg.setAttribute("viewBox", `${state.panX} ${state.panY} ${width} ${height}`);
  }
}

function setupBoardSettings() {
  const widthInput = document.getElementById("plateWidthInput");
  const heightInput = document.getElementById("plateHeightInput");
  const gridInput = document.getElementById("gridSizeSelect");
  const areaLabel = document.getElementById("boardAreaLabel");
  const updateLabel = () => {
    if (!areaLabel) return;
    const width = (Number(widthInput?.value) || 3200) / 1000;
    const height = (Number(heightInput?.value) || 1800) / 1000;
    areaLabel.textContent = `${width.toLocaleString("de-DE", { minimumFractionDigits: 2 })} × ${height.toLocaleString("de-DE", { minimumFractionDigits: 2 })} m`;
  };
  const syncFields = () => {
    const currentMeta = state.layout?.metadaten || {};
    if (widthInput) widthInput.value = Number(currentMeta.plateWidthMm) || 3200;
    if (heightInput) heightInput.value = Number(currentMeta.plateHeightMm) || 1800;
    if (gridInput) gridInput.value = String(Number(currentMeta.rasterMm) || 25);
    updateLabel();
  };
  widthInput?.addEventListener("input", updateLabel);
  heightInput?.addEventListener("input", updateLabel);
  document.addEventListener("dynora:builder-opened", syncFields);
  syncFields();
  document.getElementById("applyBoardSizeButton")?.addEventListener("click", async () => {
    const width = Math.max(500, Math.min(20000, Number(widthInput?.value) || 3200));
    const height = Math.max(500, Math.min(20000, Number(heightInput?.value) || 1800));
    const rasterMm = Math.max(5, Math.min(200, Number(gridInput?.value) || 25));
    const meta = state.layout.metadaten || (state.layout.metadaten = {});
    recordHistory();
    meta.plateWidthMm = width;
    meta.plateHeightMm = height;
    meta.rasterMm = rasterMm;
    meta.raster = rasterMm * .5;
    state.zoom = 1;
    state.panX = 0;
    state.panY = 0;
    state.layoutDirty = true;
    if (widthInput) widthInput.value = width;
    if (heightInput) heightInput.value = height;
    updateLabel();
    renderCanvas();
    updateZoom();
    const button = document.getElementById("applyBoardSizeButton");
    if (button) button.disabled = true;
    try {
      await apiCall("/layout", { method: "POST", body: state.layout });
      state.layoutDirty = false;
      try { localStorage.removeItem("dynora.layoutDraft"); } catch {}
      showToast("Anlagenplatte und Raster gespeichert");
    } catch (error) {
      showToast(`Anlagenplatte konnte nicht gespeichert werden: ${error?.message || error}`, "error");
    } finally {
      if (button) button.disabled = false;
    }
  });
}

function bindCanvasNavigation() {
  const svg = document.getElementById("builderSvg");
  if (!svg || svg.dataset.navigationBound === "true") return;
  svg.dataset.navigationBound = "true";
  let drag = null;

  svg.addEventListener("wheel", (event) => {
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const size = canvasSize();
    const oldWidth = size.width / state.zoom;
    const oldHeight = size.height / state.zoom;
    const ratioX = (event.clientX - rect.left) / Math.max(1, rect.width);
    const ratioY = (event.clientY - rect.top) / Math.max(1, rect.height);
    const nextZoom = Math.max(.25, Math.min(3, state.zoom * (event.deltaY < 0 ? 1.12 : .89)));
    const nextWidth = size.width / nextZoom;
    const nextHeight = size.height / nextZoom;
    state.panX += ratioX * (oldWidth - nextWidth);
    state.panY += ratioY * (oldHeight - nextHeight);
    state.zoom = nextZoom;
    updateZoom();
  }, { passive: false });

  svg.addEventListener("pointerdown", (event) => {
    if (state.selectedTool === "place") return;
    const background = !event.target.closest?.(".layout-element");
    const shouldPan = event.button === 1 || (background && event.button === 0);
    if (!shouldPan) return;
    event.preventDefault();
    event.stopPropagation();
    const rect = svg.getBoundingClientRect();
    const size = canvasSize();
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY, width: size.width / state.zoom, height: size.height / state.zoom, rect };
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
