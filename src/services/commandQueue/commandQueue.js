"use strict";

const { cleanText } = require("../../utils/sanitize");

function createCommandQueue({ runtimeState, maxCommands, commandMaxAgeMs, commandMaxAttempts, addEvent }) {
  if (!Array.isArray(runtimeState.commandResults)) runtimeState.commandResults = [];
  const maxResults = Math.max(100, Number(maxCommands) || 500);

  function trimResults() {
    if (runtimeState.commandResults.length > maxResults) {
      runtimeState.commandResults.splice(0, runtimeState.commandResults.length - maxResults);
    }
  }

  function resultFor(id) {
    return runtimeState.commandResults.find((item) => Number(item.id) === Number(id)) || null;
  }

  function rememberCommand(cmd) {
    const result = {
      id: cmd.id,
      module: cmd.module,
      type: cmd.type,
      data: { ...(cmd.data || {}) },
      status: "pending",
      reason: "",
      createdAt: cmd.created,
      updatedAt: cmd.created,
      attempts: 0
    };
    runtimeState.commandResults.push(result);
    trimResults();
    return result;
  }

  function settleCommand(cmd, status, reason = "") {
    if (!cmd) return null;
    const now = Date.now();
    let result = resultFor(cmd.id);
    if (!result) result = rememberCommand(cmd);
    result.status = status;
    result.reason = cleanText(reason || "", 160);
    result.attempts = Number(cmd.attempts || 0);
    result.updatedAt = now;
    if (status === "confirmed") result.confirmedAt = now;
    if (status === "failed" || status === "timeout") result.failedAt = now;
    return result;
  }

  function removeWhere(predicate, status, reason) {
    const kept = [];
    runtimeState.commandQueue.forEach((cmd) => {
      if (predicate(cmd)) settleCommand(cmd, status, reason);
      else kept.push(cmd);
    });
    runtimeState.commandQueue = kept;
  }

  function cleanupCommandQueue() {
    const now = Date.now();
    for (let i = runtimeState.commandQueue.length - 1; i >= 0; i--) {
      const c = runtimeState.commandQueue[i];
      const tooOld = now - Number(c.created || 0) > commandMaxAgeMs;
      // Wiederholte Abholung ist erlaubt, bis das absolute Zeitlimit greift.
      // So führt ein kurz verlorenes ACK nicht schon nach wenigen Sekunden zum Abbruch.
      if (tooOld) {
        const status = "timeout";
        const reason = Number(c.attempts || 0) === 0
          ? "Zeitüberschreitung: Befehl wurde vom ESP nicht abgeholt"
          : "Zeitüberschreitung: ESP-Bestätigung fehlt";
        settleCommand(c, status, reason);
        addEvent("COMMAND", `${c.module}:${c.type}`, `${reason}: #${c.id}`);
        runtimeState.commandQueue.splice(i, 1);
      }
    }
  }

  function createCommand(type, data, module = "GLEIS_01") {
    cleanupCommandQueue();

    const isEmergency = String(type) === "NOT_AUS";
    const normalizedModule = cleanText(module || "GLEIS_01", 48) || "GLEIS_01";
    if (isEmergency) {
      removeWhere(
        (queued) => queued.module === normalizedModule,
        "failed",
        "Durch Not-Aus ersetzt"
      );
    }
    if (String(type) === "RELAY_SET" && Number(data?.channel) > 0) {
      removeWhere(
        (queued) => (
          queued.module === normalizedModule &&
          queued.type === "RELAY_SET" &&
          Number(queued.data?.channel) === Number(data.channel) &&
          Number(queued.attempts || 0) === 0
        ),
        "failed",
        "Durch neueren Relaisbefehl ersetzt"
      );
    }
    while (runtimeState.commandQueue.length >= maxCommands) {
      const dropped = runtimeState.commandQueue.shift();
      settleCommand(dropped, "failed", "Befehlswarteschlange voll");
    }

    const cmd = {
      id: runtimeState.nextCommandId++,
      module: normalizedModule,
      type: String(type),
      data: data && typeof data === "object" ? { ...data } : {},
      created: Date.now(),
      attempts: 0,
      priority: isEmergency ? 100 : 10
    };

    console.log(`[COMMAND] erstellt · #${cmd.id} · ${cmd.module} · ${cmd.type}${Number(cmd.data?.channel) > 0 ? ` · Kanal ${cmd.data.channel}` : ""}`);

    if (isEmergency) runtimeState.commandQueue.unshift(cmd);
    else runtimeState.commandQueue.push(cmd);
    rememberCommand(cmd);

    return cmd;
  }

  function nextCommandForModule(moduleId) {
    cleanupCommandQueue();
    const id = cleanText(moduleId || "GLEIS_01", 48) || "GLEIS_01";
    const cmd = runtimeState.commandQueue.find((c) => c.module === id);
    if (cmd) {
      cmd.attempts++;
      const result = resultFor(cmd.id);
      if (result) {
        result.attempts = cmd.attempts;
        result.updatedAt = Date.now();
      }
    }
    return cmd || null;
  }

  function ackCommand(id, { success = true, reason = "" } = {}) {
    cleanupCommandQueue();
    const idx = runtimeState.commandQueue.findIndex((c) => c.id === id);
    if (idx < 0) {
      return { command: null, result: resultFor(id), alreadySettled: true };
    }
    const [command] = runtimeState.commandQueue.splice(idx, 1);
    const result = settleCommand(
      command,
      success ? "confirmed" : "failed",
      success ? "" : (reason || "ESP meldet Ausführungsfehler")
    );
    return { command, result, alreadySettled: false };
  }


  function cancelCommandsForModule(moduleId, reason = "Modul entfernt") {
    const id = cleanText(moduleId || "", 48);
    if (!id) return;
    removeWhere((command) => command.module === id, "failed", reason);
  }

  function getCommandResults(limit = 200) {
    cleanupCommandQueue();
    return runtimeState.commandResults
      .slice()
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
      .slice(0, Math.max(1, Number(limit) || 200));
  }

  return {
    cleanupCommandQueue,
    createCommand,
    nextCommandForModule,
    ackCommand,
    cancelCommandsForModule,
    getCommandResults,
    getCommandResult: resultFor
  };
}

module.exports = { createCommandQueue };
