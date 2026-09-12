"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function modules() { return Object.values(state.hardware?.modules || {}); }
function relayName(moduleId, channel) { return state.relayConfig?.[`${moduleId}:${channel}`]?.name || `Relay ${channel}`; }
function sensorName(moduleId, sensor, index) {
  const id = sensor?.id || `S${index + 1}`;
  return state.sensorConfig?.[`${moduleId}:${id}`]?.name || sensor?.name || id;
}

function allTriggerOptions() {
  const hardware = modules().flatMap((module) => [
    ...(module.sensors || []).map((sensor, index) => ({ type: "sensor", value: `${module.id}::${sensor.id || `S${index + 1}`}`, label: `${module.name || module.id} · ${sensorName(module.id, sensor, index)}` })),
    ...(module.relays || []).map((_, index) => ({ type: "relay", value: `${module.id}::${index + 1}`, label: `${module.name || module.id} · ${relayName(module.id, index + 1)}` })),
    ...(module.leds || []).map((_, index) => ({ type: "led", value: `${module.id}::${index + 1}`, label: `${module.name || module.id} · LED ${index + 1}` }))
  ]);
  const typeMap = { switch: "switch", signal: "signal", crossing: "xtrack", xtrack: "xtrack", espSignal: "ledsignal", ledSignal: "ledsignal" };
  const layout = (state.layout?.elemente || []).flatMap((element) => {
    const type = typeMap[element.typ];
    return type ? [{ type, value: element.id, label: element.name || `${triggerTypeLabel(type)} · ${element.id}` }] : [];
  });
  return [...hardware, ...layout];
}

function targetOptions() {
  const hardware = modules().flatMap((module) => [
    ...(module.relays || []).map((_, index) => ({ type: "relay", value: `${module.id}::${index + 1}`, label: `${module.name || module.id} · ${relayName(module.id, index + 1)}` })),
    ...(module.leds || []).map((_, index) => ({ type: "led", value: `${module.id}::${index + 1}`, label: `${module.name || module.id} · LED ${index + 1}` }))
  ]);
  const typeMap = { switch: "switch", signal: "signal", crossing: "crossing", xtrack: "crossing", espSignal: "espSignal", ledSignal: "espSignal" };
  const layout = (state.layout?.elemente || []).flatMap((element) => {
    const type = typeMap[element.typ];
    return type ? [{ type, value: element.id, label: element.name || `${targetTypeLabel(type)} · ${element.id}` }] : [];
  });
  return [...hardware, ...layout];
}

function splitRef(value) {
  const [module, channel] = String(value || "").split("::");
  return { module: module || "", channel: Number(channel || 0) };
}

function triggerTypeLabel(type) {
  return ({ sensor: "Sensor", relay: "Relay", led: "LED", switch: "Weiche", signal: "Signal", xtrack: "Kreuzungsweiche", ledsignal: "ESP-Signal" })[type] || type;
}
function targetTypeLabel(type) {
  return ({ relay: "Relay", led: "Einzelne LED", switch: "Weiche", crossing: "Kreuzungsweiche", signal: "Märklin-Signal", espSignal: "ESP-Signal" })[type] || type;
}

function triggerStateOptions(type) {
  const map = {
    sensor: [["triggered", "Aktiv / ausgelöst"], ["free", "Frei / Ruhe"]],
    relay: [["on", "Ein"], ["off", "Aus"]],
    led: [["on", "Ein"], ["off", "Aus"]],
    switch: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    xtrack: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    signal: [["halt", "Rot / Halt"], ["fahrt", "Grün / Fahrt"]],
    ledsignal: [["halt", "Rot / Halt"], ["warnung", "Gelb / Warnung"], ["fahrt", "Grün / Fahrt"]]
  };
  return map[type] || [["on", "Ein"]];
}

