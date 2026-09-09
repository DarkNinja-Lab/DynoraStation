"use strict";

import { state } from "../core/state.js";
import { renderCanvas } from "./render.js";
import { showToast } from "../ui/toast.js";

export function initializeTools() {
  console.log("🔧 Initialize Tools...");

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
      state.panX = 0;
      state.panY = 0;
      updateZoom();
    });
  }

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
  state.layout.elemente.push(newElement);
  renderCanvas();
  showToast("✅ Element dupliziert");
}

function rotateElement(degrees) {
  const el = state.layout.elemente?.find(e => e.id === state.selectedElement);
  if (!el) return;

  el.rotation = (el.rotation + degrees) % 360;
  renderCanvas();
  showToast(`↻ Rotiert um ${degrees}°`);
}

function deleteElement() {
  if (!confirm("Element wirklich löschen?")) return;

  state.layout.elemente = (state.layout.elemente || []).filter(
    e => e.id !== state.selectedElement
  );
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
    svg.style.transform = `scale(${state.zoom}) translate(${state.panX}px, ${state.panY}px)`;
  }
}

export { updateZoom };