"use strict";

import { state } from "../core/state.js?v=mobile-v5-cachefix";
import { apiCall } from "../core/api.js?v=mobile-v5-cachefix";
import { commandFeedbackForRelay, commandStatusText, moduleControlInfo, rememberPendingCommands } from "../core/commands.js?v=mobile-v5-cachefix";

export async function lightButtonsLaden() {
  try {
    const data = await apiCall("/status");
    if (Array.isArray(data?.lightButtons) && data.lightButtons.length) {
      state.lightButtons = data.lightButtons.slice(0, 4).map((b, i) => ({
        id: b.id ?? i + 1,
        name: b.name || `Licht ${i + 1}`,
        moduleId: b.moduleId || b.module || "",
        relayIndex: Number(b.relayIndex ?? b.relay ?? 0),
        active: !!b.active
      }));
    } else if (!Array.isArray(state.lightButtons) || state.lightButtons.length < 4) {
      state.lightButtons = [
        { name: "Licht 1", moduleId: "", relayIndex: 0, active: false },
        { name: "Licht 2", moduleId: "", relayIndex: 0, active: false },
        { name: "Licht 3", moduleId: "", relayIndex: 0, active: false },
        { name: "Licht 4", moduleId: "", relayIndex: 0, active: false }
      ];
    }
  } catch {
    if (!Array.isArray(state.lightButtons) || state.lightButtons.length < 4) {
      state.lightButtons = [
        { name: "Licht 1", moduleId: "", relayIndex: 0, active: false },
        { name: "Licht 2", moduleId: "", relayIndex: 0, active: false },
        { name: "Licht 3", moduleId: "", relayIndex: 0, active: false },
        { name: "Licht 4", moduleId: "", relayIndex: 0, active: false }
      ];
    }
  }
}

export async function lightButtonToggle(index) {
  const btn = state.lightButtons?.[index];
  if (!btn) return;

  const channel = Number(btn.relayIndex || 0);
  if (!btn.moduleId || channel < 1) return;

  const control = moduleControlInfo(btn.moduleId);
  const feedback = commandFeedbackForRelay(btn.moduleId, channel);
  if (!control.enabled || feedback?.status === "pending") return;
  try {
    const result = await apiCall("/control/relay", {
      method: "POST",
      body: {
        module: btn.moduleId,
        channel,
        state: !btn.active
      }
    });
    rememberPendingCommands(result);
  } catch (err) {
    console.warn("Licht schalten fehlgeschlagen:", err?.message || err);
  }
}

export function renderTrackLightButtons() {
  const grid = document.getElementById("trackLightGrid");
  if (!grid) return;

  const src = Array.isArray(state.lightButtons) ? state.lightButtons : [];
  const html = src.map((btn, idx) => {
    const channel = Number(btn?.relayIndex || 0);
    const configured = Boolean(btn?.moduleId && channel > 0);
    const control = configured ? moduleControlInfo(btn.moduleId) : { enabled: false, reason: "Nicht zugewiesen" };
    const feedback = configured ? commandFeedbackForRelay(btn.moduleId, channel) : null;
    const statusText = commandStatusText(feedback) || (!control.enabled ? control.reason : "");
    const disabled = !control.enabled || feedback?.status === "pending";
    return `
    <button class="light-toggle-btn ${btn?.active ? "active" : ""} ${!configured ? "unconfigured" : ""} ${!control.enabled ? "control-disabled" : ""} ${feedback?.status ? `command-${feedback.status}` : ""}" data-light-index="${idx}" type="button" ${disabled ? "disabled" : ""} title="${statusText || "Schalten"}">
      <span>${btn?.name || `Licht ${idx + 1}`}</span>${statusText ? `<small>${statusText}</small>` : ""}
    </button>`;
  }).join("");

  grid.innerHTML = html || `
    <button class="light-toggle-btn" data-light-index="0" type="button">Licht 1</button>
    <button class="light-toggle-btn" data-light-index="1" type="button">Licht 2</button>
    <button class="light-toggle-btn" data-light-index="2" type="button">Licht 3</button>
    <button class="light-toggle-btn" data-light-index="3" type="button">Licht 4</button>
  `;
}