function actionOptions(type) {
  const map = {
    relay: [["on", "Einschalten"], ["off", "Ausschalten"]],
    led: [["on", "Einschalten"], ["off", "Ausschalten"]],
    switch: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    crossing: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    signal: [["halt", "Rot / Halt"], ["fahrt", "Grün / Fahrt"]],
    espSignal: [["halt", "Rot / Halt"], ["warnung", "Gelb / Warnung"], ["fahrt", "Grün / Fahrt"]]
  };
  return map[type] || map.relay;
}

function defaultRule() {
  return { id: `RULE_${Date.now()}_${Math.floor(Math.random() * 10000)}`, name: "Neue Automation", enabled: true, cooldownMs: 500, triggerType: "sensor", triggerRef: "", triggerState: "triggered", targetType: "relay", targetRef: "", action: "on" };
}

function toUiRule(rule) {
  const action = Array.isArray(rule?.actions) ? rule.actions[0] || {} : {};
  const targetType = ({ ledsignal: "espSignal", xtrack: "crossing" })[action.kind] || action.kind || "relay";
  const hardwareTarget = ["relay", "led"].includes(targetType);
  const condition = rule?.condition || {};
  const triggerType = condition.kind || "sensor";
  const triggerHardware = ["sensor", "relay", "led"].includes(triggerType);
  let triggerRef = condition.elementId || "";
  if (triggerHardware && condition.module) {
    const channel = triggerType === "sensor" ? condition.sensorId : condition.channel;
    triggerRef = channel ? `${condition.module}::${channel}` : "";
  }
  let triggerState = condition.state || "";
  if (triggerType === "sensor") triggerState = condition.triggered === false ? "free" : "triggered";
  if (!triggerState) triggerState = triggerStateOptions(triggerType)[0][0];
  return {
    id: rule.id,
    name: rule.name || "Automation",
    enabled: rule.enabled !== false,
    cooldownMs: Number(rule.cooldownMs || 500),
    triggerType,
    triggerRef,
    triggerState,
    targetType,
    targetRef: hardwareTarget && action.module && action.channel ? `${action.module}::${action.channel}` : action.elementId || "",
    action: action.state || actionOptions(targetType)[0][0]
  };
}

function toApiRule(rule) {
  const trigger = splitRef(rule.triggerRef);
  const actionKind = rule.targetType === "espSignal" ? "ledsignal" : rule.targetType === "crossing" ? "xtrack" : rule.targetType;
  const hardwareTarget = ["relay", "led"].includes(actionKind);
  const target = splitRef(rule.targetRef);
  const hardwareTrigger = ["sensor", "relay", "led"].includes(rule.triggerType);
  const condition = {
    kind: rule.triggerType,
    module: hardwareTrigger ? trigger.module : "",
    sensorId: rule.triggerType === "sensor" ? String(rule.triggerRef || "").split("::")[1] || "" : "",
    channel: ["relay", "led"].includes(rule.triggerType) ? trigger.channel : 0,
    elementId: hardwareTrigger ? "" : rule.triggerRef,
    state: rule.triggerState,
    triggered: rule.triggerState !== "free"
  };
  return {
    id: rule.id, name: rule.name, enabled: rule.enabled, cooldownMs: Math.max(0, Number(rule.cooldownMs || 0)),
    condition,
    actions: [{ kind: actionKind, elementId: hardwareTarget ? "" : rule.targetRef, module: hardwareTarget ? target.module : "", channel: hardwareTarget ? target.channel : 0, state: rule.action }]
  };
}

function validate(rules) {
  for (let index = 0; index < rules.length; index += 1) {
    if (!rules[index].name.trim()) return `Automation ${index + 1}: Name fehlt`;
    if (!rules[index].triggerRef) return `Automation ${index + 1}: WENN-Auslöser fehlt`;
    if (!rules[index].targetRef) return `Automation ${index + 1}: DANN-Ziel fehlt`;
  }
  return "";
}

let uiRules = [];
let bound = false;
let rulesDirty = false;

