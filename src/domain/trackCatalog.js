"use strict";

const TRACK_CATALOG = {
  "5105": { kind: "track", label: "5105 Schaltgleis", length: 180 },
  "5106": { kind: "track", label: "5106", length: 180 },
  "5107": { kind: "track", label: "5107", length: 90 },
  "5108": { kind: "track", label: "5108", length: 45 },
  "5109": { kind: "track", label: "5109", length: 33.5 },
  "5110": { kind: "track", label: "5110", length: 22.5 },
  "5129": { kind: "bumper", label: "5129 Prellbock", length: 70 },

  "5128": {
    kind: "xtrack",
    label: "5128 X-Gleis",
    length: 193,
    crossingAngleDeg: 30,
    hasLantern: true
  },

  "5100": { kind: "curve", label: "5100 R1", radius: 360, angleDeg: 30, arcLength: 188.5 },
  "5101": { kind: "curve", label: "5101 R1 halb", radius: 360, angleDeg: 15, arcLength: 94.2 },
  "5102": { kind: "curve", label: "5102 R1 viertel", radius: 360, angleDeg: 7.5, arcLength: 47.1 },
  "5200": { kind: "curve", label: "5200 R2", radius: 437.4, angleDeg: 30, arcLength: 229 },
  "5120": { kind: "curve", label: "5120 Industriekreis", radius: 286, angleDeg: 45, arcLength: 224.6 },
  "5118": { kind: "switch", label: "5118 Weiche links", handed: "left", length: 180, radius: 360, angleDeg: 30 },
  "5119": { kind: "switch", label: "5119 Weiche rechts", handed: "right", length: 180, radius: 360, angleDeg: 30 },
  "5141": { kind: "switch", label: "5141 Bogenweiche links", handed: "left", length: 180, radius: 360, branchRadius: 437.4, angleDeg: 30, switchStyle: "curved" },
  "5202": { kind: "switch", label: "5202 links", handed: "left", length: 180, radius: 437.4, angleDeg: 24.2833 },
  "5203": { kind: "switch", label: "5203 rechts", handed: "right", length: 180, radius: 437.4, angleDeg: 24.2833 }
};

function defaultTrackCode() { return "5106"; }
function defaultCurveCode() { return "5100"; }
function defaultSwitchCode() { return "5202"; }
function defaultXTrackCode() { return "5128"; }
function defaultBumperCode() { return "5129"; }

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
function validBumperCode(code) {
  return TRACK_CATALOG[String(code)]?.kind === "bumper" ? String(code) : defaultBumperCode();
}

module.exports = {
  TRACK_CATALOG,
  defaultTrackCode,
  defaultCurveCode,
  defaultSwitchCode,
  defaultXTrackCode,
  defaultBumperCode,
  validTrackCode,
  validCurveCode,
  validSwitchCode,
  validXTrackCode,
  validBumperCode
};
