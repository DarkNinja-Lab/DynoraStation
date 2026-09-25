"use strict";

import { state } from "../core/state.js?v=mobile-v5-cachefix";
import { apiCall } from "../core/api.js?v=mobile-v5-cachefix";
import { renderTrackLightButtons } from "../track/lights.js?v=mobile-v5-cachefix";
import { renderRulesGrid } from "../rules/rules.js?v=mobile-v5-cachefix";
import { renderSidebarEspStatus, renderCs3Tiles } from "./render.js?v=mobile-v5-cachefix";
import { renderTrackLayout } from "../track/track.js?v=mobile-v5-cachefix";
import { showToast } from "./toast.js?v=mobile-v5-cachefix";
import { commandFeedbackForRelay, commandFeedbackForLed, commandFeedbackForElement, commandStatusText, moduleControlInfo, rememberPendingCommands } from "../core/commands.js?v=mobile-v5-cachefix";

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
  dashboard: { title: "Übersicht", subtitle: "Betriebsbild, Systemzustand und letzte Aktivitäten", section: "Zentrale" },
  track: { title: "Betrieb", subtitle: "Fahrwege, Signale und Anlagenfunktionen steuern", section: "Workspace" },
  settings: { title: "System", subtitle: "Geräte, Ein-/Ausgänge und Ereignisse", section: "Administration" },
  events: { title: "Logbuch", subtitle: "System-, Schalt- und Sensorereignisse", section: "Administration" }
};

if (!state.relayConfig || typeof state.relayConfig !== "object") state.relayConfig = {};
if (!state.sensorConfig || typeof state.sensorConfig !== "object") state.sensorConfig = {};
if (!Array.isArray(state.defaults)) state.defaults = [];

function setPageHeader(page) {
  const t = PAGE_META[page] || PAGE_META.dashboard;
  const title = byId("pageTitle");
  const subtitle = byId("pageSubtitle");
  const section = byId("topbarSection");
  if (title) title.textContent = t.title;
  if (subtitle) subtitle.textContent = t.subtitle;
  if (section) section.textContent = t.section;
}

function setTrackWorkspaceMode(mode = "operate") {
  const editing = mode === "edit";
  const trackPage = byId("page-track");
  const builderPage = byId("page-builder");
  const onTrackWorkspace = document.body.dataset.page === "track";

  document.body.classList.toggle("track-edit-mode", editing && onTrackWorkspace);
  if (trackPage) trackPage.classList.toggle("active", onTrackWorkspace && !editing);
  if (builderPage) builderPage.classList.toggle("active", onTrackWorkspace && editing);

  const editButton = byId("enterEditModeButton");
  if (editButton) editButton.setAttribute("aria-pressed", String(editing));

  if (onTrackWorkspace) {
    const title = byId("pageTitle");
    const subtitle = byId("pageSubtitle");
    const section = byId("topbarSection");
    if (editing) {
      if (title) title.textContent = "Stellwerk bearbeiten";
      if (subtitle) subtitle.textContent = "Gleisbild bearbeiten, Elemente platzieren und Hardware zuweisen";
      if (section) section.textContent = "Bearbeitung";
      document.dispatchEvent(new CustomEvent("dynora:builder-opened"));
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    } else {
      setPageHeader("track");
      requestAnimationFrame(renderTrackLayout);
    }
  }
}

