"use strict";

const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data");
const LAYOUT_FILE = path.join(DATA_DIR, "layout.json");
const HARDWARE_FILE = path.join(DATA_DIR, "hardware.json");
const RULES_FILE = path.join(DATA_DIR, "rules.json");

const runtimeState = {
  layout: null,
  hardware: null,
  rulesData: null,

  commandQueue: [],
  events: [],
  nextCommandId: 1,

  modules: {},

  writeState: {
    layout: { running: false, pending: false, lastError: null },
    hardware: { running: false, pending: false, lastError: null },
    rules: { running: false, pending: false, lastError: null }
  },

  rateBuckets: new Map(),

  paths: {
    DATA_DIR,
    LAYOUT_FILE,
    HARDWARE_FILE,
    RULES_FILE
  }
};

module.exports = { runtimeState };