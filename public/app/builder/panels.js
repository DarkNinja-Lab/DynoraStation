"use strict";

import { state } from "../core/state.js?v=workspace-v11";

export function setBuilderPanel(panel = "canvas") {
  const layout = document.querySelector(".builder-layout");
  if (!layout) return;
  const next = ["library", "inspector"].includes(panel) ? panel : "canvas";
  const previous = layout.dataset.panel;
  layout.dataset.panel = next;
  layout.dataset.mobilePanel = next;
  const library = document.getElementById("builderLibrary");
  const inspector = document.getElementById("inspector");
  if (library) library.hidden = next !== "library";
  if (inspector) inspector.hidden = next !== "inspector";
  document.querySelectorAll("[data-builder-panel]").forEach(button => {
    const active = button.dataset.builderPanel === next;
    button.classList.toggle("active", active);
    if (button.hasAttribute("aria-expanded")) button.setAttribute("aria-expanded", String(active));
  });
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
    if (previous !== next && next === "library") document.getElementById("componentSearch")?.focus();
    if (previous !== next && next === "canvas") document.getElementById("builderSvg")?.focus();
  });
}

export function syncBuilderContext() {
  const selected = Boolean(state.selectedElement && !state.placement);
  const tools = document.getElementById("selectionTools");
  if (tools) tools.hidden = !selected;
  const panel = document.querySelector(".builder-layout")?.dataset.panel;
  if (!selected && panel === "inspector") setBuilderPanel("canvas");
}
