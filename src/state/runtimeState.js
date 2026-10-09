"use strict";

const path = require("path");

const PROJECT_DIR = path.resolve(__dirname, "../..");
const DATA_DIR = process.env.DYNORA_DATA_DIR ? path.resolve(process.env.DYNORA_DATA_DIR) : path.join(PROJECT_DIR, "data");
const LAYOUT_FILE = path.join(DATA_DIR, "layout.json");
const HARDWARE_FILE = path.join(DATA_DIR, "hardware.json");
const RULES_FILE = path.join(DATA_DIR, "rules.json");

const runtimeState = {
  instanceId: require("node:crypto").randomUUID(),
  layout: null,
  hardware: null,
  rulesData: null,

  commandQueue: [],
  commandResults: [],
  events: [],
  nextCommandId: 1,

  modules: {},
  otaJobs: new Map(),
  firmwareBuilds: new Map(),

  revisions: {
    layout: 1,
    events: 1
  },

  writeState: {
    layout: { running: false, pending: false, lastError: null },
    hardware: { running: false, pending: false, lastError: null },
    rules: { running: false, pending: false, lastError: null }
  },

  rateBuckets: new Map(),

  paths: {
    PROJECT_DIR,
    DATA_DIR,
    LAYOUT_FILE,
    HARDWARE_FILE,
    RULES_FILE
  }
};

module.exports = { runtimeState };
