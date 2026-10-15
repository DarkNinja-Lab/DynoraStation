"use strict";

import { state } from "../core/state.js?v=workspace-v11";
import { apiCall } from "../core/api.js?v=workspace-v11";
import { icon } from "../ui/icons.js?v=workspace-v11";
import { esc } from "../core/utils.js?v=workspace-v11";

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
    relay: [["on", "Ein"], ["off", "Aus"]], led: [["on", "Ein"], ["off", "Aus"]],
    switch: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    xtrack: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    signal: [["halt", "Rot / Halt"], ["fahrt", "Grün / Fahrt"]],
    ledsignal: [["halt", "Rot / Halt"], ["warnung", "Gelb / Warnung"], ["fahrt", "Grün / Fahrt"]]
  };
  return map[type] || [["on", "Ein"]];
}
function actionOptions(type) {
  const map = {
    relay: [["on", "Einschalten"], ["off", "Ausschalten"]], led: [["on", "Einschalten"], ["off", "Ausschalten"]],
    switch: [["gerade", "Gerade"], ["abzweig", "Abzweig"]], crossing: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    signal: [["halt", "Rot / Halt"], ["fahrt", "Grün / Fahrt"]],
    espSignal: [["halt", "Rot / Halt"], ["warnung", "Gelb / Warnung"], ["fahrt", "Grün / Fahrt"]]
  };
  return map[type] || map.relay;
}

