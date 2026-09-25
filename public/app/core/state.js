"use strict";

export const state = {
  statusTimer: null,
  statusPollMs: 400,
  statusRevisions: { layout: 0, events: 0 },

  // Backend-Status/HW
  hardware: {
    modules: {}
  },
  commands: [],
  relayConflicts: [],
  connection: null,

  // Regeln
  rules: [],

  // Layout/Builder relevante Dinge
  layout: {
    version: 32,
    metadaten: { name: "Meine Modellbahn", massstab: "H0", raster: 12.5, rasterMm: 25, plateWidthMm: 3200, plateHeightMm: 1800 },
    stromkreise: [],
    elemente: [],
    verbindungen: []
  },
  layoutDirty: false,
  placement: null,

  // Dashboard/Track
  cs3Tiles: [],
  lightButtons: [
    { name: "Licht 1", moduleId: "", relayIndex: 0, active: false },
    { name: "Licht 2", moduleId: "", relayIndex: 0, active: false },
    { name: "Licht 3", moduleId: "", relayIndex: 0, active: false },
    { name: "Licht 4", moduleId: "", relayIndex: 0, active: false }
  ],

  // Settings
  defaults: [], // { targetType, targetId, action }
  relayConfig: {}, // key: moduleId:idx -> { name, role }
  sensorConfig: {}, // key: moduleId:idx -> { name }
  ledConfig: {}, // key: moduleId:channel -> { name, color, brightness }
  ledConfigDirty: false,
  settingsDirty: { lights: false, relays: false, sensors: false, leds: false, defaults: false },
  settingsPersistedAt: 0,
  settingsLedModule: "",
  events: []
};
