"use strict";

import { state } from "./core/state.js";
import { ensureCanvasGeometry, setupBuilderButtons } from "./builder/canvas.js";
import { initializeTools } from "./builder/tools.js";
import { eventsRegistrieren, renderSettingsTab } from "./ui/events.js";
import { katalogLaden, katalogUIInit } from "./catalog/catalog.js";
import { lightButtonsLaden, renderTrackLightButtons } from "./track/lights.js";
import { renderTrackLayout } from "./track/track.js";
import { layoutLaden, layoutNormalisieren } from "./layout/layout.js";
import { rulesLaden, renderRulesGrid } from "./rules/rules.js";
import { builderRender, trackRender, renderSidebarEspStatus, renderCs3Tiles, renderDashboardOverview } from "./ui/render.js";
import { statusLaden } from "./status/status.js";
import { renderCanvas, inspectorLeer } from "./builder/render.js";
import { resetHistory } from "./builder/history.js";
import { setupPlanValidation } from "./builder/validation.js";

export async function startApp() {
  console.log("=== START APP ===");

  eventsRegistrieren();
  window.addEventListener("beforeunload", (event) => {
    const hasUnsavedChanges = state.layoutDirty || Object.values(state.settingsDirty || {}).some(Boolean);
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = "";
  });
  ensureCanvasGeometry();

  await katalogLaden();
  katalogUIInit();

  await lightButtonsLaden();

  await layoutLaden();
  layoutNormalisieren();
  resetHistory();

  await rulesLaden();

  builderRender();
  trackRender();
  renderTrackLayout();
  renderCanvas();
  inspectorLeer();
  renderTrackLightButtons();
  renderSidebarEspStatus();
  renderCs3Tiles();
  renderDashboardOverview();
  renderRulesGrid();

  setupBuilderButtons();
  setupPlanValidation();
  initializeTools();

  await statusLaden({ ruhig: false });
  if (document.getElementById("page-settings")?.classList.contains("active")) renderSettingsTab();

  if (state.statusTimer) clearTimeout(state.statusTimer);
  const refreshStatus = async () => {
    await statusLaden({ ruhig: true });
    state.statusTimer = setTimeout(refreshStatus, state.statusPollMs);
  };
  state.statusTimer = setTimeout(refreshStatus, state.statusPollMs);

  console.log("=== APP READY ===");
}
