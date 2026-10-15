"use strict";

import { apiCall } from "../core/api.js?v=workspace-v11";
import { state } from "../core/state.js?v=workspace-v11";
import { esc } from "../core/utils.js?v=workspace-v11";
import { showToast } from "../ui/toast.js?v=workspace-v14";

function retainLocalDraft() {
  if (!state.layoutDirty) return;
  // If local storage is full, stop before replacing the user's working plan.
  localStorage.setItem("dynora.layoutDraft.backup", JSON.stringify({ savedAt: Date.now(), layout: state.layout }));
}
export function initializePlanVersions() {
  const dialog = document.getElementById("planVersionsDialog");
  const list = document.getElementById("planVersionsList");
  let version;
  document.getElementById("downloadConflictDraft").addEventListener("click", () => document.getElementById("downloadLayoutButton").click());
  document.getElementById("loadStationPlan").addEventListener("click", () => {
    if (!confirm("Aktuellen Stationsplan laden? Dein bisheriger Entwurf wird lokal als Sicherung behalten.")) return;
    try { retainLocalDraft(); localStorage.removeItem("dynora.layoutDraft"); location.reload(); }
    catch { showToast("Lokale Sicherung fehlgeschlagen. Lade deinen Entwurf zuerst herunter.", "error"); }
  });
  document.getElementById("closePlanVersions").addEventListener("click", () => dialog.close());
  document.getElementById("openPlanVersions").addEventListener("click", async () => {
    dialog.showModal();
    list.textContent = "Planversionen werden geladen …";
    try {
      const data = await apiCall("/layout/history");
      version = data.layoutVersion;
      list.innerHTML = data.versions.length ? data.versions.map(item => `<div class="plan-version-row"><div><strong>${esc(item.name)}</strong><small>${esc(new Date(item.savedAt).toLocaleString("de-DE"))} · ${Number(item.elements)} Elemente</small></div><button type="button" class="secondary-button" data-restore-version="${esc(item.id)}">Wiederherstellen</button></div>`).join("") : "Noch keine früheren Planversionen. Vor dem nächsten Speichern wird der bisherige Plan automatisch gesichert.";
    } catch (error) { list.textContent = error.message; }
  });
  list.addEventListener("click", async event => {
    const button = event.target.closest("[data-restore-version]");
    if (!button) return;
    if (!confirm("Diese Version als Stationsplan wiederherstellen? Der aktuelle Stationsplan wird vorher gesichert." + (state.layoutDirty ? " Dein ungespeicherter Entwurf wird zusätzlich lokal gesichert." : ""))) return;
    const buttons = list.querySelectorAll("button");
    buttons.forEach(item => { item.disabled = true; });
    try {
      retainLocalDraft();
      await apiCall(`/layout/history/${encodeURIComponent(button.dataset.restoreVersion)}/restore`, { method: "POST", headers: { "If-Match": version } });
      localStorage.removeItem("dynora.layoutDraft");
      location.reload();
    } catch (error) {
      showToast(error.code === "LAYOUT_CONFLICT" ? "Der Plan wurde inzwischen geändert. Öffne die Planversionen erneut; es wurde nichts überschrieben." : error.message, "error");
      buttons.forEach(item => { item.disabled = false; });
    }
  });
}
