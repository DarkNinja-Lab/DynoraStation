"use strict";

import { state } from "../core/state.js?v=mobile-v5-cachefix";
import { renderCanvas, canvasSize } from "./render.js?v=mobile-v5-cachefix";
import { showToast } from "../ui/toast.js?v=mobile-v5-cachefix";
import { esc } from "../core/utils.js?v=mobile-v5-cachefix";


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

  clone.querySelectorAll(".selected,.connection-source").forEach((node) => node.classList.remove("selected", "connection-source"));
  clone.querySelectorAll(".layout-element > rect[fill='transparent']").forEach((node) => node.remove());
  const size = canvasSize();
  clone.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  clone.setAttribute("width", String(size.width));
  clone.setAttribute("height", String(size.height));
  clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

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
    @page{size:A4 landscape;margin:10mm}
    *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    :root{--ink:#23182d;--muted:#74687d;--purple:#7e22ce;--purple2:#a855f7;--orange:#f97316;--paper:#fff;--soft:#f7f2fb;--line:#ded4e5}
    body{margin:0;color:var(--ink);background:#ebe5ef;font:10.5px/1.42 Inter,Segoe UI,Arial,sans-serif}
    .sheet{max-width:1160px;margin:22px auto;padding:18px;background:var(--paper);box-shadow:0 18px 55px rgba(32,18,43,.18)}
    header{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;margin-bottom:12px;padding:0 0 11px;border-bottom:3px solid var(--purple)}
    .brand{display:flex;align-items:center;gap:11px}.brand-mark{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;color:#fff;background:linear-gradient(145deg,var(--purple2),var(--purple));font-size:22px;font-weight:900;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
    .eyebrow{color:var(--orange);font-size:8px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
    h1{margin:1px 0 0;font-size:21px;line-height:1.05}.document-meta{color:var(--muted);text-align:right}.document-meta b{display:block;color:var(--ink)}
    .facts{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:0 0 10px}.fact{padding:8px 10px;border:1px solid var(--line);border-radius:8px;background:var(--soft)}.fact span{display:block;color:var(--muted);font-size:7.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.fact strong{display:block;margin-top:2px;font-size:12px}
    .plan-card{overflow:hidden;border:1px solid #31243b;border-radius:10px;background:#09070d;page-break-inside:avoid}.plan-head{display:flex;justify-content:space-between;align-items:center;padding:7px 10px;color:#eee5f5;background:linear-gradient(90deg,#24162f,#120d18);font-weight:800}.plan-head span:last-child{color:#fdba74;font-size:8px;text-transform:uppercase;letter-spacing:.1em}.plan{padding:7px}.plan svg{display:block;width:100%;height:auto;max-height:137mm}
    .section{margin-top:13px}.section-title{display:flex;align-items:center;gap:8px;margin:0 0 6px;font-size:13px}.section-title::before{content:"";width:4px;height:15px;border-radius:3px;background:var(--orange)}
    table{width:100%;border-collapse:separate;border-spacing:0;font-size:8.5px;border:1px solid var(--line);border-radius:7px;overflow:hidden}thead{display:table-header-group}tr{page-break-inside:avoid}th,td{padding:4px 6px;text-align:left;border-right:1px solid var(--line);border-bottom:1px solid var(--line)}th:last-child,td:last-child{border-right:0}tbody tr:last-child td{border-bottom:0}th{color:#fff;background:var(--purple);font-size:7.5px;letter-spacing:.04em;text-transform:uppercase}tbody tr:nth-child(even){background:var(--soft)}
    footer{display:flex;justify-content:space-between;gap:16px;margin-top:10px;padding-top:8px;border-top:1px solid var(--line);color:var(--muted);font-size:8px}.hint{max-width:75%}
    @media print{body{background:#fff}.sheet{max-width:none;margin:0;padding:0;box-shadow:none}.section{break-before:auto}}
  </style></head><body><main class="sheet">
    <header><div class="brand"><div class="brand-mark">D</div><div><div class="eyebrow">DynoraStation · Technischer Export</div><h1>${title}</h1></div></div><div class="document-meta"><b>Bau- und Montageplan</b>Erstellt am ${createdAt}</div></header>
    <section class="facts"><div class="fact"><span>Anlagenplatte</span><strong>${plateWidth} × ${plateHeight} mm</strong></div><div class="fact"><span>Maßstab</span><strong>${scale}</strong></div><div class="fact"><span>Planungsraster</span><strong>${grid} mm</strong></div><div class="fact"><span>Bauteile</span><strong>${elements.length}</strong></div></section>
    <section class="plan-card"><div class="plan-head"><span>Gleis- und Anlagenplan</span><span>Draufsicht · nicht direkt bemaßen</span></div><div class="plan">${svgMarkup}</div></section>
    <section class="section"><h2 class="section-title">Stückliste</h2><table><thead><tr><th>Artikelnummer</th><th>Bauteil</th><th>Menge</th></tr></thead><tbody>${partRows || "<tr><td colspan='3'>Keine Teile platziert</td></tr>"}</tbody></table></section>
    <section class="section"><h2 class="section-title">Montagepositionen</h2><table><thead><tr><th>Pos.</th><th>Artikelnummer</th><th>Name / Bauteil</th><th>X ab links (mm)</th><th>Y ab oben (mm)</th><th>Drehung</th></tr></thead><tbody>${detailRows || "<tr><td colspan='6'>Keine Teile platziert</td></tr>"}</tbody></table></section>
    <footer><span class="hint">Die Planansicht ist seitenfüllend skaliert. Für den Aufbau gelten die angegebenen X-/Y-Maße ab der linken oberen Plattenkante.</span><span>DynoraStation · ${title}</span></footer>
  </main></body></html>`;
  showExportPreview(html);
  showToast("Bauplan-Vorschau geöffnet");
}
