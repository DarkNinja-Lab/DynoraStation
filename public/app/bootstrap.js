"use strict";

import { state } from "./core/state.js";
import { ensureCanvasGeometry, setupBuilderButtons } from "./builder/canvas.js";
import { eventsRegistrieren } from "./ui/events.js";
import { katalogLaden, katalogUIInit } from "./catalog/catalog.js";
import { lightButtonsLaden, renderTrackLightButtons } from "./track/lights.js";
import { layoutLaden, layoutNormalisieren } from "./layout/layout.js";
import { rulesLaden, renderRulesGrid } from "./rules/rules.js";
import { builderRender, trackRender, renderSidebarEspStatus, renderCs3Tiles } from "./ui/render.js";
import { statusLaden } from "./status/status.js";
import { renderCanvas, inspectorLeer } from "./builder/render.js";

export async function startApp() {
  console.log("=== START APP ===");

  eventsRegistrieren();
  ensureCanvasGeometry();

  await katalogLaden();
  katalogUIInit();

  await lightButtonsLaden();

  await layoutLaden();
  layoutNormalisieren();

  await rulesLaden();

  builderRender();
  trackRender();
  renderCanvas();
  inspectorLeer();
  renderTrackLightButtons();
  renderSidebarEspStatus();
  renderCs3Tiles();
  renderRulesGrid();

  setupBuilderButtons();

  await statusLaden({ ruhig: false });

  if (state.statusTimer) clearInterval(state.statusTimer);
  state.statusTimer = setInterval(() => statusLaden({ ruhig: true }), 1500);

  console.log("=== APP READY ===");
}