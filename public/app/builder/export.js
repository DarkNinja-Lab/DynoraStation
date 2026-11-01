"use strict";

import { state } from "../core/state.js?v=workspace-v11";
import { renderCanvas, canvasSize } from "./render.js?v=workspace-v19";
import { showToast } from "../ui/toast.js?v=workspace-v14";
import { esc } from "../core/utils.js?v=workspace-v11";


function articleFor(element) {
  return String(element.trackCode || element.curveCode || element.switchCode || element.xTrackCode || element.bumperCode || element.catalogCode || ({ signal: "7039", transformer: "6631", espSignal: "DIY" }[element.typ]) || "OHNE ART.-NR.");
}

function catalogLabel(element, article) {
  for (const group of ["tracks", "curves", "switches", "crossings", "bumpers"]) {
    const item = (state.catalog?.[group] || []).find((entry) => String(entry.code) === article);
    if (item) return item.label || article;
  }
  return ({ signal: "Hauptsignal", transformer: "Transformator", espSignal: "ESP-Signalmast" }[element.typ]) || element.typ;
}

function partsList(elements) {
  const parts = new Map();
  for (const element of elements) {
    const article = articleFor(element);
    const current = parts.get(article) || { article, label: catalogLabel(element, article), count: 0 };
    current.count += 1;
    parts.set(article, current);
  }
  return [...parts.values()].sort((a, b) => a.article.localeCompare(b.article, "de", { numeric: true }));
}

function showExportPreview(html) {
  document.getElementById("buildPlanPreview")?.remove();
  const overlay = document.createElement("section");
  overlay.id = "buildPlanPreview";
  overlay.className = "export-preview";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Bauplan-Vorschau");
  overlay.innerHTML = `
    <div class="export-preview-toolbar">
      <div><strong>Bauplan-Vorschau</strong><small>Ohne Pop-up · direkt drucken oder als PDF speichern</small></div>
      <div>
        <button class="secondary-button" data-export-close type="button">Schließen</button>
        <button class="primary-button" data-export-print type="button">Drucken / PDF</button>
      </div>
    </div>
    <iframe class="export-preview-frame" title="Bauplan"></iframe>`;
  document.body.appendChild(overlay);
  const frame = overlay.querySelector("iframe");
  frame.srcdoc = html;
  overlay.querySelector("[data-export-close]").addEventListener("click", () => overlay.remove());
  overlay.querySelector("[data-export-print]").addEventListener("click", () => frame.contentWindow?.print());
  overlay.addEventListener("keydown", (event) => {
    if (event.key === "Escape") overlay.remove();
  });
  overlay.querySelector("[data-export-print]").focus();
}

