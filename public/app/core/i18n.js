"use strict";

const STORAGE_KEY = "dynora.language";
const DEFAULT_LANGUAGE = "de";

export const LANGUAGES = [
  { code: "de", name: "Deutsch", flag: "🇩🇪", locale: "de-DE" },
  { code: "en", name: "English", flag: "🇬🇧", locale: "en-GB" },
  { code: "fr", name: "Français", flag: "🇫🇷", locale: "fr-FR" },
  { code: "es", name: "Español", flag: "🇪🇸", locale: "es-ES" },
  { code: "it", name: "Italiano", flag: "🇮🇹", locale: "it-IT" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱", locale: "nl-NL" },
  { code: "pt", name: "Português", flag: "🇵🇹", locale: "pt-PT" },
  { code: "pl", name: "Polski", flag: "🇵🇱", locale: "pl-PL" }
];

const base = {
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
};

const de = {
  "language.toggle": "Sprache ändern", "nav.dashboard": "Übersicht", "nav.track": "Betrieb", "nav.builder": "Builder",
  "nav.settings": "Einstellungen", "nav.events": "Logbuch", "nav.help": "Hilfe & Anleitung",
  "mobile.dashboard.open": "Übersicht öffnen", "mobile.track.open": "Betrieb öffnen", "mobile.builder.open": "Builder öffnen",
  "mobile.settings.open": "System öffnen", "mobile.events.open": "Logbuch öffnen",
  "page.dashboard.title": "Übersicht", "page.dashboard.subtitle": "Betriebsbild, Systemzustand und letzte Aktivitäten", "page.dashboard.section": "Zentrale",
  "page.track.title": "Betrieb", "page.track.subtitle": "Fahrwege, Signale und Anlagenfunktionen steuern", "page.track.section": "Workspace",
  "page.settings.title": "Einstellungen", "page.settings.subtitle": "Geräte, Ein-/Ausgänge und Ereignisse", "page.settings.section": "Administration",
  "page.events.title": "Logbuch", "page.events.subtitle": "System-, Schalt- und Sensorereignisse", "page.events.section": "Administration",
  "page.builder.title": "Stellwerk bearbeiten", "page.builder.subtitle": "Gleisbild bearbeiten, Elemente platzieren und Hardware zuweisen", "page.builder.section": "Bearbeitung",
  "track.focus.enable": "Gleisbild maximieren", "track.focus.disable": "Maximierung beenden",
  "status.noModuleSupported": "Kein unterstütztes ESP-Modul gefunden.", "status.online": "Online", "status.offline": "Offline",
  "status.warning": "Warnung", "status.incompatible": "Inkompatibel", "status.hardwareError": "Hardwarefehler",
  "button.restart": "Neu starten", "button.emergency": "NOT-AUS", "button.deviceCenter": "Gerätecenter",
  "topbar.section.default": "Betrieb", "sidebar.noModules": "Noch kein ESP verbunden.",
  "dashboard.noModules": "Noch keine ESP-Module registriert.", "dashboard.noEvents": "Noch keine Ereignisse vorhanden.",
  "dashboard.noControls": "Keine schaltbaren Weichen, Signale oder Entkuppler im Plan",
  "compat.incomplete": "Kompatibilitätsdaten unvollständig", "hardware.mcp": "MCP23017 nicht erreichbar",
  "module.connected": "verbunden", "module.noIp": "keine aktuelle IP"
};

const translations = {
  de,
  en: base,
  fr: {
    "language.toggle": "Changer de langue", "nav.dashboard": "Vue d’ensemble", "nav.track": "Exploitation", "nav.builder": "Éditeur",
    "nav.settings": "Paramètres", "nav.events": "Journal", "nav.help": "Aide et guide",
    "mobile.dashboard.open": "Ouvrir la vue d’ensemble", "mobile.track.open": "Ouvrir l’exploitation", "mobile.builder.open": "Ouvrir l’éditeur",
    "mobile.settings.open": "Ouvrir le système", "mobile.events.open": "Ouvrir le journal",
    "page.dashboard.title": "Vue d’ensemble", "page.dashboard.subtitle": "Vue d’exploitation, état du système et activité récente", "page.dashboard.section": "Centre de contrôle",
    "page.track.title": "Exploitation", "page.track.subtitle": "Contrôler les itinéraires, les signaux et les fonctions du réseau", "page.track.section": "Espace de travail",
    "page.settings.title": "Paramètres", "page.settings.subtitle": "Appareils, entrées/sorties et événements", "page.settings.section": "Administration",
    "page.events.title": "Journal", "page.events.subtitle": "Événements système, commandes et capteurs", "page.events.section": "Administration",
    "page.builder.title": "Modifier le pupitre", "page.builder.subtitle": "Modifier le plan de voies, placer des éléments et associer le matériel", "page.builder.section": "Édition",
    "track.focus.enable": "Agrandir le plan de voies", "track.focus.disable": "Quitter le mode agrandi",
    "status.noModuleSupported": "Aucun module ESP compatible détecté.", "status.online": "En ligne", "status.offline": "Hors ligne",
    "status.warning": "Avertissement", "status.incompatible": "Incompatible", "status.hardwareError": "Erreur matérielle",
    "button.restart": "Redémarrer", "button.emergency": "ARRÊT D’URGENCE", "button.deviceCenter": "Centre des appareils",
    "topbar.section.default": "Exploitation", "sidebar.noModules": "Aucun ESP connecté pour le moment.",
    "dashboard.noModules": "Aucun module ESP enregistré pour le moment.", "dashboard.noEvents": "Aucun événement pour le moment.",
    "dashboard.noControls": "Aucun aiguillage, signal ou dételage commandable dans le plan",
    "compat.incomplete": "Données de compatibilité incomplètes", "hardware.mcp": "MCP23017 inaccessible",
    "module.connected": "connecté", "module.noIp": "aucune adresse IP actuelle"
  },
  es: {
    "language.toggle": "Cambiar idioma", "nav.dashboard": "Resumen", "nav.track": "Operación", "nav.builder": "Diseñador",
    "nav.settings": "Ajustes", "nav.events": "Registro", "nav.help": "Ayuda y guía",
    "mobile.dashboard.open": "Abrir resumen", "mobile.track.open": "Abrir operación", "mobile.builder.open": "Abrir diseñador",
    "mobile.settings.open": "Abrir sistema", "mobile.events.open": "Abrir registro",
    "page.dashboard.title": "Resumen", "page.dashboard.subtitle": "Vista de operación, estado del sistema y actividad reciente", "page.dashboard.section": "Centro de control",
    "page.track.title": "Operación", "page.track.subtitle": "Controla rutas, señales y funciones de la maqueta", "page.track.section": "Espacio de trabajo",
    "page.settings.title": "Ajustes", "page.settings.subtitle": "Dispositivos, entradas/salidas y eventos", "page.settings.section": "Administración",
    "page.events.title": "Registro", "page.events.subtitle": "Eventos del sistema, cambios y sensores", "page.events.section": "Administración",
    "page.builder.title": "Editar el panel de control", "page.builder.subtitle": "Editar el plano, colocar elementos y asignar hardware", "page.builder.section": "Edición",
    "track.focus.enable": "Ampliar el plano", "track.focus.disable": "Salir de la vista ampliada",
    "status.noModuleSupported": "No se encontró ningún módulo ESP compatible.", "status.online": "En línea", "status.offline": "Sin conexión",
    "status.warning": "Advertencia", "status.incompatible": "Incompatible", "status.hardwareError": "Error de hardware",
    "button.restart": "Reiniciar", "button.emergency": "PARADA DE EMERGENCIA", "button.deviceCenter": "Centro de dispositivos",
    "topbar.section.default": "Operación", "sidebar.noModules": "Aún no hay ningún ESP conectado.",
    "dashboard.noModules": "Aún no hay módulos ESP registrados.", "dashboard.noEvents": "Aún no hay eventos.",
    "dashboard.noControls": "No hay desvíos, señales ni desenganchadores controlables en el plano",
    "compat.incomplete": "Datos de compatibilidad incompletos", "hardware.mcp": "MCP23017 no accesible",
    "module.connected": "conectado", "module.noIp": "sin dirección IP actual"
  },
  it: {
    "language.toggle": "Cambia lingua", "nav.dashboard": "Panoramica", "nav.track": "Esercizio", "nav.builder": "Editor",
    "nav.settings": "Impostazioni", "nav.events": "Registro", "nav.help": "Aiuto e guida",
    "mobile.dashboard.open": "Apri panoramica", "mobile.track.open": "Apri esercizio", "mobile.builder.open": "Apri editor",
    "mobile.settings.open": "Apri sistema", "mobile.events.open": "Apri registro",
    "page.dashboard.title": "Panoramica", "page.dashboard.subtitle": "Vista operativa, stato del sistema e attività recenti", "page.dashboard.section": "Centro di controllo",
    "page.track.title": "Esercizio", "page.track.subtitle": "Controlla itinerari, segnali e funzioni del plastico", "page.track.section": "Area di lavoro",
    "page.settings.title": "Impostazioni", "page.settings.subtitle": "Dispositivi, ingressi/uscite ed eventi", "page.settings.section": "Amministrazione",
    "page.events.title": "Registro", "page.events.subtitle": "Eventi di sistema, comandi e sensori", "page.events.section": "Amministrazione",
    "page.builder.title": "Modifica il quadro di controllo", "page.builder.subtitle": "Modifica il piano dei binari, posiziona elementi e assegna l’hardware", "page.builder.section": "Modifica",
    "track.focus.enable": "Ingrandisci il piano dei binari", "track.focus.disable": "Esci dalla vista ingrandita",
    "status.noModuleSupported": "Nessun modulo ESP supportato trovato.", "status.online": "Online", "status.offline": "Offline",
    "status.warning": "Attenzione", "status.incompatible": "Incompatibile", "status.hardwareError": "Errore hardware",
    "button.restart": "Riavvia", "button.emergency": "ARRESTO DI EMERGENZA", "button.deviceCenter": "Centro dispositivi",
    "topbar.section.default": "Esercizio", "sidebar.noModules": "Nessun ESP connesso.",
    "dashboard.noModules": "Nessun modulo ESP registrato.", "dashboard.noEvents": "Nessun evento presente.",
    "dashboard.noControls": "Nessuno scambio, segnale o sganciatore controllabile nel piano",
    "compat.incomplete": "Dati di compatibilità incompleti", "hardware.mcp": "MCP23017 non raggiungibile",
    "module.connected": "connesso", "module.noIp": "nessun indirizzo IP attuale"
  },
  nl: {
    "language.toggle": "Taal wijzigen", "nav.dashboard": "Overzicht", "nav.track": "Bediening", "nav.builder": "Bouwer",
    "nav.settings": "Instellingen", "nav.events": "Logboek", "nav.help": "Hulp en handleiding",
    "mobile.dashboard.open": "Overzicht openen", "mobile.track.open": "Bediening openen", "mobile.builder.open": "Bouwer openen",
    "mobile.settings.open": "Systeem openen", "mobile.events.open": "Logboek openen",
    "page.dashboard.title": "Overzicht", "page.dashboard.subtitle": "Bedieningspaneel, systeemstatus en recente activiteit", "page.dashboard.section": "Controlecentrum",
    "page.track.title": "Bediening", "page.track.subtitle": "Rijwegen, seinen en baanfuncties bedienen", "page.track.section": "Werkruimte",
    "page.settings.title": "Instellingen", "page.settings.subtitle": "Apparaten, in- en uitgangen en gebeurtenissen", "page.settings.section": "Beheer",
    "page.events.title": "Logboek", "page.events.subtitle": "Systeem-, schakel- en sensorgebeurtenissen", "page.events.section": "Beheer",
    "page.builder.title": "Bedieningspaneel bewerken", "page.builder.subtitle": "Sporenplan bewerken, elementen plaatsen en hardware toewijzen", "page.builder.section": "Bewerken",
    "track.focus.enable": "Sporenplan maximaliseren", "track.focus.disable": "Gemaximaliseerde weergave sluiten",
    "status.noModuleSupported": "Geen ondersteunde ESP-module gevonden.", "status.online": "Online", "status.offline": "Offline",
    "status.warning": "Waarschuwing", "status.incompatible": "Niet compatibel", "status.hardwareError": "Hardwarefout",
    "button.restart": "Opnieuw starten", "button.emergency": "NOODSTOP", "button.deviceCenter": "Apparaten",
    "topbar.section.default": "Bediening", "sidebar.noModules": "Nog geen ESP verbonden.",
    "dashboard.noModules": "Nog geen ESP-modules geregistreerd.", "dashboard.noEvents": "Er zijn nog geen gebeurtenissen.",
    "dashboard.noControls": "Geen bedienbare wissels, seinen of ontkoppelaars in het plan",
    "compat.incomplete": "Compatibiliteitsgegevens onvolledig", "hardware.mcp": "MCP23017 niet bereikbaar",
    "module.connected": "verbonden", "module.noIp": "geen actueel IP-adres"
  },
  pt: {
    "language.toggle": "Alterar idioma", "nav.dashboard": "Visão geral", "nav.track": "Operação", "nav.builder": "Editor",
    "nav.settings": "Definições", "nav.events": "Registo", "nav.help": "Ajuda e guia",
    "mobile.dashboard.open": "Abrir visão geral", "mobile.track.open": "Abrir operação", "mobile.builder.open": "Abrir editor",
    "mobile.settings.open": "Abrir sistema", "mobile.events.open": "Abrir registo",
    "page.dashboard.title": "Visão geral", "page.dashboard.subtitle": "Vista de operação, estado do sistema e atividade recente", "page.dashboard.section": "Centro de controlo",
    "page.track.title": "Operação", "page.track.subtitle": "Controlar percursos, sinais e funções da maquete", "page.track.section": "Área de trabalho",
    "page.settings.title": "Definições", "page.settings.subtitle": "Dispositivos, entradas/saídas e eventos", "page.settings.section": "Administração",
    "page.events.title": "Registo", "page.events.subtitle": "Eventos do sistema, comandos e sensores", "page.events.section": "Administração",
    "page.builder.title": "Editar painel de controlo", "page.builder.subtitle": "Editar o plano de vias, colocar elementos e atribuir hardware", "page.builder.section": "Edição",
    "track.focus.enable": "Ampliar plano de vias", "track.focus.disable": "Sair da vista ampliada",
    "status.noModuleSupported": "Não foi encontrado nenhum módulo ESP compatível.", "status.online": "Online", "status.offline": "Offline",
    "status.warning": "Aviso", "status.incompatible": "Incompatível", "status.hardwareError": "Erro de hardware",
    "button.restart": "Reiniciar", "button.emergency": "PARAGEM DE EMERGÊNCIA", "button.deviceCenter": "Centro de dispositivos",
    "topbar.section.default": "Operação", "sidebar.noModules": "Ainda não há nenhum ESP ligado.",
    "dashboard.noModules": "Ainda não há módulos ESP registados.", "dashboard.noEvents": "Ainda não há eventos.",
    "dashboard.noControls": "Não há desvios, sinais ou desengatadores controláveis no plano",
    "compat.incomplete": "Dados de compatibilidade incompletos", "hardware.mcp": "MCP23017 inacessível",
    "module.connected": "ligado", "module.noIp": "sem endereço IP atual"
  },
  pl: {
    "language.toggle": "Zmień język", "nav.dashboard": "Przegląd", "nav.track": "Sterowanie", "nav.builder": "Edytor",
    "nav.settings": "Ustawienia", "nav.events": "Dziennik", "nav.help": "Pomoc i instrukcja",
    "mobile.dashboard.open": "Otwórz przegląd", "mobile.track.open": "Otwórz sterowanie", "mobile.builder.open": "Otwórz edytor",
    "mobile.settings.open": "Otwórz system", "mobile.events.open": "Otwórz dziennik",
    "page.dashboard.title": "Przegląd", "page.dashboard.subtitle": "Widok sterowania, stan systemu i ostatnia aktywność", "page.dashboard.section": "Centrum sterowania",
    "page.track.title": "Sterowanie", "page.track.subtitle": "Steruj trasami, sygnałami i funkcjami makiety", "page.track.section": "Obszar roboczy",
    "page.settings.title": "Ustawienia", "page.settings.subtitle": "Urządzenia, wejścia/wyjścia i zdarzenia", "page.settings.section": "Administracja",
    "page.events.title": "Dziennik", "page.events.subtitle": "Zdarzenia systemowe, przełączenia i czujniki", "page.events.section": "Administracja",
    "page.builder.title": "Edytuj pulpit sterowniczy", "page.builder.subtitle": "Edytuj plan torów, umieszczaj elementy i przypisuj sprzęt", "page.builder.section": "Edycja",
    "track.focus.enable": "Powiększ plan torów", "track.focus.disable": "Zamknij powiększony widok",
    "status.noModuleSupported": "Nie znaleziono obsługiwanego modułu ESP.", "status.online": "Online", "status.offline": "Offline",
    "status.warning": "Ostrzeżenie", "status.incompatible": "Niezgodny", "status.hardwareError": "Błąd sprzętu",
    "button.restart": "Uruchom ponownie", "button.emergency": "AWARYJNE ZATRZYMANIE", "button.deviceCenter": "Centrum urządzeń",
    "topbar.section.default": "Sterowanie", "sidebar.noModules": "Nie podłączono jeszcze ESP.",
    "dashboard.noModules": "Nie zarejestrowano jeszcze modułów ESP.", "dashboard.noEvents": "Brak zdarzeń.",
    "dashboard.noControls": "Brak sterowanych zwrotnic, sygnałów lub odczepiaczy w planie",
    "compat.incomplete": "Niepełne dane zgodności", "hardware.mcp": "MCP23017 jest niedostępny",
    "module.connected": "połączony", "module.noIp": "brak aktualnego adresu IP"
  }
};

let currentLanguage = DEFAULT_LANGUAGE;

function normalizeLanguage(value) {
  const code = String(value || "").trim().toLowerCase().split(/[-_]/)[0];
  return LANGUAGES.some((language) => language.code === code) ? code : DEFAULT_LANGUAGE;
}

export function getLanguage() { return currentLanguage; }
export function getLocale() { return LANGUAGES.find(({ code }) => code === currentLanguage)?.locale || "de-DE"; }
export function t(key, fallback = "") {
  const translated = translations[currentLanguage]?.[key];
  if (translated != null) return translated;
  if (currentLanguage === DEFAULT_LANGUAGE) return fallback || key;
  return base[key] ?? de[key] ?? (fallback || key);
}

export function setLanguage(nextLanguage) {
  const language = normalizeLanguage(nextLanguage);
  if (language === currentLanguage) return language;
  currentLanguage = language;
  try { localStorage.setItem(STORAGE_KEY, language); } catch {}
  document.documentElement.lang = language;
  document.dispatchEvent(new CustomEvent("dynora:language-changed", { detail: { language } }));
  return language;
}

export function initLanguage() {
  let saved = "";
  try { saved = localStorage.getItem(STORAGE_KEY) || ""; } catch {}
  currentLanguage = normalizeLanguage(saved || navigator.language);
  document.documentElement.lang = currentLanguage;
  return currentLanguage;
}
