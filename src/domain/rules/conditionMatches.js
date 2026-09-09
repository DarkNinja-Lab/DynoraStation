"use strict";

function conditionMatches(rule, trigger) {
  const c = rule?.condition || {};
  if (c.kind !== trigger.kind) return false;

  if (c.kind === "sensor") {
    return (
      String(c.module) === String(trigger.module) &&
      String(c.sensorId) === String(trigger.sensorId) &&
      Boolean(c.triggered) === Boolean(trigger.triggered)
    );
  }

  if (c.kind === "switch") {
    return (
      String(c.elementId) === String(trigger.elementId) &&
      String(c.state) === String(trigger.state)
    );
  }

  return false;
}

module.exports = { conditionMatches };