"use strict";

import { state } from "./core/state.js";
import { ensureCanvasGeometry } from "./builder/canvas.js";
import { eventsRegistrieren } from "./ui/events.js";
import { katalogLaden, katalogUIInit } from "./catalog/catalog.js";
import { lightButtonsLaden, renderTrackLightButtons } from "./track/lights.js";
import { layoutLaden, layoutNormalisieren } from "./layout/layout.js";
import { rulesLaden } from "./rules/rules.js";
import { builderRender, trackRender, inspectorLeer, renderSidebarEspStatus, renderCs3Tiles } from "./ui/render.js";
import { statusLaden } from "./status/status.js";

export async function startApp() {
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
  inspectorLeer();
  renderTrackLightButtons();
  renderSidebarEspStatus();
  renderCs3Tiles();

  await statusLaden({ ruhig: false });

  if (state.statusTimer) clearInterval(state.statusTimer);
  state.statusTimer = setInterval(() => statusLaden({ ruhig: true }), 1500);
}