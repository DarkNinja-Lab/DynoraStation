"use strict";

const { cleanText, validRelay } = require("../../utils/sanitize");
const { relayState, ledState } = require("./relayLedSensorOps");

function updateElementsPowerByRelay(layout, moduleId, channel, state) {
  const mId = cleanText(moduleId || "GLEIS_01", 48) || "GLEIS_01";

  layout.elemente.forEach((e) => {
    if (e.module === mId && Number(e.relay) === Number(channel)) {
      e.powerState = Boolean(state);
    }
    if (
      e.typ === "xtrack" &&
      e.module === mId &&
      (Number(e.relayA) === Number(channel) || Number(e.relayB) === Number(channel))
    ) {
      e.powerState = Boolean(state) || e.powerState;
    }
  });

  layout.stromkreise
    .filter((s) => s.module === mId && Number(s.relay) === Number(channel))
    .forEach((s) => {
      s.state = Boolean(state);
      layout.elemente
        .filter((e) => e.stromkreis === s.id && e.module === mId)
        .forEach((e) => {
          e.powerState = Boolean(state);
        });
    });
}

function syncAllElementStatesFromRelaysAndLeds(layout, hardware) {
  layout.elemente.forEach((e) => {
    const mId = cleanText(
      e.module || (e.typ === "ledSignal" ? "LEDMOD_01" : "GLEIS_01"),
      48
    ) || (e.typ === "ledSignal" ? "LEDMOD_01" : "GLEIS_01");

    if (e.typ === "switch") {
      const b = relayState(hardware, mId, e.relayBranch);
      const s = relayState(hardware, mId, e.relayStraight);
      e.powerState = b || s;
      return;
    }

    if (e.typ === "xtrack") {
      const a = relayState(hardware, mId, e.relayA);
      const b = relayState(hardware, mId, e.relayB);
      e.powerState = a || b;
      return;
    }

    if (e.typ === "signal") {
      const hp0 = relayState(hardware, mId, e.relayHp0);
      const hp1 = relayState(hardware, mId, e.relayHp1);
      e.powerState = hp0 || hp1;
      return;
    }

    if (e.typ === "ledSignal") {
      const redOn = ledState(hardware, mId, e.ledChannelRed);
      const greenOn = ledState(hardware, mId, e.ledChannelGreen);
      e.ledState = greenOn ? "fahrt" : "halt";
      e.powerState = redOn || greenOn;
      return;
    }

    if (validRelay(e.relay) > 0) {
      e.powerState = relayState(hardware, mId, e.relay);
      return;
    }

    if (e.stromkreis) {
      const c = layout.stromkreise.find((x) => x.id === e.stromkreis && x.module === mId);
      e.powerState = Boolean(c?.state);
    }
  });
}

module.exports = {
  updateElementsPowerByRelay,
  syncAllElementStatesFromRelaysAndLeds
};