"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";
import { renderTrackLightButtons } from "../track/lights.js";
import { renderRulesGrid } from "../rules/rules.js";
import { renderSidebarEspStatus, renderCs3Tiles } from "./render.js";
import { renderTrackLayout } from "../track/track.js";
import { showToast } from "./toast.js";

function byId(id) { return document.getElementById(id); }
function all(sel) { return Array.from(document.querySelectorAll(sel)); }
function modules() { return Object.values(state?.hardware?.modules || {}); }
function hasCapability(module, capability) {
  const caps = Array.isArray(module?.capabilities) ? module.capabilities : [];
  if (caps.includes(capability)) return true;
  if (capability === "relay" && ["RELAY_SENSOR", "HYBRID"].includes(module?.kind)) return true;
  if (capability === "led" && ["SIGNAL_LED", "HYBRID"].includes(module?.kind)) return true;
  return module?.kind === "UNKNOWN";
}
function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

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
  if (page === "track") renderTrackLayout();

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
    .concat(modules().filter((module) => hasCapability(module, "relay")).map((m) => `<option value="${m.id}" ${m.id === selected ? "selected" : ""}>${m.name || m.id}</option>`))
    .join("");
}

function optionList(items, selected, emptyLabel) {
  const values = items.map(([value]) => String(value));
  const legacy = selected && !values.includes(String(selected))
    ? [[selected, `${selected} (nicht mehr verfügbar)`]]
    : [];
  return [["", emptyLabel], ...legacy, ...items]
    .map(([value, label]) => `<option value="${esc(value)}" ${String(value) === String(selected || "") ? "selected" : ""}>${esc(label)}</option>`)
    .join("");
}

function defaultTargetOptions(type) {
  if (type === "relay") {
    return modules().flatMap((module) => (module.relays || []).map((_, index) => [
      `${module.id}:${index + 1}`,
      `${module.name || module.id} · Relay ${index + 1}`
    ]));
  }
  const typeMap = { switch: "switch", signal: "signal", crossing: "xtrack", espSignal: "ledSignal" };
  const backendType = typeMap[type];
  return (state.layout?.elemente || [])
    .filter((element) => element.typ === type || element.typ === backendType)
    .map((element) => [element.id, element.name || element.id]);
}

function defaultActionOptions(type) {
  const map = {
    relay: [["on", "Einschalten"], ["off", "Ausschalten"]],
    switch: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    crossing: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    signal: [["halt", "Rot / Halt"], ["fahrt", "Grün / Fahrt"]],
    espSignal: [["halt", "Rot / Halt"], ["warnung", "Gelb / Warnung"], ["fahrt", "Grün / Fahrt"]]
  };
  return map[type] || [];
}

