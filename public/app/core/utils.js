"use strict";

import { CONST } from "./state.js";

export function clone(v) { return JSON.parse(JSON.stringify(v)); }
export function nummer(v, d) { const n = Number(v); return Number.isFinite(n) ? n : d; }
export function ganzzahl(v, d) { const n = Number(v); return Number.isInteger(n) ? n : d; }
export function gueltigesRelais(v) { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 256 ? n : 0; }
export function gueltigerLedKanal(v) { const n = Number(v); return Number.isInteger(n) && n >= 1 && n <= 256 ? n : 0; }
export function normalizeWinkel(w) { let x = Number(w) || 0; x %= 360; if (x < 0) x += 360; return x; }

export function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function svg(tag) { return document.createElementNS(CONST.SVG_NS, tag); }
export function attrs(el, map) { Object.entries(map).forEach(([k, v]) => el.setAttribute(k, String(v))); }
export function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = String(text ?? ""); }



export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function generateId() {
  return Math.random().toString(36).substring(2, 11);
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function findElementById(elements, id) {
  return elements.find(e => e.id === id);
}
