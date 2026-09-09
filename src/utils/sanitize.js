"use strict";

function cleanText(value, max = 80) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function makeId(prefix) {
  return `${String(prefix || "ID").toUpperCase()}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function validRelay(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 256) return 0;
  return n;
}

function validLedChannel(value) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 256) return 0;
  return n;
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
  validBrightness
};