export async function rulesLaden() {
  try {
    const data = await apiCall("/rules");
    state.rules = Array.isArray(data?.rules) ? data.rules : [];
  } catch { state.rules = []; }
  uiRules = state.rules.map(toUiRule);
  if (!uiRules.length) uiRules = [defaultRule()];
}

export async function rulesSpeichern() {
  const hint = document.getElementById("rulesHint");
  const error = validate(uiRules);
  if (error) { if (hint) hint.textContent = error; return; }
  if (hint) hint.textContent = "Speichert …";
  const data = await apiCall("/rules", { method: "POST", body: { rules: uiRules.map(toApiRule) } });
  state.rules = Array.isArray(data?.rules) ? data.rules : [];
  uiRules = state.rules.map(toUiRule);
  rulesDirty = false;
  if (hint) hint.textContent = "Automationen gespeichert";
  renderRulesGrid();
}

function renderRow(rule, index, triggers, targets) {
  const triggerTypes = [["sensor", "Sensor"], ["switch", "Weiche"], ["xtrack", "Kreuzungsweiche"], ["signal", "Märklin-Signal"], ["ledsignal", "ESP-Signal"], ["relay", "Relay"], ["led", "LED"]];
  const targetTypes = [["relay", "Relay"], ["led", "Einzelne LED"], ["switch", "Weiche"], ["crossing", "Kreuzungsweiche"], ["signal", "Märklin-Signal"], ["espSignal", "ESP-Signal"]];
  const availableTriggers = triggers.filter((item) => item.type === rule.triggerType);
  const availableTargets = targets.filter((target) => target.type === rule.targetType);
  return `<article class="automation-card ${rule.enabled ? "" : "disabled"}" data-rule-index="${index}">
    <header class="automation-card-head">
      <div class="automation-identity">
        <span class="automation-number">${String(index + 1).padStart(2, "0")}</span>
        <label class="automation-name"><span>Name der Automation</span><input data-field="name" value="${esc(rule.name)}" placeholder="z. B. Einfahrt Gleis 1"></label>
      </div>
      <div class="automation-head-actions">
        <label class="automation-toggle"><input data-field="enabled" type="checkbox" ${rule.enabled ? "checked" : ""}><span>${rule.enabled ? "Aktiv" : "Pausiert"}</span></label>
        <button type="button" class="icon-danger-button" data-action="delete-rule" aria-label="Automation löschen">×</button>
      </div>
    </header>
    <div class="automation-flow">
      <section class="automation-step when-step">
        <div class="automation-step-title"><span>WENN</span><strong>Auslöser</strong></div>
        <div class="automation-condition-grid">
          <label>Typ<select data-field="triggerType">${triggerTypes.map(([value, label]) => `<option value="${value}" ${rule.triggerType === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          <label>Quelle<select class="${rule.triggerRef ? "" : "field-invalid"}" data-field="triggerRef"><option value="">Auslöser wählen…</option>${availableTriggers.map((item) => `<option value="${esc(item.value)}" ${rule.triggerRef === item.value ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select></label>
          <label>Zustand<select data-field="triggerState">${triggerStateOptions(rule.triggerType).map(([value, label]) => `<option value="${value}" ${rule.triggerState === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        </div>
        <p>Die Automation startet, sobald diese Bedingung eintritt.</p>
      </section>
      <div class="automation-arrow" aria-hidden="true">→</div>
      <section class="automation-step then-step">
        <div class="automation-step-title"><span>DANN</span><strong>Aktion</strong></div>
        <div class="automation-action-grid">
          <label>Zieltyp<select data-field="targetType">${targetTypes.map(([value, label]) => `<option value="${value}" ${rule.targetType === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
          <label>Ziel<select class="${rule.targetRef ? "" : "field-invalid"}" data-field="targetRef"><option value="">Ziel wählen…</option>${availableTargets.map((item) => `<option value="${esc(item.value)}" ${rule.targetRef === item.value ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select></label>
          <label>Aktion<select data-field="action">${actionOptions(rule.targetType).map(([value, label]) => `<option value="${value}" ${rule.action === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        </div>
        <p>Dieses Ziel wird nach erfüllter Bedingung geschaltet.</p>
      </section>
    </div>
    <footer class="automation-card-footer">
      <span>Wiederholschutz verhindert mehrfaches Auslösen in kurzer Folge.</span>
      <label>Wiederholschutz <input data-field="cooldownMs" type="number" min="0" step="100" value="${rule.cooldownMs}"> ms</label>
    </footer>
  </article>`;
}

function markRulesDirty() {
  rulesDirty = true;
  const hint = document.getElementById("rulesHint");
  if (hint) hint.textContent = "Änderungen noch nicht gespeichert";
  document.querySelector('[data-action="save-rules"]')?.classList.add("needs-save");
}

export function renderRulesGrid() {
  const root = document.getElementById("rulesGrid");
  if (!root) return;
  if (!uiRules.length) uiRules = [defaultRule()];
  const triggers = allTriggerOptions();
  const targets = targetOptions();
  const active = uiRules.filter((rule) => rule.enabled).length;
  const incomplete = uiRules.filter((rule) => !rule.triggerRef || !rule.targetRef).length;
  root.innerHTML = `<div class="automation-overview">
    <div class="automation-stats"><div><strong>${uiRules.length}</strong><span>Automationen</span></div><div><strong>${active}</strong><span>Aktiv</span></div><div><strong>${incomplete}</strong><span>Unvollständig</span></div></div>
    <div class="rules-actions"><button type="button" class="secondary-button" data-action="add-rule">＋ Automation anlegen</button><button type="button" class="primary-button ${rulesDirty ? "needs-save" : ""}" data-action="save-rules">Änderungen speichern</button></div>
  </div>
  <div id="rulesHint" class="automation-message ${incomplete ? "warning" : ""}">${rulesDirty ? "Änderungen noch nicht gespeichert" : incomplete ? "Unvollständige Automationen sind markiert." : "Alle Automationen sind vollständig konfiguriert."}</div>
  <div class="automation-list">${uiRules.map((rule, index) => renderRow(rule, index, triggers, targets)).join("")}</div>`;
  if (bound) return;
  bound = true;
  root.addEventListener("change", (event) => {
    const card = event.target.closest("[data-rule-index]");
    if (!card) return;
    const rule = uiRules[Number(card.dataset.ruleIndex)];
    const field = event.target.dataset.field;
    if (!rule || !field) return;
    rule[field] = field === "enabled" ? event.target.checked : field === "cooldownMs" ? Number(event.target.value) : event.target.value;
    markRulesDirty();
    if (field === "enabled") { renderRulesGrid(); return; }
    if (field === "targetType") { rule.targetRef = ""; rule.action = actionOptions(rule.targetType)[0][0]; renderRulesGrid(); }
    if (field === "triggerType") { rule.triggerRef = ""; rule.triggerState = triggerStateOptions(rule.triggerType)[0][0]; renderRulesGrid(); }
  });
  root.addEventListener("input", (event) => {
    const card = event.target.closest("[data-rule-index]");
    const field = event.target.dataset.field;
    if (!card || !["name", "cooldownMs"].includes(field)) return;
    uiRules[Number(card.dataset.ruleIndex)][field] = field === "cooldownMs" ? Number(event.target.value) : event.target.value;
    markRulesDirty();
  });
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "add-rule") { uiRules.push(defaultRule()); rulesDirty = true; }
    if (button.dataset.action === "delete-rule") {
      const card = button.closest("[data-rule-index]");
      uiRules.splice(Number(card.dataset.ruleIndex), 1);
      if (!uiRules.length) uiRules.push(defaultRule());
      rulesDirty = true;
    }
    if (button.dataset.action === "save-rules") {
      try { await rulesSpeichern(); } catch (error) { const hint = document.getElementById("rulesHint"); if (hint) { hint.textContent = `Fehler: ${error.message || error}`; hint.className = "automation-message error"; } }
      return;
    }
    renderRulesGrid();
  });
}
