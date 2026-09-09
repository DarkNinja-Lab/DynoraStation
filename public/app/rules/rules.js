"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function ensureRules() {
  if (!Array.isArray(state.rules)) state.rules = [];
}

function getModules() {
  return Object.values(state?.hardware?.modules || {});
}

function getSensorOptions() {
  const options = [];
  for (const mod of getModules()) {
    const sensors = Array.isArray(mod.sensors) ? mod.sensors : [];
    sensors.forEach((s, idx) => {
      options.push({
        value: `${mod.id}::${s.id || `S${idx + 1}`}`,
        label: `${mod.name || mod.id} • ${s.name || s.id || `Sensor ${idx + 1}`}`
      });
    });
  }
  return options;
}

function getTargetOptions() {
  const options = [];
  for (const mod of getModules()) {
    const relays = Array.isArray(mod.relays) ? mod.relays : [];
    relays.forEach((_, idx) => {
      options.push({
        type: "relay",
        value: `${mod.id}::${idx + 1}`,
        label: `${mod.name || mod.id} • Relay ${idx + 1}`
      });
    });

    const leds = Array.isArray(mod.leds) ? mod.leds : [];
    leds.forEach((_, idx) => {
      options.push({
        type: "espSignal",
        value: `${mod.id}::${idx + 1}`,
        label: `${mod.name || mod.id} • LED ${idx + 1}`
      });
    });
  }
  return options;
}

function parseSensorValue(v) {
  const [module, sensorId] = String(v || "").split("::");
  return { module: module || "", sensorId: sensorId || "" };
}

function parseTargetValue(v) {
  const [module, channel] = String(v || "").split("::");
  return { module: module || "", channel: Number(channel || 0) };
}

function toUiRule(raw) {
  const sensorModule = raw?.if?.module || "";
  const sensorId = raw?.if?.sensorId || "";
  const targetType = raw?.then?.targetType || "relay";
  const targetModule = raw?.then?.module || "";
  const targetChannel = Number(raw?.then?.channel || 0);
  const action = raw?.then?.action || "on";

  return {
    ifSensor: sensorModule && sensorId ? `${sensorModule}::${sensorId}` : "",
    targetType,
    targetRef: targetModule && targetChannel ? `${targetModule}::${targetChannel}` : "",
    action
  };
}

function toApiRule(ui) {
  const s = parseSensorValue(ui.ifSensor);
  const t = parseTargetValue(ui.targetRef);
  return {
    if: {
      kind: "sensor",
      module: s.module,
      sensorId: s.sensorId,
      triggered: true
    },
    then: {
      targetType: ui.targetType || "relay",
      module: t.module,
      channel: t.channel,
      action: ui.action || "on"
    },
    enabled: true
  };
}

function defaultUiRule() {
  return { ifSensor: "", targetType: "relay", targetRef: "", action: "on" };
}

function actionOptionsForType(type) {
  if (type === "relay") return ["on", "off", "toggle"];
  if (type === "espSignal") return ["on", "off", "blink"];
  if (type === "signal") return ["red", "green"];
  if (type === "switch" || type === "crossing") return ["straight", "turn"];
  return ["on", "off"];
}

function renderRuleRow(rule, idx, sensors, targets) {
  const sensorOpts = [`<option value="">Sensor wählen…</option>`]
    .concat(sensors.map(s => `<option value="${esc(s.value)}" ${rule.ifSensor === s.value ? "selected" : ""}>${esc(s.label)}</option>`))
    .join("");

  const filteredTargets = targets.filter(t => t.type === rule.targetType);
  const targetOpts = [`<option value="">Ziel wählen…</option>`]
    .concat(filteredTargets.map(t => `<option value="${esc(t.value)}" ${rule.targetRef === t.value ? "selected" : ""}>${esc(t.label)}</option>`))
    .join("");

  const typeOpts = ["relay", "espSignal", "switch", "signal", "crossing"]
    .map(t => `<option value="${t}" ${rule.targetType === t ? "selected" : ""}>${t}</option>`)
    .join("");

  const actionOpts = actionOptionsForType(rule.targetType)
    .map(a => `<option value="${a}" ${rule.action === a ? "selected" : ""}>${a}</option>`)
    .join("");

  return `
    <div class="rule-card" data-rule-index="${idx}">
      <div class="rule-title">Regel ${idx + 1}</div>

      <label>WENN Sensor</label>
      <select data-field="ifSensor">${sensorOpts}</select>

      <label>DANN Zieltyp</label>
      <select data-field="targetType">${typeOpts}</select>

      <label>Ziel</label>
      <select data-field="targetRef">${targetOpts}</select>

      <label>Aktion</label>
      <select data-field="action">${actionOpts}</select>

      <button type="button" class="secondary-button" data-action="delete-rule">Löschen</button>
    </div>
  `;
}

