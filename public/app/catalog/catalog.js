"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

export async function katalogLaden() {
  try {
    const data = await apiCall("/api/track-catalog");
    state.catalog = {
      tracks: data.tracks || [],
      curves: data.curves || [],
      switches: data.switches || [],
      crossings: data.crossings || [],
      signals: data.signals || [],
      transformers: data.transformers || [],
      espSignals: data.espSignals || []
    };
  } catch (error) {
    console.warn("Katalog konnte nicht geladen werden", error);
    state.catalog = { tracks: [], curves: [], switches: [], crossings: [], signals: [], transformers: [], espSignals: [] };
  }
}

function itemCode(item) {
  return String(item?.code || item?.label || "").match(/\d{4}/)?.[0] || String(item?.code || item?.label || "");
}

function itemImage(item) {
  const article = itemCode(item);
  return article ? `/assets/track/${article}.jpg` : "";
}

function itemMeta(item, kind) {
  if (kind === "track") return `${item.length || "?"} mm`;
  if (kind === "curve") return `R ${item.radius || "?"} mm · ${item.angleDeg || "?"}°${item.arcLength ? ` · ${item.arcLength} mm Bogen` : ""}`;
  if (kind === "switch") return item.handed === "right" ? "rechts" : item.handed === "left" ? "links" : "Weiche";
  if (kind === "crossing") return "Kreuzung";
  return "";
}

function renderCatalogSelect(hostId, selectId, items, kind) {
  const host = document.getElementById(hostId);
  if (!host || !Array.isArray(items) || !items.length) return;

  const first = items[0];
  host.innerHTML = `
    <div class="custom-select" data-catalog-select="${selectId}">
      <button class="custom-select-btn" type="button" aria-haspopup="listbox" aria-expanded="false">
        <span class="custom-select-value">
          <img class="custom-select-thumb" src="${itemImage(first)}" alt="" onerror="this.style.visibility='hidden'">
          <span>
            <span class="custom-select-title">${first.label}</span>
            <small class="custom-select-meta">${itemMeta(first, kind)}</small>
          </span>
        </span>
        <span class="custom-select-caret">▾</span>
      </button>
      <div class="custom-select-list hidden" role="listbox">
        ${items.map((item, index) => `
          <button class="custom-select-item ${index === 0 ? "active" : ""}" type="button" role="option"
                  data-value="${itemCode(item)}" data-meta="${itemMeta(item, kind)}" data-image="${itemImage(item)}">
            <span class="custom-select-item-text">
              <b>${item.label}</b>
              <small>${itemMeta(item, kind)}</small>
            </span>
            <img src="${itemImage(item)}" alt="${item.label}" onerror="this.style.visibility='hidden'">
          </button>
        `).join("")}
      </div>
      <input type="hidden" id="${selectId}" value="${itemCode(first)}">
    </div>`;

  const root = host.querySelector(".custom-select");
  const button = root.querySelector(".custom-select-btn");
  const list = root.querySelector(".custom-select-list");
  const hidden = root.querySelector(`#${selectId}`);
  const title = root.querySelector(".custom-select-title");
  const meta = root.querySelector(".custom-select-meta");
  const thumb = root.querySelector(".custom-select-thumb");

  button.addEventListener("click", () => {
    const open = list.classList.toggle("hidden") === false;
    root.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
  });

  list.addEventListener("click", (event) => {
    const option = event.target.closest(".custom-select-item");
    if (!option) return;
    hidden.value = option.dataset.value;
    title.textContent = option.querySelector("b")?.textContent || option.dataset.value;
    meta.textContent = option.dataset.meta || "";
    thumb.src = option.dataset.image || "";
    thumb.style.visibility = "visible";
    list.querySelectorAll(".custom-select-item").forEach((x) => x.classList.toggle("active", x === option));
    list.classList.add("hidden");
    root.classList.remove("open");
    button.setAttribute("aria-expanded", "false");
    hidden.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

export function katalogUIInit() {
  renderCatalogSelect("trackTypeSelectHost", "trackTypeSelect", state.catalog.tracks, "track");
  renderCatalogSelect("curveTypeSelectHost", "curveTypeSelect", state.catalog.curves, "curve");
  renderCatalogSelect("switchTypeSelectHost", "switchTypeSelect", state.catalog.switches, "switch");
  renderCatalogSelect("xTrackTypeSelectHost", "xTrackTypeSelect", state.catalog.crossings, "crossing");

  document.addEventListener("click", (event) => {
    document.querySelectorAll(".custom-select.open").forEach((root) => {
      if (root.contains(event.target)) return;
      root.classList.remove("open");
      root.querySelector(".custom-select-list")?.classList.add("hidden");
      root.querySelector(".custom-select-btn")?.setAttribute("aria-expanded", "false");
    });
  });
}
