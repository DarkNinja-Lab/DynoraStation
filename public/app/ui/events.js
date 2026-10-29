"use strict";

import { setBuilderPanel } from "../builder/panels.js?v=workspace-v11";
import { icon } from "./icons.js?v=workspace-v11";
import { state } from "../core/state.js?v=workspace-v11";
import { apiCall } from "../core/api.js?v=workspace-v11";
import { renderTrackLightButtons } from "../track/lights.js?v=workspace-v12";
import { collapseAllAutomations, renderRulesGrid } from "../rules/rules.js?v=workspace-v18";
import { renderSidebarEspStatus, renderCs3Tiles, renderDashboardOverview } from "./render.js?v=workspace-v11";
import { renderTrackLayout } from "../track/track.js?v=workspace-v15";
import { showToast } from "./toast.js?v=workspace-v15";
import { commandFeedbackForRelay, commandFeedbackForLed, commandFeedbackForElement, commandStatusText, moduleControlInfo, rememberPendingCommands } from "../core/commands.js?v=workspace-v11";
import { esc } from "../core/utils.js?v=workspace-v11";
import { getLanguage, initLanguage, LANGUAGES, setLanguage, t } from "../core/i18n.js?v=workspace-v23";

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

const PAGE_META = {
  dashboard: { title: "page.dashboard.title", subtitle: "page.dashboard.subtitle", section: "page.dashboard.section" },
  track: { title: "page.track.title", subtitle: "page.track.subtitle", section: "page.track.section" },
  settings: { title: "page.settings.title", subtitle: "page.settings.subtitle", section: "page.settings.section" },
  events: { title: "page.events.title", subtitle: "page.events.subtitle", section: "page.events.section" }
};

function setNodeText(selector, text) {
  const node = typeof selector === "string" ? document.querySelector(selector) : selector;
  if (node) node.textContent = text;
}

function updateLanguageToggleButton() {
  const button = byId("languageToggle");
  if (!button) return;
  button.setAttribute("aria-label", t("language.toggle"));
  button.setAttribute("title", t("language.toggle"));
  button.value = getLanguage();
}

function applyCoreTranslations() {
  const navMap = [
    [".nav-button[data-page='dashboard'] .nav-copy b", "nav.dashboard"],
    [".nav-button[data-page='track'] .nav-copy b", "nav.track"],
    [".nav-button[data-page='builder'] .nav-copy b", "nav.builder"],
    [".nav-button[data-page='settings'] .nav-copy b", "nav.settings"],
    [".nav-button[data-page='events'] .nav-copy b", "nav.events"],
    ["#openHelpDialog .nav-copy b", "nav.help"],
    [".mobile-nav-button[data-page-link='dashboard'] small", "nav.dashboard"],
    [".mobile-nav-button[data-page-link='track'] small", "nav.track"],
    [".mobile-nav-button[data-page-link='builder'] small", "nav.builder"],
    [".mobile-nav-button[data-page-link='settings'] small", "nav.settings"],
    [".mobile-nav-button[data-page-link='events'] small", "nav.events"]
  ];
  navMap.forEach(([selector, key]) => setNodeText(selector, t(key)));

  const mobileAriaMap = [
    [".mobile-nav-button[data-page-link='dashboard']", "mobile.dashboard.open"],
    [".mobile-nav-button[data-page-link='track']", "mobile.track.open"],
    [".mobile-nav-button[data-page-link='builder']", "mobile.builder.open"],
    [".mobile-nav-button[data-page-link='settings']", "mobile.settings.open"],
    [".mobile-nav-button[data-page-link='events']", "mobile.events.open"]
  ];
  mobileAriaMap.forEach(([selector, key]) => {
    const button = document.querySelector(selector);
    if (button) button.setAttribute("aria-label", t(key));
  });

  setNodeText("#emergencyButton span", t("button.emergency"));
  setNodeText("#mobileMenuButton .drawer-desktop-label", t("button.deviceCenter"));
  updateLanguageToggleButton();
}

if (!state.relayConfig || typeof state.relayConfig !== "object") state.relayConfig = {};
if (!state.sensorConfig || typeof state.sensorConfig !== "object") state.sensorConfig = {};
if (!Array.isArray(state.defaults)) state.defaults = [];

