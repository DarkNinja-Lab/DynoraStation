"use strict";

import { state } from "./core/state.js";
import { ensureCanvasGeometry, setupBuilderButtons } from "./builder/canvas.js";
import { eventsRegistrieren } from "./ui/events.js";
import { katalogLaden, katalogUIInit } from "./catalog/catalog.js";
import { lightButtonsLaden, renderTrackLightButtons } from "./track/lights.js";
import { layoutLaden, layoutNormalisieren } from "./layout/layout.js";
import { rulesLaden } from "./rules/rules.js";
import { builderRender, trackRender, renderSidebarEspStatus, renderCs3Tiles } from "./ui/render.js";
import { statusLaden } from "./status/status.js";
import { renderCanvas, inspectorLeer } from "./builder/render.js";

export async function startApp() {
  console.log("=== START APP ===");
  
  console.log("1. Registriere Events...");
  eventsRegistrieren();
  
  console.log("2. Canvas initialisieren...");
  ensureCanvasGeometry();

  console.log("3. Katalog laden...");
  await katalogLaden();
  katalogUIInit();

  console.log("4. Light Buttons laden...");
  await lightButtonsLaden();
  
  console.log("5. Layout laden...");
  await layoutLaden();
  layoutNormalisieren();
  
  console.log("6. Rules laden...");
  await rulesLaden();

  console.log("7. UI rendern...");
  builderRender();
  trackRender();
  renderCanvas();
  inspectorLeer();
  renderTrackLightButtons();
  renderSidebarEspStatus();
  renderCs3Tiles();

  console.log("8. Builder Setup...");
  setupBuilderButtons();

  console.log("9. Status laden...");
  await statusLaden({ ruhig: false });

  console.log("10. Status-Timer starten...");
  if (state.statusTimer) clearInterval(state.statusTimer);
  state.statusTimer = setInterval(() => statusLaden({ ruhig: true }), 1500);
  
  console.log("=== APP READY ===");
}