function validateUiRules(rules) {
  const errors = [];
  rules.forEach((r, i) => {
    if (!r.ifSensor) errors.push(`Regel ${i + 1}: Sensor fehlt`);
    if (!r.targetType) errors.push(`Regel ${i + 1}: Zieltyp fehlt`);
    if (!r.targetRef) errors.push(`Regel ${i + 1}: Ziel fehlt`);
    if (!r.action) errors.push(`Regel ${i + 1}: Aktion fehlt`);
  });
  return errors;
}

let uiRules = [];
let bound = false;

export async function rulesLaden() {
  try {
    const data = await apiCall("/rules");
    state.rules = Array.isArray(data?.rules) ? data.rules : [];
  } catch {
    state.rules = [];
  }
  uiRules = state.rules.map(toUiRule);
  if (!uiRules.length) uiRules = [defaultUiRule()];
}

export async function rulesSpeichern() {
  const errors = validateUiRules(uiRules);
  const hint = document.getElementById("rulesHint");
  if (errors.length) {
    if (hint) hint.textContent = errors[0];
    return;
  }

  const payloadRules = uiRules.map(toApiRule);
  const data = await apiCall("/rules", {
    method: "POST",
    body: { rules: payloadRules }
  });
  state.rules = Array.isArray(data?.rules) ? data.rules : payloadRules;
  if (hint) hint.textContent = "Regeln gespeichert ✅";
}

export function renderRulesGrid() {
  const root = document.getElementById("rulesGrid");
  if (!root) return;

  ensureRules();
  if (!uiRules.length) uiRules = state.rules.map(toUiRule);
  if (!uiRules.length) uiRules = [defaultUiRule()];

  const sensors = getSensorOptions();
  const targets = getTargetOptions();

  root.innerHTML = `
    <div class="rules-head">
      <div id="rulesHint" class="builder-message">Baue Regeln ohne Tipparbeit.</div>
      <div class="rules-actions">
        <button type="button" class="primary-button" data-action="add-rule">+ Regel</button>
        <button type="button" class="secondary-button" data-action="save-rules">Speichern</button>
      </div>
    </div>
    <div class="rules-cards">
      ${uiRules.map((r, i) => renderRuleRow(r, i, sensors, targets)).join("")}
    </div>
  `;

  if (bound) return;
  bound = true;

  root.addEventListener("change", (ev) => {
    const card = ev.target.closest("[data-rule-index]");
    if (!card) return;
    const idx = Number(card.dataset.ruleIndex);
    const field = ev.target.dataset.field;
    if (Number.isNaN(idx) || !field || !uiRules[idx]) return;

    uiRules[idx][field] = ev.target.value;

    if (field === "targetType") {
      uiRules[idx].targetRef = "";
      uiRules[idx].action = actionOptionsForType(uiRules[idx].targetType)[0];
      renderRulesGrid();
    }
  });

  root.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("button");
    if (!btn) return;

    if (btn.dataset.action === "add-rule") {
      uiRules.push(defaultUiRule());
      renderRulesGrid();
      return;
    }

    if (btn.dataset.action === "delete-rule") {
      const card = btn.closest("[data-rule-index]");
      if (!card) return;
      const idx = Number(card.dataset.ruleIndex);
      if (!Number.isNaN(idx)) {
        uiRules.splice(idx, 1);
        if (!uiRules.length) uiRules.push(defaultUiRule());
        renderRulesGrid();
      }
      return;
    }

    if (btn.dataset.action === "save-rules") {
      try {
        await rulesSpeichern();
      } catch (e) {
        const hint = document.getElementById("rulesHint");
        if (hint) hint.textContent = `Fehler: ${e.message || e}`;
      }
    }
  });
}