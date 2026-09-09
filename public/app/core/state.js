"use strict";

export const state = {
  statusTimer: null,

  // Backend-Status/HW
  hardware: {
    modules: {}
  },

  // Regeln
  rules: [],

  // Layout/Builder relevante Dinge
  layout: {
    elements: [],
    connections: []
  },

  // Dashboard/Track
  cs3Tiles: [],
  lightButtons: [
    { name: "Licht 1", moduleId: "", relayIndex: 0, active: false },
    { name: "Licht 2", moduleId: "", relayIndex: 1, active: false },
    { name: "Licht 3", moduleId: "", relayIndex: 2, active: false },
    { name: "Licht 4", moduleId: "", relayIndex: 3, active: false }
  ],

  // Settings
  defaults: [], // { targetType, targetId, action }
  relayConfig: {}, // key: moduleId:idx -> { name, role }
  sensorConfig: {}, // key: moduleId:idx -> { name }
  ledConfig: {} // key: moduleId -> { enabled, onValue, offValue }
};