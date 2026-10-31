"use strict";

import { initializePlanVersions } from "./layout/versions.js?v=workspace-v11";

import { initializeWorkspace } from "./builder/workspace.js?v=workspace-v21";
import { showToast } from "./ui/toast.js?v=workspace-v15";

import { state } from "./core/state.js?v=workspace-v11";
import { ensureCanvasGeometry, setupBuilderButtons } from "./builder/canvas.js?v=workspace-v12";
import { initializeTools } from "./builder/tools.js?v=workspace-v11";
import { initTranslation } from "./core/translate.js?v=workspace-v26";
import { eventsRegistrieren, renderSettingsTab, showFirstVisitGuide } from "./ui/events.js?v=workspace-v27";
import { katalogLaden } from "./catalog/catalog.js?v=workspace-v11";
import { lightButtonsLaden, renderTrackLightButtons } from "./track/lights.js?v=workspace-v12";
import { renderTrackLayout } from "./track/track.js?v=workspace-v15";
import { layoutDraftFingerprint, layoutLaden, layoutNormalisieren } from "./layout/layout.js?v=workspace-v11";
import { rulesLaden, renderRulesGrid } from "./rules/rules.js?v=workspace-v18";
import { renderSidebarEspStatus, renderCs3Tiles, renderDashboardOverview } from "./ui/render.js?v=workspace-v19";
import { statusLaden } from "./status/status.js?v=workspace-v11";
import { renderCanvas, inspectorLeer } from "./builder/render.js?v=workspace-v17";
import { recordHistory, resetHistory } from "./builder/history.js?v=workspace-v11";
import { setupPlanValidation } from "./builder/validation.js?v=workspace-v12";
import { initializeLightSystem } from "./lightSystem.js?v=workspace-v1";

export async function startApp() {
  eventsRegistrieren();
  initTranslation();
  window.addEventListener("beforeunload", (event) => {
    const hasUnsavedChanges = state.layoutDirty || Object.values(state.settingsDirty || {}).some(Boolean);
    if (!hasUnsavedChanges) return;
    event.preventDefault();
    event.returnValue = "";
  });
  ensureCanvasGeometry();

  await Promise.all([katalogLaden(), lightButtonsLaden(), layoutLaden(), rulesLaden()]);
  layoutNormalisieren();
  resetHistory();

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
  initializeWorkspace();
  setupDraftRecovery();
  initializePlanVersions();
  setupOperationDisclosures();
  if (state.layoutDirty) showToast("Lokaler Entwurf wiederhergestellt · noch nicht auf der Station gespeichert", "warning");

  await statusLaden({ ruhig: false });
  await initializeLightSystem();
  if (document.getElementById("page-settings")?.classList.contains("active")) renderSettingsTab();
  showFirstVisitGuide();

  if (state.statusTimer) clearTimeout(state.statusTimer);
  let refreshEpoch = 0;
  const refreshStatus = async (epoch = refreshEpoch) => {
    if (epoch !== refreshEpoch) return;
    if (!document.hidden) await statusLaden({ ruhig: true });
    if (epoch !== refreshEpoch) return;
    state.statusTimer = setTimeout(() => refreshStatus(epoch), document.hidden ? Math.max(5000, state.statusPollMs) : state.statusPollMs);
  };
  state.statusTimer = setTimeout(refreshStatus, document.hidden ? Math.max(5000, state.statusPollMs) : state.statusPollMs);
  const resume = () => {
    if (document.hidden) return;
    state.statusRevisions = { layout: 0, events: 0 };
    refreshEpoch++;
    clearTimeout(state.statusTimer);
    refreshStatus(refreshEpoch);
  };
  document.addEventListener("visibilitychange",resume);
  window.addEventListener("pageshow",event => { if (event.persisted) resume(); });
}

function setupDraftRecovery() {
  const host = document.getElementById("layoutRecovery");
  if (!host || !state.recoverableDraft) return;
  host.hidden = false;
  const draft = state.recoverableDraft;
  document.getElementById("dismissLayoutDraft").onclick = () => {
    try { localStorage.setItem("dynora.layoutDraft.dismissed", layoutDraftFingerprint(draft)); } catch {}
    try {
      const serialized = JSON.stringify(draft);
      if (localStorage.getItem("dynora.layoutDraft") === serialized) {
        localStorage.setItem("dynora.layoutDraft.backup", serialized);
        localStorage.removeItem("dynora.layoutDraft");
      }
    } catch {}
    state.recoverableDraft = null;
    host.hidden = true;
  };
  document.getElementById("downloadLayoutDraft").onclick = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(draft.layout,null,2)], {type:"application/json"}));
    const link = document.createElement("a");link.href=url;link.download="Dynora-lokaler-Entwurf.json";link.click();
    setTimeout(() => URL.revokeObjectURL(url),1000);
  };
  document.getElementById("restoreLayoutDraft").onclick = () => {
    if (!confirm("Lokalen Entwurf zum Bearbeiten laden? Der Stationsplan bleibt bis zum Speichern unverändert. Aktuelle Änderungen lassen sich rückgängig machen.")) return;
    recordHistory();
    state.layout = JSON.parse(JSON.stringify(draft.layout));
    try {
      const serialized = JSON.stringify(draft);
      if (localStorage.getItem("dynora.layoutDraft") === serialized) localStorage.removeItem("dynora.layoutDraft");
      if (localStorage.getItem("dynora.layoutDraft.backup") === serialized) localStorage.removeItem("dynora.layoutDraft.backup");
      localStorage.removeItem("dynora.layoutDraft.dismissed");
    } catch {}
    state.recoverableDraft = null;
    state.layoutDirty = true;
    state.selectedElement = null;
    layoutNormalisieren();renderCanvas();renderTrackLayout();
    host.hidden = true;
    document.querySelector('.nav-button[data-page="builder"]')?.click();
    showToast("Entwurf geladen · zum Übernehmen auf der Station speichern", "warning");
  };
}

function setupOperationDisclosures() {
  document.querySelectorAll(".mobile-control-toggle").forEach(button => {
    button.addEventListener("click", () => {
      const section = button.closest(".mobile-control-section");
      const expanded = section.dataset.expanded !== "true";
      document.querySelectorAll(".mobile-control-section").forEach(other => {
        const open = other === section && expanded;
        other.dataset.expanded = String(open);
        other.querySelector("button").setAttribute("aria-expanded",String(open));
      });
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    });
  });
}
