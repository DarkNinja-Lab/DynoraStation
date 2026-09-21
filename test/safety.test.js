"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { createCommandQueue } = require("../src/services/commandQueue/commandQueue");
const { findRelayConflicts } = require("../src/domain/hardware/relayConflicts");
const { createModuleRegistry } = require("../src/services/modules/moduleRegistry");

test("Command-Queue markiert fehlende ESP-Bestätigung als Zeitüberschreitung", async () => {
  const runtimeState = { commandQueue: [], commandResults: [], nextCommandId: 1 };
  const events = [];
  const queue = createCommandQueue({
    runtimeState,
    maxCommands: 20,
    commandMaxAgeMs: 5,
    commandMaxAttempts: 10,
    addEvent: (...args) => events.push(args)
  });
  const command = queue.createCommand("RELAY_SET", { channel: 1, state: true }, "ESP-A");
  assert.equal(queue.getCommandResult(command.id).status, "pending");
  await new Promise((resolve) => setTimeout(resolve, 12));
  queue.cleanupCommandQueue();
  const result = queue.getCommandResult(command.id);
  assert.equal(result.status, "timeout");
  assert.match(result.reason, /Zeitüberschreitung/);
  assert.equal(runtimeState.commandQueue.length, 0);
  assert.equal(events.length, 1);
});

test("Relais-Konflikte warnen bei unabhängiger Doppelbelegung", () => {
  const conflicts = findRelayConflicts({
    stromkreise: [],
    elemente: [
      { id: "A", typ: "track", module: "ESP-A", relay: 3 },
      { id: "B", typ: "switch", module: "ESP-A", relayStraight: 3, relayBranch: 4 }
    ]
  });
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].module, "ESP-A");
  assert.equal(conflicts[0].channel, 3);
  assert.equal(conflicts[0].assignments.length, 2);
});

test("Explizit gemeinsamer Stromkreis ist von Relais-Konfliktwarnung ausgenommen", () => {
  const conflicts = findRelayConflicts({
    stromkreise: [{ id: "C1", name: "Bahnhof", module: "ESP-A", relay: 3 }],
    elemente: [
      { id: "A", typ: "track", module: "ESP-A", relay: 3, stromkreis: "C1" },
      { id: "B", typ: "curve", module: "ESP-A", relay: 3, stromkreis: "C1" }
    ]
  });
  assert.deepEqual(conflicts, []);
});

test("Modul-Kompatibilität sperrt fehlende und abweichende Protokollversionen", () => {
  const runtimeState = { modules: {} };
  const registry = createModuleRegistry({ runtimeState, moduleTimeout: 10000, protocolVersion: 2 });
  const module = registry.getOrCreateModule("ESP-A");
  module.lastHeartbeat = Date.now();
  assert.equal(registry.moduleCanControl(module), false);
  assert.equal(registry.moduleCompatibility(module).status, "unknown");

  module.protocolVersion = 99;
  module.firmwareVersion = "9.9.9";
  module.hardwareType = "TEST";
  assert.equal(registry.moduleCanControl(module), false);
  assert.equal(registry.moduleCompatibility(module).status, "incompatible");

  module.protocolVersion = 2;
  assert.equal(registry.moduleCanControl(module), true);
  assert.equal(registry.moduleCompatibility(module).status, "compatible");
});