function setActivePage(page) {
  const editRequested = page === "builder";
  const targetPage = editRequested ? "track" : page;
  const targetMeta = PAGE_META[targetPage] ? targetPage : "dashboard";

  document.body.dataset.page = targetMeta;
  all(".nav-button[data-page]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === targetMeta);
  });

  all(".page").forEach((p) => {
    p.classList.toggle("active", p.id === `page-${targetMeta}`);
  });

  setPageHeader(targetMeta);
  all(".mobile-nav-button[data-page-link]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pageLink === targetMeta);
  });

  if (targetMeta === "settings") renderSettingsTab();
  if (targetMeta === "track") setTrackWorkspaceMode(editRequested ? "edit" : "operate");
  else document.body.classList.remove("track-edit-mode");

  try {
    localStorage.setItem("dynora.activePage", targetMeta);
  } catch {}
}
function restorePage() {
  try {
    const saved = localStorage.getItem("dynora.activePage");
    if (saved === "builder") return "track";
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
    const setSidebarOpen = (open) => {
      document.body.classList.toggle("sidebar-open", open);
      mobileBtn.setAttribute("aria-expanded", String(open));
    };
    mobileBtn.addEventListener("click", () => setSidebarOpen(!document.body.classList.contains("sidebar-open")));
    all("[data-close-sidebar]").forEach((btn) => btn.addEventListener("click", () => setSidebarOpen(false)));
    all(".nav-button[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => setSidebarOpen(false));
    });
    document.addEventListener("click", (event) => {
      if (!document.body.classList.contains("sidebar-open")) return;
      if (sidebar.contains(event.target) || mobileBtn.contains(event.target)) return;
      setSidebarOpen(false);
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") setSidebarOpen(false);
    });
  }

  const builderLayout = document.querySelector(".builder-layout");
  all("[data-builder-panel]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const panel = btn.dataset.builderPanel;
      if (builderLayout) builderLayout.dataset.mobilePanel = panel;
      all("[data-builder-panel]").forEach((item) => item.classList.toggle("active", item === btn));
      if (panel === "canvas") requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    });
  });

  setActivePage(restorePage());
}

function bindTrackFocusMode() {
  const page = byId("page-track");
  const button = byId("toggleTrackFocusButton");
  const exitButton = byId("trackFocusExitButton");
  if (!page || !button) return;

  let active = false;
  const label = button.querySelector("span");

  const apply = (next) => {
    active = Boolean(next);
    page.classList.toggle("plan-focus", active);
    document.body.classList.toggle("track-focus-active", active);
    button.setAttribute("aria-pressed", String(active));
    if (label) label.textContent = active ? "Maximierung beenden" : "Gleisbild maximieren";
    if (exitButton) exitButton.hidden = !active;

    // Erst nach dem Layoutwechsel neu einpassen, damit wirklich die volle
    // Viewport-Fläche und nicht die vorherige Panel-Größe verwendet wird.
    requestAnimationFrame(() => requestAnimationFrame(renderTrackLayout));
  };

  button.addEventListener("click", () => apply(!active));
  exitButton?.addEventListener("click", () => apply(false));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && active) apply(false);
  });

  // Ein maximiertes Gleisbild ist ein momentaner Bedienzustand und wird
  // absichtlich nicht über Seiten-Neuladen hinweg gespeichert.
  apply(false);
}

