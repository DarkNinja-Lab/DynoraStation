"use strict";

export const API = {
  LAYOUT_URL: "/api/layout",
  STATUS_URL: "/api/status",
  LIGHT_BUTTONS_URL: "/api/light-buttons",
  APPLY_DEFAULTS_URL: "/api/apply-default-states",
  CATALOG_URL: "/api/track-catalog",
  RULES_URL: "/api/rules"
};

export const CONST = {
  SVG_NS: "http://www.w3.org/2000/svg",
  CANVAS_WIDTH: 2400,
  CANVAS_HEIGHT: 1400,
  GRID_SIZE: 25,
  TRACK_LIGHT_COUNT: 4,
  TRACK_IMAGE_DIR: "/assets/track",
  TRACK_IMAGE_FALLBACK: "/assets/track/fallback.jpg",
  API_TIMEOUT_MS: 7000
};

export const DEFAULT_LAYOUT = {
  version: 30,
  metadaten: { name: "Meine Modellbahn", massstab: "H0", raster: 25 },
  stromkreise: [],
  elemente: [],
  verbindungen: []
};

export const state = {
  rulesEditLockUntil: 0,
  trackCatalog: {},
  selectedCodes: {
    trackCode: "5106",
    crossingCode: "5128",
    curveCode: "5100",
    switchCode: "5202",
    signalCode: "7039",
    espSignalCode: "ESP_SIGNALMST"
  },
  layout: structuredClone(DEFAULT_LAYOUT),
  statusDaten: null,
  hardwareCache: { relays: [], sensors: [], leds: [], moduleMap: {} },
  rulesCache: [],
  trackLightConfig: [],
  aktiveSeite: "dashboard",
  statusTimer: null,
  statusLadenInFlight: false
};