function setPageHeader(page) {
  const meta = PAGE_META[page] || PAGE_META.dashboard;
  const title = byId("pageTitle");
  const subtitle = byId("pageSubtitle");
  const section = byId("topbarSection");
  if (title) title.textContent = window?.dynoraEditMode === "true" ? t("page.builder.title") : t(meta.title);
  if (subtitle) subtitle.textContent = window?.dynoraEditMode === "true" ? t("page.builder.subtitle") : t(meta.subtitle);
  if (section) section.textContent = window?.dynoraEditMode === "true" ? t("page.builder.section") : t(meta.section);
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
      window.dynoraEditMode = "true";
      if (title) title.textContent = t("page.builder.title");
      if (subtitle) subtitle.textContent = t("page.builder.subtitle");
      if (section) section.textContent = t("page.builder.section");
      document.dispatchEvent(new CustomEvent("dynora:builder-opened"));
      requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    } else {
      window.dynoraEditMode = "false";
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
    btn.classList.toggle("active", btn.dataset.page === (editRequested ? "builder" : targetMeta));
  });

  all(".page").forEach((p) => {
    p.classList.toggle("active", p.id === `page-${targetMeta}`);
  });

  setPageHeader(targetMeta);
  all(".mobile-nav-button[data-page-link]").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.pageLink === (editRequested ? "builder" : targetMeta));
  });

  if (targetMeta === "settings") {
    state.settingsView = "overview";
    renderSettingsTab();
  }
  if (targetMeta === "track") setTrackWorkspaceMode(editRequested ? "edit" : "operate");
  else {
    window.dynoraEditMode = "false";
    document.body.classList.remove("track-edit-mode");
  }

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
      sidebar.toggleAttribute("inert", !open);
      sidebar.setAttribute("aria-hidden",String(!open));
      if (open) sidebar.querySelector(".drawer-close")?.focus();
      else mobileBtn.focus();
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
      const requested = btn.dataset.builderPanel;
      const panel = builderLayout?.dataset.panel === requested ? "canvas" : requested;
      setBuilderPanel(panel);
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
    if (label) label.textContent = active ? t("track.focus.disable") : t("track.focus.enable");
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
      icon: "light",
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

  const lightIcons = [["light", "Lampe"], ["signal", "Signal"], ["transformer", "Trafo"], ["power", "Strom"], ["home", "Haus"], ["device", "Modul"], ["events", "Ablauf"], ["track-straight", "Gleis"]];
  host.innerHTML = state.lightButtons.map((b, i) => `
    <div class="light-config-card" data-light-index="${i}">
      <header class="light-config-card-head"><span class="light-icon-preview">${icon(b.icon || "light")}</span><div><small>LICHTTASTE ${String(i + 1).padStart(2, "0")}</small><h4>${esc(b.name || `Licht ${i + 1}`)}</h4></div></header>
      <label><span>Name</span><input data-field="name" value="${esc(b.name || `Licht ${i + 1}`)}"></label>
      <label><span>Symbol</span><select data-field="icon">${lightIcons.map(([value, label]) => `<option value="${value}" ${value === (b.icon || "light") ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label><span>Modul</span><select data-field="moduleId">${modOptions(b.moduleId || "")}</select></label>
      <label><span>Relay</span><select data-field="relayIndex">${relayOptions(Number(b.relayIndex || 0), b.moduleId || "")}</select></label>
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
  const onlineCount = list.filter((module) => module.online).length;
  const warningCount = list.filter((module) => module.health?.relayDriverReady === false || module.compatibility?.compatible === false).length;
  const opened = new Set([...host.querySelectorAll("details[open]")].map(item => item.dataset.managedModule));
  host.innerHTML = list.length ? `<div class="module-management-overview"><div><span>VERBINDUNGEN</span><strong>${onlineCount} <small>/ ${list.length} online</small></strong></div><div><span>PR\u00dcFEN</span><strong>${warningCount}</strong></div><p>Modul aufklappen, um Namen, Anschl\u00fcsse oder Firmware zu verwalten.</p></div><div class="module-management-list">${list.map(module => {
    const relays = module.relays?.length || 0;
    const leds = module.leds?.length || 0;
    const sensors = module.sensors?.length || 0;
    const problem = module.health?.relayDriverReady === false ? "MCP23017 nicht erreichbar" : module.compatibility?.compatible === false ? module.compatibility.reason || "Inkompatible Firmware" : "";
    const label = !module.online ? "Offline" : problem ? "Prüfen" : "Online";
    return `<details class="module-settings-card" data-managed-module="${esc(module.id)}" ${opened.has(module.id) ? "open" : ""}>
      <summary><span class="module-status-dot ${module.online && !problem ? "online" : "offline"}"></span><span class="module-card-title"><strong>${esc(module.name || module.id)}</strong><small>${relays} Relais · ${leds} LEDs · ${sensors} Sensoren</small></span><span class="module-card-state">${label}</span><span class="module-chevron" aria-hidden="true">⌄</span></summary>
      <div class="module-settings-body">
        ${problem ? `<p class="module-problem">${esc(problem)}</p>` : ""}
        <div class="module-name-row"><label><span>Anzeigename</span><input data-field="moduleName" value="${esc(module.name || module.id)}" maxlength="80" autocomplete="off"></label><button class="primary-button" data-action="rename-module" data-module-id="${esc(module.id)}" type="button">Speichern</button></div>
        <div class="module-channel-links">
          ${relays ? `<button type="button" class="secondary-button" data-settings-view="relays" data-module-id="${esc(module.id)}">Relais einrichten →</button>` : ""}
          ${leds ? `<button type="button" class="secondary-button" data-settings-view="leds" data-module-id="${esc(module.id)}">LEDs einrichten →</button>` : ""}
          ${sensors ? `<button type="button" class="secondary-button" data-settings-view="sensors">Sensoren ansehen →</button>` : ""}
          <button type="button" class="secondary-button" data-action="ota-firmware" data-module-id="${esc(module.id)}" ${module.online && module.hardwareType ? "" : "disabled"}>Firmware per OTA aktualisieren</button>
        </div>
        <dl class="module-tech-details"><div><dt>Modul-ID</dt><dd>${esc(module.id)}</dd></div><div><dt>IP-Adresse</dt><dd>${esc(module.ip || "Nicht verfügbar")}</dd></div><div><dt>Firmware</dt><dd>${esc(module.firmwareVersion || "Unbekannt")} · Protokoll ${esc(module.protocolVersion ?? "?")}</dd></div><div><dt>Hardware</dt><dd>${esc(module.hardwareType || module.type || "ESP-Modul")}</dd></div></dl>
        <details class="module-remove"><summary>Modul entfernen</summary><p>Ein eingeschalteter ESP meldet sich erneut an. Zum dauerhaften Entfernen zuerst ausschalten.</p><button class="module-delete-button" data-action="delete-module" data-module-id="${esc(module.id)}" type="button">Modul löschen</button></details>
      </div></details>`;
  }).join("")}</div>` : '<div class="settings-empty"><strong>Noch kein Modul verbunden</strong><p>Schalte deinen ESP ein und verbinde ihn mit demselben Netzwerk. Erkannte Module erscheinen hier automatisch.</p></div>';

}

const selectedDefaultIndices = new Set();
const expandedDefaultGroups = new Set();
function renderDefaultStates() {
  const host = byId("defaultStateGrid");
  if (!host) return;
  if (!Array.isArray(state.defaults)) state.defaults = [];
  const search = String(byId("defaultSearch")?.value || "").trim().toLocaleLowerCase("de-DE");
  const visibleDefaults = state.defaults.map((item, index) => ({ item, index })).filter(({ item }) => !search || `${item.groupName || ""} ${item.targetType} ${item.targetId} ${item.action}`.toLocaleLowerCase("de-DE").includes(search));
  const selectAll = byId("defaultSelectVisible");
  if (selectAll) { selectAll.checked = visibleDefaults.length > 0 && visibleDefaults.every(({ index }) => selectedDefaultIndices.has(index)); selectAll.indeterminate = visibleDefaults.some(({ index }) => selectedDefaultIndices.has(index)) && !selectAll.checked; }
  const count = byId("defaultSelectionCount");
  if (count) count.textContent = `${selectedDefaultIndices.size} ausgewählt`;
  const deleteSelected = byId("deleteSelectedDefaults");
  if (deleteSelected) deleteSelected.disabled = selectedDefaultIndices.size === 0;

  host.innerHTML = `
    <div class="rules-head">
      <div class="builder-message">Startzustände werden beim Verbinden des passenden ESP gesetzt.</div>
      <button type="button" class="primary-button" data-action="add-default">+ Zustand</button>
    </div>
    <div class="rules-cards">
      ${visibleDefaults.map(({ item: d, index: i }) => `
        <div class="rule-card ${selectedDefaultIndices.has(i) ? "selected" : ""}" data-default-index="${i}">
          <label class="collection-item-select"><input type="checkbox" data-select-default="${i}" ${selectedDefaultIndices.has(i) ? "checked" : ""}> Auswählen</label>
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
      `).join("") || `<div class="sidebar-esp-empty">${search ? "Keine passende Grundstellung gefunden." : "Keine Standardzustände konfiguriert."}</div>`}
    </div>
  `;
  const cardContainer = host.querySelector(".rules-cards");
  const stateCards = [...host.querySelectorAll(".rule-card[data-default-index]")];
  const groupToolbar = host.querySelector(".rules-head");
  if (groupToolbar) {
    const addGroup = document.createElement("button");
    addGroup.type = "button";
    addGroup.className = "secondary-button";
    addGroup.dataset.action = "add-default-group";
    addGroup.innerHTML = `${icon("plus")} Gruppe anlegen`;
    groupToolbar.append(addGroup);
  }
  if (cardContainer && stateCards.length) {
    cardContainer.className = "default-group-list";
    const groups = new Map();
    stateCards.forEach((card) => {
      const entry = state.defaults[Number(card.dataset.defaultIndex)];
      const name = String(entry?.groupName || "").trim();
      const key = name || "__ungrouped__";
      if (!groups.has(key)) groups.set(key, { name, cards: [] });
      groups.get(key).cards.push(card);
      const typeLabel = [...card.querySelectorAll("label")].find((label) => label.textContent.trim() === "Typ");
      const groupLabel = document.createElement("label");
      groupLabel.className = "default-state-group-field";
      const groupCaption = document.createElement("span"); groupCaption.textContent = "Gruppe";
      const groupInput = document.createElement("input");
      groupInput.type = "text"; groupInput.maxLength = 48; groupInput.value = name;
      groupInput.placeholder = "Ohne Gruppe"; groupInput.setAttribute("list", "defaultGroupNames"); groupInput.dataset.field = "groupName";
      groupLabel.append(groupCaption, groupInput);
      if (typeLabel) card.insertBefore(groupLabel, typeLabel);
      [...card.querySelectorAll("label")].filter((label) => ["Typ", "Ziel", "Aktion"].includes(label.textContent.trim())).forEach((label) => {
        const control = label.nextElementSibling;
        if (!control || !["SELECT", "INPUT"].includes(control.tagName)) return;
        const field = document.createElement("label"); field.className = "default-state-field";
        const caption = document.createElement("span"); caption.textContent = label.textContent.trim();
        field.append(caption, control); card.insertBefore(field, label); label.remove();
      });
    });
    const groupNames = [...new Set(state.defaults.map((item) => String(item.groupName || "").trim()).filter(Boolean))];
    const names = document.createElement("datalist"); names.id = "defaultGroupNames";
    groupNames.forEach((name) => { const option = document.createElement("option"); option.value = name; names.append(option); });
    host.append(names);
    for (const [key, group] of groups) {
      const details = document.createElement("details");
      details.className = "default-group";
      details.dataset.defaultGroup = key;
      details.open = expandedDefaultGroups.has(key);
      const summary = document.createElement("summary");
      const title = document.createElement("strong"); title.textContent = group.name || "Ohne Gruppe";
      const countLabel = document.createElement("span"); countLabel.className = "default-group-count";
      countLabel.textContent = `${group.cards.length} ${group.cards.length === 1 ? "Zustand" : "Zust\u00e4nde"}`;
      summary.append(title, countLabel);
      const chevron = document.createElement("span"); chevron.className = "default-group-chevron"; chevron.innerHTML = icon("chevron-down"); summary.append(chevron);
      details.append(summary);
      const actions = document.createElement("div"); actions.className = "default-group-actions";
      const addState = document.createElement("button"); addState.type = "button"; addState.className = "secondary-button"; addState.dataset.action = "add-default-to-group"; addState.dataset.groupName = group.name; addState.innerHTML = `${icon("plus")} Zustand`;
      actions.append(addState);
      if (group.name) {
        const rename = document.createElement("button"); rename.type = "button"; rename.className = "text-button"; rename.dataset.action = "rename-default-group"; rename.dataset.groupName = group.name; rename.textContent = "Umbenennen"; actions.append(rename);
      }
      details.append(actions, ...group.cards);
      cardContainer.append(details);
      details.addEventListener("toggle", () => details.open ? expandedDefaultGroups.add(key) : expandedDefaultGroups.delete(key));
    }
  }
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
    <div class="relay-module-summary">${selectedModule ? `${esc(selectedModule.name || selectedModule.id)} · ${selectedModule.online ? "online" : "offline"} · ${esc(selectedModule.ip || "keine aktuelle IP")}` : "Kein Relay-Modul verfügbar"}</div>
    <div class="relay-module-grid">
    ${rows.length ? rows.map((r) => {
        const key = `${r.m.id}:${r.idx + 1}`;
        const cfg = state.relayConfig[key] || {};
        const linkedLights = (state.lightButtons || []).filter((button) => String(button.moduleId || button.module || "") === String(r.m.id) && Number(button.relayIndex ?? button.relay ?? 0) === r.idx + 1);
        const control = moduleControlInfo(r.m.id);
        const feedback = commandFeedbackForRelay(r.m.id, r.idx + 1);
        const commandText = commandStatusText(feedback) || (!control.enabled ? control.reason : "");
        const conflict = (state.relayConflicts || []).find((item) => item.module === r.m.id && Number(item.channel) === r.idx + 1);
        const disabled = !control.enabled || feedback?.status === "pending";
        return `
          <article class="relay-item io-channel-card ${!control.enabled ? "control-disabled" : ""} ${feedback?.status ? `command-${feedback.status}` : ""}" data-module-id="${esc(r.m.id)}" data-relay-index="${r.idx + 1}">
            <header class="io-channel-head">
              <div class="io-channel-title"><small>Kanal ${String(r.idx + 1).padStart(2, "0")}</small><strong>${esc(cfg.name || `Relais ${r.idx + 1}`)}</strong></div>
              <span class="${r.on ? "badge-on" : "badge-off"}">${r.on ? "AN" : "AUS"}</span>
            </header>
            ${linkedLights.length ? `<div class="relay-light-assignment" aria-label="Zugeordnete Lichttasten">${linkedLights.map((button) => `<span>${icon(button.icon || "light")}<span>${esc(button.name || "Lichttaste")}</span></span>`).join("")}</div>` : ""}


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
  if (sensorHost && state.settingsView === "sensors") {
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
  if (state.settingsView === "relays" && relayHost && !relayHost.contains(document.activeElement)) renderRelayGrid();

  const ledHost = byId("ledConfigGrid");
  if (state.settingsView === "leds" && ledHost && !ledHost.contains(document.activeElement)) renderLedGrid();
  renderStationControlStatus();
}

function formatUptime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days} T ${hours} Std`;
  if (hours > 0) return `${hours} Std ${minutes} Min`;
  return `${minutes} Min`;
}

function renderStationControlStatus() {
  const status = byId("stationProcessStatus");
  const detail = byId("stationRuntimeDetail");
  const version = byId("stationVersion");
  const address = byId("stationAddress");
  const station = state.stationStatus || {};
  const managerLabel = ({ docker: "Docker / Unraid", systemd: "systemd", windows: "Windows-Aufgabe", process: "Direktstart" })[station.managedBy] || "Prozess";
  const uptime = Number(station.uptimeSec ?? state.serverUptimeSec) || 0;
  if (status) status.textContent = station.state === "restart" ? "Startet neu …" : station.state === "shutdown" ? "Wird beendet …" : "Läuft";
  if (detail) detail.textContent = `Laufzeit ${formatUptime(uptime)}${Number(station.pid) > 0 ? ` · PID ${station.pid}` : ""} · ${managerLabel}`;
  if (version) version.textContent = state.stationReleaseVersion || (state.serverVersion ? `v${state.serverVersion}` : "–");
  if (address) {
    const host = Array.isArray(state.connection?.lanAddresses) && state.connection.lanAddresses.length
      ? state.connection.lanAddresses[0]
      : window.location.hostname;
    address.textContent = `${host}:${state.connection?.port || window.location.port || 8181}`;
  }
  const shutdownButton = document.querySelector('[data-station-action="shutdown"]');
  const dockerManaged = station.managedBy === "docker";
  if (shutdownButton) {
    shutdownButton.disabled = dockerManaged;
    shutdownButton.title = dockerManaged ? "Container in Unraid stoppen" : "DynoraStation beenden";
  }
  const stationNote = document.querySelector("[data-station-note]");
  if (stationNote) stationNote.textContent = dockerManaged
    ? "Docker verwaltet den Prozess. Neustart startet den Container über die Docker-Richtlinie neu. Zum Beenden den Container in der Unraid Docker-UI stoppen."
    : "Nach „Station beenden“ ist die Weboberfläche nicht mehr erreichbar, bis DynoraStation extern wieder gestartet wird.";

  // Nach einem erfolgreichen Restart bleibt die Seite offen. Sobald ein neuer
  // Serverprozess erkannt wurde, wird der Restart-Button wieder freigegeben.
  const restartButton = document.querySelector('[data-station-action="restart"]');
  if (restartButton?.dataset.stationPending === "restart") {
    const previousPid = Number(restartButton.dataset.previousPid || 0);
    const previousUptime = Number(restartButton.dataset.previousUptime || 0);
    const currentPid = Number(station.pid || 0);
    const restarted = (previousPid > 0 && currentPid > 0 && currentPid !== previousPid) ||
      (previousUptime > 2 && uptime + 2 < previousUptime);
    if (restarted) {
      restartButton.disabled = false;
      restartButton.textContent = t("button.restart");
      delete restartButton.dataset.stationPending;
      delete restartButton.dataset.previousPid;
      delete restartButton.dataset.previousUptime;
      showToast("DynoraStation ist wieder online");
    }
  }
}

const SETTINGS_SECTIONS = {
  overview: "Alle Einstellungen", modules: "Module", updates: "ESP-Firmware", "station-updates": "DynoraStation-Updates", lights: "Lichttasten", relays: "Relais",
  sensors: "Sensoren", leds: "LEDs & Signale", rules: "Automationen", defaults: "Grundstellung", station: "Server & Neustart"
};

let lastRenderedSettingsView = "";
let otaServerConfig = null;
let otaServerConfigRequest = null;
let stationUpdateRequest = null;

async function refreshStationUpdateStatus({ force = false } = {}) {
  if (stationUpdateRequest) return stationUpdateRequest;
  stationUpdateRequest = fetch(`/api/update/status${force ? "?refresh=1" : ""}`, { cache: "no-store" }).then(async response => {
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || "Versionsprüfung fehlgeschlagen.");
    const local = byId("stationLocalVersion");
    const remote = byId("stationRemoteVersion");
    const heading = byId("stationUpdateState");
    const details = byId("stationUpdateDetails");
    const instructions = byId("stationUpdateInstructions");
    const dashboardLabel = byId("dashboardUpdateLabel");
    const dashboardVersion = byId("dashboardUpdateVersion");
    if (local) local.textContent = data.localVersion || "–";
    state.stationReleaseVersion = data.localVersion || "";
    renderStationControlStatus();
    if (remote) remote.textContent = data.remoteVersion || "Nicht erreichbar";
    if (heading) heading.textContent = data.checkError ? "GitHub-Prüfung nicht möglich" : data.updateAvailable ? "Update verfügbar" : "DynoraStation ist aktuell";
    if (details) details.textContent = data.checkError || `Zuletzt geprüft: ${new Date(data.checkedAt).toLocaleString(getLocale())}`;
    if (dashboardLabel) dashboardLabel.textContent = data.checkError ? "Prüfung fehlgeschlagen" : data.updateAvailable ? "Update verfügbar" : "Aktuell";
    if (dashboardVersion) dashboardVersion.textContent = data.checkError ? "GitHub momentan nicht erreichbar" : `Installiert ${data.localVersion} · main ${data.remoteVersion}`;
    const dashboard = byId("dashboardUpdateStatus");
    dashboard?.classList.toggle("update-available", Boolean(data.updateAvailable));
    dashboard?.classList.toggle("update-current", !data.updateAvailable && !data.checkError);
    if (instructions) {
      instructions.hidden = !data.updateAvailable;
      if (data.updateAvailable) {
        const guidance = data.managedBy === "docker"
          ? "Docker aktualisiert sich nicht aus dem Container heraus. Im Compose-Projektordner auf dem Docker-Host den Quellstand aktualisieren und den Dienst neu bauen: git pull origin main && docker compose up -d --build. Bei einem Image-Setup stattdessen das konfigurierte Image aktualisieren und den Container neu erstellen."
          : data.managedBy === "systemd"
            ? "Auf dem Linux-Host den installierten Updater ausführen: sudo dynora-update. Er lädt main, sichert die Installation und prüft den Neustart."
            : data.managedBy === "windows"
              ? "Auf dem Windows-Rechner den DynoraStation-Installer mit „update“ ausführen. Der Installer aktualisiert aus main und erstellt zuvor ein Backup."
              : "Das Update kommt aus dem main-Zweig. Nutze den Installer passend zu deiner Installation; bei einem direkten Start müssen Programmdateien und Abhängigkeiten auf dem Host aktualisiert und der Prozess neu gestartet werden.";
        instructions.textContent = guidance;
      }
    }
    return data;
  }).catch(error => {
    const heading = byId("stationUpdateState");
    const details = byId("stationUpdateDetails");
    const label = byId("dashboardUpdateLabel");
    if (heading) heading.textContent = "Versionsprüfung fehlgeschlagen";
    if (details) details.textContent = error.message || "GitHub ist nicht erreichbar.";
    if (label) label.textContent = "Prüfung fehlgeschlagen";
  }).finally(() => { stationUpdateRequest = null; });
  return stationUpdateRequest;
}

async function refreshOtaServerConfig() {
  if (otaServerConfigRequest) return otaServerConfigRequest;
  otaServerConfigRequest = fetch("/api/ota/config-status", { cache: "no-store" })
    .then(async response => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `${response.status} ${response.statusText}`);
      otaServerConfig = data;
      return data;
    })
    .catch(() => { otaServerConfig = { enabled: false }; return otaServerConfig; })
    .finally(() => { otaServerConfigRequest = null; renderFirmwareUpdates(); });
  return otaServerConfigRequest;
}

function collectFirmwareConnectionSettings() {
  const wifiSsid = String(byId("wifiSsidInput")?.value || "");
  const wifiPassword = String(byId("wifiPasswordInput")?.value || "");
  const serverHost = String(byId("stationHostInput")?.value || "").trim();
  const serverPort = Number(byId("stationPortInput")?.value);
  if (!wifiSsid || wifiSsid.length > 32 || /[\u0000-\u001f\u007f]/.test(wifiSsid)) throw new Error("Der WLAN-Name muss 1 bis 32 Zeichen lang sein.");
  if ((wifiPassword && wifiPassword.length < 8) || wifiPassword.length > 63 || /[\u0000-\u001f\u007f]/.test(wifiPassword)) throw new Error("Das WLAN-Passwort muss leer oder 8 bis 63 Zeichen lang sein.");
  if (!/^[A-Za-z0-9.-]{1,253}$/.test(serverHost) || serverHost.startsWith(".") || serverHost.endsWith(".") || serverHost.includes("..") || serverHost.toLowerCase() === "localhost") throw new Error("Trage die IP-Adresse oder den Hostnamen des Servers ein, nicht localhost.");
  if (!Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65535) throw new Error("Der Stations-Port muss zwischen 1 und 65535 liegen.");
  return { wifiSsid, wifiPassword, serverHost, serverPort };
}

function updateManualFirmwareButton() {
  const button = byId("uploadBinButton");
  if (!button) return;
  const file = byId("firmwareBinInput")?.files?.[0];
  const version = String(byId("firmwareBinVersion")?.value || "").trim();
  button.disabled = !otaServerConfig?.enabled || !file || file.size < 8 || file.size > 2 * 1024 * 1024 || !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,39}$/.test(version);
}

