"use strict";

const { cleanText, validRelay } = require("../../utils/sanitize");

function findRelayConflicts(layout) {
  const safeLayout = layout && typeof layout === "object" ? layout : {};
  const circuits = Array.isArray(safeLayout.stromkreise) ? safeLayout.stromkreise : [];
  const circuitMap = new Map(circuits.map((circuit) => [String(circuit.id || ""), circuit]));
  const assignments = new Map();

  function add(moduleId, channel, owner) {
    const module = cleanText(moduleId || "", 48);
    const relay = validRelay(channel);
    if (!module || !relay) return;
    const key = `${module}:${relay}`;
    if (!assignments.has(key)) assignments.set(key, []);
    assignments.get(key).push({ module, channel: relay, ...owner });
  }

  circuits.forEach((circuit) => {
    const circuitId = String(circuit?.id || "");
    add(circuit?.module, circuit?.relay, {
      ownerType: "circuit",
      ownerId: circuitId,
      field: "relay",
      label: circuit?.name || circuitId || "Stromkreis",
      sharingGroup: circuitId ? `circuit:${circuitId}` : ""
    });
  });

  const relayFieldsByType = {
    track: [["relay", "Versorgung"]],
    curve: [["relay", "Versorgung"]],
    transformer: [["relay", "Versorgung"]],
    switch: [["relayStraight", "Gerade"], ["relayBranch", "Abzweig"]],
    xtrack: [["relayA", "Gerade"], ["relayB", "Abzweig"]],
    crossing: [["relayA", "Gerade"], ["relayB", "Abzweig"]],
    signal: [["relayHp0", "Hp0"], ["relayHp1", "Hp1"]]
  };

  (Array.isArray(safeLayout.elemente) ? safeLayout.elemente : []).forEach((element) => {
    const fields = relayFieldsByType[element?.typ] || [];
    const circuitId = String(element?.stromkreis || "");
    const circuit = circuitMap.get(circuitId);
    fields.forEach(([field, purpose]) => {
      const relay = validRelay(element?.[field]);
      if (!relay) return;
      const sameCircuitRelay = circuit &&
        cleanText(circuit.module || "", 48) === cleanText(element.module || "", 48) &&
        validRelay(circuit.relay) === relay;
      add(element?.module, relay, {
        ownerType: "element",
        ownerId: String(element?.id || ""),
        field,
        purpose,
        label: String(element?.name || element?.id || element?.typ || "Element"),
        sharingGroup: sameCircuitRelay ? `circuit:${circuitId}` : ""
      });
    });
  });

  const conflicts = [];
  assignments.forEach((items, key) => {
    if (items.length < 2) return;
    const groups = new Set(items.map((item) => item.sharingGroup).filter(Boolean));
    const allExplicitlyShared = groups.size === 1 && items.every((item) => item.sharingGroup === [...groups][0]);
    if (allExplicitlyShared) return;

    const [module, channelText] = key.split(":");
    conflicts.push({
      module,
      channel: Number(channelText),
      assignments: items.map((item) => ({
        ownerType: item.ownerType,
        ownerId: item.ownerId,
        field: item.field,
        purpose: item.purpose || "",
        label: item.label,
        sharingGroup: item.sharingGroup || ""
      }))
    });
  });

  return conflicts;
}

module.exports = { findRelayConflicts };
