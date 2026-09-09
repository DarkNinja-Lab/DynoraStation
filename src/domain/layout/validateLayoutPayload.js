"use strict";

function validateLayoutPayload(body) {
  if (!body || typeof body !== "object") return "Payload fehlt";
  if (!Array.isArray(body.elemente)) return "elemente muss ein Array sein";
  if (!Array.isArray(body.verbindungen)) return "verbindungen muss ein Array sein";
  return null;
}

module.exports = { validateLayoutPayload };