"use strict";

import { state } from "../core/state.js?v=workspace-v11";
import { apiCall } from "../core/api.js?v=workspace-v11";
import { icon } from "../ui/icons.js?v=workspace-v11";
import { renderAutomation } from "./render.js?v=interface-v2";

import { typeNames, triggerStates, actionStates, actionStep, delayStep, defaultRule, defaultAutomation, groupApiRules, apiRule, incomplete, validate, searchText } from "./model.js?v=interface-v1";

function modules() { return Object.values(state.hardware?.modules || {}); }
function relayName(moduleId, channel) { return state.relayConfig?.[`${moduleId}:${channel}`]?.name || `Relais ${channel}`; }
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
  const map = { switch: "switch", signal: "signal", crossing: "xtrack", xtrack: "xtrack", espSignal: "ledsignal", ledSignal: "ledsignal" };
  return [...hardware, ...(state.layout?.elemente || []).flatMap((element) => map[element.typ] ? [{ type: map[element.typ], value: element.id, label: element.name || `${typeNames[map[element.typ]]} · ${element.id}` }] : [])];
}
function targetOptions() {
  const hardware = modules().flatMap((module) => [
    ...(module.relays || []).map((_, index) => ({ type: "relay", value: `${module.id}::${index + 1}`, label: `${module.name || module.id} · ${relayName(module.id, index + 1)}` })),
    ...(module.leds || []).map((_, index) => ({ type: "led", value: `${module.id}::${index + 1}`, label: `${module.name || module.id} · LED ${index + 1}` }))
  ]);
  const map = { switch: "switch", signal: "signal", crossing: "crossing", xtrack: "crossing", espSignal: "espSignal", ledSignal: "espSignal" };
  return [...hardware, ...(state.layout?.elemente || []).flatMap((element) => map[element.typ] ? [{ type: map[element.typ], value: element.id, label: element.name || `${typeNames[map[element.typ]]} · ${element.id}` }] : [])];
}
let uiAutomations = [];
let bound = false;
let rulesDirty = false;
const selectedAutomations = new Set();
const collapsedAutomations = new Set();
const expandedRules = new Set();

