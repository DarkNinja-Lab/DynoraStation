"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";
import { renderTrackLightButtons } from "../track/lights.js";
import { renderRulesGrid } from "../rules/rules.js";

function byId(id) { return document.getElementById(id); }
function all(sel) { return Array.from(document.querySelectorAll(sel)); }
function modules() { return Object.values(state?.hardware?.modules || {}); }

const PAGE_META = {
  dashboard: { title: "Übersicht", subtitle: "Status, Betrieb und Gleisbild" },
  builder: { title: "Gleisbild-Editor", subtitle: "Planen, verbinden, speichern" },
  track: { title: "Gleisbild", subtitle: "Betrieb und Schalten" },
  settings: { title: "Einstellungen", subtitle: "Module, Relais, Sensoren, Standards" },
  rules: { title: "Regeln", subtitle: "Wenn-Dann Automationen" },
  events: { title: "Ereignisse", subtitle: "System- und Sensorprotokoll" }
};

if (!state.relayConfig || typeof state.relayConfig !== "object") state.relayConfig = {};
if (!state.sensorConfig || typeof state.sensorConfig !== "object") state.sensorConfig = {};
if (!Array.isArray(state.defaults)) state.defaults = [];

function setPageHeader(page) {
  const t = PAGE_META[page] || PAGE_META.dashboard;
  const title = byId("pageTitle");
  const subtitle = byId("pageSubtitle");
  if (title) title.textContent = t.title;
  if (subtitle) subtitle.textContent = t.subtitle;
}

function setActivePage(page) {
  all(".nav-button[data-page]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  all(".page").forEach((p) => {
    p.classList.toggle("active", p.id === `page-${page}`);
  });

  setPageHeader(page);

  if (page === "settings") renderSettingsTab();
  if (page === "rules") renderRulesGrid();

  try {
    localStorage.setItem("dynora.activePage", page);
  } catch {}
}

function restorePage() {
  try {
    const saved = localStorage.getItem("dynora.activePage");
    if (saved && PAGE_META[saved]) return saved;
  } catch {}
  return "dashboard";
}

function bindNavigation() {
  all(".nav-button[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => setActivePage(btn.dataset.page));
  });

  all("[data-page-link]").forEach((btn) => {
    btn.addEventListener("click", () => setActivePage(btn.dataset.pageLink));
  });

  const mobileBtn = byId("mobileMenuButton");
  const sidebar = byId("sidebar");
  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener("click", () => sidebar.classList.toggle("open"));
    all(".nav-button[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => sidebar.classList.remove("open"));
    });
  }

  setActivePage(restorePage());
}

function modOptions(selected = "") {
  return [`<option value="">Modul wählen…</option>`]
    .concat(modules().map((m) => `<option value="${m.id}" ${m.id === selected ? "selected" : ""}>${m.name || m.id}</option>`))
    .join("");
}

function relayOptions(selected = 1, count = 16) {
  const out = [];
  for (let i = 1; i <= count; i++) {
    out.push(`<option value="${i}" ${Number(selected) === i ? "selected" : ""}>Relay ${i}</option>`);
  }
  return out.join("");
}

function ensureLightButtons() {
  if (!Array.isArray(state.lightButtons)) state.lightButtons = [];
  while (state.lightButtons.length < 4) {
    state.lightButtons.push({
      name: `Licht ${state.lightButtons.length + 1}`,
      moduleId: "",
      relayIndex: state.lightButtons.length + 1,
      active: false
    });
  }
  state.lightButtons = state.lightButtons.slice(0, 4);
}

function renderLightConfig() {
  const host = byId("lightConfigGrid");
  if (!host) return;
  ensureLightButtons();

  host.innerHTML = state.lightButtons.map((b, i) => `
    <div class="light-config-card" data-light-index="${i}">
      <h4>Button ${i + 1}</h4>
      <label>Name</label>
      <input data-field="name" value="${b.name || `Licht ${i + 1}`}">
      <label>Modul</label>
      <select data-field="moduleId">${modOptions(b.moduleId || "")}</select>
      <label>Relay</label>
      <select data-field="relayIndex">${relayOptions(Number(b.relayIndex || (i + 1)), 16)}</select>
    </div>
  `).join("");
}

