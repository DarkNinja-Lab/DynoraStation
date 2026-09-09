"use strict";

function defaultLightButtons() {
  return [
    { id: 1, name: "Licht 1", module: "GLEIS_01", relay: 0 },
    { id: 2, name: "Licht 2", module: "GLEIS_01", relay: 0 },
    { id: 3, name: "Licht 3", module: "GLEIS_01", relay: 0 },
    { id: 4, name: "Licht 4", module: "GLEIS_01", relay: 0 }
  ];
}

function defaultLayout() {
  return {
    version: 30,
    metadaten: { name: "Meine Modellbahn", massstab: "H0", raster: 25 },
    stromkreise: [],
    elemente: [],
    verbindungen: []
  };
}

function defaultHardware() {
  return {
    version: 4,
    module: {},
    relays: [],
    sensors: [],
    leds: [],
    lightButtons: defaultLightButtons(),
    updatedAt: 0
  };
}

function defaultRules() {
  return {
    version: 1,
    updatedAt: 0,
    rules: []
  };
}

module.exports = {
  defaultLightButtons,
  defaultLayout,
  defaultHardware,
  defaultRules
};