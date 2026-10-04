"use strict";

export function duplicateForPlacement(element, width, height) {
  const copy = JSON.parse(JSON.stringify(element));
  copy.id = globalThis.crypto?.randomUUID?.() || `elem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  copy.name = element.name ? `${element.name} (Kopie)` : "";
  copy.x = Math.max(0, Math.min(width, (Number(element.x) || 0) + 40));
  copy.y = Math.max(0, Math.min(height, (Number(element.y) || 0) + 40));
  for (const key of ["relay", "relayA", "relayB", "relayStraight", "relayBranch", "relayHp0", "relayHp1", "ledChannelRed", "ledChannelYellow", "ledChannelGreen"]) copy[key] = 0;
  for (const key of ["module", "sensorId", "linkedSignalId", "stromkreis"]) copy[key] = "";
  copy.powerState = false;
  copy.switchState = copy.xState = "gerade";
  copy.signalState = copy.espState = copy.ledState = "halt";
  return copy;
}

export function normalizedRotation(value) {
  return (((Number(value) || 0) % 360) + 360) % 360;
}

export function validateImport(value) {
  if (!value || typeof value !== "object" || !Array.isArray(value.elemente) || !Array.isArray(value.verbindungen)) throw new Error("Keine gültige DynoraStation-Plandatei");
  if (value.elemente.length > 10000 || value.verbindungen.length > 20000) throw new Error("Der Plan ist zu groß");
  if (value.metadaten !== undefined && (!value.metadaten || typeof value.metadaten !== "object" || Array.isArray(value.metadaten))) throw new Error("Ungültige Planmetadaten");
  const ids = new Set();
  const types = new Set(["track", "curve", "switch", "crossing", "xtrack", "bumper", "signal", "espSignal", "ledSignal", "transformer"]);
  for (const element of value.elemente) {
    if (!element || typeof element.id !== "string" || !element.id.trim() || element.id.length > 120 || ids.has(element.id.trim()) || !types.has(element.typ)) throw new Error("Ungültige oder doppelte Element-ID / unbekannter Bauteiltyp");
    ids.add(element.id.trim());
    for (const key of ["x", "y", "rotation", "winkel"]) {
      if (element[key] !== undefined && (typeof element[key] !== "number" || !Number.isFinite(element[key]))) throw new Error("Ungültige Position oder Drehung");
    }
  }
  for (const link of value.verbindungen) {
    for (const key of ["vonPort", "nachPort"]) if (link?.[key] !== undefined && (!Number.isInteger(link[key]) || link[key] < 0 || link[key] > 3)) throw new Error("Ungültiger Anschluss");
    if (!link || !ids.has(link.von) || !ids.has(link.nach) || link.von === link.nach) throw new Error("Ungültige Verbindung im Plan");
  }
  return value;
}