export function exportBuildPlan() {
  const previousLabels = state.showLabels;
  state.showLabels = true;
  renderCanvas();
  const clone = document.getElementById("builderSvg")?.cloneNode(true);
  state.showLabels = previousLabels;
  renderCanvas();
  if (!clone) {
    showToast("Bauplan konnte nicht erstellt werden.", "error");
    return;
  }

  clone.querySelector("#builderPlacementLayer")?.remove();
  clone.querySelectorAll(".selected,.connection-source").forEach((node) => node.classList.remove("selected", "connection-source"));
  clone.querySelectorAll(".layout-element > rect[fill='transparent']").forEach((node) => node.remove());
  const size = canvasSize();
  clone.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  clone.setAttribute("width", String(size.width));
  clone.setAttribute("height", String(size.height));
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

  // The preview lives in an iframe; carry its presentation with the SVG.
  const schematic = state.builderView !== "rails";
  clone.style.background = schematic ? "#e6e8e7" : "#101722";
  const presentation = document.createElementNS("http://www.w3.org/2000/svg", "style");
  presentation.textContent = schematic
    ? "#builderGrid path{stroke:#aab2b5;opacity:.4}.layout-element text{fill:#28343b;stroke:#e6e8e7}#builderEmptyHint{fill:#606d76}"
    : "#builderGrid path{stroke:#53677f;opacity:.25}";
  clone.prepend(presentation);

  const svgMarkup = new XMLSerializer().serializeToString(clone);
  const metadata = state.layout.metadaten || {};
  const elements = state.layout.elemente || [];
  const parts = partsList(elements);
  const detailRows = elements.map((element, index) => `<tr><td>${index + 1}</td><td>${esc(articleFor(element))}</td><td>${esc(element.name || catalogLabel(element, articleFor(element)))}</td><td>${Math.round(Number(element.x || 0) * 2)}</td><td>${Math.round(Number(element.y || 0) * 2)}</td><td>${Math.round(Number(element.rotation ?? element.winkel ?? 0))}°</td></tr>`).join("");
  const partRows = parts.map((part) => `<tr><td><b>${esc(part.article)}</b></td><td>${esc(part.label)}</td><td>${part.count}</td></tr>`).join("");
  const title = esc(metadata.name || "Meine Modellbahn");
  const plateWidth = Number(metadata.plateWidthMm) || 3200;
  const plateHeight = Number(metadata.plateHeightMm) || 1800;
  const scale = esc(metadata.massstab || "H0");
  const grid = Number(metadata.rasterMm) || 50;
  const createdAt = esc(new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(new Date()));

  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${title} – Bauplan</title><style>
    @page{size:A4 landscape;margin:12mm}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    :root{--ink:#1b292e;--muted:#627178;--accent:#a87936;--line:#cbd3d4;--soft:#f1f4f3;--paper:#fff}
    body{margin:0;color:var(--ink);background:#dfe5e4;font:11px/1.45 Bahnschrift,"Segoe UI",Arial,sans-serif}
    .sheet{max-width:1160px;margin:24px auto;padding:26px;background:var(--paper);box-shadow:0 16px 44px #17242b24}
    header{display:flex;align-items:center;justify-content:space-between;gap:20px;margin-bottom:15px;padding:0 0 15px;border-bottom:2px solid var(--ink)}
    .brand{display:flex;align-items:center;gap:12px;min-width:0}.brand-mark{display:grid;place-items:center;width:40px;height:40px;flex:0 0 40px;border:1px solid var(--accent);border-radius:4px;color:#f3d6a4;background:var(--ink);font-size:20px;font-weight:800}
    .eyebrow{color:var(--accent);font-size:8px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
    h1{margin:3px 0 0;font-size:21px;line-height:1.15;overflow-wrap:anywhere}.document-meta{color:var(--muted);text-align:right;white-space:nowrap}.document-meta b{display:block;color:var(--ink);font-size:12px}
    .facts{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 14px}.fact{padding:9px 11px;border:1px solid var(--line);border-left:3px solid var(--accent);background:var(--soft)}.fact span{display:block;color:var(--muted);font-size:8px;font-weight:750;letter-spacing:.06em;text-transform:uppercase}.fact strong{display:block;margin-top:2px;font-size:12px}
    .plan-card{overflow:hidden;border:1px solid #394950;border-radius:4px;background:#e6e8e7;break-inside:avoid}.plan-head{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:9px 12px;color:#f0f3f2;background:var(--ink);font-weight:750}.plan-head span:last-child{color:#d7b479;font-size:8px;text-transform:uppercase;letter-spacing:.08em}.plan{padding:8px}.plan svg{display:block;width:100%;height:auto;max-height:122mm}
    .section{margin-top:17px;break-inside:auto}.section-title{display:flex;align-items:center;gap:9px;margin:0 0 8px;font-size:14px;break-after:avoid}.section-title::before{content:"";width:3px;height:17px;background:var(--accent)}
    table{width:100%;border-collapse:collapse;font-size:9px}thead{display:table-header-group}tr{break-inside:avoid}th,td{padding:6px 8px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}th{color:#e9eeee;background:var(--ink);font-size:8px;font-weight:750;letter-spacing:.04em;text-transform:uppercase}tbody tr:nth-child(even){background:var(--soft)}td:first-child{font-family:Consolas,monospace}td:last-child,th:last-child{text-align:right}
    footer{display:flex;justify-content:space-between;gap:16px;margin-top:17px;padding-top:9px;border-top:1px solid var(--line);color:var(--muted);font-size:8px}.hint{max-width:75%}
    @media print{body{background:#fff}.sheet{max-width:none;margin:0;padding:0;box-shadow:none}.lists{break-before:page}.plan-card{break-inside:avoid}}
  </style></head><body><main class="sheet">
    <header><div class="brand"><div class="brand-mark">D</div><div><div class="eyebrow">DynoraStation · Technischer Export</div><h1>${title}</h1></div></div><div class="document-meta"><b>Bau- und Montageplan</b>Erstellt am ${createdAt}</div></header>
    <section class="facts"><div class="fact"><span>Anlagenplatte</span><strong>${plateWidth} × ${plateHeight} mm</strong></div><div class="fact"><span>Maßstab</span><strong>${scale}</strong></div><div class="fact"><span>Planungsraster</span><strong>${grid} mm</strong></div><div class="fact"><span>Bauteile</span><strong>${elements.length}</strong></div></section>
    <section class="plan-card"><div class="plan-head"><span>Gleis- und Anlagenplan</span><span>Draufsicht · nicht direkt bemaßen</span></div><div class="plan">${svgMarkup}</div></section>
    <div class="lists"><section class="section"><h2 class="section-title">Stückliste</h2><table><thead><tr><th>Artikelnummer</th><th>Bauteil</th><th>Menge</th></tr></thead><tbody>${partRows || "<tr><td colspan='3'>Keine Teile platziert</td></tr>"}</tbody></table></section>
    <section class="section"><h2 class="section-title">Montagepositionen</h2><table><thead><tr><th>Pos.</th><th>Artikelnummer</th><th>Name / Bauteil</th><th>X ab links (mm)</th><th>Y ab oben (mm)</th><th>Drehung</th></tr></thead><tbody>${detailRows || "<tr><td colspan='6'>Keine Teile platziert</td></tr>"}</tbody></table></section></div>
    <footer><span class="hint">Die Planansicht ist seitenfüllend skaliert. Für den Aufbau gelten die angegebenen X-/Y-Maße ab der linken oberen Plattenkante.</span><span>DynoraStation · ${title}</span></footer>
  </main></body></html>`;
  showExportPreview(html);
  showToast("Bauplan-Vorschau geöffnet");
}
