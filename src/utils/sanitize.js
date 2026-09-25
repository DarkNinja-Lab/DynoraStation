"use strict";

function cleanText(value, max = 80) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function makeId(prefix) {
  return `${String(prefix || "ID").toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function validChannel(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 256) return 0;
  return n;
}

function validRelay(value) {
  return validChannel(value);
}

function validLedChannel(value) {
  return validChannel(value);
}

function makeOperationId(prefix = "CMD") {
  return `${cleanText(prefix || "CMD", 32).toUpperCase() || "CMD"}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function validBrightness(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 255) return 255;
  return Math.round(n);
}

module.exports = {
  cleanText,
  makeId,
  validRelay,
  validLedChannel,
  validBrightness,
  makeOperationId
};