function relayOptions(selected = 0, moduleId = "") {
  const module = state.hardware.modules?.[moduleId];
  const count = Array.isArray(module?.relays) ? module.relays.length : 0;
  const out = [`<option value="0" ${Number(selected) === 0 ? "selected" : ""}>Kein Relay</option>`];
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
      relayIndex: 0,
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
      <select data-field="relayIndex">${relayOptions(Number(b.relayIndex || 0), b.moduleId || "")}</select>
    </div>
  `).join("");
}

function renderModuleManagement() {
  const host = byId("moduleManagementGrid");
  if (!host) return;
  const list = modules().sort((a, b) =>
    Number(Boolean(b.online)) - Number(Boolean(a.online)) ||
    String(a.name || a.id).localeCompare(String(b.name || b.id), "de")
  );
  host.innerHTML = list.length ? list.map((module) => {
    const relays = Array.isArray(module.relays) ? module.relays.length : 0;
    const leds = Array.isArray(module.leds) ? module.leds.length : 0;
    const sensors = Array.isArray(module.sensors) ? module.sensors.length : 0;
    const seen = Number(module.lastHeartbeat) > 0
      ? new Date(Number(module.lastHeartbeat)).toLocaleString("de-DE")
      : "noch kein Heartbeat";
    return `
      <article class="module-management-card ${module.online ? "online" : "offline"}" data-managed-module="${esc(module.id)}">
        <div class="module-management-head">
          <div>
            <strong>${esc(module.name || module.id)}</strong>
            <small>${esc(module.id)}</small>
          </div>
          <span class="module-state-badge ${module.online ? "online" : "offline"}">${module.online ? "Online" : "Offline"}</span>
        </div>
        <dl class="module-facts">
          <div><dt>Typ</dt><dd>${esc(module.type || "ESP-Modul")}</dd></div>
          <div><dt>IP</dt><dd>${esc(module.ip || "keine aktuelle IP")}</dd></div>
          <div><dt>Kanäle</dt><dd>${relays} Relais · ${leds} LEDs · ${sensors} Sensoren</dd></div>
          <div><dt>Zuletzt gesehen</dt><dd>${esc(seen)}</dd></div>
        </dl>
        <button class="danger-button module-delete-button" data-action="delete-module" data-module-id="${esc(module.id)}" type="button">
          Modul löschen
        </button>
      </article>
    `;
  }).join("") : '<div class="empty-state">Noch keine ESP-Module registriert.</div>';
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
          <select data-field="targetType">${optionList([
            ["switch", "Weiche"], ["crossing", "Kreuzungsweiche"], ["signal", "Märklin-Signal"],
            ["espSignal", "ESP-Signal"], ["relay", "Relay"]
          ], d.targetType, "Typ wählen…")}</select>
          <label>Ziel</label>
          <select data-field="targetId" ${d.targetType ? "" : "disabled"}>${optionList(defaultTargetOptions(d.targetType), d.targetId, "Ziel wählen…")}</select>
          <label>Aktion</label>
          <select data-field="action" ${d.targetType ? "" : "disabled"}>${optionList(defaultActionOptions(d.targetType), d.action, "Aktion wählen…")}</select>
          <button class="secondary-button" data-action="remove-default" type="button">Löschen</button>
        </div>
      `).join("") || `<div class="sidebar-esp-empty">Keine Standardzustände konfiguriert.</div>`}
    </div>
  `;
}

function renderRelayGrid() {
  const host = byId("relayGrid");
  if (!host) return;

  const availableModules = modules().filter((module) => hasCapability(module, "relay")).sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), "de"));
  if (!availableModules.some((module) => module.id === state.settingsRelayModule)) {
    state.settingsRelayModule = availableModules[0]?.id || "";
  }
  const selectedModule = availableModules.find((module) => module.id === state.settingsRelayModule);
  const rows = [];
  (selectedModule ? [selectedModule] : []).forEach((m) => {
    const relays = Array.isArray(m.relays) ? m.relays : [];
    relays.forEach((r, idx) => rows.push({ m, idx, on: !!r }));
  });

  host.innerHTML = `
    <div class="settings-module-picker">
      <label for="relayModuleSelect">ESP-Modul</label>
      <select id="relayModuleSelect">
        ${availableModules.map((module) => `<option value="${esc(module.id)}" ${module.id === state.settingsRelayModule ? "selected" : ""}>${esc(module.name || module.id)} (${Array.isArray(module.relays) ? module.relays.length : 0} Relais)</option>`).join("")}
      </select>
    </div>
    <div class="relay-module-summary">${selectedModule ? `${selectedModule.name || selectedModule.id} · ${selectedModule.online ? "online" : "offline"} · ${selectedModule.ip || "keine aktuelle IP"}` : "Kein Relay-Modul verfügbar"}</div>
    <div class="relay-module-grid">
    ${rows.length ? rows.map((r) => {
        const key = `${r.m.id}:${r.idx + 1}`;
        const cfg = state.relayConfig[key] || {};
        return `
          <div class="relay-item" data-module-id="${r.m.id}" data-relay-index="${r.idx + 1}">
            <div><b>${r.m.name || r.m.id}</b> • ${esc(cfg.name || `Relay ${r.idx + 1}`)}</div>
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
      }).join("") : `<div class="empty-state relay-empty-state"><strong>${selectedModule ? esc(selectedModule.name || selectedModule.id) : "Kein Modul"} meldet aktuell keine Relais.</strong><span>Es werden keine Kanäle erfunden. Prüfe den ESP-Code und den nächsten Heartbeat; sobald das Modul seine Relay-Anzahl meldet, erscheinen die Kanäle hier.</span></div>`}
    </div>
  `;
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
            <div><b>${r.m.name || r.m.id}</b> • ${esc(cfg.name || r.s.name || sensorId)}</div>
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

export function refreshSettingsHardwareStatus() {
  if (!document.getElementById("page-settings")?.classList.contains("active")) return;

  const sensorHost = byId("sensorGrid");
  if (sensorHost) {
    const current = sensorHost.querySelectorAll("[data-module-id][data-sensor-id]").length;
    const expected = modules().reduce((sum, module) => sum + (Array.isArray(module.sensors) ? module.sensors.length : 0), 0);
    if (current !== expected && !sensorHost.contains(document.activeElement)) {
      renderSensorGrid();
    } else {
      modules().forEach((module) => (module.sensors || []).forEach((sensor, index) => {
        const sensorId = sensor?.id || `S${index + 1}`;
        const card = sensorHost.querySelector(`[data-module-id="${CSS.escape(module.id)}"][data-sensor-id="${CSS.escape(sensorId)}"]`);
        const badge = card?.querySelector(".badge-on, .badge-off");
        if (badge) {
          badge.className = sensor.triggered ? "badge-on" : "badge-off";
          badge.textContent = sensor.triggered ? "AKTIV" : "RUHE";
        }
      }));
    }
  }

  const relayHost = byId("relayGrid");
  if (relayHost && !relayHost.contains(document.activeElement)) {
    relayHost.querySelectorAll("[data-module-id][data-relay-index]").forEach((card) => {
      const module = state.hardware.modules?.[card.dataset.moduleId];
      const index = Number(card.dataset.relayIndex);
      const on = Boolean(module?.relays?.[index - 1]);
      const badge = card.querySelector(".badge-on, .badge-off");
      if (badge) { badge.className = on ? "badge-on" : "badge-off"; badge.textContent = on ? "AN" : "AUS"; }
    });
  }
}

export function renderSettingsTab() {
  renderModuleManagement();
  renderLightConfig();
  renderDefaultStates();
  renderRelayGrid();
  renderSensorGrid();
  renderLedGrid();
  applySettingsView();
}

function applySettingsView() {
  const view = state.settingsView || "modules";
  all("[data-settings-view]").forEach((button) => button.classList.toggle("active", button.dataset.settingsView === view));
  all("[data-settings-section]").forEach((section) => section.classList.toggle("active", section.dataset.settingsSection === view));
}

function setSaveStatus(id, text, kind = "") {
  const el = byId(id);
  if (!el) return;
  el.textContent = text;
  el.className = `save-status ${kind}`.trim();
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 2200);
}

async function saveSettingsSection(section) {
  const map = {
    lights: { body: { lightButtons: state.lightButtons }, status: "saveLightStatus", label: "Licht-Buttons" },
    defaults: { body: { defaults: state.defaults || [] }, status: "saveDefaultsStatus", label: "Standardzustände" },
    relays: { body: { relayConfig: state.relayConfig || {} }, status: "saveRelayStatus", label: "Relais" },
    sensors: { body: { sensorConfig: state.sensorConfig || {} }, status: "saveSensorStatus", label: "Sensoren" },
    leds: { body: { ledConfig: state.ledConfig || {} }, status: "saveLedStatus", label: "LEDs" }
  };
  const cfg = map[section];
  if (!cfg) return;
  setSaveStatus(cfg.status, "Speichert …");
  try {
    await apiCall("/control/settings", { method: "POST", body: cfg.body });
    setSaveStatus(cfg.status, "Gespeichert", "saved");
    if (section === "lights") renderTrackLightButtons();
    showToast(`${cfg.label} gespeichert`);
  } catch (e) {
    setSaveStatus(cfg.status, "Fehler", "error");
    showToast(`${cfg.label} konnten nicht gespeichert werden: ${e?.message || e}`, "error");
  }
}

function bindSettingsInput() {
  document.addEventListener("change", (ev) => {
    if (ev.target.closest("[data-default-index]") && ev.target.dataset.field) {
      ev.target.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    if (ev.target.id !== "relayModuleSelect") return;
    state.settingsRelayModule = ev.target.value;
    renderRelayGrid();
  });

  document.addEventListener("input", (ev) => {
    const lightCard = ev.target.closest("[data-light-index]");
    if (lightCard) {
      const i = Number(lightCard.dataset.lightIndex);
      const field = ev.target.dataset.field;
      if (Number.isNaN(i) || !field || !state.lightButtons[i]) return;
      state.lightButtons[i][field] = field === "relayIndex" ? Number(ev.target.value) : ev.target.value;
      if (field === "moduleId") {
        state.lightButtons[i].relayIndex = 0;
        renderLightConfig();
      }
      setSaveStatus("saveLightStatus", "Ungespeichert");
      return;
    }

    const dRow = ev.target.closest("[data-default-index]");
    if (dRow) {
      const i = Number(dRow.dataset.defaultIndex);
      const field = ev.target.dataset.field;
      if (Number.isNaN(i) || !field || !state.defaults[i]) return;
      state.defaults[i][field] = ev.target.value;
      if (field === "targetType") {
        state.defaults[i].targetId = "";
        state.defaults[i].action = defaultActionOptions(ev.target.value)[0]?.[0] || "";
        renderDefaultStates();
      }
      setSaveStatus("saveDefaultsStatus", "Ungespeichert");
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
      setSaveStatus("saveRelayStatus", "Ungespeichert");
      return;
    }

    const sensorCard = ev.target.closest("[data-module-id][data-sensor-id]");
    if (sensorCard && ev.target.dataset.field === "sensorName") {
      const moduleId = sensorCard.dataset.moduleId;
      const sensorId = sensorCard.dataset.sensorId;
      const key = `${moduleId}:${sensorId}`;
      if (!state.sensorConfig[key]) state.sensorConfig[key] = {};
      state.sensorConfig[key].name = ev.target.value;
      setSaveStatus("saveSensorStatus", "Ungespeichert");
    }
  });

  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    if (btn.dataset.settingsView) {
      state.settingsView = btn.dataset.settingsView;
      applySettingsView();
      try { localStorage.setItem("dynora.settingsView", state.settingsView); } catch {}
      return;
    }

    if (btn.dataset.saveSection) {
      await saveSettingsSection(btn.dataset.saveSection);
      return;
    }

    if (btn.dataset.action === "delete-module") {
      const moduleId = btn.dataset.moduleId;
      const module = state.hardware.modules?.[moduleId];
      if (!moduleId || !module) return;
      const onlineWarning = module.online
        ? "\n\nDieses Modul ist online und erscheint beim nächsten Heartbeat wieder. Schalte den ESP zuerst aus, wenn es dauerhaft wegbleiben soll."
        : "";
      if (!confirm(`ESP-Modul „${module.name || moduleId}“ wirklich löschen?\n\nRelais, LEDs und Sensoren dieses Moduls werden entfernt. Zugewiesene Elemente werden getrennt und betroffene Automationen deaktiviert.${onlineWarning}`)) return;
      btn.disabled = true;
      btn.textContent = "Wird gelöscht …";
      try {
        const result = await apiCall("/module/delete", {
          method: "POST",
          body: { module: moduleId }
        });
        delete state.hardware.modules[moduleId];
        state.lightButtons = (state.lightButtons || []).map((light) =>
          light.moduleId === moduleId ? { ...light, moduleId: "", relayIndex: 0, active: false } : light
        );
        if (state.settingsRelayModule === moduleId) state.settingsRelayModule = "";
        renderSettingsTab();
        renderSidebarEspStatus();
        showToast(`Modul gelöscht · ${result.clearedElements || 0} Zuweisungen getrennt · ${result.disabledRules || 0} Automationen deaktiviert`);
      } catch (error) {
        btn.disabled = false;
        btn.textContent = "Modul löschen";
        showToast(`Modul konnte nicht gelöscht werden: ${error?.message || error}`, "error");
      }
      return;
    }

    if (btn.dataset.action === "add-default") {
      if (!Array.isArray(state.defaults)) state.defaults = [];
      state.defaults.push({ targetType: "", targetId: "", action: "" });
      renderDefaultStates();
      setSaveStatus("saveDefaultsStatus", "Ungespeichert");
      return;
    }

    if (btn.dataset.action === "remove-default") {
      const row = btn.closest("[data-default-index]");
      if (!row) return;
      const i = Number(row.dataset.defaultIndex);
      if (!Number.isNaN(i)) {
        state.defaults.splice(i, 1);
        renderDefaultStates();
        setSaveStatus("saveDefaultsStatus", "Ungespeichert");
      }
      return;
    }

    if (btn.dataset.action === "toggle-relay") {
      const row = btn.closest("[data-module-id][data-relay-index]");
      if (!row) return;
      const moduleId = row.dataset.moduleId;
      const relayIndex = Number(row.dataset.relayIndex);
      const module = state.hardware.modules?.[moduleId];
      const isOn = Boolean(module?.relays?.[relayIndex - 1]);
      btn.classList.add("busy");
      try {
        const result = await apiCall("/control/relay", {
          method: "POST",
          body: { module: moduleId, channel: relayIndex, state: !isOn }
        });
        if (module && Array.isArray(result?.relays)) module.relays = result.relays.map(Boolean);
        renderRelayGrid();
        showToast(`Relay ${relayIndex} ${!isOn ? "eingeschaltet" : "ausgeschaltet"}`);
      } catch (e) {
        showToast(`Relay konnte nicht geschaltet werden: ${e?.message || e}`, "error");
      } finally {
        btn.classList.remove("busy");
      }
      return;
    }

    if (btn.id === "applyDefaultsButton") {
      try {
        await apiCall("/control/defaults/apply", { method: "POST", body: { defaults: state.defaults || [] } });
        showToast("Standardzustände angewendet");
      } catch (e) {
        showToast(`Standardzustände konnten nicht angewendet werden: ${e?.message || e}`, "error");
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
    const channel = Number(cfg.relayIndex || 0);
    if (!cfg.moduleId || channel < 1) {
      showToast("Licht-Button ist noch keinem Modul/Relay zugewiesen", "warning");
      return;
    }
    try {
      await apiCall("/control/relay", {
        method: "POST",
        body: {
          module: cfg.moduleId,
          channel,
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

function bindTrackElementQuickToggle() {
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".cs3-tile[data-element-id]");
    if (!btn) return;
    const element = (state.layout?.elemente || []).find((item) => item.id === btn.dataset.elementId);
    if (!element) return;
    const type = element.typ === "xtrack" || element.typ === "crossing" ? "xtrack" : element.typ === "ledSignal" || element.typ === "espSignal" ? "espSignal" : element.typ;
    const config = {
      switch: ["/switch/control", element.switchState === "abzweig" ? "gerade" : "abzweig"],
      xtrack: ["/xtrack/control", element.xState === "abzweig" ? "gerade" : "abzweig"],
      signal: ["/signal/control", element.signalState === "fahrt" ? "halt" : "fahrt"],
      espSignal: ["/esp-signal/control", ({ halt: "warnung", warnung: "fahrt", fahrt: "halt" })[element.ledState || element.espState || "halt"] || "halt"]
    }[type];
    if (!config) return;
    btn.classList.add("busy");
    try {
      const result = await apiCall(config[0], { method: "POST", body: { elementId: element.id, state: config[1] } });
      if (type === "switch") element.switchState = result.state;
      if (type === "xtrack") element.xState = result.state;
      if (type === "signal") element.signalState = result.state;
      if (type === "espSignal") element.ledState = element.espState = result.state;
      renderSidebarEspStatus();
      renderCs3Tiles();
      renderTrackLayout();
    } catch (error) {
      showToast(`Element konnte nicht geschaltet werden: ${error?.message || error}`, "error");
    } finally { btn.classList.remove("busy"); }
  });
}

export function eventsRegistrieren() {
  try {
    const savedSettingsView = localStorage.getItem("dynora.settingsView");
    if (["modules", "lights", "relays", "sensors", "leds", "defaults"].includes(savedSettingsView)) state.settingsView = savedSettingsView;
  } catch {}
  bindNavigation();
  bindSettingsInput();
  bindTrackLightsQuickToggle();
  bindTrackElementQuickToggle();
}
