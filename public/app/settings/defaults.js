"use strict";

import { state } from "../core/state.js?v=workspace-v11";
import { esc } from "../core/utils.js?v=workspace-v11";
import { icon } from "../ui/icons.js?v=workspace-v11";

const TARGET_TYPES = [
  ["switch", "Weiche"], ["crossing", "Kreuzungsweiche"],
  ["signal", "Märklin-Signal"], ["espSignal", "ESP-Signal"], ["relay", "Relais"]
];

export const selectedDefaultIndices = new Set();
export const expandedDefaultGroups = new Set();

export function defaultTargetOptions(type) {
  if (type === "relay") {
    return Object.values(state.hardware?.modules || {}).flatMap((module) =>
      (module.relays || []).map((_, index) => [
        `${module.id}:${index + 1}`,
        `${module.name || module.id} · ${state.relayConfig?.[`${module.id}:${index + 1}`]?.name || `Relais ${index + 1}`}`
      ])
    );
  }
  const elementType = { switch: "switch", signal: "signal", crossing: "xtrack", espSignal: "ledSignal" }[type];
  return (state.layout?.elemente || [])
    .filter((element) => element.typ === type || element.typ === elementType)
    .map((element) => [element.id, element.name || element.id]);
}

export function defaultActionOptions(type) {
  return ({
    relay: [["on", "Einschalten"], ["off", "Ausschalten"]],
    switch: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    crossing: [["gerade", "Gerade"], ["abzweig", "Abzweig"]],
    signal: [["halt", "Rot / Halt"], ["fahrt", "Grün / Fahrt"]],
    espSignal: [["halt", "Rot / Halt"], ["warnung", "Gelb / Warnung"], ["fahrt", "Grün / Fahrt"]]
  })[type] || [];
}

function optionList(items, selected, emptyLabel) {
  const choices = [["", emptyLabel], ...items];
  // Keep an offline or removed target visible until the user explicitly changes it.
  if (selected && !choices.some(([value]) => String(value) === String(selected))) {
    choices.push([selected, `${selected} · derzeit nicht verfügbar`]);
  }
  return choices.map(([value, label]) => `<option value="${esc(value)}" ${String(value) === String(selected || "") ? "selected" : ""}>${esc(label)}</option>`).join("");
}

export function getVisibleDefaults() {
  const search = String(document.getElementById("defaultSearch")?.value || "").trim().toLocaleLowerCase("de-DE");
  return (state.defaults || []).map((item, index) => ({ item, index })).filter(({ item }) => {
    const target = defaultTargetOptions(item.targetType).find(([id]) => id === item.targetId)?.[1] || "";
    return !search || `${item.groupName || ""} ${item.targetType} ${item.targetId} ${target} ${item.action}`.toLocaleLowerCase("de-DE").includes(search);
  });
}

function renderState({ item, index }) {
  const selected = selectedDefaultIndices.has(index);
  return `<article class="default-state-card ${selected ? "selected" : ""}" data-default-index="${index}">
    <label class="collection-item-select"><input type="checkbox" data-select-default="${index}" ${selected ? "checked" : ""} aria-label="Grundstellung ${index + 1} auswählen"><span>Auswählen</span></label>
    <label class="default-state-group-field"><span>Gruppe</span><input data-field="groupName" value="${esc(item.groupName || "")}" maxlength="48" list="defaultGroupNames" placeholder="Ohne Gruppe"></label>
    <label class="default-state-field"><span>Bauteiltyp</span><select data-field="targetType">${optionList(TARGET_TYPES, item.targetType, "Typ auswählen")}</select></label>
    <label class="default-state-field"><span>Ziel</span><select data-field="targetId" ${item.targetType ? "" : "disabled"}>${optionList(defaultTargetOptions(item.targetType), item.targetId, "Ziel auswählen")}</select></label>
    <label class="default-state-field"><span>Startzustand</span><select data-field="action" ${item.targetType ? "" : "disabled"}>${optionList(defaultActionOptions(item.targetType), item.action, "Zustand auswählen")}</select></label>
    <button class="icon-danger-button" data-action="remove-default" type="button" aria-label="Grundstellung ${index + 1} löschen">${icon("trash")}</button>
  </article>`;
}

