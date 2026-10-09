"use strict";

const TRACK_CATALOG = {
  "5105": { kind: "track", label: "5105 Kontaktgleis gerade", length: 180, trackStyle: "contact" },
  "5106": { kind: "track", label: "5106", length: 180 },
  "5107": { kind: "track", label: "5107", length: 90 },
  "5108": { kind: "track", label: "5108", length: 45 },
  "5109": { kind: "track", label: "5109", length: 33.5 },
  "5110": { kind: "track", label: "5110", length: 22.5 },
  "5111": { kind: "track", label: "5111 Anschlussgleis gerade", length: 180, trackStyle: "feed" },
  "5112": { kind: "track", label: "5112 Entkupplungsgleis", length: 90, trackStyle: "uncoupler" },
  "5115": { kind: "track", label: "5115 Kontaktgleis Schranke gerade", length: 180, trackStyle: "contact" },
  "5129": { kind: "track", label: "5129 Ausgleichsstück", length: 70 },
  "5131": { kind: "track", label: "5131 Anschlussgleis mit Entstörung", length: 180, trackStyle: "feed" },
  "5145": { kind: "track", label: "5145 Kontaktgleis Schranke Ende", length: 90, trackStyle: "contact" },
  "5146": { kind: "track", label: "5146 Schaltgleis gerade", length: 90, trackStyle: "contact" },
  "5208": { kind: "track", label: "5208 Ausgleichsstück", length: 8 },
  "5210": { kind: "track", label: "5210 Ausgleichsstück", length: 16 },
  "7190": { kind: "bumper", label: "7190 Prellbock", length: 70 },
  "7191": { kind: "bumper", label: "7191 Prellbock beleuchtet", length: 70 },

  "5114": { kind: "xtrack", label: "5114 Kreuzung 30°", length: 180, crossingAngleDeg: 30 },
  "5128": {
    kind: "xtrack",
    label: "5128 X-Gleis",
    length: 193,
    crossingAngleDeg: 30,
    hasLantern: true
  },

  "5100": { kind: "curve", label: "5100 R1", radius: 360, angleDeg: 30, arcLength: 188.5 },
  "5104": { kind: "curve", label: "5104 Kontaktgleis gebogen", radius: 360, angleDeg: 30, arcLength: 188.5, trackStyle: "contact" },
  "5101": { kind: "curve", label: "5101 R1 halb", radius: 360, angleDeg: 15, arcLength: 94.2 },
  "5102": { kind: "curve", label: "5102 R1 viertel", radius: 360, angleDeg: 7.5, arcLength: 47.1 },
  "5200": { kind: "curve", label: "5200 R2", radius: 437.4, angleDeg: 30, arcLength: 229 },
  "5103": { kind: "curve", label: "5103 Anschlussgleis Normalkreis", radius: 360, angleDeg: 30, arcLength: 188.5, trackStyle: "feed" },
  "5116": { kind: "curve", label: "5116 Kontaktgleis Schranke gebogen", radius: 360, angleDeg: 30, arcLength: 188.5, trackStyle: "contact" },
  "5120": { kind: "curve", label: "5120 Industriekreis", radius: 286, angleDeg: 45, arcLength: 224.6 },
  "5147": { kind: "curve", label: "5147 Schaltgleis Normalkreis", radius: 360, angleDeg: 15, arcLength: 94.2, trackStyle: "contact" },
  "5201": { kind: "curve", label: "5201 Parallelkreis halb", radius: 437.4, angleDeg: 15, arcLength: 114.5 },
  "5205": { kind: "curve", label: "5205 Parallelkreis Ausgleichsbogen", radius: 437.4, angleDeg: 5.72, arcLength: 43.7 },
  "5206": { kind: "curve", label: "5206 Parallelkreis Ausgleichsbogen", radius: 437.4, angleDeg: 24.2833, arcLength: 185.4 },
  "5213": { kind: "curve", label: "5213 Schaltgleis Parallelkreis", radius: 437.4, angleDeg: 15, arcLength: 114.5, trackStyle: "contact" },
  "5118": { kind: "switch", label: "5118 Weiche links", handed: "left", length: 180, radius: 360, angleDeg: 30 },
  "5119": { kind: "switch", label: "5119 Weiche rechts", handed: "right", length: 180, radius: 360, angleDeg: 30 },
  "5141": { kind: "switch", label: "5141 Bogenweiche links", handed: "left", length: 180, radius: 360, branchRadius: 437.4, angleDeg: 30, branchAngleDeg: 38, innerCurveCode: "5100", outerCurveCode: "5200", switchStyle: "curved", switchGeometry: "5141" },
  "5202": { kind: "switch", label: "5202 links", handed: "left", length: 180, radius: 437.4, angleDeg: 24.2833 },
  "5203": { kind: "switch", label: "5203 rechts", handed: "right", length: 180, radius: 437.4, angleDeg: 24.2833 },
  "5207": { kind: "xtrack", label: "5207 Doppelkreuzungsweiche", length: 180, crossingAngleDeg: 24.2833 },
  "5211": { kind: "xtrack", label: "5211 Kreuzung 48,6°", length: 98, crossingAngleDeg: 48.6 },
  "5215": { kind: "xtrack", label: "5215 Kreuzung 24,3°", length: 180, crossingAngleDeg: 24.2833 }
};

function defaultTrackCode() { return "5106"; }
function defaultCurveCode() { return "5100"; }
function defaultSwitchCode() { return "5202"; }
function defaultXTrackCode() { return "5128"; }
function defaultBumperCode() { return "7190"; }

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
