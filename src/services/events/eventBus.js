"use strict";

function addEventFactory(runtimeState, maxEvents) {
  return function addEvent(type, source, text) {
    runtimeState.events.unshift({
      id: Date.now() + Math.floor(Math.random() * 1000),
      type: String(type || "EVENT"),
      source: String(source || "SYSTEM"),
      text: String(text || ""),
      timestamp: Date.now()
    });

    if (runtimeState.events.length > maxEvents) {
      runtimeState.events.length = maxEvents;
    }
    if (!runtimeState.revisions) runtimeState.revisions = {};
    runtimeState.revisions.events = Number(runtimeState.revisions.events || 0) + 1;
  };
}

module.exports = { addEventFactory };
