"use strict";

function defaultLightButtons() {
  return [
    { id: 1, name: "Licht 1", module: "", relay: 0 },
    { id: 2, name: "Licht 2", module: "", relay: 0 },
    { id: 3, name: "Licht 3", module: "", relay: 0 },
    { id: 4, name: "Licht 4", module: "", relay: 0 }
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
    modules: {},
    relays: [],
    sensors: [],
    leds: [],
    lightButtons: defaultLightButtons(),
    defaults: [],
    ledConfig: {},
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