export async function rulesLaden() {
  try { const data = await apiCall("/rules"); state.rules = Array.isArray(data?.rules) ? data.rules : []; } catch { state.rules = []; }
  uiAutomations = groupApiRules(state.rules); selectedAutomations.clear(); collapseAllAutomations();
  expandedRules.clear();
  uiAutomations.forEach((automation) => { if (automation.rules[0]) expandedRules.add(automation.rules[0].id); });
}
export function collapseAllAutomations() { collapsedAutomations.clear(); uiAutomations.forEach((automation) => collapsedAutomations.add(automation.id)); }
export async function rulesSpeichern() {
  const hint = document.getElementById("rulesHint"); const error = validate(uiAutomations);
  if (error) { if (hint) { hint.textContent = error; hint.classList.remove("is-quiet"); hint.classList.add("error"); } return; }
  if (hint) hint.classList.remove("is-quiet");
  if (hint) hint.textContent = "Speichert …";
  const data = await apiCall("/rules", { method: "POST", body: { rules: uiAutomations.flatMap((automation) => automation.rules.map((rule) => apiRule(automation, rule))) } });
  state.rules = Array.isArray(data?.rules) ? data.rules : []; uiAutomations = groupApiRules(state.rules); selectedAutomations.clear(); rulesDirty = false; state.settingsDirty.rules = false;
  if (hint) hint.textContent = "Automationen gespeichert"; renderRulesGrid();
}
function markDirty() { rulesDirty = true; state.settingsDirty.rules = true; const hint = document.getElementById("rulesHint"); if (hint) { hint.textContent = "Änderungen noch nicht gespeichert"; hint.classList.remove("is-quiet", "error"); } document.querySelector('[data-action="save-rules"]')?.classList.add("needs-save"); }
function visibleAutomations() { const search = String(document.getElementById("automationSearch")?.value || "").trim().toLocaleLowerCase("de-DE"); return uiAutomations.map((automation, index) => ({ automation, index })).filter(({ automation }) => !search || `${automation.name} ${automation.rules.map(searchText).join(" ")}`.toLocaleLowerCase("de-DE").includes(search)); }
export function renderRulesGrid() {
  const root = document.getElementById("rulesGrid"); if (!root) return;
  const triggers = allTriggerOptions(); const targets = targetOptions(); const visible = visibleAutomations();
  const ruleCount = uiAutomations.reduce((total, automation) => total + automation.rules.length, 0); const active = uiAutomations.reduce((total, automation) => total + automation.rules.filter((rule) => rule.enabled).length, 0); const invalid = uiAutomations.reduce((total, automation) => total + automation.rules.filter(incomplete).length, 0);
  const selectAll = document.getElementById("automationSelectVisible"); if (selectAll) { selectAll.checked = visible.length > 0 && visible.every(({ automation }) => selectedAutomations.has(automation.id)); selectAll.indeterminate = visible.some(({ automation }) => selectedAutomations.has(automation.id)) && !selectAll.checked; }
  const selection = document.getElementById("automationSelectionCount"); if (selection) selection.textContent = `${selectedAutomations.size} ausgewählt`;
  const deleteSelected = document.getElementById("deleteSelectedAutomations"); if (deleteSelected) deleteSelected.disabled = selectedAutomations.size === 0;
  const search = String(document.getElementById("automationSearch")?.value || "").trim();
  root.innerHTML = `<div class="automation-overview"><p class="automation-total">${uiAutomations.length} ${uiAutomations.length === 1 ? "Automation" : "Automationen"} <span>· ${active} von ${ruleCount} ${ruleCount === 1 ? "Regel" : "Regeln"} aktiv</span></p><div class="rules-actions"><button type="button" class="secondary-button" data-action="add-automation" aria-label="Automation anlegen">${icon("plus")}<span>Neue Automation</span></button><button type="button" class="primary-button ${rulesDirty ? "needs-save" : ""}" data-action="save-rules" aria-label="Änderungen speichern">${icon("check")}<span>Speichern</span></button></div></div><div role="status" aria-live="polite" id="rulesHint" class="automation-message ${invalid ? "warning" : ""} ${!rulesDirty && !invalid ? "is-quiet" : ""}">${rulesDirty ? "Änderungen noch nicht gespeichert" : invalid ? "Unvollständige Regeln sind markiert." : uiAutomations.length ? "Alle Regeln sind vollständig konfiguriert." : "Noch keine Automation angelegt."}</div><div class="automation-list">${visible.length ? visible.map(({ automation, index }) => renderAutomation(automation, index, { selected: selectedAutomations.has(automation.id), collapsed: collapsedAutomations.has(automation.id), triggers, targets, expandedRules })).join("") : `<div class="automation-empty"><span>${icon("events", "ui-icon automation-empty-icon")}</span><strong>${search ? "Keine passende Automation" : "Noch keine Automation"}</strong><p>${search ? "Passe den Suchbegriff an." : "Lege eine Automation an und erstelle darunter klare WENN-DANN-Abläufe."}</p></div>`}</div>`;
  if (!bound) bindRulesEvents(root);
}
function contextFor(target) { const group = target.closest("[data-automation-index]"); const automation = group && uiAutomations[Number(group.dataset.automationIndex)]; const card = target.closest("[data-rule-index]"); const rule = card && automation?.rules[Number(card.dataset.ruleIndex)]; const step = rule?.steps[Number(target.closest("[data-step-index]")?.dataset.stepIndex)]; return { group, automation, rule, step }; }
function bindRulesEvents(root) {
  bound = true;
  root.addEventListener("toggle", (event) => {
    const id = event.target.dataset.ruleDisclosure;
    if (!id) return;
    if (event.target.open) expandedRules.add(id);
    else expandedRules.delete(id);
  }, true);
  root.addEventListener("change", (event) => {
    if (event.target.matches("[data-select-automation]")) { event.target.checked ? selectedAutomations.add(event.target.dataset.selectAutomation) : selectedAutomations.delete(event.target.dataset.selectAutomation); renderRulesGrid(); return; }
    const { automation, rule, step } = contextFor(event.target);
    if (event.target.dataset.groupField === "name" && automation) { automation.name = event.target.value; markDirty(); return; }
    if (!rule) return;
    if (event.target.matches("[data-step-target]") && step) {
      const selected = new Set(step.targetRefs || []);
      if (event.target.checked) selected.add(event.target.value);
      else selected.delete(event.target.value);
      step.targetRefs = [...selected];
      const field = event.target.closest(".automation-targets");
      field.classList.toggle("field-invalid", selected.size === 0);
      const count = field.querySelector("[data-target-count]");
      if (count) count.textContent = selected.size + " ausgew" + String.fromCharCode(228) + "hlt";
      const picker = field.closest(".automation-target-picker");
      const preview = picker?.querySelector("[data-target-preview]");
      if (preview) preview.textContent = [...field.querySelectorAll(".automation-target-option")]
        .filter((label) => label.querySelector("input").checked)
        .map((label) => label.querySelector("span").textContent).join(" · ") || "Noch kein Ziel ausgewählt";
      markDirty();
      return;
    }
    if (event.target.dataset.stepField && step) {
      const field = event.target.dataset.stepField;
      if (field === "targetRefs") step.targetRefs = [...event.target.selectedOptions].map((option) => option.value);
      else if (field === "durationSeconds") step.durationMs = Math.max(0, Number(event.target.value) || 0) * 1000;
      else step[field] = event.target.value;
      if (field === "targetType") { step.targetRefs = []; step.action = actionStates(step.targetType)[0][0]; }
      markDirty(); renderRulesGrid(); return;
    }
    const field = event.target.dataset.field; if (!field) return;
    rule[field === "cooldownSeconds" ? "cooldownMs" : field] = field === "enabled" ? event.target.checked : field === "cooldownSeconds" ? Math.max(0, Number(event.target.value) || 0) * 1000 : event.target.value;
    if (field === "triggerType") { rule.triggerRef = ""; rule.triggerState = triggerStates(rule.triggerType)[0][0]; }
    markDirty(); renderRulesGrid();
  });
  root.addEventListener("input", (event) => {
    const { automation, rule, step } = contextFor(event.target);
    if (event.target.dataset.groupField === "name" && automation) { automation.name = event.target.value; markDirty(); return; }
    if (!rule) return;
    if (event.target.dataset.field === "name") { rule.name = event.target.value; markDirty(); }
    if (event.target.dataset.field === "cooldownSeconds") { rule.cooldownMs = Math.max(0, Number(event.target.value) || 0) * 1000; markDirty(); }
    if (step && event.target.dataset.stepField === "durationSeconds") { step.durationMs = Math.max(0, Number(event.target.value) || 0) * 1000; markDirty(); }
  });
  root.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]"); if (!button) return;
    const { automation, rule } = contextFor(button); const automationIndex = Number(button.dataset.automationIndex ?? button.closest("[data-automation-index]")?.dataset.automationIndex); const ruleIndex = Number(button.dataset.ruleIndex ?? button.closest("[data-rule-index]")?.dataset.ruleIndex);
    switch (button.dataset.action) {
      case "toggle-automation": if (automation) { collapsedAutomations.has(automation.id) ? collapsedAutomations.delete(automation.id) : collapsedAutomations.add(automation.id); renderRulesGrid(); } return;
      case "add-automation": { const created = defaultAutomation(); uiAutomations.push(created); collapsedAutomations.delete(created.id); expandedRules.add(created.rules[0].id); break; }
      case "delete-automation": if (automation) { uiAutomations.splice(automationIndex, 1); selectedAutomations.delete(automation.id); } break;
      case "add-rule": if (automation) { const created = defaultRule(); automation.rules.push(created); expandedRules.add(created.id); } break;
      case "delete-rule": if (automation) { automation.rules.splice(ruleIndex, 1); if (!automation.rules.length) uiAutomations.splice(automationIndex, 1); } break;
      case "add-action-step": if (rule) rule.steps.push(actionStep()); break;
      case "add-delay-step": if (rule) rule.steps.push(delayStep()); break;
      case "add-initial-delay": if (rule) rule.steps.unshift(delayStep()); break;
      case "delete-step": if (rule) rule.steps.splice(Number(button.dataset.stepIndex), 1); break;
      case "save-rules": try { await rulesSpeichern(); } catch (error) { const hint = document.getElementById("rulesHint"); if (hint) { hint.textContent = `Fehler: ${error.message || error}`; hint.className = "automation-message error"; } } return;
      default: return;
    }
    markDirty(); renderRulesGrid();
  });
  document.getElementById("automationSearch")?.addEventListener("input", renderRulesGrid);
  document.getElementById("automationSelectVisible")?.addEventListener("change", (event) => { visibleAutomations().forEach(({ automation }) => event.target.checked ? selectedAutomations.add(automation.id) : selectedAutomations.delete(automation.id)); renderRulesGrid(); });
  document.getElementById("deleteSelectedAutomations")?.addEventListener("click", () => { const chosen = uiAutomations.filter((automation) => selectedAutomations.has(automation.id)); if (!chosen.length || !confirm(`${chosen.length} Automation${chosen.length === 1 ? "" : "en"} löschen? Diese Änderung muss anschließend gespeichert werden.`)) return; uiAutomations = uiAutomations.filter((automation) => !selectedAutomations.has(automation.id)); selectedAutomations.clear(); markDirty(); renderRulesGrid(); });
}
