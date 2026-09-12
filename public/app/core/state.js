"use strict";

export const state = {
  statusTimer: null,
  statusPollMs: 400,

  // Backend-Status/HW
  hardware: {
    modules: {}
  },

  // Regeln
  rules: [],

  // Layout/Builder relevante Dinge
  layout: {
    version: 30,
    metadaten: { name: "Meine Modellbahn", massstab: "H0", raster: 25 },
    stromkreise: [],
    elemente: [],
    verbindungen: []
  },
  layoutDirty: false,

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
  ledConfig: {}, // key: moduleId -> { enabled, onValue, offValue }
  events: []
};
