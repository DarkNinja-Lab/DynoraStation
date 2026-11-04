"use strict";

// Rule format adapters and validation; no DOM or network dependencies.
const hardwareKinds = ["sensor", "relay", "led"];
const targetKinds = [["relay", "Relais"], ["led", "Einzelne LED"], ["switch", "Weiche"], ["crossing", "Kreuzungsweiche"], ["signal", "Märklin-Signal"], ["espSignal", "ESP-Signal"]];
const triggerKinds = [["sensor", "Sensor"], ["switch", "Weiche"], ["xtrack", "Kreuzungsweiche"], ["signal", "Märklin-Signal"], ["ledsignal", "ESP-Signal"], ["relay", "Relais"], ["led", "LED"]];
const typeNames = { sensor: "Sensor", relay: "Relais", led: "LED", switch: "Weiche", signal: "Signal", xtrack: "Kreuzungsweiche", ledsignal: "ESP-Signal", crossing: "Kreuzungsweiche", espSignal: "ESP-Signal" };

function splitRef(value) {
  const [module, channel] = String(value || "").split("::");
  return { module: module || "", channel: Number(channel || 0) };
}
function triggerStates(type) {
  return ({ sensor: [["triggered", "Aktiv / ausgelöst"], ["free", "Frei / Ruhe"]], relay: [["on", "Ein"], ["off", "Aus"]], led: [["on", "Ein"], ["off", "Aus"]], switch: [["gerade", "Gerade"], ["abzweig", "Abzweig"]], xtrack: [["gerade", "Gerade"], ["abzweig", "Abzweig"]], signal: [["halt", "Rot / Halt"], ["fahrt", "Grün / Fahrt"]], ledsignal: [["halt", "Rot / Halt"], ["warnung", "Gelb / Warnung"], ["fahrt", "Grün / Fahrt"]] })[type] || [["on", "Ein"]];
}
function actionStates(type) {
  return ({ relay: [["on", "Einschalten"], ["off", "Ausschalten"]], led: [["on", "Einschalten"], ["off", "Ausschalten"]], switch: [["gerade", "Gerade"], ["abzweig", "Abzweig"]], crossing: [["gerade", "Gerade"], ["abzweig", "Abzweig"]], signal: [["halt", "Rot / Halt"], ["fahrt", "Grün / Fahrt"]], espSignal: [["halt", "Rot / Halt"], ["warnung", "Gelb / Warnung"], ["fahrt", "Grün / Fahrt"]] })[type] || [["on", "Einschalten"]];
}
function newId(prefix) { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`; }
function actionStep() { return { type: "action", targetType: "relay", targetRefs: [], action: "on" }; }
function delayStep() { return { type: "delay", durationMs: 5000 }; }
function defaultRule() { return { id: newId("RULE"), name: "Neue Regel", enabled: true, cooldownMs: 5000, triggerType: "sensor", triggerRef: "", triggerState: "triggered", steps: [actionStep()] }; }
function defaultAutomation() { return { id: newId("AUTO"), name: "Neue Automation", rules: [defaultRule()] }; }

function uiAction(action = {}) {
  const targetType = ({ ledsignal: "espSignal", xtrack: "crossing" })[action.kind] || action.kind || "relay";
  const hardware = ["relay", "led"].includes(targetType);
  return {
    targetType,
    targetRef: hardware && action.module && action.channel
      ? `${action.module}::${action.channel}`
      : action.elementId || "",
    action: action.state || actionStates(targetType)[0][0]
  };
}
function uiSteps(rule) {
  const source = Array.isArray(rule.steps) && rule.steps.length ? rule.steps : [{ type: "actions", actions: rule.actions || [] }];
  const result = [];
  source.forEach((step) => {
    if (step?.type === "delay") { result.push({ type: "delay", durationMs: Math.max(0, Number(step.durationMs) || 0) }); return; }
    let previous;
    (step?.actions || []).forEach((raw) => {
      const action = uiAction(raw);
      if (previous && previous.targetType === action.targetType && previous.action === action.action) {
        if (action.targetRef) previous.targetRefs.push(action.targetRef);
      } else {
        previous = { type: "action", targetType: action.targetType, targetRefs: action.targetRef ? [action.targetRef] : [], action: action.action };
        result.push(previous);
      }
    });
  });
  return result.length ? result : [actionStep()];
}
function uiRule(rule, fallbackName) {
  const condition = rule?.condition || {};
  const triggerType = condition.kind || "sensor";
  const hardware = hardwareKinds.includes(triggerType);
  const ref = hardware && condition.module ? `${condition.module}::${triggerType === "sensor" ? condition.sensorId : condition.channel}` : condition.elementId || "";
  const triggerState = triggerType === "sensor" ? (condition.triggered === false ? "free" : "triggered") : condition.state || triggerStates(triggerType)[0][0];
  return {
    id: rule.id,
    name: rule.groupName ? (rule.name || fallbackName) : fallbackName,
    enabled: rule.enabled !== false,
    cooldownMs: Number(rule.cooldownMs ?? 5000),
    triggerType,
    triggerRef: ref.endsWith("::0") || ref.endsWith("::") ? "" : ref,
    triggerState,
    steps: uiSteps(rule)
  };
}
function groupApiRules(rules) {
  const groups = new Map();
  (rules || []).forEach((rule) => {
    const id = String(rule.groupId || rule.id);
    if (!groups.has(id)) groups.set(id, { id, name: rule.groupName || rule.name || "Automation", rules: [] });
    const group = groups.get(id);
    group.rules.push(uiRule(rule, `Regel ${group.rules.length + 1}`));
  });
  return [...groups.values()];
}
function apiAction(step, ref) {
  const kind = step.targetType === "espSignal" ? "ledsignal" : step.targetType === "crossing" ? "xtrack" : step.targetType;
  const hardware = ["relay", "led"].includes(kind);
  const target = splitRef(ref);
  return {
    kind,
    elementId: hardware ? "" : ref,
    module: hardware ? target.module : "",
    channel: hardware ? target.channel : 0,
    state: step.action
  };
}
function apiRule(automation, rule) {
  const trigger = splitRef(rule.triggerRef);
  const hardware = hardwareKinds.includes(rule.triggerType);
  const steps = rule.steps.map((step) => step.type === "delay"
    ? { type: "delay", durationMs: Math.max(0, Math.round(Number(step.durationMs) || 0)) }
    : { type: "actions", actions: (step.targetRefs || []).map((ref) => apiAction(step, ref)) });
  return {
    id: rule.id,
    groupId: automation.id,
    groupName: automation.name,
    name: rule.name,
    enabled: rule.enabled,
    cooldownMs: Math.max(0, Number(rule.cooldownMs) || 0),
    condition: {
      kind: rule.triggerType,
      module: hardware ? trigger.module : "",
      sensorId: rule.triggerType === "sensor" ? String(rule.triggerRef || "").split("::")[1] || "" : "",
      channel: ["relay", "led"].includes(rule.triggerType) ? trigger.channel : 0,
      elementId: hardware ? "" : rule.triggerRef,
      state: rule.triggerState,
      triggered: rule.triggerState !== "free"
    },
    steps,
    actions: steps.flatMap((step) => step.type === "actions" ? step.actions : [])
  };
}
function incomplete(rule) {
  const actions = rule.steps.filter((step) => step.type === "action");
  return !rule.name.trim() || !rule.triggerRef || !actions.length || actions.some((step) => !step.targetRefs?.length);
}
function validate(automations) {
  for (let groupIndex = 0; groupIndex < automations.length; groupIndex += 1) {
    const automation = automations[groupIndex];
    if (!automation.name.trim()) return `Automation ${groupIndex + 1}: Name fehlt`;
    if (!automation.rules.length) return `${automation.name}: mindestens eine Regel hinzufügen`;
    for (let ruleIndex = 0; ruleIndex < automation.rules.length; ruleIndex += 1) {
      const rule = automation.rules[ruleIndex]; const label = `${automation.name} · Regel ${ruleIndex + 1}`;
      if (!rule.name.trim()) return `${label}: Name der Unterregel fehlt`;
      if (!rule.triggerRef) return `${label}: WENN-Auslöser fehlt`;
      if (!rule.steps.some((step) => step.type === "action")) return `${label}: mindestens eine DANN-Aktion hinzufügen`;
      if (rule.steps.some((step) => step.type === "action" && !step.targetRefs?.length)) return `${label}: DANN-Ziel fehlt`;
      if (rule.steps.some((step) => step.type === "delay" && (!Number.isFinite(Number(step.durationMs)) || Number(step.durationMs) <= 0))) return `${label}: Wartezeit muss größer als 0 Sekunden sein`;
    }
  }
  return "";
}
function searchText(rule) { return `${rule.name} ${typeNames[rule.triggerType]} ${rule.triggerRef} ${rule.steps.map((step) => step.type === "delay" ? "warten timer" : `${typeNames[step.targetType]} ${(step.targetRefs || []).join(" ")}`).join(" ")}`; }


export { hardwareKinds, targetKinds, triggerKinds, typeNames, triggerStates, actionStates, actionStep, delayStep, defaultRule, defaultAutomation, groupApiRules, apiRule, incomplete, validate, searchText };