function modOptions(selected = "") {
  return [`<option value="">Modul wählen…</option>`]
    .concat(modules().filter((module) => hasCapability(module, "relay")).map((m) => `<option value="${esc(m.id)}" ${m.id === selected ? "selected" : ""}>${esc(m.name || m.id)}</option>`))
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
  host.innerHTML = list.length ? `<div class="module-table">
    <div class="module-table-head" aria-hidden="true">
      <span>Modul</span><span>Status</span><span>Typ / Adresse</span><span>Kanäle</span><span>Zuletzt gesehen</span><span>Verwaltung</span>
    </div>${list.map((module) => {
    const relays = Array.isArray(module.relays) ? module.relays.length : 0;
    const leds = Array.isArray(module.leds) ? module.leds.length : 0;
    const sensors = Array.isArray(module.sensors) ? module.sensors.length : 0;
    const seen = Number(module.lastHeartbeat) > 0
      ? new Date(Number(module.lastHeartbeat)).toLocaleString("de-DE")
      : "noch kein Heartbeat";
    return `
      <article class="module-management-card ${module.online ? "online" : "offline"} ${module.compatibility?.compatible === false ? "incompatible" : module.compatibility?.status === "warning" ? "compat-warning" : ""}" data-managed-module="${esc(module.id)}">
        <div class="module-identity"><strong>${esc(module.name || module.id)}</strong><small>${esc(module.id)}</small></div>
        <span class="module-state-badge ${module.online && module.compatibility?.compatible !== false && module.health?.relayDriverReady !== false ? "online" : "offline"}">${!module.online ? "OFFLINE" : module.health?.relayDriverReady === false ? "MCP FEHLER" : module.compatibility?.compatible === false ? "INKOMPATIBEL" : module.compatibility?.status === "warning" ? "WARNUNG" : "ONLINE"}</span>
        <div class="module-endpoint"><strong>${esc(module.hardwareType || module.type || "ESP-Modul")}</strong><small>FW ${esc(module.firmwareVersion || "?")} · Protokoll ${esc(module.protocolVersion ?? "?")} · ${esc(module.ip || "keine aktuelle IP")}</small>${module.health?.relayDriveMode === "OPEN_DRAIN_IODIR" ? `<small>Relaislogik: aktiv-LOW · Open-Drain/IODIR</small>` : typeof module.health?.relayActiveLow === "boolean" ? `<small>Relaislogik: ${module.health.relayActiveLow ? "aktiv-LOW" : "aktiv-HIGH"}</small>` : ""}${module.health?.relayDriverReady === false ? `<small class="compatibility-warning">MCP23017 nicht erreichbar · I²C und Versorgung prüfen</small>` : module.compatibility?.compatible === false || module.compatibility?.status === "warning" ? `<small class="compatibility-warning">${esc(module.compatibility?.reason || "Kompatibilitätsdaten unvollständig")}</small>` : ""}</div>
        <div class="module-channel-count"><b>${relays}</b> R&nbsp;&nbsp;<b>${leds}</b> LED&nbsp;&nbsp;<b>${sensors}</b> S${module.environment ? "&nbsp;&nbsp;<b>BME</b>" : ""}</div>
        <time>${esc(seen)}</time>
        <div class="module-row-actions">
          <input aria-label="Anzeigename" data-field="moduleName" value="${esc(module.name || module.id)}" maxlength="80" autocomplete="off">
          <button class="secondary-button" data-action="rename-module" data-module-id="${esc(module.id)}" type="button">Speichern</button>
          <button class="module-delete-button" data-action="delete-module" data-module-id="${esc(module.id)}" type="button" aria-label="Modul löschen">Löschen</button>
        </div>
      </article>
    `;
  }).join("")}</div>` : '<div class="empty-state">Noch keine ESP-Module registriert.</div>';
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
        const control = moduleControlInfo(r.m.id);
        const feedback = commandFeedbackForRelay(r.m.id, r.idx + 1);
        const commandText = commandStatusText(feedback) || (!control.enabled ? control.reason : "");
        const conflict = (state.relayConflicts || []).find((item) => item.module === r.m.id && Number(item.channel) === r.idx + 1);
        const disabled = !control.enabled || feedback?.status === "pending";
        return `
          <article class="relay-item io-channel-card ${!control.enabled ? "control-disabled" : ""} ${feedback?.status ? `command-${feedback.status}` : ""}" data-module-id="${r.m.id}" data-relay-index="${r.idx + 1}">
            <header class="io-channel-head">
              <div class="io-channel-title"><small>Kanal ${String(r.idx + 1).padStart(2, "0")}</small><strong>${esc(cfg.name || `Relais ${r.idx + 1}`)}</strong></div>
              <span class="${r.on ? "badge-on" : "badge-off"}">${r.on ? "AN" : "AUS"}</span>
            </header>

            <label class="io-field"><span>Name</span><input data-field="relayName" value="${esc(cfg.name || "")}" placeholder="z. B. Bahnhof Licht"></label>
            <label class="io-field"><span>Rolle</span><input data-field="relayRole" value="${esc(cfg.role || "")}" placeholder="z. B. Beleuchtung"></label>

            ${conflict ? `<div class="relay-conflict-warning">Mehrfach belegt · ${conflict.assignments?.length || 2} Zuweisungen</div>` : ""}
            ${commandText ? `<div class="command-inline-status status-${feedback?.status || "disabled"}">${esc(commandText)}</div>` : ""}
            <button class="secondary-button io-channel-action" data-action="toggle-relay" type="button" ${disabled ? "disabled" : ""}>
              ${r.on ? "Ausschalten" : "Einschalten"}
            </button>
          </article>
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
          <article class="sensor-item io-channel-card" data-module-id="${esc(r.m.id)}" data-sensor-id="${esc(sensorId)}">
            <header class="io-channel-head">
              <div class="io-channel-title"><small>${esc(r.m.name || r.m.id)} · ${esc(sensorId)}</small><strong>${esc(cfg.name || r.s.name || sensorId)}</strong></div>
              <span class="${r.s.triggered ? "badge-on" : "badge-off"}">${r.s.triggered ? "AKTIV" : "RUHE"}</span>
            </header>
            <label class="io-field"><span>Name</span><input data-field="sensorName" value="${esc(cfg.name || r.s.name || "")}" placeholder="z. B. Einfahrt Gleis 1"></label>
          </article>
        `;
      }).join("")
    : `<div class="sidebar-esp-empty">Keine Sensoren verfügbar.</div>`;
}