function renderDefaultStates() {
  const host = byId("defaultStateGrid");
  if (!host) return;
  if (!Array.isArray(state.defaults)) state.defaults = [];

  host.innerHTML = `
    <div class="rules-head">
      <div class="builder-message">Standardaktionen für "Jetzt anwenden"</div>
      <button type="button" class="primary-button" data-action="add-default">+ Zustand</button>
    </div>
    <div class="rules-cards">
      ${state.defaults.map((d, i) => `
        <div class="rule-card" data-default-index="${i}">
          <label>Typ</label>
          <input data-field="targetType" value="${d.targetType || ""}" placeholder="switch/signal/relay/espSignal">
          <label>Ziel-ID</label>
          <input data-field="targetId" value="${d.targetId || ""}" placeholder="z. B. weiche-1">
          <label>Aktion</label>
          <input data-field="action" value="${d.action || ""}" placeholder="z. B. straight/red/on">
          <button class="secondary-button" data-action="remove-default" type="button">Löschen</button>
        </div>
      `).join("") || `<div class="sidebar-esp-empty">Keine Standardzustände konfiguriert.</div>`}
    </div>
  `;
}

function renderRelayGrid() {
  const host = byId("relayGrid");
  if (!host) return;

  const rows = [];
  modules().forEach((m) => {
    const relays = Array.isArray(m.relays) ? m.relays : [];
    relays.forEach((r, idx) => rows.push({ m, idx, on: !!r }));
  });

  host.innerHTML = rows.length
    ? rows.map((r) => {
        const key = `${r.m.id}:${r.idx + 1}`;
        const cfg = state.relayConfig[key] || {};
        return `
          <div class="relay-item" data-module-id="${r.m.id}" data-relay-index="${r.idx + 1}">
            <div><b>${r.m.name || r.m.id}</b> • Relay ${r.idx + 1}</div>
            <div class="${r.on ? "badge-on" : "badge-off"}">${r.on ? "AN" : "AUS"}</div>

            <label>Name</label>
            <input data-field="relayName" value="${cfg.name || ""}" placeholder="z. B. Bahnhof Licht">

            <label>Rolle</label>
            <input data-field="relayRole" value="${cfg.role || ""}" placeholder="z. B. Beleuchtung">

            <button class="secondary-button" data-action="toggle-relay" type="button">
              ${r.on ? "Ausschalten" : "Einschalten"}
            </button>
          </div>
        `;
      }).join("")
    : `<div class="sidebar-esp-empty">Keine Relais verfügbar.</div>`;
}

function renderSensorGrid() {
  const host = byId("sensorGrid");
  if (!host) return;

  const rows = [];
  modules().forEach((m) => {
    const sensors = Array.isArray(m.sensors) ? m.sensors : [];
    sensors.forEach((s, idx) => rows.push({ m, idx, s }));
  });

  host.innerHTML = rows.length
    ? rows.map((r) => {
        const sensorId = r.s?.id || `S${r.idx + 1}`;
        const key = `${r.m.id}:${sensorId}`;
        const cfg = state.sensorConfig[key] || {};
        return `
          <div class="sensor-item" data-module-id="${r.m.id}" data-sensor-id="${sensorId}">
            <div><b>${r.m.name || r.m.id}</b> • ${r.s.name || sensorId}</div>
            <div class="${r.s.triggered ? "badge-on" : "badge-off"}">${r.s.triggered ? "AKTIV" : "RUHE"}</div>

            <label>Name</label>
            <input data-field="sensorName" value="${cfg.name || r.s.name || ""}" placeholder="z. B. Einfahrt Gleis 1">
          </div>
        `;
      }).join("")
    : `<div class="sidebar-esp-empty">Keine Sensoren verfügbar.</div>`;
}

function renderLedGrid() {
  const host = byId("ledConfigGrid");
  if (!host) return;

  const rows = [];
  modules().forEach((m) => {
    const leds = Array.isArray(m.leds) ? m.leds : [];
    leds.forEach((l, idx) => rows.push({ m, idx, l }));
  });

  host.innerHTML = rows.length
    ? rows.map((r) => `
      <div class="light-config-card">
        <h4>${r.m.name || r.m.id} • LED ${r.idx + 1}</h4>
        <div>Status: <b>${r.l?.state ? "AN" : "AUS"}</b></div>
        <div>Helligkeit: <b>${Number(r.l?.brightness || 0)}</b></div>
        <div>Blinken: <b>${r.l?.blinking ? "Ja" : "Nein"}</b></div>
      </div>
    `).join("")
    : `<div class="sidebar-esp-empty">Keine LEDs verfügbar.</div>`;
}

function renderSettingsTab() {
  renderLightConfig();
  renderDefaultStates();
  renderRelayGrid();
  renderSensorGrid();
  renderLedGrid();
}

