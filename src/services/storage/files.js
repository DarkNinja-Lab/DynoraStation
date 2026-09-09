"use strict";

const fs = require("fs");
const { normalizeLayout } = require("../../domain/layout/normalizeLayout");
const { normalizeHardware } = require("../../domain/hardware/normalizeHardware");
const { normalizeRules } = require("../../domain/rules/normalizeRules");
const { defaultLayout, defaultHardware, defaultRules } = require("../../domain/defaults");

function ensureDataDir(paths) {
  fs.mkdirSync(paths.DATA_DIR, { recursive: true });
}

function loadLayout(paths) {
  try {
    if (!fs.existsSync(paths.LAYOUT_FILE)) return defaultLayout();
    const text = fs.readFileSync(paths.LAYOUT_FILE, "utf8");
    return normalizeLayout(JSON.parse(text));
  } catch (error) {
    console.error("Layout konnte nicht geladen werden:", error.message);
    return defaultLayout();
  }
}

function loadHardware(paths) {
  try {
    if (!fs.existsSync(paths.HARDWARE_FILE)) return defaultHardware();
    const text = fs.readFileSync(paths.HARDWARE_FILE, "utf8");
    return normalizeHardware(JSON.parse(text));
  } catch (error) {
    console.error("Hardware konnte nicht geladen werden:", error.message);
    return defaultHardware();
  }
}

function loadRules(paths) {
  try {
    if (!fs.existsSync(paths.RULES_FILE)) return defaultRules();
    const text = fs.readFileSync(paths.RULES_FILE, "utf8");
    return normalizeRules(JSON.parse(text));
  } catch (error) {
    console.error("Rules konnten nicht geladen werden:", error.message);
    return defaultRules();
  }
}

module.exports = {
  ensureDataDir,
  loadLayout,
  loadHardware,
  loadRules
};