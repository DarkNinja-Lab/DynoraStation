"use strict";

function conditionMatches(rule, trigger) {
  const c = rule?.condition || {};
  if (c.kind !== trigger.kind) return false;

  if (c.kind === "sensor") {
    return String(c.module) === String(trigger.module) && String(c.sensorId) === String(trigger.sensorId) && Boolean(c.triggered) === Boolean(trigger.triggered);
  }

  if (c.kind === "relay" || c.kind === "led") {
    return String(c.module) === String(trigger.module) && Number(c.channel) === Number(trigger.channel) && String(c.state) === String(trigger.state);
  }

  if (["switch", "signal", "xtrack", "ledsignal"].includes(c.kind)) {
    return String(c.elementId) === String(trigger.elementId) && String(c.state) === String(trigger.state);
  }

  return false;
}

module.exports = { conditionMatches };