function renderFirmwareUpdates() {
  const select = byId("otaModuleSelect");
  if (!select) return;
  const modules = Object.values(state.hardware?.modules || {}).filter(module => ["ESP8266_NODEMCU_LED_DIRECT", "ESP8266_NODEMCU_MCP23017_BME280"].includes(module.hardwareType));
  const selected = select.value || state.selectedOtaModule || "";
  select.innerHTML = modules.map(module => `<option value="${esc(module.id)}">${esc(module.name || module.id)} · ${module.online ? "online" : "offline"}</option>`).join("");
  if (modules.some(module => module.id === selected)) select.value = selected;
  else if (modules.length) select.value = modules[0].id;
  const current = modules.find(module => module.id === select.value);
  if (current) state.selectedOtaModule = current.id;
  const build = current ? state.firmwareBuilds?.[current.hardwareType] : null;
  const buildButton = byId("buildFirmwareButton");
  const upload = byId("uploadFirmwareButton");
  if (buildButton) buildButton.disabled = !current || !otaServerConfig?.enabled || build?.status === "building";
  if (upload) upload.disabled = !current?.online || build?.status !== "ready" || !otaServerConfig?.enabled;
  const status = byId("firmwareUpdateStatus");
  if (status && current && build) status.textContent = build.error || build.message || `Firmwarestatus: ${build.status}`;
  if (status && current && !build) status.textContent = "WLAN und Stationsadresse eintragen; danach Firmware bauen oder eine BIN bereitstellen.";
  if (status && !current) status.textContent = "Verbinde zuerst einen unterstützten ESP8266 oder prüfe seine Hardwareangabe.";
  const readiness = byId("otaServerReadiness");
  const keyState = byId("otaServerKeyState");
  if (readiness) {
    readiness.textContent = otaServerConfig === null ? "OTA-Konfiguration wird geprüft …" : otaServerConfig.enabled ? "Server-OTA-Schlüssel ist eingerichtet. Firmware kann erstellt und geprüft werden." : "OTA ist noch nicht eingerichtet. Setze OTA_SHARED_SECRET (mindestens 24 Zeichen) in der Server-/Compose-Konfiguration und starte DynoraStation neu.";
    readiness.classList.toggle("ready", Boolean(otaServerConfig?.enabled));
    readiness.classList.toggle("warning", otaServerConfig?.enabled === false);
  }
  if (keyState) keyState.textContent = otaServerConfig?.enabled ? "auf dem Server eingerichtet" : "auf dem Server nicht eingerichtet";
  const downloadSketch = byId("downloadUsbSketchButton");
  if (downloadSketch) downloadSketch.disabled = !current || !otaServerConfig?.enabled || String(byId("otaKeyInput")?.value || "").length < 24;
  updateManualFirmwareButton();
  if (current && !build) refreshFirmwareBuild(current.hardwareType).catch(() => {});
  const progress = byId("firmwareProgress");
  if (progress) progress.value = build?.progress || 0;
  if (!otaServerConfig && !otaServerConfigRequest) refreshOtaServerConfig();
}

