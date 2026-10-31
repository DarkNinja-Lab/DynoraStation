"use strict";

export const FIRMWARE_CONNECTION_SETTINGS_KEY = "dynora.firmwareConnectionSettings";

function browserStorage() {
  try { return globalThis.localStorage || null; }
  catch { return null; }
}

function defaults(location = globalThis.location) {
  return {
    wifiSsid: "",
    wifiPassword: "",
    serverHost: String(location?.hostname || ""),
    serverPort: String(location?.port || "8181"),
    otaSecret: ""
  };
}

export function loadFirmwareConnectionSettings(storage = browserStorage(), location = globalThis.location) {
  const result = defaults(location);
  try {
    const stored = JSON.parse(storage?.getItem(FIRMWARE_CONNECTION_SETTINGS_KEY) || "null");
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return result;
    for (const key of Object.keys(result)) {
      if (typeof stored[key] === "string") result[key] = stored[key];
    }
  } catch {}
  return result;
}

export function saveFirmwareConnectionSettings(values, storage = browserStorage()) {
  const settings = {};
  for (const key of ["wifiSsid", "wifiPassword", "serverHost", "serverPort", "otaSecret"]) {
    settings[key] = String(values?.[key] ?? "");
  }
  try {
    if (!storage) return false;
    storage.setItem(FIRMWARE_CONNECTION_SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch { return false; }
}

export function clearFirmwareConnectionSettings(storage = browserStorage()) {
  try {
    if (!storage) return false;
    storage.removeItem(FIRMWARE_CONNECTION_SETTINGS_KEY);
    return true;
  } catch { return false; }
}
