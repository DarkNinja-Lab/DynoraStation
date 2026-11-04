"use strict";

import { icon } from "../ui/icons.js?v=workspace-v11";
import { esc } from "../core/utils.js?v=workspace-v11";
import { targetKinds, triggerKinds, triggerStates, actionStates } from "./model.js?v=interface-v1";

function options(items, selected) {
  return items.map(([value, label]) => `<option value="${esc(value)}" ${value === selected ? "selected" : ""}>${esc(label)}</option>`).join("");
}

function renderTargets(step, targets) {
  const selected = new Set(step.targetRefs || []);
  const available = targets.filter((target) => target.type === step.targetType);
  const missing = [...selected].filter((ref) => !available.some((target) => target.value === ref));
  const choices = [...available, ...missing.map((ref) => ({ value: ref, label: `${ref} · derzeit nicht verfügbar` }))];
  const preview = choices.filter((target) => selected.has(target.value)).map((target) => target.label).join(" · ");
  return `<details class="automation-target-picker" ${selected.size ? "" : "open"}><summary><span><b>Ziele auswählen</b><small data-target-preview>${esc(preview || "Noch kein Ziel ausgewählt")}</small></span>${icon("chevron-down")}</summary><fieldset class="automation-targets ${selected.size ? "" : "field-invalid"}">
    <legend>Ziele <span data-target-count>${selected.size} ausgewählt</span></legend>
    <div class="automation-target-list">${choices.length ? choices.map((target) => `<label class="automation-target-option"><input type="checkbox" data-step-target value="${esc(target.value)}" ${selected.has(target.value) ? "checked" : ""}><span>${esc(target.label)}</span></label>`).join("") : `<p class="automation-target-empty">Noch keine passenden Ziele. Lege ein Bauteil im Gleisplan an oder verbinde ein Modul.</p>`}</div>
    <small>Ein oder mehrere Ziele antippen.</small>
  </fieldset></details>`;
}

function renderStep(step, stepIndex, targets) {
  const delay = step.type === "delay";
  const title = delay ? "Wartezeit" : `Aktion ${stepIndex + 1}`;
  return `<div class="automation-sequence-step ${delay ? "automation-delay-step" : "automation-action-step"}" data-step-index="${stepIndex}">
    <div class="automation-sequence-step-head"><span class="automation-step-badge">${stepIndex + 1}</span><strong>${delay ? "Warten" : "Schalten"}</strong><button type="button" class="icon-danger-button" data-action="delete-step" data-step-index="${stepIndex}" aria-label="${title} löschen">${icon("trash")}</button></div>
    ${delay ? `<label class="automation-duration-field"><span>Dauer in Sekunden</span><input data-step-field="durationSeconds" type="number" min="0.1" max="86400" step="0.1" value="${Math.round((Number(step.durationMs || 0) / 1000) * 10) / 10}"><small>Danach geht der Ablauf mit dem nächsten Schritt weiter.</small></label>` : `<div class="automation-action-grid">
      <label>Zieltyp<select data-step-field="targetType">${options(targetKinds, step.targetType)}</select></label>
      <label>Schaltaktion<select data-step-field="action">${options(actionStates(step.targetType), step.action)}</select></label>
      ${renderTargets(step, targets)}
    </div>`}
  </div>`;
}

