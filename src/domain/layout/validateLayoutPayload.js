"use strict";

const TYPES = new Set(["track", "curve", "switch", "crossing", "xtrack", "bumper", "signal", "espSignal", "ledSignal", "transformer", "sensor"]);
const object = value => value && typeof value === "object" && !Array.isArray(value);

function validateLayoutPayload(body) {
  if (!object(body)) return "Payload fehlt";
  if (!Array.isArray(body.elemente)) return "elemente muss ein Array sein";
  if (!Array.isArray(body.verbindungen)) return "verbindungen muss ein Array sein";
  if (body.elemente.length > 10000 || body.verbindungen.length > 20000) return "Plan ist zu groß (max. 10000 Elemente / 20000 Verbindungen)";
  if (body.metadaten !== undefined && !object(body.metadaten)) return "metadaten muss ein Objekt sein";
  const ids = new Set();
  for (const element of body.elemente) {
    if (!object(element) || !TYPES.has(element.typ)) return "Ungültiger Elementtyp";
    if (typeof element.id !== "string" || !element.id.trim() || element.id.length > 120) return "Element benötigt eine gültige ID";
    if (ids.has(element.id.trim())) return "Doppelte Element-ID";
    ids.add(element.id.trim());
    for (const key of ["x", "y", "rotation", "winkel"]) {
      if (element[key] !== undefined && (typeof element[key] !== "number" || !Number.isFinite(element[key]))) return `${key} muss eine endliche Zahl sein`;
    }
  }
  for (const link of body.verbindungen) {
    if (!object(link) || !ids.has(link.von) || !ids.has(link.nach) || link.von === link.nach) return "Verbindung verweist auf ungültige Elemente";
    for (const key of ["vonPort", "nachPort"]) {
      if (link[key] !== undefined && (!Number.isInteger(link[key]) || link[key] < 0 || link[key] > 3)) return "Ungültiger Anschluss";
    }
  }
  return null;
}

module.exports = { validateLayoutPayload };