function renderLedGrid() {
  const host = byId("ledConfigGrid");
  if (!host) return;

  const availableModules = modules()
    .filter((module) => hasCapability(module, "led") || (Array.isArray(module.leds) && module.leds.length > 0))
    .sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id), "de"));
  if (!availableModules.some((module) => module.id === state.settingsLedModule)) {
    state.settingsLedModule = availableModules[0]?.id || "";
  }
  const selectedModule = availableModules.find((module) => module.id === state.settingsLedModule);
  const leds = Array.isArray(selectedModule?.leds) ? selectedModule.leds : [];
  const colorOptions = [
    ["rot", "Rot"], ["gelb", "Gelb"], ["gruen", "Grün"], ["weiss", "Weiß"],
    ["warmweiss", "Warmweiß"], ["blau", "Blau"], ["orange", "Orange"]
  ];

  host.innerHTML = `
    <div class="settings-module-picker led-module-picker">
      <label for="ledModuleSelect">LED-ESP</label>
      <select id="ledModuleSelect">
        ${availableModules.map((module) => `<option value="${esc(module.id)}" ${module.id === state.settingsLedModule ? "selected" : ""}>${esc(module.name || module.id)} (${module.leds?.length || 0} LEDs)</option>`).join("")}
      </select>
    </div>
    <div class="relay-module-summary">${selectedModule ? `${esc(selectedModule.name || selectedModule.id)} · ${selectedModule.online ? "online" : "offline"} · ${esc(selectedModule.ip || "keine aktuelle IP")}` : "Kein LED-ESP verfügbar"}</div>
    <div class="led-channel-grid">
      ${leds.length ? leds.map((led, idx) => {
        const channel = idx + 1;
        const key = `${selectedModule.id}:${channel}`;
        const saved = state.ledConfig[key] || {};
        const config = {
          name: saved.name || `LED ${channel}`,
          color: saved.color || "weiss",
          brightness: Math.max(0, Math.min(255, Number(saved.brightness ?? 255)))
        };
        state.ledConfig[key] = config;
        const isOn = Boolean(led?.state);
        const control = moduleControlInfo(selectedModule.id);
        const feedback = commandFeedbackForLed(selectedModule.id, channel);
        const commandText = commandStatusText(feedback) || (!control.enabled ? control.reason : "");
        const disabled = !control.enabled || feedback?.status === "pending";
        return `
          <article class="led-channel-card ${!control.enabled ? "control-disabled" : ""} ${feedback?.status ? `command-${feedback.status}` : ""}" data-module-id="${esc(selectedModule.id)}" data-led-index="${channel}">
            <div class="led-channel-head">
              <span class="led-color-dot led-color-${esc(config.color)}"></span>
              <div><strong>${esc(config.name)}</strong><small>Kanal ${channel}</small></div>
              <span class="${isOn ? "badge-on" : "badge-off"}" data-led-status>${led?.blinking ? "BLINKT" : isOn ? "AN" : "AUS"}</span>
            </div>
            <label><span>Name</span><input data-field="ledName" value="${esc(config.name)}" maxlength="64" placeholder="z. B. Signal Rot"></label>
            <label><span>Farbe</span><select data-field="ledColor">${colorOptions.map(([value, label]) => `<option value="${value}" ${config.color === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
            <label class="led-brightness-field"><span>Helligkeit <output>${config.brightness}</output></span><input data-field="ledBrightness" type="range" min="0" max="255" step="1" value="${config.brightness}"></label>
            <div class="led-channel-live">Live: <b>${Number(led?.brightness || 0)}</b> / 255</div>
            ${commandText ? `<div class="command-inline-status status-${feedback?.status || "disabled"}">${esc(commandText)}</div>` : ""}
            <div class="led-channel-actions">
              <button class="secondary-button" data-action="toggle-led" type="button" ${disabled ? "disabled" : ""}>${isOn ? "Ausschalten" : "Einschalten"}</button>
              <button class="secondary-button" data-action="test-led" type="button" ${disabled ? "disabled" : ""}>Blinktest</button>
            </div>
          </article>`;
      }).join("") : `<div class="empty-state relay-empty-state"><strong>${selectedModule ? esc(selectedModule.name || selectedModule.id) : "Kein LED-ESP"} meldet keine LED-Kanäle.</strong><span>Der ESP muss im Heartbeat das Feld „leds“ senden. Nach dem nächsten Heartbeat erscheinen die Kanäle automatisch.</span></div>`}
    </div>`;
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
  if (relayHost && !relayHost.contains(document.activeElement)) renderRelayGrid();

  const ledHost = byId("ledConfigGrid");
  if (ledHost && !ledHost.contains(document.activeElement)) renderLedGrid();
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
  if (view === "rules") renderRulesGrid();
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
    const result = await apiCall("/control/settings", { method: "POST", body: cfg.body });
    const hardware = result?.hardware;
    if (hardware && typeof hardware === "object") {
      state.hardware = { ...(state.hardware || {}), ...hardware, modules: state.hardware?.modules || {} };
      state.settingsPersistedAt = Math.max(Number(state.settingsPersistedAt || 0), Number(hardware.updatedAt || 0));
      if (section === "lights" && Array.isArray(hardware.lightButtons)) {
        state.lightButtons = hardware.lightButtons.map((button, index) => ({
          id: button.id ?? index + 1,
          name: button.name || `Licht ${index + 1}`,
          moduleId: button.module || "",
          relayIndex: Number(button.relay || 0),
          active: false
        }));
      }
    }
    if (!state.settingsDirty) state.settingsDirty = {};
    state.settingsDirty[section] = false;
    if (section === "leds") state.ledConfigDirty = false;
    setSaveStatus(cfg.status, "Gespeichert", "saved");
    if (section === "lights") renderTrackLightButtons();
    if (section === "leds") {
      renderLedGrid();
      document.dispatchEvent(new CustomEvent("dynora:modules-updated"));
    }
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
    if (ev.target.id === "relayModuleSelect") {
      state.settingsRelayModule = ev.target.value;
      renderRelayGrid();
      return;
    }
    if (ev.target.id === "ledModuleSelect") {
      state.settingsLedModule = ev.target.value;
      renderLedGrid();
    }
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
      state.settingsDirty.lights = true;
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
      state.settingsDirty.defaults = true;
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
      state.settingsDirty.relays = true;
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
      state.settingsDirty.sensors = true;
      setSaveStatus("saveSensorStatus", "Ungespeichert");
      return;
    }

    const ledCard = ev.target.closest("[data-module-id][data-led-index]");
    if (ledCard && ["ledName", "ledColor", "ledBrightness"].includes(ev.target.dataset.field)) {
      const moduleId = ledCard.dataset.moduleId;
      const channel = Number(ledCard.dataset.ledIndex);
      const key = `${moduleId}:${channel}`;
      if (!state.ledConfig[key]) state.ledConfig[key] = { name: `LED ${channel}`, color: "weiss", brightness: 255 };
      if (ev.target.dataset.field === "ledName") state.ledConfig[key].name = ev.target.value;
      if (ev.target.dataset.field === "ledColor") state.ledConfig[key].color = ev.target.value;
      if (ev.target.dataset.field === "ledBrightness") {
        state.ledConfig[key].brightness = Number(ev.target.value);
        const output = ledCard.querySelector(".led-brightness-field output");
        if (output) output.textContent = ev.target.value;
      }
      state.ledConfigDirty = true;
      state.settingsDirty.leds = true;
      setSaveStatus("saveLedStatus", "Ungespeichert");
    }
  });

  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    if (btn.id === "emergencyButton") {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.textContent = "STOPP …";
      try {
        const result = await apiCall("/emergency-stop", { method: "POST", body: {} });
        rememberPendingCommands(result);
        renderTrackLayout();
        renderCs3Tiles();
        renderTrackLightButtons();
        renderSidebarEspStatus();
        showToast(`NOT-AUS gesendet · ${Number(result.commands?.length || 0)} ESP-Modul(e) warten auf Bestätigung${result.skippedOffline?.length ? ` · ${result.skippedOffline.length} offline` : ""}`);
      } catch (error) {
        showToast(`NOT-AUS fehlgeschlagen: ${error?.message || error}`, "error");
      } finally {
        btn.disabled = false;
        btn.textContent = "NOT-AUS";
      }
      return;
    }

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

    if (btn.dataset.action === "toggle-led" || btn.dataset.action === "test-led") {
      const card = btn.closest("[data-module-id][data-led-index]");
      const moduleId = card?.dataset.moduleId || "";
      const channel = Number(card?.dataset.ledIndex || 0);
      const module = state.hardware.modules?.[moduleId];
      const led = module?.leds?.[channel - 1];
      if (!moduleId || !channel || !led) return;
      const config = state.ledConfig?.[`${moduleId}:${channel}`] || { brightness: 255 };
      const control = moduleControlInfo(moduleId);
      if (!control.enabled) { showToast(control.reason, "warning"); return; }
      if (commandFeedbackForLed(moduleId, channel)?.status === "pending") { showToast("Schaltvorgang läuft bereits", "warning"); return; }
      btn.disabled = true;
      try {
        const body = btn.dataset.action === "test-led"
          ? { module: moduleId, channel, mode: "blink", onMs: 220, offMs: 220, durationMs: 1800 }
          : { module: moduleId, channel, mode: "pwm", brightness: led.state ? 0 : Math.max(1, Number(config.brightness ?? 255)) };
        const result = await apiCall("/led", { method: "POST", body });
        rememberPendingCommands(result);
        renderLedGrid();
        showToast(`LED ${channel}: Wird geschaltet …`);
      } catch (error) {
        btn.disabled = false;
        showToast(`LED ${channel} konnte nicht gesteuert werden: ${error?.message || error}`, "error");
      }
      return;
    }

    if (btn.dataset.action === "rename-module") {
      const moduleId = btn.dataset.moduleId;
      const card = btn.closest("[data-managed-module]");
      const name = card?.querySelector('[data-field="moduleName"]')?.value.trim() || "";
      if (!moduleId || !name) {
        showToast("Bitte einen ESP-Namen eingeben", "error");
        return;
      }
      btn.disabled = true;
      try {
        const result = await apiCall("/module/rename", {
          method: "POST",
          body: { module: moduleId, name }
        });
        if (state.hardware.modules?.[moduleId]) {
          state.hardware.modules[moduleId].name = result.name;
          state.hardware.modules[moduleId].customName = true;
        }
        renderSettingsTab();
        renderSidebarEspStatus();
        renderCs3Tiles();
        showToast(`ESP heißt jetzt „${result.name}“`);
      } catch (error) {
        btn.disabled = false;
        showToast(`ESP konnte nicht umbenannt werden: ${error?.message || error}`, "error");
      }
      return;
    }

    if (btn.dataset.action === "delete-module") {
      const moduleId = btn.dataset.moduleId;
      const module = state.hardware.modules?.[moduleId];
      if (!moduleId || !module) return;
      const onlineWarning = module.online
        ? "\n\nDieses Modul ist online und erscheint beim nächsten Heartbeat wieder. Schalte den ESP zuerst aus, wenn es dauerhaft wegbleiben soll."
        : "";
      if (!confirm(`ESP-Modul „${module.name || moduleId}“ wirklich löschen?\n\nRelais, LEDs und Sensoren dieses Moduls werden entfernt. Zugewiesene Elemente werden getrennt und betroffene Ereignisse deaktiviert.${onlineWarning}`)) return;
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
        showToast(`Modul gelöscht · ${result.clearedElements || 0} Zuweisungen getrennt · ${result.disabledRules || 0} Ereignisse deaktiviert`);
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
      state.settingsDirty.defaults = true;
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
        state.settingsDirty.defaults = true;
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
      const control = moduleControlInfo(moduleId);
      if (!control.enabled) { showToast(control.reason, "warning"); return; }
      if (commandFeedbackForRelay(moduleId, relayIndex)?.status === "pending") { showToast("Schaltvorgang läuft bereits", "warning"); return; }
      btn.classList.add("busy");
      try {
        const result = await apiCall("/control/relay", {
          method: "POST",
          body: { module: moduleId, channel: relayIndex, state: !isOn }
        });
        rememberPendingCommands(result);
        renderRelayGrid();
        showToast(`Relay ${relayIndex}: Wird geschaltet …`);
      } catch (e) {
        showToast(`Relay konnte nicht geschaltet werden: ${e?.message || e}`, "error");
      } finally {
        btn.classList.remove("busy");
      }
      return;
    }

    if (btn.id === "applyDefaultsButton") {
      try {
        const result = await apiCall("/control/defaults/apply", { method: "POST", body: { defaults: state.defaults || [] } });
        rememberPendingCommands(result);
        showToast("Standardzustände werden geschaltet …");
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
    const control = moduleControlInfo(cfg.moduleId);
    if (!control.enabled) { showToast(control.reason, "warning"); return; }
    if (commandFeedbackForRelay(cfg.moduleId, channel)?.status === "pending") { showToast("Schaltvorgang läuft bereits", "warning"); return; }
    try {
      const result = await apiCall("/control/relay", {
        method: "POST",
        body: {
          module: cfg.moduleId,
          channel,
          state: !cfg.active
        }
      });
      rememberPendingCommands(result);
      renderTrackLightButtons();
    } catch (e) {
      showToast(`Lichtschaltung fehlgeschlagen: ${e?.message || e}`, "error");
    }
  });
}

function bindTrackElementQuickToggle() {
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest(".cs3-tile[data-element-id]");
    if (!btn) return;
    const element = (state.layout?.elemente || []).find((item) => item.id === btn.dataset.elementId);
    if (!element) return;
    const isUncoupler = element.typ === "track" && String(element.trackCode || element.catalogCode || "") === "5112";
    const type = isUncoupler ? "uncoupler" : element.typ === "xtrack" || element.typ === "crossing" ? "xtrack" : element.typ === "ledSignal" || element.typ === "espSignal" ? "espSignal" : element.typ;
    const config = {
      uncoupler: ["/track/control", "pulse"],
      switch: ["/switch/control", element.switchState === "abzweig" ? "gerade" : "abzweig"],
      xtrack: ["/xtrack/control", element.xState === "abzweig" ? "gerade" : "abzweig"],
      signal: ["/signal/control", element.signalState === "fahrt" ? "halt" : "fahrt"],
      espSignal: ["/esp-signal/control", (element.signalAspectMode === "rgy"
        ? ({ halt: "warnung", warnung: "fahrt", fahrt: "halt" })
        : ({ halt: "fahrt", fahrt: "halt", warnung: "halt" }))[element.ledState || element.espState || "halt"] || "halt"]
    }[type];
    if (!config) return;
    const control = moduleControlInfo(element.module);
    if (!control.enabled) { showToast(control.reason, "warning"); return; }
    if (commandFeedbackForElement(element.id)?.status === "pending") { showToast("Schaltvorgang läuft bereits", "warning"); return; }
    btn.classList.add("busy");
    try {
      const result = await apiCall(config[0], { method: "POST", body: { elementId: element.id, state: config[1] } });
      rememberPendingCommands(result);
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
    if (["modules", "lights", "relays", "sensors", "leds", "rules", "defaults"].includes(savedSettingsView)) state.settingsView = savedSettingsView;
  } catch {}
  bindNavigation();
  bindTrackFocusMode();
  bindSettingsInput();
  bindTrackLightsQuickToggle();
  bindTrackElementQuickToggle();
}

document.addEventListener("dynora:modules-updated", () => {
  if (!document.getElementById("page-settings")?.classList.contains("active")) return;
  const content = document.querySelector(".settings-content");
  if (content?.contains(document.activeElement)) return;
  if (Object.values(state.settingsDirty || {}).some(Boolean)) return;
  renderSettingsTab();
});
