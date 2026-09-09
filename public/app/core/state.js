"use strict";

export const state = {
  statusTimer: null,
  layout: { 
    version: 30,
    metadaten: { name: "Meine Modellbahn", massstab: "H0", raster: 25 },
    stromkreise: [],
    elemente: [],
    verbindungen: []
  },
  hardware: { 
    version: 4,
    module: {},
    relays: [], 
    sensors: [], 
    leds: [], 
    lightButtons: [], 
    modules: {} 
  },
  rules: [],
  events: [],
  catalog: { 
    tracks: [], 
    curves: [], 
    switches: [], 
    crossings: [], 
    signals: [], 
    transformers: [], 
    espSignals: [] 
  },
  selectedElement: null,
  undoStack: [],
  redoStack: [],
  cs3Tiles: [],
  lightButtons: [],
  selectedTool: "select",
  zoom: 1,
  panX: 0,
  panY: 0
};

export function setState(updates) {
  Object.assign(state, updates);
}