export function renderRule(rule, automationIndex, ruleIndex, triggers, targets, expanded = true) {
  const available = triggers.filter((item) => item.type === rule.triggerType);
  const triggerChoices = available.map((item) => [item.value, item.label]);
  if (rule.triggerRef && !available.some((item) => item.value === rule.triggerRef)) {
    triggerChoices.push([rule.triggerRef, `${rule.triggerRef} · derzeit nicht verfügbar`]);
  }
  const source = available.find((item) => item.value === rule.triggerRef)?.label || "Auslöser festlegen";
  const state = triggerStates(rule.triggerType).find(([value]) => value === rule.triggerState)?.[1] || "";
  return `<article class="automation-card automation-subrule ${rule.enabled ? "" : "disabled"}" data-automation-index="${automationIndex}" data-rule-index="${ruleIndex}">
    <details class="automation-rule-disclosure" data-rule-disclosure="${esc(rule.id)}" ${expanded ? "open" : ""}><summary><span class="automation-rule-summary-copy"><strong>${esc(rule.name || `Regel ${ruleIndex + 1}`)}</strong><small>${esc(source)}${rule.triggerRef ? ` · ${esc(state)}` : ""} · ${rule.steps.length} ${rule.steps.length === 1 ? "Schritt" : "Schritte"}</small></span><span class="automation-rule-summary-state">${rule.enabled ? "Aktiv" : "Pausiert"}</span>${icon("chevron-down")}</summary>
    <header class="automation-card-head"><div class="automation-identity"><span class="automation-number">${ruleIndex + 1}</span><label class="automation-rule-name"><span>Name der Regel</span><input data-field="name" value="${esc(rule.name)}" placeholder="z. B. Zug kommt an" maxlength="120"></label></div><div class="automation-head-actions"><label class="automation-toggle"><input data-field="enabled" type="checkbox" role="switch" aria-label="Regel aktivieren" ${rule.enabled ? "checked" : ""}><span>${rule.enabled ? "Aktiv" : "Pausiert"}</span></label><button type="button" class="icon-danger-button" data-action="delete-rule" aria-label="Regel löschen">${icon("trash")}</button></div></header>
    <div class="automation-flow">
      <section class="automation-step when-step"><div class="automation-step-title"><strong>Wann soll die Regel starten?</strong></div><div class="automation-condition-grid">
        <label>Typ<select data-field="triggerType">${options(triggerKinds, rule.triggerType)}</select></label>
        <label>Quelle<select class="${rule.triggerRef ? "" : "field-invalid"}" data-field="triggerRef"><option value="">Auslöser auswählen</option>${options(triggerChoices, rule.triggerRef)}</select></label>
        <label>Zustand<select data-field="triggerState">${options(triggerStates(rule.triggerType), rule.triggerState)}</select></label>
      </div></section>
      <div class="automation-arrow" aria-hidden="true">${icon("arrow-right")}</div>
      <section class="automation-step then-step"><div class="automation-step-title"><strong>Was soll danach passieren?</strong></div><div class="automation-sequence">${rule.steps.map((step, index) => renderStep(step, index, targets)).join("")}</div><div class="automation-sequence-actions">
        ${rule.steps[0]?.type === "delay" ? "" : `<button type="button" class="text-button" data-action="add-initial-delay">${icon("plus")} Zuerst warten</button>`}
        <button type="button" class="secondary-button" data-action="add-action-step">${icon("plus")} Aktion hinzufügen</button><button type="button" class="secondary-button" data-action="add-delay-step">${icon("plus")} Wartezeit hinzufügen</button>
      </div></section>
    </div>
    <footer class="automation-card-footer"><details class="automation-rule-options"><summary>Weitere Optionen · Sperrzeit ${Math.round((rule.cooldownMs / 1000) * 10) / 10} s</summary><label>Sperrzeit in Sekunden<input data-field="cooldownSeconds" type="number" min="0" max="86400" step="0.5" value="${Math.round((rule.cooldownMs / 1000) * 10) / 10}"></label><p>Verhindert, dass die Regel innerhalb dieser Zeit erneut startet.</p></details></footer>
    </details>
  </article>`;
}

export function renderAutomation(automation, index, { selected, collapsed, triggers, targets, expandedRules }) {
  return `<section class="automation-group ${selected ? "selected" : ""} ${collapsed ? "is-collapsed" : ""}" data-automation-index="${index}">
    <header class="automation-group-head"><label class="collection-item-select"><input type="checkbox" data-select-automation="${esc(automation.id)}" ${selected ? "checked" : ""} aria-label="${esc(automation.name)} auswählen"></label>${collapsed ? `<button type="button" class="automation-title-button" data-action="toggle-automation" aria-label="${esc(automation.name)} bearbeiten" aria-expanded="false"><strong>${esc(automation.name)}</strong><small>${automation.rules.length} ${automation.rules.length === 1 ? "Regel" : "Regeln"} · ${automation.rules.filter((rule) => rule.enabled).length} aktiv</small></button>` : `<label class="automation-name"><span>Name der Automation</span><input data-group-field="name" value="${esc(automation.name)}" placeholder="z. B. Einfahrt Gleis 1" maxlength="120"></label>`}<div class="automation-head-actions"><button type="button" class="secondary-button automation-collapse-button" data-action="toggle-automation" aria-expanded="${!collapsed}" aria-label="Automation ${collapsed ? "ausklappen" : "einklappen"}">${icon(collapsed ? "edit" : "chevron-down")}<span>${collapsed ? "Bearbeiten" : "Schließen"}</span></button><button type="button" class="icon-danger-button" data-action="delete-automation" aria-label="Automation löschen">${icon("trash")}</button></div></header>
    <div class="automation-subrules" ${collapsed ? "hidden" : ""}>${automation.rules.map((rule, ruleIndex) => renderRule(rule, index, ruleIndex, triggers, targets, expandedRules ? expandedRules.has(rule.id) : ruleIndex === 0)).join("")}</div>
    <button type="button" class="secondary-button automation-add-rule" data-action="add-rule" ${collapsed ? "hidden" : ""}>${icon("plus")} Regel hinzufügen</button>
  </section>`;
}