function newId(prefix) { return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`; }
function defaultAction() { return { targetType: "relay", targetRef: "", action: "on" }; }
function defaultRule() {
  return {
    id: newId("RULE"), enabled: true, cooldownMs: 5000,
    triggerType: "sensor", triggerRef: "", triggerState: "triggered",
    actions: [defaultAction()]
  };
}
function defaultAutomation() { return { id: newId("AUTO"), name: "Neue Automation", rules: [defaultRule()] }; }

function toUiAction(action = {}) {
  const targetType = ({ ledsignal: "espSignal", xtrack: "crossing" })[action.kind] || action.kind || "relay";
  const hardwareTarget = ["relay", "led"].includes(targetType);
  return {
    targetType,
    targetRef: hardwareTarget && action.module && action.channel ? `${action.module}::${action.channel}` : action.elementId || "",
    action: action.state || actionOptions(targetType)[0][0]
  };
}
function toUiRule(rule) {
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
    enabled: rule.enabled !== false,
    cooldownMs: Number(rule.cooldownMs ?? 5000),
    triggerType, triggerRef, triggerState,
    actions: (Array.isArray(rule.actions) ? rule.actions : []).map(toUiAction)
  };
}
function groupApiRules(rules) {
  const groups = new Map();
  (Array.isArray(rules) ? rules : []).forEach((rule) => {
    const groupId = String(rule.groupId || rule.id);
    if (!groups.has(groupId)) groups.set(groupId, { id: groupId, name: rule.name || "Automation", rules: [] });
    groups.get(groupId).rules.push(toUiRule(rule));
  });
  return [...groups.values()];
}
function toApiRule(automation, rule) {
  const trigger = splitRef(rule.triggerRef);
  const hardwareTrigger = ["sensor", "relay", "led"].includes(rule.triggerType);
  return {
    id: rule.id,
    groupId: automation.id,
    name: automation.name,
    enabled: rule.enabled,
    cooldownMs: Math.max(0, Number(rule.cooldownMs || 0)),
    condition: {
      kind: rule.triggerType,
      module: hardwareTrigger ? trigger.module : "",
      sensorId: rule.triggerType === "sensor" ? String(rule.triggerRef || "").split("::")[1] || "" : "",
      channel: ["relay", "led"].includes(rule.triggerType) ? trigger.channel : 0,
      elementId: hardwareTrigger ? "" : rule.triggerRef,
      state: rule.triggerState,
      triggered: rule.triggerState !== "free"
    },
    actions: rule.actions.map((action) => {
      const targetType = action.targetType === "espSignal" ? "ledsignal" : action.targetType === "crossing" ? "xtrack" : action.targetType;
      const hardwareTarget = ["relay", "led"].includes(targetType);
      const target = splitRef(action.targetRef);
      return {
        kind: targetType,
        elementId: hardwareTarget ? "" : action.targetRef,
        module: hardwareTarget ? target.module : "",
        channel: hardwareTarget ? target.channel : 0,
        state: action.action
      };
    })
  };
}
function validate(automations) {
  for (let groupIndex = 0; groupIndex < automations.length; groupIndex += 1) {
    const automation = automations[groupIndex];
    if (!automation.name.trim()) return `Automation ${groupIndex + 1}: Name fehlt`;
    if (!automation.rules.length) return `${automation.name}: mindestens eine Regel hinzufügen`;
    for (let ruleIndex = 0; ruleIndex < automation.rules.length; ruleIndex += 1) {
      const rule = automation.rules[ruleIndex];
      const label = `${automation.name} · Regel ${ruleIndex + 1}`;
      if (!rule.triggerRef) return `${label}: WENN-Auslöser fehlt`;
      if (!rule.actions.length) return `${label}: mindestens eine DANN-Aktion hinzufügen`;
      if (rule.actions.some((action) => !action.targetRef)) return `${label}: DANN-Ziel fehlt`;
    }
  }
  return "";
}

let uiAutomations = [];
let bound = false;
let rulesDirty = false;
const selectedAutomations = new Set();

export async function rulesLaden() {
  try {
    const data = await apiCall("/rules");
    state.rules = Array.isArray(data?.rules) ? data.rules : [];
  } catch { state.rules = []; }
  uiAutomations = groupApiRules(state.rules);
  selectedAutomations.clear();
}
export async function rulesSpeichern() {
  const hint = document.getElementById("rulesHint");
  const error = validate(uiAutomations);
  if (error) { if (hint) hint.textContent = error; return; }
  if (hint) hint.textContent = "Speichert …";
  const rules = uiAutomations.flatMap((automation) => automation.rules.map((rule) => toApiRule(automation, rule)));
  const data = await apiCall("/rules", { method: "POST", body: { rules } });
  state.rules = Array.isArray(data?.rules) ? data.rules : [];
  uiAutomations = groupApiRules(state.rules);
  selectedAutomations.clear();
  rulesDirty = false;
  if (hint) hint.textContent = "Automationen gespeichert";
  renderRulesGrid();
}

function renderActionRow(action, automationIndex, ruleIndex, actionIndex, targets) {
  const targetTypes = [["relay", "Relay"], ["led", "Einzelne LED"], ["switch", "Weiche"], ["crossing", "Kreuzungsweiche"], ["signal", "Märklin-Signal"], ["espSignal", "ESP-Signal"]];
  const availableTargets = targets.filter((target) => target.type === action.targetType);
  return `<div class="automation-action-row" data-action-index="${actionIndex}">
    <label>Zieltyp<select data-action-field="targetType">${targetTypes.map(([value, label]) => `<option value="${value}" ${action.targetType === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <label>Ziel<select class="${action.targetRef ? "" : "field-invalid"}" data-action-field="targetRef"><option value="">Ziel wählen…</option>${availableTargets.map((item) => `<option value="${esc(item.value)}" ${action.targetRef === item.value ? "selected" : ""}>${esc(item.label)}</option>`).join("")}</select></label>
    <label>Aktion<select data-action-field="action">${actionOptions(action.targetType).map(([value, label]) => `<option value="${value}" ${action.action === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
    <button type="button" class="icon-danger-button" data-action="delete-action" data-automation-index="${automationIndex}" data-rule-index="${ruleIndex}" data-action-index="${actionIndex}" aria-label="Aktion löschen">${icon("trash")}</button>
  </div>`;
}
function renderRule(rule, automationIndex, ruleIndex, triggers, targets) {
  const triggerTypes = [["sensor", "Sensor"], ["switch", "Weiche"], ["xtrack", "Kreuzungsweiche"], ["signal", "Märklin-Signal"], ["ledsignal", "ESP-Signal"], ["relay", "Relay"], ["led", "LED"]];
  const availableTriggers = triggers.filter((item) => item.type === rule.triggerType);
  return `<article class="automation-card automation-subrule ${rule.enabled ? "" : "disabled"}" data-automation-index="${automationIndex}" data-rule-index="${ruleIndex}">
    <header class="automation-card-head">
      <div class="automation-identity"><span class="automation-number">Regel ${ruleIndex + 1}</span></div>
      <div class="automation-head-actions">
        <label class="automation-toggle"><input data-field="enabled" type="checkbox" ${rule.enabled ? "checked" : ""}><span>${rule.enabled ? "Aktiv" : "Pausiert"}</span></label>
        <button type="button" class="icon-danger-button" data-action="delete-rule" aria-label="Regel löschen">${icon("trash")}</button>
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
        <p>Diese Regel reagiert auf ihren eigenen Auslöser.</p>
      </section>
      <div class="automation-arrow" aria-hidden="true">${icon("arrow-right")}</div>
      <section class="automation-step then-step">
        <div class="automation-step-title"><span>DANN</span><strong>Aktionen</strong></div>
        <div class="automation-action-list">${rule.actions.map((action, actionIndex) => renderActionRow(action, automationIndex, ruleIndex, actionIndex, targets)).join("")}</div>
        <button type="button" class="secondary-button automation-add-action" data-action="add-action" data-automation-index="${automationIndex}" data-rule-index="${ruleIndex}">${icon("plus")} Aktion hinzufügen</button>
      </section>
    </div>
    <footer class="automation-card-footer">
      <span>Diese Regel hat eine eigene Sperrzeit.</span>
      <label>Sperrzeit <input data-field="cooldownSeconds" type="number" min="0" max="86400" step="0.5" value="${Math.round((rule.cooldownMs / 1000) * 10) / 10}"> Sekunden</label>
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
  const triggers = allTriggerOptions();
  const targets = targetOptions();
  const ruleCount = uiAutomations.reduce((count, automation) => count + automation.rules.length, 0);
  const active = uiAutomations.reduce((count, automation) => count + automation.rules.filter((rule) => rule.enabled).length, 0);
  const incomplete = uiAutomations.reduce((count, automation) => count + automation.rules.filter((rule) => !rule.triggerRef || !rule.actions.length || rule.actions.some((action) => !action.targetRef)).length, 0);
  const search = String(document.getElementById("automationSearch")?.value || "").trim().toLocaleLowerCase("de-DE");
  const visibleAutomations = uiAutomations.map((automation, index) => ({ automation, index })).filter(({ automation }) => !search || `${automation.name} ${automation.rules.map((rule) => `${triggerTypeLabel(rule.triggerType)} ${rule.triggerRef} ${rule.actions.map((action) => `${targetTypeLabel(action.targetType)} ${action.targetRef}`).join(" ")}`).join(" ")}`.toLocaleLowerCase("de-DE").includes(search));
  const selectAll = document.getElementById("automationSelectVisible");
  if (selectAll) { selectAll.checked = visibleAutomations.length > 0 && visibleAutomations.every(({ automation }) => selectedAutomations.has(automation.id)); selectAll.indeterminate = visibleAutomations.some(({ automation }) => selectedAutomations.has(automation.id)) && !selectAll.checked; }
  const selectionCount = document.getElementById("automationSelectionCount");
  if (selectionCount) selectionCount.textContent = `${selectedAutomations.size} ausgewählt`;
  const deleteSelected = document.getElementById("deleteSelectedAutomations");
  if (deleteSelected) deleteSelected.disabled = selectedAutomations.size === 0;
  root.innerHTML = `<div class="automation-overview">
    <div class="automation-stats"><div><strong>${uiAutomations.length}</strong><span>Automationen</span></div><div><strong>${ruleCount}</strong><span>Regeln</span></div><div><strong>${active}</strong><span>Aktiv</span></div></div>
    <div class="rules-actions"><button type="button" class="secondary-button" data-action="add-automation">${icon("plus")}<span>Automation anlegen</span></button><button type="button" class="primary-button ${rulesDirty ? "needs-save" : ""}" data-action="save-rules">Änderungen speichern</button></div>
  </div>
  <div id="rulesHint" class="automation-message ${incomplete ? "warning" : ""}">${rulesDirty ? "Änderungen noch nicht gespeichert" : incomplete ? "Unvollständige Regeln sind markiert." : uiAutomations.length ? "Alle Regeln sind vollständig konfiguriert." : "Noch keine Automation angelegt."}</div>
  <div class="automation-list">${uiAutomations.length ? visibleAutomations.map(({ automation, index: automationIndex }) => `<section class="automation-group ${selectedAutomations.has(automation.id) ? "selected" : ""}" data-automation-index="${automationIndex}">
    <header class="automation-group-head">
      <label class="collection-item-select" aria-label="Automation auswählen"><input type="checkbox" data-select-automation="${esc(automation.id)}" ${selectedAutomations.has(automation.id) ? "checked" : ""}></label>
      <label class="automation-name"><span>Name der Automation</span><input data-group-field="name" value="${esc(automation.name)}" placeholder="z. B. Einfahrt Gleis 1"></label>
      <div class="automation-head-actions"><span class="automation-group-count">${automation.rules.length} ${automation.rules.length === 1 ? "Regel" : "Regeln"}</span><button type="button" class="icon-danger-button" data-action="delete-automation" aria-label="Automation löschen">${icon("trash")}</button></div>
    </header>
    <div class="automation-subrules">${automation.rules.map((rule, ruleIndex) => renderRule(rule, automationIndex, ruleIndex, triggers, targets)).join("")}</div>
    <button type="button" class="secondary-button automation-add-rule" data-action="add-rule" data-automation-index="${automationIndex}">${icon("plus")} Regel hinzufügen</button>
  </section>`).join("") : `<div class="automation-empty"><span>${icon("events", "ui-icon automation-empty-icon")}</span><strong>${search ? "Keine passende Automation" : "Noch keine Automation"}</strong><p>${search ? "Passe den Suchbegriff an." : "Lege eine Automation an und ergänze darunter beliebig mehrere WENN-DANN-Regeln."}</p></div>`}</div>`;

  if (bound) return;
  bound = true;
  root.addEventListener("change", (event) => {
    if (event.target.matches("[data-select-automation]")) {
      const id = event.target.dataset.selectAutomation;
      if (event.target.checked) selectedAutomations.add(id); else selectedAutomations.delete(id);
      renderRulesGrid(); return;
    }
    const group = event.target.closest("[data-automation-index]");
    const automation = group && uiAutomations[Number(group.dataset.automationIndex)];
    if (event.target.dataset.groupField === "name" && automation) { automation.name = event.target.value; markRulesDirty(); return; }
    const card = event.target.closest("[data-rule-index]");
    const rule = card && automation?.rules[Number(card.dataset.ruleIndex)];
    if (!rule) return;
    if (event.target.dataset.actionField) {
      const action = rule.actions[Number(event.target.closest("[data-action-index]")?.dataset.actionIndex)];
      if (!action) return;
      const field = event.target.dataset.actionField;
      action[field] = event.target.value;
      if (field === "targetType") { action.targetRef = ""; action.action = actionOptions(action.targetType)[0][0]; }
      markRulesDirty(); renderRulesGrid(); return;
    }
    const field = event.target.dataset.field;
    if (!field) return;
    rule[field === "cooldownSeconds" ? "cooldownMs" : field] = field === "enabled"
      ? event.target.checked
      : field === "cooldownSeconds" ? Math.max(0, Number(event.target.value) || 0) * 1000 : event.target.value;
    if (field === "triggerType") { rule.triggerRef = ""; rule.triggerState = triggerStateOptions(rule.triggerType)[0][0]; }
    markRulesDirty(); renderRulesGrid();
  });
  root.addEventListener("input", (event) => {
    const group = event.target.closest("[data-automation-index]");
    const automation = group && uiAutomations[Number(group.dataset.automationIndex)];
    if (event.target.dataset.groupField === "name" && automation) { automation.name = event.target.value; markRulesDirty(); return; }
    const card = event.target.closest("[data-rule-index]");
    const rule = card && automation?.rules[Number(card.dataset.ruleIndex)];
    if (rule && event.target.dataset.field === "cooldownSeconds") {
      rule.cooldownMs = Math.max(0, Number(event.target.value) || 0) * 1000;
      markRulesDirty();
    }
  });
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const automationIndex = Number(button.dataset.automationIndex ?? button.closest("[data-automation-index]")?.dataset.automationIndex);
    const automation = uiAutomations[automationIndex];
    const ruleIndex = Number(button.dataset.ruleIndex ?? button.closest("[data-rule-index]")?.dataset.ruleIndex);
    const rule = automation?.rules[ruleIndex];
    switch (button.dataset.action) {
      case "add-automation": uiAutomations.push(defaultAutomation()); rulesDirty = true; break;
      case "delete-automation": if (automation) { uiAutomations.splice(automationIndex, 1); selectedAutomations.delete(automation.id); } rulesDirty = true; break;
      case "add-rule": if (automation) automation.rules.push(defaultRule()); rulesDirty = true; break;
      case "delete-rule": if (automation) { automation.rules.splice(ruleIndex, 1); if (!automation.rules.length) uiAutomations.splice(automationIndex, 1); } rulesDirty = true; break;
      case "add-action": if (rule) rule.actions.push(defaultAction()); rulesDirty = true; break;
      case "delete-action": if (rule) rule.actions.splice(Number(button.dataset.actionIndex), 1); rulesDirty = true; break;
      case "save-rules":
        try { await rulesSpeichern(); } catch (error) { const hint = document.getElementById("rulesHint"); if (hint) { hint.textContent = `Fehler: ${error.message || error}`; hint.className = "automation-message error"; } }
        return;
      default: return;
    }
    markRulesDirty(); renderRulesGrid();
  });
  document.getElementById("automationSearch")?.addEventListener("input", renderRulesGrid);
  document.getElementById("automationSelectVisible")?.addEventListener("change", (event) => {
    const search = String(document.getElementById("automationSearch")?.value || "").trim().toLocaleLowerCase("de-DE");
    uiAutomations.filter((automation) => !search || `${automation.name} ${automation.rules.map((rule) => `${triggerTypeLabel(rule.triggerType)} ${rule.triggerRef} ${rule.actions.map((action) => `${targetTypeLabel(action.targetType)} ${action.targetRef}`).join(" ")}`).join(" ")}`.toLocaleLowerCase("de-DE").includes(search)).forEach((automation) => event.target.checked ? selectedAutomations.add(automation.id) : selectedAutomations.delete(automation.id));
    renderRulesGrid();
  });
  document.getElementById("deleteSelectedAutomations")?.addEventListener("click", () => {
    const chosen = uiAutomations.filter((automation) => selectedAutomations.has(automation.id));
    if (!chosen.length || !confirm(`${chosen.length} Automation${chosen.length === 1 ? "" : "en"} löschen? Diese Änderung muss anschließend gespeichert werden.`)) return;
    uiAutomations = uiAutomations.filter((automation) => !selectedAutomations.has(automation.id));
    selectedAutomations.clear(); markRulesDirty(); renderRulesGrid();
  });
}
