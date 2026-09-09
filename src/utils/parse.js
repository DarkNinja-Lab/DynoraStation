"use strict";

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) ? n : fallback;
}

function parseState(value) {
  return (
    value === true ||
    value === 1 ||
    value === "1" ||
    value === "true" ||
    value === "ein" ||
    value === "on"
  );
}

module.exports = {
  toNumber,
  toInt,
  parseState
};