"use strict";

const { toInt, toNumber } = require("../../utils/parse");
const { cleanText, makeId, validRelay, validLedChannel } = require("../../utils/sanitize");
const {
  validTrackCode,
  validXTrackCode,
  validCurveCode,
  validSwitchCode
} = require("../trackCatalog");
const { defaultLayout } = require("../defaults");

function normalizeLayout(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = defaultLayout();

  out.version = 30;
  out.metadaten = {
    name: cleanText(src.metadaten?.name || "Meine Modellbahn", 120) || "Meine Modellbahn",
    massstab: cleanText(src.metadaten?.massstab || "H0", 20) || "H0",
    raster: toInt(src.metadaten?.raster, 25)
  };

  const elementMap = new Map();

  (Array.isArray(src.elemente) ? src.elemente : [])
    .filter((e) => e && e.typ !== "sensor")
    .forEach((e) => {
      const rawTyp = e.typ === "crossing" ? "xtrack" : e.typ === "espSignal" ? "ledSignal" : e.typ;
      const typ = ["track", "xtrack", "curve", "switch", "signal", "transformer", "ledSignal"].includes(rawTyp) ? rawTyp : "track";
      const id = String(e.id || makeId(typ));
      if (elementMap.has(id)) return;

      const trackCode = typ === "track" ? validTrackCode(e.trackCode || e.code || e.catalogCode) : "";
      const xTrackCode = typ === "xtrack" ? validXTrackCode(e.xTrackCode || e.code || e.catalogCode) : "";
      const curveCode = typ === "curve" ? validCurveCode(e.curveCode || e.code || e.catalogCode) : "";
      const switchCode = typ === "switch" ? validSwitchCode(e.switchCode || e.code || e.catalogCode) : "";

      elementMap.set(id, {
        id,
        typ,
        name: String(e.name ?? ""),
        x: toNumber(e.x, 300),
        y: toNumber(e.y, 250),
        winkel: ((toNumber(e.winkel ?? e.rotation, 0) % 360) + 360) % 360,
        rotation: ((toNumber(e.rotation ?? e.winkel, 0) % 360) + 360) % 360,
        section: String(e.section || ""),
        module: cleanText(e.module || "", 48),

        trackCode,
        xTrackCode,
        curveCode,
        switchCode,

        relay: validRelay(e.relay || 0),
        relayA: validRelay(e.relayA || 0),
        relayB: validRelay(e.relayB || 0),
        xState: e.xState === "abzweig" ? "abzweig" : "gerade",
        defaultXState: e.defaultXState === "abzweig" ? "abzweig" : "gerade",

        sensorId: (typ === "transformer" || typ === "ledSignal") ? "" : cleanText(e.sensorId || "", 48),

        relayStraight: validRelay(e.relayStraight || 0),
        relayBranch: validRelay(e.relayBranch || 0),
        switchState: e.switchState === "abzweig" ? "abzweig" : "gerade",
        defaultSwitchState: e.defaultSwitchState === "abzweig" ? "abzweig" : "gerade",

        relayHp0: validRelay(e.relayHp0 || 0),
        relayHp1: validRelay(e.relayHp1 || 0),
        signalState: e.signalState === "fahrt" ? "fahrt" : "halt",
        defaultSignalState: e.defaultSignalState === "fahrt" ? "fahrt" : "halt",

        linkedSignalId: cleanText(e.linkedSignalId || "", 80),

        powerState: Boolean(e.powerState),
        stromkreis: String(e.stromkreis || ""),

        ledChannelRed: validLedChannel(e.ledChannelRed || 0),
        ledChannelYellow: validLedChannel(e.ledChannelYellow || 0),
        ledChannelGreen: validLedChannel(e.ledChannelGreen || 0),
        ledState: ["halt", "warnung", "fahrt"].includes(e.ledState || e.espState) ? (e.ledState || e.espState) : "halt",
        defaultLedState: ["halt", "warnung", "fahrt"].includes(e.defaultLedState) ? e.defaultLedState : "halt"
      });
    });

  for (const e of elementMap.values()) {
    if (e.typ === "track" || e.typ === "curve" || e.typ === "xtrack") {
      if (!e.linkedSignalId) continue;
      const target = elementMap.get(e.linkedSignalId);
      if (!target || (target.typ !== "signal" && target.typ !== "ledSignal")) e.linkedSignalId = "";
    } else {
      e.linkedSignalId = "";
    }
  }

  out.elemente = Array.from(elementMap.values());

  const dedupe = new Set();
  out.verbindungen = (Array.isArray(src.verbindungen) ? src.verbindungen : [])
    .filter(Boolean)
    .map((v) => ({
      id: String(v.id || makeId("CONNECTION")),
      von: String(v.von || ""),
      vonPort: toInt(v.vonPort, 0),
      nach: String(v.nach || ""),
      nachPort: toInt(v.nachPort, 0)
    }))
    .filter((v) => {
      if (!v.von || !v.nach || v.von === v.nach) return false;
      if (!elementMap.has(v.von) || !elementMap.has(v.nach)) return false;

      const a = `${v.von}:${v.vonPort}`;
      const b = `${v.nach}:${v.nachPort}`;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      if (dedupe.has(key)) return false;
      dedupe.add(key);
      return true;
    });

  out.stromkreise = (Array.isArray(src.stromkreise) ? src.stromkreise : [])
    .filter(Boolean)
    .map((s) => ({
      id: String(s.id || makeId("CIRCUIT")),
      name: cleanText(s.name || s.id || "Stromkreis", 80) || "Stromkreis",
      module: cleanText(s.module || "GLEIS_01", 48) || "GLEIS_01",
      relay: validRelay(s.relay),
      state: Boolean(s.state)
    }));

  return out;
}

module.exports = { normalizeLayout };
