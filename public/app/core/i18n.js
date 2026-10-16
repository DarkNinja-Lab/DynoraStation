"use strict";

const STORAGE_KEY = "dynora.language";
const DEFAULT_LANGUAGE = "de";
const SUPPORTED_LANGUAGES = ["de", "en"];

const DICT = {
  de: {
    "language.toggle": "Sprache ändern",
    "nav.dashboard": "Übersicht",
    "nav.track": "Betrieb",
    "nav.builder": "Builder",
    "nav.settings": "Einstellungen",
    "nav.events": "Logbuch",
    "nav.help": "Hilfe & Anleitung",
    "mobile.dashboard.open": "Übersicht öffnen",
    "mobile.track.open": "Betrieb öffnen",
    "mobile.builder.open": "Builder öffnen",
    "mobile.settings.open": "System öffnen",
    "mobile.events.open": "Logbuch öffnen",
    "page.dashboard.title": "Übersicht",
    "page.dashboard.subtitle": "Betriebsbild, Systemzustand und letzte Aktivitäten",
    "page.dashboard.section": "Zentrale",
    "page.track.title": "Betrieb",
    "page.track.subtitle": "Fahrwege, Signale und Anlagenfunktionen steuern",
    "page.track.section": "Workspace",
    "page.settings.title": "Einstellungen",
    "page.settings.subtitle": "Geräte, Ein-/Ausgänge und Ereignisse",
    "page.settings.section": "Administration",
    "page.events.title": "Logbuch",
    "page.events.subtitle": "System-, Schalt- und Sensorereignisse",
    "page.events.section": "Administration",
    "page.builder.title": "Stellwerk bearbeiten",
    "page.builder.subtitle": "Gleisbild bearbeiten, Elemente platzieren und Hardware zuweisen",
    "page.builder.section": "Bearbeitung",
    "track.focus.enable": "Gleisbild maximieren",
    "track.focus.disable": "Maximierung beenden",
    "status.noModuleSupported": "Kein unterstütztes ESP-Modul gefunden.",
    "status.online": "Online",
    "status.offline": "Offline",
    "status.warning": "Warnung",
    "status.incompatible": "Inkompatibel",
    "status.hardwareError": "Hardwarefehler",
    "button.restart": "Neu starten",
    "button.emergency": "NOT-AUS",
    "button.deviceCenter": "Gerätecenter",
    "topbar.section.default": "Betrieb",
    "sidebar.noModules": "Noch kein ESP verbunden.",
    "dashboard.noModules": "Noch keine ESP-Module registriert.",
    "dashboard.noEvents": "Noch keine Ereignisse vorhanden.",
    "dashboard.noControls": "Keine schaltbaren Weichen, Signale oder Entkuppler im Plan",
    "compat.incomplete": "Kompatibilitätsdaten unvollständig",
    "hardware.mcp": "MCP23017 nicht erreichbar",
    "module.connected": "verbunden",
    "module.noIp": "keine aktuelle IP"
  },
  en: {
    "language.toggle": "Change language",
    "nav.dashboard": "Overview",
    "nav.track": "Operations",
    "nav.builder": "Builder",
    "nav.settings": "Settings",
    "nav.events": "Logbook",
    "nav.help": "Help & Guide",
    "mobile.dashboard.open": "Open overview",
    "mobile.track.open": "Open operations",
    "mobile.builder.open": "Open builder",
    "mobile.settings.open": "Open system",
    "mobile.events.open": "Open logbook",
    "page.dashboard.title": "Overview",
    "page.dashboard.subtitle": "Operations view, system status and recent activity",
    "page.dashboard.section": "Control Center",
    "page.track.title": "Operations",
    "page.track.subtitle": "Control routes, signals and layout functions",
    "page.track.section": "Workspace",
    "page.settings.title": "Settings",
    "page.settings.subtitle": "Devices, I/O and events",
    "page.settings.section": "Administration",
    "page.events.title": "Logbook",
    "page.events.subtitle": "System, switching and sensor events",
    "page.events.section": "Administration",
    "page.builder.title": "Edit control panel",
    "page.builder.subtitle": "Edit track plan, place elements and assign hardware",
    "page.builder.section": "Editing",
    "track.focus.enable": "Maximize track plan",
    "track.focus.disable": "Exit maximized view",
    "status.noModuleSupported": "No supported ESP module found.",
    "status.online": "Online",
    "status.offline": "Offline",
    "status.warning": "Warning",
    "status.incompatible": "Incompatible",
    "status.hardwareError": "Hardware error",
    "button.restart": "Restart",
    "button.emergency": "EMERGENCY STOP",
    "button.deviceCenter": "Device center",
    "topbar.section.default": "Operations",
    "sidebar.noModules": "No ESP connected yet.",
    "dashboard.noModules": "No ESP modules registered yet.",
    "dashboard.noEvents": "No events yet.",
    "dashboard.noControls": "No controllable turnouts, signals or uncouplers in the plan",
    "compat.incomplete": "Compatibility data incomplete",
    "hardware.mcp": "MCP23017 not reachable",
    "module.connected": "connected",
    "module.noIp": "no current IP"
  }
};

let currentLanguage = DEFAULT_LANGUAGE;

function normalizeLanguage(value) {
  const language = String(value || "").toLowerCase().slice(0, 2);
  return SUPPORTED_LANGUAGES.includes(language) ? language : DEFAULT_LANGUAGE;
}

export function getLanguage() {
  return currentLanguage;
}

export function getLocale() {
  return currentLanguage === "en" ? "en-US" : "de-DE";
}

export function t(key, fallback = "") {
  return DICT[currentLanguage]?.[key] ?? DICT[DEFAULT_LANGUAGE]?.[key] ?? (fallback || key);
}

export function setLanguage(nextLanguage) {
  const language = normalizeLanguage(nextLanguage);
  if (language === currentLanguage) return language;
  currentLanguage = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {}
  document.documentElement.lang = language;
  document.dispatchEvent(new CustomEvent("dynora:language-changed", { detail: { language } }));
  return language;
}

export function initLanguage() {
  let saved = "";
  try {
    saved = localStorage.getItem(STORAGE_KEY) || "";
  } catch {}
  currentLanguage = normalizeLanguage(saved || navigator.language);
  document.documentElement.lang = currentLanguage;
  return currentLanguage;
}
