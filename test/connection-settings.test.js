"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

async function importSettingsModule() {
  const source = fs.readFileSync(path.join(__dirname, "../public/app/ota/connectionSettings.js"), "utf8");
  return import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
}

test("ESP connection settings and OTA secret persist only in browser storage and can be cleared", async () => {
  const { clearFirmwareConnectionSettings, loadFirmwareConnectionSettings, saveFirmwareConnectionSettings } = await importSettingsModule();
  const records = new Map();
  const storage = {
    getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: key => records.delete(key)
  };
  const defaults = loadFirmwareConnectionSettings(storage, { hostname: "station.local", port: "8181" });
  assert.equal(defaults.serverHost, "station.local");
  assert.equal(defaults.serverPort, "8181");
  const values = { wifiSsid: "bahn-wlan", wifiPassword: "wlan-passwort", serverHost: "192.168.1.20", serverPort: "8181", otaSecret: "long-ota-secret" };
  assert.equal(saveFirmwareConnectionSettings(values, storage), true);
  assert.deepEqual(loadFirmwareConnectionSettings(storage), values);
  assert.equal(records.size, 1, "Credentials are stored as one browser-local record");
  assert.equal(clearFirmwareConnectionSettings(storage), true);
  assert.deepEqual(loadFirmwareConnectionSettings(storage, { hostname: "station.local", port: "" }), {
    wifiSsid: "", wifiPassword: "", serverHost: "station.local", serverPort: "8181", otaSecret: ""
  });
});

test("ESP connection settings degrade safely when browser storage is unavailable", async () => {
  const { saveFirmwareConnectionSettings, clearFirmwareConnectionSettings, loadFirmwareConnectionSettings } = await importSettingsModule();
  assert.equal(saveFirmwareConnectionSettings({ wifiSsid: "x" }, null), false);
  assert.equal(clearFirmwareConnectionSettings(null), false);
  assert.equal(loadFirmwareConnectionSettings(null, { hostname: "localhost", port: "" }).serverPort, "8181");
});
