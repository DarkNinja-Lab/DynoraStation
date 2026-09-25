"use strict";

import { state } from "../core/state.js?v=mobile-v5-cachefix";
import { icon } from "../ui/icons.js?v=mobile-v5-cachefix";
import { esc } from "../core/utils.js?v=mobile-v5-cachefix";

const TRACK_TYPES = new Set(["track", "curve", "switch", "crossing", "xtrack", "bumper"]);

function elementLabel(element) {
  const code = element.trackCode || element.curveCode || element.switchCode || element.xTrackCode || element.bumperCode || element.catalogCode || "";
  return element.name || code || element.id || element.typ || "Element";
}

function relayFields(element) {
  const type = element.typ === "crossing" ? "xtrack" : element.typ;
  if (type === "track") {
    const isUncoupler = String(element.trackCode || element.catalogCode || "") === "5112";
    return isUncoupler || Number(element.relay || 0) ? [["relay", isUncoupler ? "Entkuppler" : "Schaltausgang"]] : [];
  }
  if (type === "curve" || type === "transformer") return Number(element.relay || 0) ? [["relay", type === "transformer" ? "Versorgung" : "Schaltausgang"]] : [];
  const map = {
    switch: [["relayStraight", "Gerade/Außenbogen"], ["relayBranch", "Abzweig/Innenbogen"]],
    xtrack: [["relayA", "Gerade"], ["relayB", "Abzweig"]],
    signal: [["relayHp0", "Halt"], ["relayHp1", "Fahrt"]]
  };
  return map[type] || [];
}

function ledFields(element) {
  if (!["espSignal", "ledSignal"].includes(element.typ)) return [];
  return element.signalAspectMode === "rgy"
    ? [["ledChannelRed", "Rot"], ["ledChannelYellow", "Gelb"], ["ledChannelGreen", "Grün"]]
    : [["ledChannelRed", "Rot"], ["ledChannelGreen", "Grün"]];
}

export function analyzePlan(layout = state.layout) {
  const elements = Array.isArray(layout?.elemente) ? layout.elemente : [];
  const connections = Array.isArray(layout?.verbindungen) ? layout.verbindungen : [];
  const issues = [];
  const relayUse = new Map();
  const connectedIds = new Set(connections.flatMap((connection) => [String(connection.von || ""), String(connection.nach || "")]));
  const trackElements = elements.filter((element) => TRACK_TYPES.has(element.typ));

  if (!elements.length) {
    return [{ severity: "info", code: "EMPTY", title: "Plan ist noch leer", detail: "Füge das erste Gleiselement aus der Bauteilbibliothek hinzu." }];
  }

  elements.forEach((element) => {
    const label = elementLabel(element);
    const hardwareFields = [...relayFields(element), ...ledFields(element), ...(element.sensorId ? [["sensorId", "Sensor"]] : [])];
    if (hardwareFields.length && !String(element.module || "").trim()) {
      issues.push({ severity: "error", code: "NO_MODULE", elementId: element.id, title: `${label}: Kein Modul`, detail: "Hardware-Modul im Eigenschaftenbereich zuweisen." });
    }

    relayFields(element).forEach(([field, purpose]) => {
      const channel = Number(element[field] || 0);
      if (!channel) {
        issues.push({ severity: "warning", code: "NO_RELAY", elementId: element.id, title: `${label}: Ausgang fehlt`, detail: `${purpose} ist keinem Relais zugewiesen.` });
        return;
      }
      if (!element.module) return;
      const key = `${element.module}:${channel}`;
      if (!relayUse.has(key)) relayUse.set(key, []);
      relayUse.get(key).push({ purpose, label, sharingGroup: element.stromkreis ? `circuit:${element.stromkreis}` : "" });
    });

    ledFields(element).forEach(([field, purpose]) => {
      if (Number(element[field] || 0)) return;
      issues.push({ severity: "warning", code: "NO_LED", elementId: element.id, title: `${label}: LED-Kanal fehlt`, detail: `${purpose} ist keinem LED-Kanal zugewiesen.` });
    });

    if (trackElements.length > 1 && TRACK_TYPES.has(element.typ) && element.typ !== "bumper" && !connectedIds.has(String(element.id))) {
      issues.push({ severity: "warning", code: "ISOLATED", elementId: element.id, title: `${label}: Nicht verbunden`, detail: "Das Gleiselement besitzt noch keine Verbindung zu einem anderen Bauteil." });
    }
  });

  relayUse.forEach((assignments, key) => {
    if (assignments.length < 2) return;
    const sharingGroups = new Set(assignments.map((item) => item.sharingGroup).filter(Boolean));
    if (sharingGroups.size === 1 && assignments.every((item) => item.sharingGroup === [...sharingGroups][0])) return;
    const [module, channel] = key.split(":");
    issues.push({
      severity: "error",
      code: "RELAY_CONFLICT",
      title: `Relais-Konflikt: ${module} · ${channel}`,
      detail: assignments.map((item) => `${item.label} (${item.purpose})`).join(" und ")
    });
  });

  return issues;
}


function renderValidationPanel(issues) {
  const list = document.getElementById("planValidationList");
  const summary = document.getElementById("planValidationSummary");
  if (!list || !summary) return;
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.filter((issue) => issue.severity === "warning").length;
  summary.textContent = errors || warnings ? `${errors} Fehler · ${warnings} Hinweise` : "Keine Probleme erkannt";
  list.innerHTML = issues.length ? issues.map((issue) => `
    <article class="plan-validation-item severity-${issue.severity}">
      <span class="validation-status" aria-hidden="true">${icon(issue.severity === "error" ? "close" : issue.severity === "warning" ? "warning" : "info")}</span>
      <div><strong>${esc(issue.title)}</strong><small>${esc(issue.detail)}</small></div>
    </article>`).join("") : `
    <div class="plan-validation-ok"><span>${icon("check")}</span><strong>Plan ist bereit</strong><small>Keine fehlenden Hardware-Zuweisungen, Konflikte oder isolierten Gleise erkannt.</small></div>`;
}

export function refreshPlanValidation() {
  const issues = analyzePlan();
  const actionable = issues.filter((issue) => issue.severity !== "info");
  const errors = actionable.filter((issue) => issue.severity === "error").length;
  const count = document.getElementById("planIssueCount");
  const button = document.getElementById("validatePlanButton");
  if (count) count.textContent = String(actionable.length);
  if (button) {
    button.classList.toggle("has-errors", errors > 0);
    button.classList.toggle("has-warnings", errors === 0 && actionable.length > 0);
    button.classList.toggle("is-clean", actionable.length === 0);
  }
  if (!document.getElementById("planValidationPanel")?.hidden) renderValidationPanel(actionable);
  return issues;
}

export function setupPlanValidation() {
  const panel = document.getElementById("planValidationPanel");
  const button = document.getElementById("validatePlanButton");
  const close = () => {
    if (!panel) return;
    panel.hidden = true;
    button?.setAttribute("aria-expanded", "false");
  };
  button?.addEventListener("click", () => {
    if (!panel) return;
    const opening = panel.hidden;
    panel.hidden = !opening;
    button.setAttribute("aria-expanded", String(opening));
    if (opening) renderValidationPanel(analyzePlan().filter((issue) => issue.severity !== "info"));
  });
  document.getElementById("closePlanValidation")?.addEventListener("click", close);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape" && panel && !panel.hidden) close(); });
  refreshPlanValidation();
}
