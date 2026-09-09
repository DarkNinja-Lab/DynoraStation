"use strict";

const TRACK_CATALOG = {
  "5106": { kind: "track", label: "5106", length: 180 },
  "5107": { kind: "track", label: "5107", length: 90 },
  "5108": { kind: "track", label: "5108", length: 70 },
  "5109": { kind: "track", label: "5109", length: 45 },
  "5110": { kind: "track", label: "5110", length: 30 },
  "5129": { kind: "track", label: "5129", length: 22.5 },

  "5128": {
    kind: "xtrack",
    label: "5128 X-Gleis",
    length: 193,
    crossingAngleDeg: 30,
    hasLantern: true
  },

  "5100": { kind: "curve", label: "5100", radius: 110, angleDeg: 30 },
  "5101": { kind: "curve", label: "5101", radius: 110, angleDeg: 15 },
  "5120": { kind: "curve", label: "5120", radius: 150, angleDeg: 30 },
  "5202": { kind: "switch", label: "5202 links", handed: "left" },
  "5203": { kind: "switch", label: "5203 rechts", handed: "right" }
};

function defaultTrackCode() { return "5106"; }
function defaultCurveCode() { return "5100"; }
function defaultSwitchCode() { return "5202"; }
function defaultXTrackCode() { return "5128"; }

function validTrackCode(code) {
  return TRACK_CATALOG[String(code)]?.kind === "track" ? String(code) : defaultTrackCode();
}
function validCurveCode(code) {
  return TRACK_CATALOG[String(code)]?.kind === "curve" ? String(code) : defaultCurveCode();
}
function validSwitchCode(code) {
  return TRACK_CATALOG[String(code)]?.kind === "switch" ? String(code) : defaultSwitchCode();
}
function validXTrackCode(code) {
  return TRACK_CATALOG[String(code)]?.kind === "xtrack" ? String(code) : defaultXTrackCode();
}

module.exports = {
  TRACK_CATALOG,
  defaultTrackCode,
  defaultCurveCode,
  defaultSwitchCode,
  defaultXTrackCode,
  validTrackCode,
  validCurveCode,
  validSwitchCode,
  validXTrackCode
};