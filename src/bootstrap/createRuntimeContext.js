"use strict";

const env = require("../config/env");
const { runtimeState } = require("../state/runtimeState");
const { loadLayout, loadHardware, loadRules } = require("../services/storage/files");
const { queueWriteLayout: makeQueueWriteLayout, queueWriteHardware: makeQueueWriteHardware, queueWriteRules: makeQueueWriteRules } = require("../services/storage/queuedWriter");
const { addEventFactory } = require("../services/events/eventBus");
const { createCommandQueue } = require("../services/commandQueue/commandQueue");
const { createModuleRegistry } = require("../services/modules/moduleRegistry");
const { createConfirmedCommandApplier } = require("../domain/hardware/applyConfirmedCommand");
const { upsertRelay, upsertLed, upsertSensor } = require("../domain/hardware/relayLedSensorOps");
const { updateElementsPowerByRelay, syncAllElementStatesFromRelaysAndLeds } = require("../domain/hardware/syncStates");
const { lanIpv4Addresses } = require("../utils/network");

function createRuntimeContext() {
  runtimeState.layout = loadLayout(runtimeState.paths);
  runtimeState.hardware = loadHardware(runtimeState.paths);
  runtimeState.rulesData = loadRules(runtimeState.paths);

  const addEvent = addEventFactory(runtimeState, env.MAX_EVENTS);
  const queueWriteLayout = () => makeQueueWriteLayout(runtimeState, addEvent);
  const queueWriteHardware = () => makeQueueWriteHardware(runtimeState, addEvent);
  const queueWriteRules = () => makeQueueWriteRules(runtimeState, addEvent);
  const commandQueueApi = createCommandQueue({ runtimeState, maxCommands: env.MAX_COMMANDS, commandMaxAgeMs: env.COMMAND_MAX_AGE_MS, commandMaxAttempts: env.COMMAND_MAX_ATTEMPTS, addEvent });
  const moduleRegistry = createModuleRegistry({ runtimeState, moduleTimeout: env.MODULE_TIMEOUT, protocolVersion: env.PROTOCOL_VERSION });
  moduleRegistry.bootstrapModulesFromHardware(runtimeState.hardware);
  const confirmedCommandApplier = createConfirmedCommandApplier({
    runtimeState, moduleRegistry, commandQueueApi, upsertRelay, upsertLed,
    updateElementsPowerByRelay, queueWriteHardware, queueWriteLayout, queueWriteRules, addEvent
  });

  return {
    env, runtimeState, addEvent, queueWriteLayout, queueWriteHardware, queueWriteRules,
    commandQueueApi, moduleRegistry, upsertRelay, upsertLed, upsertSensor,
    updateElementsPowerByRelay, syncAllElementStatesFromRelaysAndLeds,
    confirmedCommandApplier,
    enableDebugEndpoints: env.ENABLE_DEBUG_ENDPOINTS,
    connectionInfo: Object.freeze({
      port: env.SERVER_PORT,
      discoveryPort: env.DISCOVERY_PORT,
      discoveryEnabled: env.ENABLE_UDP_DISCOVERY,
      lanAddresses: lanIpv4Addresses()
    })
  };
}

module.exports = { createRuntimeContext };