async function refreshFirmwareBuild(hardwareType) {
  const response = await fetch(`/api/ota/build-status?hardwareType=${encodeURIComponent(hardwareType)}`, { cache: "no-store" });
  const build = await response.json();
  state.firmwareBuilds ||= {};
  state.firmwareBuilds[hardwareType] = build;
  renderFirmwareUpdates();
  return build;
}

function replaceFirmwareStringConstant(source, name, value) {
  if (/[\u0000-\u001f\u007f]/.test(value)) throw new Error(`${name} darf keine Steuerzeichen enthalten.`);
  const pattern = new RegExp(`(const char\\s*\\*\\s*${name}\\s*=\\s*)"[^"\\r\\n]*";`);
  if (!pattern.test(source)) throw new Error(`Die Quelltextvorlage enthält das Feld ${name} nicht.`);
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return source.replace(pattern, (_match, prefix) => `${prefix}"${escaped}";`);
}

function replaceFirmwarePort(source, port) {
  const pattern = /(const uint16_t\s+SERVER_PORT\s*=\s*)\d+;/;
  if (!pattern.test(source)) throw new Error("Die Quelltextvorlage enthält keinen Stations-Port.");
  return source.replace(pattern, (_match, prefix) => `${prefix}${port};`);
}

function downloadTextFile(filename, contents) {
  const url = URL.createObjectURL(new Blob([contents], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadConfiguredUsbSketch() {
  const module = state.hardware?.modules?.[byId("otaModuleSelect")?.value || ""];
  if (!module || !otaServerConfig?.enabled) throw new Error("Wähle ein unterstütztes Modul und richte den Server-OTA-Schlüssel ein.");
  const configuration = collectFirmwareConnectionSettings();
  const secret = String(byId("otaKeyInput")?.value || "");
  if (secret.length < 24 || /[\u0000-\u001f\u007f]/.test(secret)) throw new Error("Der OTA-Schlüssel muss mindestens 24 Zeichen lang sein.");
  const response = await fetch(`/api/ota/sketch-template?hardwareType=${encodeURIComponent(module.hardwareType)}`, { cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Quelltextvorlage konnte nicht geladen werden.");
  }
  let source = await response.text();
  const firmwareVersion = `usb-${Date.now()}`;
  for (const [key, value] of Object.entries({
    WIFI_SSID: configuration.wifiSsid,
    WIFI_PASS: configuration.wifiPassword,
    SERVER_HOST: configuration.serverHost,
    OTA_SHARED_SECRET: secret,
    FIRMWARE_VERSION: firmwareVersion
  })) source = replaceFirmwareStringConstant(source, key, value);
  source = replaceFirmwarePort(source, configuration.serverPort);
  const sketchName = module.hardwareType === "ESP8266_NODEMCU_LED_DIRECT" ? "led_signalleuchten" : "relays_und_sensoren";
  downloadTextFile(`${sketchName}-konfiguriert.ino`, source);
  byId("otaKeyInput").value = "";
  showToast("Konfigurierte .ino-Datei geladen. Der OTA-Schlüssel blieb im Browser.");
}

export function renderSettingsTab() {
  const renderers = {
    modules: renderModuleManagement, updates: renderFirmwareUpdates, "station-updates": refreshStationUpdateStatus, lights: renderLightConfig, defaults: renderDefaultStates,
    relays: renderRelayGrid, sensors: renderSensorGrid, leds: renderLedGrid,
    station: renderStationControlStatus, rules: renderRulesGrid
  };
  if (!Object.hasOwn(SETTINGS_SECTIONS, state.settingsView)) state.settingsView = "overview";
  if (state.settingsView !== lastRenderedSettingsView) {
    if (state.settingsView === "defaults") expandedDefaultGroups.clear();
    lastRenderedSettingsView = state.settingsView;
  }
  renderers[state.settingsView]?.();
  applySettingsView();
}

function applySettingsView() {
  const view = state.settingsView || "overview";
  all("[data-settings-view]").forEach(button => button.classList.toggle("active", button.dataset.settingsView === view));
  all("[data-settings-section]").forEach(section => {
    const active = section.dataset.settingsSection === view;
    section.classList.toggle("active", active);
    section.hidden = !active;
  });
  const breadcrumb = byId("settingsBreadcrumb");
  if (breadcrumb) breadcrumb.hidden = view === "overview";
  const title = byId("settingsCurrentSection");
  if (title) title.textContent = SETTINGS_SECTIONS[view];
  const heading = document.querySelector(".hardware-center-head");
  if (heading) heading.hidden = view !== "overview";
  const content = document.querySelector(".settings-content");
  if (content) content.dataset.view = view;
}

function setSaveStatus(id, text, kind = "") {
  const el = byId(id);
  if (!el) return;
  el.textContent = text;
  el.className = `save-status ${kind}`.trim();
  if (text) setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 2200);
}

const savingSections = new Set();
async function saveSettingsSection(section) {
  if (savingSections.has(section)) return;
  const map = {
    lights: { body: { lightButtons: state.lightButtons }, status: "saveLightStatus", label: "Licht-Buttons" },
    defaults: { body: { defaults: state.defaults || [] }, status: "saveDefaultsStatus", label: "Standardzustände" },
    relays: { body: { relayConfig: state.relayConfig || {} }, status: "saveRelayStatus", label: "Relais" },
    sensors: { body: { sensorConfig: state.sensorConfig || {} }, status: "saveSensorStatus", label: "Sensoren" },
    leds: { body: { ledConfig: state.ledConfig || {} }, status: "saveLedStatus", label: "LEDs" }
  };
  const cfg = map[section];
  if (!cfg) return;
  const snapshot = JSON.stringify(cfg.body);
  savingSections.add(section);
  setSaveStatus(cfg.status, "Speichert …");
  try {
    const result = await apiCall("/control/settings", { method: "POST", body: snapshot });
    const changedDuringSave = JSON.stringify(cfg.body) !== snapshot;
    const hardware = result?.hardware;
    if (hardware && typeof hardware === "object") {
      state.hardware = { ...(state.hardware || {}), ...hardware, modules: state.hardware?.modules || {} };
      state.settingsPersistedAt = Math.max(Number(state.settingsPersistedAt || 0), Number(hardware.updatedAt || 0));
      if (!changedDuringSave && section === "lights" && Array.isArray(hardware.lightButtons)) {
        state.lightButtons = hardware.lightButtons.map((button, index) => ({
          id: button.id ?? index + 1,
          name: button.name || `Licht ${index + 1}`,
          icon: button.icon || "light",
          moduleId: button.module || "",
          relayIndex: Number(button.relay || 0),
          active: false
        }));
      }
    }
    if (!state.settingsDirty) state.settingsDirty = {};
    state.settingsDirty[section] = changedDuringSave;
    if (section === "leds") state.ledConfigDirty = changedDuringSave;
    setSaveStatus(cfg.status, changedDuringSave ? "Weitere Änderungen ungespeichert" : "Gespeichert", changedDuringSave ? "" : "saved");
    if (section === "lights") renderTrackLightButtons();
    if (section === "leds") {
      renderLedGrid();
      document.dispatchEvent(new CustomEvent("dynora:modules-updated"));
    }
    showToast(`${cfg.label} gespeichert`);
  } catch (e) {
    setSaveStatus(cfg.status, "Fehler", "error");
    showToast(`${cfg.label} konnten nicht gespeichert werden: ${e?.message || e}`, "error");
  } finally {
    savingSections.delete(section);
  }
}

function bindSettingsInput() {
  byId("defaultSearch")?.addEventListener("input", renderDefaultStates);
  byId("defaultSelectVisible")?.addEventListener("change", (event) => {
    const search = String(byId("defaultSearch")?.value || "").trim().toLocaleLowerCase("de-DE");
    state.defaults.forEach((item, index) => { if (!search || `${item.groupName || ""} ${item.targetType} ${item.targetId} ${item.action}`.toLocaleLowerCase("de-DE").includes(search)) event.target.checked ? selectedDefaultIndices.add(index) : selectedDefaultIndices.delete(index); });
    renderDefaultStates();
  });
  byId("deleteSelectedDefaults")?.addEventListener("click", () => {
    const indices = [...selectedDefaultIndices].filter((index) => index >= 0 && index < state.defaults.length).sort((a, b) => b - a);
    if (!indices.length || !confirm(`${indices.length} Grundstellung${indices.length === 1 ? "" : "en"} löschen? Änderungen müssen anschließend gespeichert werden.`)) return;
    indices.forEach((index) => state.defaults.splice(index, 1)); selectedDefaultIndices.clear();
    state.settingsDirty.defaults = true; renderDefaultStates(); setSaveStatus("saveDefaultsStatus", "Ungespeichert");
  });
  document.addEventListener("change", (event) => {
    const lightIconCard = event.target.closest("[data-light-index]");
    if (lightIconCard && event.target.matches('[data-field="icon"]')) {
      const index = Number(lightIconCard.dataset.lightIndex);
      const button = state.lightButtons?.[index];
      if (button) {
        button.icon = event.target.value;
        state.settingsDirty.lights = true;
        setSaveStatus("saveLightStatus", "Ungespeichert");
        const preview = lightIconCard.querySelector(".light-icon-preview");
        if (preview) preview.innerHTML = icon(button.icon);
        renderTrackLightButtons();
      }
      return;
    }
    if (event.target.matches("[data-select-default]")) {
      const index = Number(event.target.dataset.selectDefault);
      if (event.target.checked) selectedDefaultIndices.add(index); else selectedDefaultIndices.delete(index);
      renderDefaultStates();
    }
  });
  document.addEventListener("change", (ev) => {
    if (ev.target.closest("[data-default-index]") && ev.target.dataset.field) {
      ev.target.dispatchEvent(new Event("input", { bubbles: true }));
      if (ev.target.dataset.field === "groupName") renderDefaultStates();
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

  document.addEventListener("input", ev => {
    if (ev.target?.id === "firmwareBinInput" || ev.target?.id === "firmwareBinVersion") updateManualFirmwareButton();
    if (ev.target?.id === "otaKeyInput") {
      const module = state.hardware?.modules?.[byId("otaModuleSelect")?.value || ""];
      const button = byId("downloadUsbSketchButton");
      if (button) button.disabled = !module || !otaServerConfig?.enabled || String(ev.target.value || "").length < 24;
    }
  });

  document.addEventListener("change", ev => {
    if (ev.target?.id === "firmwareBinInput" || ev.target?.id === "firmwareBinVersion") { updateManualFirmwareButton(); return; }
    if (ev.target?.id !== "otaModuleSelect") return;
    state.selectedOtaModule = ev.target.value;
    renderFirmwareUpdates();
    const module = state.hardware?.modules?.[ev.target.value];
    if (module) refreshFirmwareBuild(module.hardwareType).catch(() => {});
  });

  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    if (btn.id === "checkStationUpdate") {
      btn.disabled = true;
      btn.textContent = "Prüft …";
      await refreshStationUpdateStatus({ force: true });
      btn.disabled = false;
      btn.textContent = "Erneut prüfen";
      return;
    }

    if (btn.dataset.action === "ota-firmware") {
      const moduleId = btn.dataset.moduleId || "";
      const module = state.hardware?.modules?.[moduleId];
      if (!module) { showToast("ESP-Modul wurde nicht gefunden.", "warning"); return; }
      state.selectedOtaModule = moduleId;
      state.settingsView = "updates";
      renderSettingsTab();
      const select = byId("otaModuleSelect");
      if (select) select.value = moduleId;
      renderFirmwareUpdates();
      return;
    }

    if (btn.id === "downloadUsbSketchButton") {
      btn.disabled = true;
      try { await downloadConfiguredUsbSketch(); }
      catch (error) { showToast(`USB-Firmwaredatei konnte nicht erstellt werden: ${error.message}`, "error"); }
      finally { renderFirmwareUpdates(); }
      return;
    }

    if (btn.id === "uploadBinButton") {
      const module = state.hardware?.modules?.[byId("otaModuleSelect")?.value || ""];
      const file = byId("firmwareBinInput")?.files?.[0];
      const version = String(byId("firmwareBinVersion")?.value || "").trim();
      const statusEl = byId("firmwareUpdateStatus");
      if (!module || !file) { showToast("Wähle zuerst ESP-Modell und BIN-Datei aus.", "warning"); return; }
      btn.disabled = true;
      if (statusEl) statusEl.textContent = "BIN wird auf Hardwaretyp, Version und OTA-Schlüssel geprüft …";
      try {
        const response = await fetch("/api/ota/manual-firmware", {
          method: "POST",
          headers: { "Content-Type": "application/octet-stream", "X-Dynora-Firmware-Hardware": module.hardwareType, "X-Dynora-Firmware-Version": version },
          body: file,
          cache: "no-store"
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || result.fehler || `${response.status} ${response.statusText}`);
        await refreshFirmwareBuild(module.hardwareType);
        if (statusEl) statusEl.textContent = `BIN geprüft: ${result.version} · ${(result.size / 1024).toFixed(0)} KB. Du kannst sie jetzt per OTA installieren.`;
        showToast(`BIN ${result.version} geprüft und für ${module.name || module.id} bereitgestellt.`);
      } catch (error) {
        if (statusEl) statusEl.textContent = `BIN abgelehnt: ${error.message}`;
        showToast(`BIN konnte nicht bereitgestellt werden: ${error.message}`, "error");
      } finally {
        renderFirmwareUpdates();
      }
      return;
    }

    if (btn.id === "buildFirmwareButton") {
      const module = state.hardware?.modules?.[byId("otaModuleSelect")?.value || ""];
      if (!module) { showToast("Wähle zuerst ein unterstütztes ESP-Modul.", "warning"); return; }
      const statusEl = byId("firmwareUpdateStatus");
      const progressEl = byId("firmwareProgress");
      btn.disabled = true;
      byId("uploadFirmwareButton").disabled = true;
      if (statusEl) statusEl.textContent = "Server kompiliert die ausgewählte Firmware …";
      if (progressEl) progressEl.value = 5;
      try {
        const configuration = collectFirmwareConnectionSettings();
        const response = await fetch("/api/ota/build", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hardwareType: module.hardwareType, ...configuration }), cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || result.fehler || `${response.status} ${response.statusText}`);
        let buildDone = false;
        for (let attempt = 0; attempt < 180; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const build = await refreshFirmwareBuild(module.hardwareType);
          if (build.status === "ready") { buildDone = true; showToast(`Firmware ${build.version} wurde erstellt.`); break; }
          if (build.status === "failed") throw new Error(build.error || "Firmware-Build fehlgeschlagen");
        }
        if (!buildDone) throw new Error("Zeitüberschreitung beim Firmware-Build.");
      } catch (error) {
        if (statusEl) statusEl.textContent = `Fehler: ${error.message}`;
        showToast(`Firmware konnte nicht erstellt werden: ${error.message}`, "error");
      } finally {
        btn.disabled = false;
        renderFirmwareUpdates();
      }
      return;
    }

    if (btn.id === "uploadFirmwareButton") {
      const moduleId = byId("otaModuleSelect")?.value || "";
      const module = state.hardware?.modules?.[moduleId];
      const statusEl = byId("firmwareUpdateStatus");
      if (!module?.online) { showToast("Der ESP muss für OTA online sein.", "warning"); return; }
      btn.disabled = true;
      const progressEl = byId("firmwareProgress");
      if (progressEl) progressEl.value = 5;
      try {
        const response = await fetch(`/api/ota/${encodeURIComponent(moduleId)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", cache: "no-store" });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || result.fehler || `${response.status} ${response.statusText}`);
        if (statusEl) statusEl.textContent = `Firmware ${result.version} wird zum ESP übertragen …`;
        let done = false;
        for (let attempt = 0; attempt < 90; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const statusResponse = await fetch(`/api/ota/status?module=${encodeURIComponent(moduleId)}`, { cache: "no-store" });
          const status = await statusResponse.json().catch(() => ({}));
          if (statusEl) statusEl.textContent = status.status === "installed" ? `Erfolgreich installiert: ${status.version}` : status.status === "failed" ? `Fehler: ${status.error}` : `OTA-Status: ${status.status}`;
          if (progressEl) progressEl.value = status.status === "installed" || status.status === "failed" ? 100 : status.status === "restarting" ? 85 : status.status === "downloading" ? 55 : 20;
          if (["installed", "failed"].includes(status.status)) { done = true; if (status.status === "failed") throw new Error(status.error || "OTA fehlgeschlagen"); showToast(`OTA erfolgreich: ${status.version}`); break; }
        }
        if (!done) throw new Error("Zeitüberschreitung: Der ESP hat das Update noch nicht bestätigt.");
      } catch (error) {
        if (statusEl) statusEl.textContent = `Fehler: ${error.message}`;
        showToast(`OTA fehlgeschlagen: ${error.message}`, "error");
      } finally {
        btn.disabled = !module?.online;
      }
      return;
    }

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

    if (btn.dataset.stationAction) {
      const action = btn.dataset.stationAction;
      if (!['restart', 'shutdown'].includes(action)) return;
      const label = action === 'restart' ? 'neu starten' : 'beenden';
      const detail = action === 'restart'
        ? 'DynoraStation wird kurz getrennt und danach neu gestartet. Der Computer bleibt eingeschaltet.'
        : 'Nur DynoraStation wird beendet. Der Computer bleibt eingeschaltet und die Weboberfläche ist danach offline.';
      if (!confirm(`DynoraStation wirklich ${label}?\n\n${detail}`)) return;
      btn.disabled = true;
      const originalText = btn.textContent;
      if (action === 'restart') {
        btn.dataset.stationPending = 'restart';
        btn.dataset.previousPid = String(state.stationStatus?.pid || 0);
        btn.dataset.previousUptime = String(state.stationStatus?.uptimeSec ?? state.serverUptimeSec ?? 0);
      }
      btn.textContent = action === 'restart' ? 'Neustart …' : 'Wird beendet …';
      try {
        const result = await apiCall(`/station/${action}`, {
          method: 'POST',
          headers: { 'X-Dynora-Action': 'station-control' },
          body: { confirm: action },
          timeoutMs: 4000
        });
        showToast(result?.message || (action === 'restart' ? 'DynoraStation wird neu gestartet' : 'DynoraStation wird beendet'));
        const processStatus = byId('stationProcessStatus');
        const runtimeDetail = byId('stationRuntimeDetail');
        if (processStatus) processStatus.textContent = action === 'restart' ? 'Startet neu …' : 'Wird beendet …';
        if (runtimeDetail) runtimeDetail.textContent = action === 'restart' ? 'Verbindung wird kurz unterbrochen' : 'Weboberfläche geht anschließend offline';
      } catch (error) {
        btn.disabled = false;
        btn.textContent = originalText;
        delete btn.dataset.stationPending;
        delete btn.dataset.previousPid;
        delete btn.dataset.previousUptime;
        showToast(`Stationsaktion fehlgeschlagen: ${error?.message || error}`, 'error');
      }
      return;
    }

    if (btn.dataset.settingsView) {
      state.settingsView = btn.dataset.settingsView;
      if (btn.dataset.moduleId && state.settingsView === "relays") state.settingsRelayModule = btn.dataset.moduleId;
      if (btn.dataset.moduleId && state.settingsView === "leds") state.settingsLedModule = btn.dataset.moduleId;
      renderSettingsTab();
      document.getElementById("page-settings")?.scrollTo?.({ top: 0 });
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
      expandedDefaultGroups.add("__ungrouped__");
      state.settingsDirty.defaults = true;
      renderDefaultStates();
      setSaveStatus("saveDefaultsStatus", "Ungespeichert");
      return;
    }

    if (btn.dataset.action === "add-default-group" || btn.dataset.action === "add-default-to-group") {
      const groupName = btn.dataset.action === "add-default-to-group" ? String(btn.dataset.groupName || "").trim() : String(prompt("Name der neuen Gruppe") || "").trim();
      if (btn.dataset.action === "add-default-group" && !groupName) return;
      if (btn.dataset.action === "add-default-group" && state.defaults.some((item) => String(item.groupName || "").toLocaleLowerCase("de-DE") === groupName.toLocaleLowerCase("de-DE"))) {
        showToast("Eine Gruppe mit diesem Namen gibt es bereits.", "warning"); return;
      }
      if (!Array.isArray(state.defaults)) state.defaults = [];
      state.defaults.push({ targetType: "", targetId: "", action: "", groupName });
      expandedDefaultGroups.add(groupName || "__ungrouped__");
      state.settingsDirty.defaults = true;
      renderDefaultStates();
      setSaveStatus("saveDefaultsStatus", "Ungespeichert");
      return;
    }

    if (btn.dataset.action === "rename-default-group") {
      const currentName = String(btn.dataset.groupName || "").trim();
      const nextName = String(prompt("Neuer Gruppenname", currentName) || "").trim();
      if (!currentName || !nextName || nextName === currentName) return;
      if (state.defaults.some((item) => String(item.groupName || "").toLocaleLowerCase("de-DE") === nextName.toLocaleLowerCase("de-DE"))) {
        showToast("Eine Gruppe mit diesem Namen gibt es bereits.", "warning"); return;
      }
      state.defaults.forEach((item) => { if (String(item.groupName || "").trim() === currentName) item.groupName = nextName; });
      expandedDefaultGroups.delete(currentName); expandedDefaultGroups.add(nextName);
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
        const updatedSelection = [...selectedDefaultIndices].filter((index) => index !== i).map((index) => index > i ? index - 1 : index);
        selectedDefaultIndices.clear(); updatedSelection.forEach((index) => selectedDefaultIndices.add(index));
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
  initLanguage();
  applyCoreTranslations();
  try {
    const savedSettingsView = localStorage.getItem("dynora.settingsView");
    if (["overview", "modules", "updates", "station-updates", "lights", "relays", "sensors", "leds", "rules", "defaults", "station"].includes(savedSettingsView)) state.settingsView = savedSettingsView;
  } catch {}
  bindNavigation();
  refreshStationUpdateStatus();
  const languageSelect = byId("languageToggle");
  if (languageSelect) {
    languageSelect.replaceChildren(...LANGUAGES.map(({ code, name, flag }) => {
      const option = document.createElement("option");
      option.value = code;
      option.textContent = `${flag} ${name}`;
      return option;
    }));
    updateLanguageToggleButton();
    languageSelect.addEventListener("change", () => setLanguage(languageSelect.value));
  }
  document.addEventListener("dynora:language-changed", () => {
    applyCoreTranslations();
    renderSidebarEspStatus();
    renderCs3Tiles();
    renderDashboardOverview();
    if (document.body.dataset.page === "track" && window?.dynoraEditMode === "true") {
      const title = byId("pageTitle");
      const subtitle = byId("pageSubtitle");
      const section = byId("topbarSection");
      if (title) title.textContent = t("page.builder.title");
      if (subtitle) subtitle.textContent = t("page.builder.subtitle");
      if (section) section.textContent = t("page.builder.section");
    } else {
      setPageHeader(document.body.dataset.page || "dashboard");
    }
  });
  const helpDialog = byId("helpDialog");
  byId("openHelpDialog")?.addEventListener("click", () => helpDialog?.showModal());
  byId("closeHelpDialog")?.addEventListener("click", () => helpDialog?.close());
  helpDialog?.addEventListener("click", (event) => {
    const link = event.target.closest("[data-help-page]");
    if (!link) return;
    const page = link.dataset.helpPage;
    const view = link.dataset.helpView || "";
    const panel = link.dataset.helpPanel || "";
    helpDialog.close();
    setActivePage(page);
    if (page === "settings" && view) {
      state.settingsView = view;
      renderSettingsTab();
      try { localStorage.setItem("dynora.settingsView", view); } catch {}
    }
    if (page === "builder" && panel) setBuilderPanel(panel);
  });
  helpDialog?.addEventListener("click", (event) => {
    if (event.target === helpDialog) helpDialog.close();
  });
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
