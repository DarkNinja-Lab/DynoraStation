"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { loadEvents } = require("../src/services/storage/files");
const { queueWriteEvents } = require("../src/services/storage/queuedWriter");
const { addEventFactory } = require("../src/services/events/eventBus");

test("event log survives reload and can be persisted empty after clearing", async () => {
  const directory = fs.mkdtempSync(path.join(__dirname, ".events-test-"));
  const runtimeState = {
    events: [], revisions: { events: 0 },
    paths: { DATA_DIR: directory, EVENTS_FILE: path.join(directory, "events.json") },
    writeState: { events: { running: false, pending: false, lastError: null } }
  };
  try {
    const addEvent = addEventFactory(runtimeState, 800, () => queueWriteEvents(runtimeState));
    addEvent("SYSTEM", "TEST", "Persistenter Eintrag");
    assert.deepEqual(await queueWriteEvents(runtimeState), { ok: true });
    assert.equal(loadEvents(runtimeState.paths)[0].text, "Persistenter Eintrag");

    runtimeState.events = [];
    assert.deepEqual(await queueWriteEvents(runtimeState), { ok: true });
    assert.deepEqual(loadEvents(runtimeState.paths), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
