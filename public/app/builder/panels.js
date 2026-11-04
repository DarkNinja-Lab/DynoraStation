"use strict";

import { state } from "../core/state.js?v=workspace-v11";

const SHELF_HEIGHT_KEY = "dynora.builderShelfHeight";
const DEFAULT_SHELF_HEIGHT = 210;
const MIN_SHELF_HEIGHT = 132;
const MAX_SHELF_HEIGHT = 520;

function desktopWorkspace() {
  return window.matchMedia("(min-width: 901px)").matches;
}

function applyPanelState(layout, panel) {
  const library = document.getElementById("builderLibrary");
  const inspector = document.getElementById("inspector");
  const resizeHandle = document.getElementById("builderShelfResize");
  const desktop = desktopWorkspace();

  layout.classList.toggle("has-inspector", desktop && panel === "inspector");
  if (library) library.hidden = desktop ? false : panel !== "library";
  if (inspector) inspector.hidden = panel !== "inspector";
  if (resizeHandle) resizeHandle.hidden = desktop || panel !== "library";
  document.querySelectorAll("[data-builder-panel]").forEach((button) => {
    const active = button.dataset.builderPanel === panel;
    button.classList.toggle("active", active);
    if (button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", String(active));
  });
}

export function setupBuilderPanelControls() {
  const layout = document.querySelector(".builder-layout");
  const handle = document.getElementById("builderShelfResize");
  const shelf = document.getElementById("builderLibrary");
  if (!layout || !handle || !shelf || handle.dataset.bound === "true") return;
  handle.dataset.bound = "true";

  const clampHeight = (height) => {
    const available = layout.clientHeight > 0 ? Math.max(MIN_SHELF_HEIGHT, layout.clientHeight - 260) : MAX_SHELF_HEIGHT;
    return Math.round(Math.max(MIN_SHELF_HEIGHT, Math.min(MAX_SHELF_HEIGHT, available, height)));
  };
  const applyHeight = (height, persist = false) => {
    const next = clampHeight(height);
    layout.style.setProperty("--builder-library-height", `${next}px`);
    handle.setAttribute("aria-valuenow", String(next));
    if (persist) {
      try { localStorage.setItem(SHELF_HEIGHT_KEY, String(next)); } catch {}
    }
    return next;
  };

  let savedHeight = DEFAULT_SHELF_HEIGHT;
  try { savedHeight = Number(localStorage.getItem(SHELF_HEIGHT_KEY)) || DEFAULT_SHELF_HEIGHT; } catch {}
  applyHeight(savedHeight);
  if (layout.dataset.panelViewportBound !== "true") {
    layout.dataset.panelViewportBound = "true";
    window.addEventListener("resize", () => applyPanelState(layout, layout.dataset.panel || "canvas"));
  }
  // On narrow screens the catalog is the useful first view. On desktop it
  // remains visible alongside the canvas, independent of the active panel.
  if (!desktopWorkspace() && layout.dataset.panel === "canvas") {
    layout.dataset.panel = "library";
    layout.dataset.mobilePanel = "library";
  }
  applyPanelState(layout, layout.dataset.panel || "canvas");

  let dragStart = null;
  const move = (event) => {
    if (dragStart === null) return;
    applyHeight(dragStart.height + event.clientY - dragStart.y);
  };
  const finish = () => {
    if (dragStart === null) return;
    dragStart = null;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    applyHeight(Number.parseFloat(getComputedStyle(layout).getPropertyValue("--builder-library-height")) || DEFAULT_SHELF_HEIGHT, true);
    handle.classList.remove("dragging");
  };
  handle.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    dragStart = { y: event.clientY, height: shelf.getBoundingClientRect().height };
    handle.classList.add("dragging");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  });
  handle.addEventListener("keydown", (event) => {
    const current = Number.parseFloat(getComputedStyle(layout).getPropertyValue("--builder-library-height")) || DEFAULT_SHELF_HEIGHT;
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      applyHeight(current + (event.key === "ArrowUp" ? 20 : -20), true);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      applyHeight(event.key === "Home" ? MIN_SHELF_HEIGHT : MAX_SHELF_HEIGHT, true);
    }
  });
}

export function setBuilderPanel(panel = "canvas") {
  const layout = document.querySelector(".builder-layout");
  if (!layout) return;
  const next = ["library", "inspector"].includes(panel) ? panel : "canvas";
  layout.dataset.panel = next;
  layout.dataset.mobilePanel = next;
  applyPanelState(layout, next);
  requestAnimationFrame(() => {
    if (next === "canvas") document.getElementById("builderSvg")?.focus();
  });
}

export function syncBuilderContext() {
  const selected = Boolean(state.selectedElement && !state.placement);
  const tools = document.getElementById("selectionTools");
  if (tools) tools.hidden = !selected;
  const panel = document.querySelector(".builder-layout")?.dataset.panel;
  if (!selected && panel === "inspector") setBuilderPanel("canvas");
}
