"use strict";

const { cleanText } = require("../../utils/sanitize");

function createCommandQueue({ runtimeState, maxCommands, commandMaxAgeMs, commandMaxAttempts, addEvent }) {
  function cleanupCommandQueue() {
    const now = Date.now();
    for (let i = runtimeState.commandQueue.length - 1; i >= 0; i--) {
      const c = runtimeState.commandQueue[i];
      const tooOld = now - Number(c.created || 0) > commandMaxAgeMs;
      const tooManyAttempts = Number(c.attempts || 0) > commandMaxAttempts;
      if (tooOld || tooManyAttempts) {
        addEvent("COMMAND", `${c.module}:${c.type}`, `Befehl verworfen: #${c.id}`);
        runtimeState.commandQueue.splice(i, 1);
      }
    }
  }

  function createCommand(type, data, module = "GLEIS_01") {
    cleanupCommandQueue();

    const isEmergency = String(type) === "NOT_AUS";
    const normalizedModule = cleanText(module || "GLEIS_01", 48) || "GLEIS_01";
    if (isEmergency) {
      // Ein alter Schaltbefehl darf nach dem Not-Aus kein Relais wieder aktivieren.
      runtimeState.commandQueue = runtimeState.commandQueue.filter((queued) => queued.module !== normalizedModule);
    }
    while (runtimeState.commandQueue.length >= maxCommands) runtimeState.commandQueue.shift();

    const cmd = {
      id: runtimeState.nextCommandId++,
      module: normalizedModule,
      type: String(type),
      data: data && typeof data === "object" ? data : {},
      created: Date.now(),
      attempts: 0,
      priority: isEmergency ? 100 : 10
    };

    if (isEmergency) runtimeState.commandQueue.unshift(cmd);
    else runtimeState.commandQueue.push(cmd);

    return cmd;
  }

  function nextCommandForModule(moduleId) {
    cleanupCommandQueue();
    const id = cleanText(moduleId || "GLEIS_01", 48) || "GLEIS_01";
    const cmd = runtimeState.commandQueue.find((c) => c.module === id);
    if (cmd) cmd.attempts++;
    return cmd || null;
  }

  function ackCommand(id) {
    const idx = runtimeState.commandQueue.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    runtimeState.commandQueue.splice(idx, 1);
    return true;
  }

  return {
    cleanupCommandQueue,
    createCommand,
    nextCommandForModule,
    ackCommand
  };
}

module.exports = { createCommandQueue };