let saveTimer = null;
async function debounceSaveSettings() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await apiCall("/control/settings", {
        method: "POST",
        body: {
          lightButtons: state.lightButtons,
          defaults: state.defaults || [],
          relayConfig: state.relayConfig || {},
          sensorConfig: state.sensorConfig || {}
        }
      });
      renderTrackLightButtons();
    } catch (e) {
      console.warn("Settings speichern fehlgeschlagen:", e?.message || e);
    }
  }, 350);
}

function bindSettingsInput() {
  document.addEventListener("input", (ev) => {
    const lightCard = ev.target.closest("[data-light-index]");
    if (lightCard) {
      const i = Number(lightCard.dataset.lightIndex);
      const field = ev.target.dataset.field;
      if (Number.isNaN(i) || !field || !state.lightButtons[i]) return;

      state.lightButtons[i][field] = field === "relayIndex" ? Number(ev.target.value) : ev.target.value;
      debounceSaveSettings();
      return;
    }

    const dRow = ev.target.closest("[data-default-index]");
    if (dRow) {
      const i = Number(dRow.dataset.defaultIndex);
      const field = ev.target.dataset.field;
      if (Number.isNaN(i) || !field || !state.defaults[i]) return;
      state.defaults[i][field] = ev.target.value;
      debounceSaveSettings();
      return;
    }

    const relayCard = ev.target.closest("[data-module-id][data-relay-index]");
    if (relayCard && (ev.target.dataset.field === "relayName" || ev.target.dataset.field === "relayRole")) {
      const moduleId = relayCard.dataset.moduleId;
      const relayIndex = Number(relayCard.dataset.relayIndex);
      const key = `${moduleId}:${relayIndex}`;
      if (!state.relayConfig[key]) state.relayConfig[key] = {};
      if (ev.target.dataset.field === "relayName") state.relayConfig[key].name = ev.target.value;
      if (ev.target.dataset.field === "relayRole") state.relayConfig[key].role = ev.target.value;
      debounceSaveSettings();
      return;
    }

    const sensorCard = ev.target.closest("[data-module-id][data-sensor-id]");
    if (sensorCard && ev.target.dataset.field === "sensorName") {
      const moduleId = sensorCard.dataset.moduleId;
      const sensorId = sensorCard.dataset.sensorId;
      const key = `${moduleId}:${sensorId}`;
      if (!state.sensorConfig[key]) state.sensorConfig[key] = {};
      state.sensorConfig[key].name = ev.target.value;
      debounceSaveSettings();
    }
  });

  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    if (btn.dataset.action === "add-default") {
      if (!Array.isArray(state.defaults)) state.defaults = [];
      state.defaults.push({ targetType: "", targetId: "", action: "" });
      renderDefaultStates();
      return;
    }

    if (btn.dataset.action === "remove-default") {
      const row = btn.closest("[data-default-index]");
      if (!row) return;
      const i = Number(row.dataset.defaultIndex);
      if (!Number.isNaN(i)) {
        state.defaults.splice(i, 1);
        renderDefaultStates();
        debounceSaveSettings();
      }
      return;
    }

    if (btn.dataset.action === "toggle-relay") {
      const row = btn.closest("[data-module-id][data-relay-index]");
      if (!row) return;
      const moduleId = row.dataset.moduleId;
      const relayIndex = Number(row.dataset.relayIndex);
      const isOn = !!row.querySelector(".badge-on");
      try {
        await apiCall("/control/relay", {
          method: "POST",
          body: { moduleId, relayIndex, state: !isOn }
        });
      } catch (e) {
        console.warn("Relay schalten fehlgeschlagen:", e?.message || e);
      }
      return;
    }

    if (btn.id === "applyDefaultsButton") {
      try {
        await apiCall("/control/defaults/apply", {
          method: "POST",
          body: { defaults: state.defaults || [] }
        });
      } catch (e) {
        console.warn("Standardzustände anwenden fehlgeschlagen:", e?.message || e);
      }
    }
  });
}

function bindTrackLightsQuickToggle() {
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".light-toggle-btn[data-light-index]");
    if (!btn) return;
    const i = Number(btn.dataset.lightIndex);
    if (Number.isNaN(i) || !state.lightButtons[i]) return;

    const cfg = state.lightButtons[i];
    try {
      await apiCall("/control/relay", {
        method: "POST",
        body: {
          moduleId: cfg.moduleId,
          relayIndex: Number(cfg.relayIndex || 1),
          state: !cfg.active
        }
      });
      cfg.active = !cfg.active;
      renderTrackLightButtons();
    } catch (e) {
      console.warn("Lichtschaltung fehlgeschlagen:", e?.message || e);
    }
  });
}

export function eventsRegistrieren() {
  bindNavigation();
  bindSettingsInput();
  bindTrackLightsQuickToggle();
}