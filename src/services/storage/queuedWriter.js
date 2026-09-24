"use strict";

const fsp = require("fs/promises");
const { ensureDataDir } = require("./files");

async function queueWrite({ kind, file, payloadFactory, runtimeState, addEvent }) {
  ensureDataDir(runtimeState.paths);
  const s = runtimeState.writeState[kind];
  s.pending = true;

  if (s.running) return s.promise;

  s.running = true;
  s.promise = (async () => {
    try {
      while (s.pending) {
        s.pending = false;
        const tmp = `${file}.tmp`;
        const body = payloadFactory();
        await fsp.writeFile(tmp, body, "utf8");
        await fsp.rename(tmp, file);
        s.lastError = null;
      }
    } catch (err) {
      s.lastError = String(err?.message || err);
      console.error(`Fehler beim Speichern (${kind}):`, s.lastError);
      addEvent("IO", "SERVER", `Speicherfehler ${kind}: ${s.lastError}`);
    } finally {
      s.running = false;
      s.promise = null;
    }
  })();
  return s.promise;
}

function queueWriteLayout(runtimeState, addEvent) {
  if (!runtimeState.revisions) runtimeState.revisions = {};
  runtimeState.revisions.layout = Number(runtimeState.revisions.layout || 0) + 1;
  return queueWrite({
    kind: "layout",
    file: runtimeState.paths.LAYOUT_FILE,
    payloadFactory: () => JSON.stringify(runtimeState.layout, null, 2),
    runtimeState,
    addEvent
  });
}

function queueWriteHardware(runtimeState, addEvent) {
  return queueWrite({
    kind: "hardware",
    file: runtimeState.paths.HARDWARE_FILE,
    payloadFactory: () => JSON.stringify(runtimeState.hardware, null, 2),
    runtimeState,
    addEvent
  });
}

function queueWriteRules(runtimeState, addEvent) {
  return queueWrite({
    kind: "rules",
    file: runtimeState.paths.RULES_FILE,
    payloadFactory: () => JSON.stringify(runtimeState.rulesData, null, 2),
    runtimeState,
    addEvent
  });
}

module.exports = {
  queueWrite,
  queueWriteLayout,
  queueWriteHardware,
  queueWriteRules
};
