"use strict";

import { trackImages } from "../catalog/images.js?v=workspace-v16";
import { setBuilderPanel, syncBuilderContext } from "./panels.js?v=workspace-v11";
import { validateImport } from "./model.js?v=workspace-v11";

import { state } from "../core/state.js?v=workspace-v11";
import { beginPlacement, cancelPlacement, commitPlacement } from "./canvas.js?v=workspace-v11";
import { renderCanvas, inspectorLeer, canvasPointFromEvent } from "./render.js?v=workspace-v11";
import { recordHistory } from "./history.js?v=workspace-v11";
import { layoutNormalisieren } from "../layout/layout.js?v=workspace-v11";
import { showToast } from "../ui/toast.js?v=workspace-v14";
import { esc } from "../core/utils.js?v=workspace-v11";
import { icon } from "../ui/icons.js?v=workspace-v11";

const groups = [
  ["tracks", "track", "Geraden", "track-straight"],
  ["curves", "curve", "Kurven", "track-curve"],
  ["switches", "switch", "Weichen", "turnout-left"],
  ["crossings", "crossing", "Kreuzungen", "crossing"],
  ["bumpers", "bumper", "Prellböcke", "bumper"]
];


function downloadPlan() {
  const blob = new Blob([JSON.stringify(state.layout, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(state.layout.metadaten?.name || "Dynora-Plan").replace(/[^\p{L}\p{N}_-]/gu, "-")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initializeWorkspace() {
  // Refresh optional user-supplied photos on each page load.
  const photoRevision = Date.now();
  let category = "tracks";
  let selectedIndex = -1;
  const items = groups.flatMap(([key, typ, label, symbol]) => (state.catalog?.[key] || []).map(item => ({ ...item, typ, category: key, categoryLabel: label, symbol })));
  items.push(
    { typ: "signal", label: "Märklin-Hauptsignal", code: "7039", imagePath: "/assets/track/7039.jpg", category: "control", symbol: "signal" },
    { typ: "espSignal", label: "ESP-Signal · Rot / Grün", code: "", mode: "rg", category: "control", symbol: "signal" },
    { typ: "espSignal", label: "ESP-Signal · Rot / Gelb / Grün", code: "", mode: "rgy", category: "control", symbol: "signal" },
    { typ: "transformer", label: "Transformator", code: "6631", category: "control", symbol: "transformer" }
  );
  const filters = document.getElementById("libraryCategory");
  filters.innerHTML = [["all", "Alle Bauteile"], ...groups.map(g => [g[0], g[2]]), ["control", "Signale & Steuerung"]].map(([key, label]) => `<option value="${key}" ${key === category ? "selected" : ""}>${label}</option>`).join("");
  const list = document.getElementById("componentResults");
  const search = document.getElementById("componentSearch");
  list.addEventListener("wheel", (event) => {
    if (list.scrollWidth <= list.clientWidth || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
    event.preventDefault();
    list.scrollLeft += event.deltaY;
  }, { passive: false });
  const renderLibrary = () => {
    const query = (search.value || "").trim().toLocaleLowerCase("de-DE");
    const matches = items.filter(item => (query || category === "all" || item.category === category) && `${item.code} ${item.label} ${item.categoryLabel || "Steuerung"}`.toLocaleLowerCase("de-DE").includes(query));
    list.innerHTML = matches.map(item => {
      const index = items.indexOf(item);
      const detail = item.length ? `${item.length} mm` : item.radius ? `R ${item.radius} · ${item.angleDeg}°` : item.handed ? (item.handed === "right" ? "Rechts" : "Links") : "Steuerung";
      const code = String(item.code || "");
      const fallbackPath = item.imagePath || (code ? `/assets/track/${encodeURIComponent(code)}.jpg` : "");
      const imageSource = trackImages[code] || (fallbackPath ? `${fallbackPath}?v=${photoRevision}` : "");
      const image = imageSource
        ? `<img data-image-src="${esc(imageSource)}" alt="${esc(item.label)}" width="120" height="66" draggable="false">`
        : "";
      const symbol = item.typ === "espSignal" || item.typ === "signal"
        ? `<svg viewBox="0 0 100 60" aria-hidden="true"><path d="M50 40V55M40 55H60" stroke="#303a40" stroke-width="4"/><rect x="40" y="2" width="20" height="43" rx="7" fill="#252c31"/><circle cx="50" cy="11" r="5" fill="#df4548"/>${item.mode === "rgy" ? '<circle cx="50" cy="23" r="5" fill="#e8ba39"/>' : ""}<circle cx="50" cy="35" r="5" fill="#29a85c"/></svg>`
        : icon(String(item.code) === "5112" ? "uncoupler" : item.symbol);
      return `<button type="button" class="component-card${index === selectedIndex && state.placement ? " active" : ""}" data-component="${index}" draggable="true" aria-pressed="${index === selectedIndex && Boolean(state.placement)}" title="${esc(item.label)}: anklicken oder in den Plan ziehen"><span class="component-picture${image ? " has-photo" : ""}">${image}<span class="component-symbol">${symbol}</span></span><span class="component-description"><strong>${esc(item.code || "ESP")} <span>${esc(item.categoryLabel || (item.typ === "transformer" ? "Trafo" : "Signal"))}</span></strong><small>${esc(item.label === item.code ? detail : `${item.label} · ${detail}`)}</small></span></button>`;
    }).join("") || '<div class="library-empty">Keine Bauteile gefunden.<br>Versuche eine andere Artikelnummer oder Kategorie.</div>';
    list.querySelectorAll(".component-picture img").forEach((image) => {
      const showSymbol = () => {
        image.closest(".component-picture")?.classList.remove("has-photo");
        image.remove();
      };
      image.addEventListener("error", showSymbol, { once: true });
      image.src = image.dataset.imageSrc;
    });
    document.getElementById("libraryResultCount").textContent = `${matches.length} Bauteile`;
  };
  filters.addEventListener("change", () => {
    category = filters.value;
    search.value = "";
    renderLibrary();
  });
  search.addEventListener("input", renderLibrary);
  list.addEventListener("click", event => {
    const button = event.target.closest("[data-component]");
    if (!button) return;
    const item = items[Number(button.dataset.component)];
    selectedIndex = Number(button.dataset.component);
    beginPlacement(item.typ, item.mode || "", String(item.code || ""));
    if (document.querySelector(".builder-layout").dataset.panel !== "library") setBuilderPanel("library");
    document.getElementById("builderSvg")?.focus();
  });
  list.addEventListener("error", event => {
    if (event.target.tagName !== "IMG") return;
    event.target.closest(".component-picture")?.classList.remove("has-photo");
    event.target.remove();
  }, true);
  list.addEventListener("dragstart", event => {
    const button = event.target.closest("[data-component]");
    if (!button || !event.dataTransfer) return;
    event.dataTransfer.setData("application/x-dynora-component", button.dataset.component);
    event.dataTransfer.effectAllowed = "copy";
  });
  const canvas = document.getElementById("builderSvg");
  canvas.addEventListener("dragover", event => {
    if (!Array.from(event.dataTransfer?.types || []).includes("application/x-dynora-component")) return;
    event.preventDefault(); event.dataTransfer.dropEffect = "copy";
  });
  canvas.addEventListener("drop", event => {
    const raw = event.dataTransfer?.getData("application/x-dynora-component");
    if (!raw || !/^\d+$/.test(raw)) return;
    const index = Number(raw), item = items[index];
    if (!item) return;
    event.preventDefault();
    const point = canvasPointFromEvent(canvas, event);
    selectedIndex = index;
    beginPlacement(item.typ, item.mode || "", String(item.code || ""));
    commitPlacement(point);
    cancelPlacement();
  });
  document.querySelectorAll("[data-builder-view]").forEach(button => {
    button.addEventListener("click", () => {
      state.builderView = button.dataset.builderView;
      document.querySelector(".builder-layout").dataset.view = state.builderView;
      document.querySelectorAll("[data-builder-view]").forEach(node => node.setAttribute("aria-pressed", String(node === button)));
      renderCanvas();
    });
  });
  renderLibrary();
  document.addEventListener("dynora:layout-rendered", () => {
    list.querySelectorAll("[data-component]").forEach(button => {
      const item = items[Number(button.dataset.component)];
      const active = Boolean(state.placement && item.typ === state.placement.typ && String(item.code || "") === state.placement.catalogCode && (!item.mode || item.mode === state.placement.signalAspectMode));
      button.classList.toggle("active",active); button.setAttribute("aria-pressed",String(active));
    });
  });
  document.addEventListener("dynora:layout-rendered", syncBuilderContext);
  syncBuilderContext();
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.getElementById("page-builder")?.classList.contains("active")) {
      setBuilderPanel("canvas");
      document.querySelectorAll(".plan-file-menu[open], .selection-more[open]").forEach(menu => menu.open = false);
    }
  });
  document.querySelectorAll(".plan-file-menu button").forEach(button => {
    if (button.closest(".plan-board-options")) return;
    button.addEventListener("click", () => button.closest(".plan-file-menu").open = false);
  });

  const name = document.getElementById("layoutName");
  const syncName = () => { if (document.activeElement !== name) name.value = state.layout.metadaten?.name || "Meine Modellbahn"; };
  name.addEventListener("change", () => {
    recordHistory();
    state.layout.metadaten.name = name.value.trim().slice(0, 120) || "Meine Modellbahn";
    state.layoutDirty = true;
    renderCanvas();
  });
  document.addEventListener("dynora:layout-rendered", syncName);
  syncName();

  document.getElementById("downloadLayoutButton").addEventListener("click", downloadPlan);
  const input = document.getElementById("importLayoutInput");
  document.getElementById("importLayoutButton").addEventListener("click", () => input.click());
  input.addEventListener("change", async () => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error("Datei ist größer als 2 MB");
      const layout = validateImport(JSON.parse(await file.text()));
      if (!confirm(`„${layout.metadaten?.name || file.name}“ mit ${layout.elemente.length} Elementen laden? Der aktuelle Plan wird ersetzt. Rückgängig bleibt möglich.`)) return;
      cancelPlacement();
      recordHistory();
      state.layout = layout;
      layoutNormalisieren();
      state.selectedElement = null;
      state.connectFrom = null;
      state.layoutDirty = true;
      renderCanvas();
      inspectorLeer();
      document.getElementById("zoomResetButton")?.click();
      document.dispatchEvent(new Event("dynora:builder-opened"));
      showToast("Plan importiert · zum Übernehmen speichern");
    } catch (error) { showToast(`Import fehlgeschlagen: ${error.message}`, "error"); }
  });
  document.getElementById("disconnectButton").addEventListener("click", () => {
    if (!state.selectedElement) return;
    recordHistory();
    state.layout.verbindungen = state.layout.verbindungen.filter(link => link.von !== state.selectedElement && link.nach !== state.selectedElement);
    state.connectFrom = null;
    state.layoutDirty = true;
    renderCanvas();
    showToast("Verbindungen getrennt");
  });
}
