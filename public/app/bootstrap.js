"use strict";

import { state } from "./core/state.js?v=mobile-v5-cachefix";
import { ensureCanvasGeometry, setupBuilderButtons } from "./builder/canvas.js?v=mobile-v5-cachefix";
import { initializeTools } from "./builder/tools.js?v=mobile-v5-cachefix";
import { eventsRegistrieren, renderSettingsTab } from "./ui/events.js?v=mobile-v5-cachefix";
import { katalogLaden, katalogUIInit } from "./catalog/catalog.js?v=mobile-v5-cachefix";
import { lightButtonsLaden, renderTrackLightButtons } from "./track/lights.js?v=mobile-v5-cachefix";
import { renderTrackLayout } from "./track/track.js?v=mobile-v5-cachefix";
import { layoutLaden, layoutNormalisieren } from "./layout/layout.js?v=mobile-v5-cachefix";
import { rulesLaden, renderRulesGrid } from "./rules/rules.js?v=mobile-v5-cachefix";
import { renderSidebarEspStatus, renderCs3Tiles, renderDashboardOverview } from "./ui/render.js?v=mobile-v5-cachefix";
import { statusLaden } from "./status/status.js?v=mobile-v5-cachefix";
import { renderCanvas, inspectorLeer } from "./builder/render.js?v=mobile-v5-cachefix";
import { resetHistory } from "./builder/history.js?v=mobile-v5-cachefix";
import { setupPlanValidation } from "./builder/validation.js?v=mobile-v5-cachefix";

export async function startApp() {
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
}