function renderGroup(key, group) {
  return `<details class="default-group" data-default-group="${esc(key)}" ${expandedDefaultGroups.has(key) ? "open" : ""}>
    <summary><span class="default-group-symbol" aria-hidden="true">${icon("duplicate")}</span><strong>${esc(group.name || "Ohne Gruppe")}</strong><span class="default-group-count">${group.entries.length} ${group.entries.length === 1 ? "Zustand" : "Zustände"}</span><span class="default-group-chevron" aria-hidden="true">${icon("chevron-down")}</span></summary>
    <div class="default-group-actions"><button type="button" class="secondary-button" data-action="add-default-to-group" data-group-name="${esc(group.name)}">${icon("plus")} Zustand hinzufügen</button>${group.name ? `<button type="button" class="text-button" data-action="rename-default-group" data-group-name="${esc(group.name)}">Gruppe umbenennen</button>` : ""}</div>
    <div class="default-group-items">${group.entries.map(renderState).join("")}</div>
  </details>`;
}

export function renderDefaultStates() {
  const host = document.getElementById("defaultStateGrid");
  if (!host) return;
  if (!Array.isArray(state.defaults)) state.defaults = [];
  const visible = getVisibleDefaults();
  const selectedVisible = visible.filter(({ index }) => selectedDefaultIndices.has(index)).length;
  const selectAll = document.getElementById("defaultSelectVisible");
  if (selectAll) {
    selectAll.checked = visible.length > 0 && selectedVisible === visible.length;
    selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
  }
  const count = document.getElementById("defaultSelectionCount");
  if (count) count.textContent = `${selectedDefaultIndices.size} ausgewählt`;
  const remove = document.getElementById("deleteSelectedDefaults");
  if (remove) remove.disabled = selectedDefaultIndices.size === 0;

  const groups = new Map();
  for (const entry of visible) {
    const name = String(entry.item.groupName || "").trim();
    const key = name || "__ungrouped__";
    if (!groups.has(key)) groups.set(key, { name, entries: [] });
    groups.get(key).entries.push(entry);
  }
  const names = [...new Set(state.defaults.map((item) => String(item.groupName || "").trim()).filter(Boolean))];
  host.innerHTML = `<div class="default-state-toolbar"><div><strong>${state.defaults.length} ${state.defaults.length === 1 ? "Startzustand" : "Startzustände"}</strong><span>Nach dem Speichern beim nächsten Verbinden wirksam.</span></div><div><button type="button" class="secondary-button" data-action="add-default-group">${icon("plus")} Gruppe anlegen</button><button type="button" class="primary-button" data-action="add-default">${icon("plus")} Zustand hinzufügen</button></div></div>
    <div class="default-group-list">${[...groups].map(([key, group]) => renderGroup(key, group)).join("") || `<div class="settings-empty"><span class="settings-empty-icon" aria-hidden="true">${icon("settings")}</span><strong>${state.defaults.length ? "Keine passende Grundstellung" : "Mit einem sicheren Startzustand beginnen"}</strong><p>${state.defaults.length ? "Passe den Suchbegriff an, um weitere Zustände zu sehen." : "Lege fest, wie Weichen, Signale und Relais nach dem Verbinden stehen sollen."}</p></div>`}</div>
    <datalist id="defaultGroupNames">${names.map((name) => `<option value="${esc(name)}"></option>`).join("")}</datalist>`;
  host.querySelectorAll("[data-default-group]").forEach((group) => {
    group.addEventListener("toggle", () => {
      if (group.open) expandedDefaultGroups.add(group.dataset.defaultGroup);
      else expandedDefaultGroups.delete(group.dataset.defaultGroup);
    });
  });
}
