"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const { normalizeRules } = require("../src/domain/rules/normalizeRules");

test("Automationsmodell bewahrt Mehrfachziele und Wartezeiten beim API-Rundlauf", async () => {
  const { groupApiRules, apiRule, validate } = await import("../public/app/rules/model.js?v=interface-v1");
  const source = normalizeRules({ rules: [{
    id: "entry", groupId: "station", groupName: "Bahnhof", name: "Einfahrt", enabled: false,
    condition: { kind: "sensor", module: "ESP", sensorId: "S1", state: "free", triggered: false },
    steps: [
      { type: "delay", durationMs: 1500 },
      { type: "actions", actions: [1, 2].map((channel) => ({ kind: "relay", module: "ESP", channel, state: "on" })) },
      { type: "delay", durationMs: 5000 },
      { type: "actions", actions: [{ kind: "espSignal", elementId: "signal", state: "halt" }] }
    ]
  }] }).rules;
  const [automation] = groupApiRules(source);
  assert.equal(validate([automation]), "");
  assert.deepEqual(automation.rules[0].steps[1].targetRefs, ["ESP::1", "ESP::2"]);
  assert.equal(automation.rules[0].triggerState, "free");
  const restored = normalizeRules({ rules: automation.rules.map((rule) => apiRule(automation, rule)) }).rules;
  assert.deepEqual(restored, source);
});

test("Alte Regeln ohne Schritte bleiben bearbeitbar und unvollständige Ziele werden gemeldet", async () => {
  const { groupApiRules, validate } = await import("../public/app/rules/model.js?v=interface-v1");
  const groups = groupApiRules([{ id: "old", name: "Alt", condition: { kind: "relay", module: "ESP", channel: 1, state: "on" }, actions: [{ kind: "relay", module: "ESP", channel: 2, state: "off" }] }]);
  assert.equal(groups[0].name, "Alt");
  assert.equal(validate(groups), "");
  groups[0].rules[0].steps[0].targetRefs = [];
  assert.match(validate(groups), /DANN-Ziel fehlt/);
});

test("Automationsansicht bietet beschriftete Checkboxen und bewahrt fehlende Zuordnungen", async () => {
  const { renderAutomation } = await import("../public/app/rules/render.js?v=interface-v1");
  const { groupApiRules } = await import("../public/app/rules/model.js?v=interface-v1");
  const [group] = groupApiRules([{ id: "rule", name: "<img src=x>", condition: { kind: "relay", module: "OFFLINE", channel: 1 }, actions: [{ kind: "relay", module: "OFFLINE", channel: 2, state: "off" }] }]);
  const dom = new JSDOM(renderAutomation(group, 0, { selected: false, collapsed: false, triggers: [], targets: [] }));
  const document = dom.window.document;
  const target = document.querySelector("[data-step-target]");
  assert.equal(target.type, "checkbox");
  assert.equal(target.checked, true);
  assert.equal(target.value, "OFFLINE::2");
  assert.match(target.closest("label").textContent, /derzeit nicht verfügbar/);
  assert.equal(document.querySelector('[data-field="triggerRef"]').value, "OFFLINE::1");
  assert.equal(document.querySelector("img"), null, "Namen dürfen kein HTML einschleusen");
  dom.window.close();
});
