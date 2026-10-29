"use strict";

import { localConnectionPorts, worldConnectionPort } from "./shapes.js?v=workspace-v20";

import { state } from "../core/state.js?v=workspace-v11";
import { icon } from "../ui/icons.js?v=workspace-v11";
import { esc } from "../core/utils.js?v=workspace-v11";

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
    switch: [["relayStraight", "Gerade/Au\u00dfenbogen"], ["relayBranch", "Abzweig/Innenbogen"]],
    xtrack: [["relayA", "Gerade"], ["relayB", "Abzweig"]],
    signal: [["relayHp0", "Halt"], ["relayHp1", "Fahrt"]]
  };
  return map[type] || [];
}

function ledFields(element) {
  if (!["espSignal", "ledSignal"].includes(element.typ)) return [];
  return element.signalAspectMode === "rgy"
    ? [["ledChannelRed", "Rot"], ["ledChannelYellow", "Gelb"], ["ledChannelGreen", "Gr\u00fcn"]]
    : [["ledChannelRed", "Rot"], ["ledChannelGreen", "Gr\u00fcn"]];
}

export function analyzePlan(layout = state.layout) {
  const elements = Array.isArray(layout?.elemente) ? layout.elemente : [];
  const connections = Array.isArray(layout?.verbindungen) ? layout.verbindungen : [];
  const issues = [];
  const relayUse = new Map();
  const connectedIds = new Set(connections.flatMap((connection) => [String(connection.von || ""), String(connection.nach || "")]));
  const byId = new Map(elements.map(element => [element.id, element]));
  const portUse = new Set();
  const ledUse = new Map();
  const switchPairOwners = new Map();
  const sharedSwitchGroupById = new Map();
  elements.forEach((element) => {
    if (element.typ !== "switch" || !element.module) return;
    const straight = Number(element.relayStraight || 0);
    const branch = Number(element.relayBranch || 0);
    if (!straight || !branch || straight === branch) return;
    const pair = [straight, branch].sort((a, b) => a - b).join(":");
    const key = `${element.module}:${pair}`;
    if (!switchPairOwners.has(key)) switchPairOwners.set(key, new Set());
    switchPairOwners.get(key).add(String(element.id));
  });
  switchPairOwners.forEach((owners, key) => {
    if (owners.size < 2) return;
    owners.forEach((id) => sharedSwitchGroupById.set(id, `switch-pair:${key}`));
  });
  for (const link of connections) {
    const from = byId.get(link.von);
    const to = byId.get(link.nach);
    if (!from || !to) { issues.push({ severity: "error", code: "BROKEN_LINK", title: "Ung\u00fcltige Verbindung", detail: "Ein verbundenes Element fehlt." }); continue; }
    const ports = [from, to].map((element, i) => {
      const key = `${element.id}:${Number(i ? link.nachPort : link.vonPort) || 0}`;
      if (portUse.has(key)) issues.push({ severity: "error", code: "PORT_CONFLICT", title: `${elementLabel(element)}: Anschluss mehrfach belegt`, detail: "Verbindungen trennen und freie Anschl\u00fcsse verwenden." });
      portUse.add(key);
      const category = { track: "tracks", curve: "curves", switch: "switches", crossing: "crossings", xtrack: "crossings", bumper: "bumpers" }[element.typ];
      const code = element.trackCode || element.curveCode || element.switchCode || element.xTrackCode || element.bumperCode || element.catalogCode;
      const item = (state.catalog?.[category] || []).find(entry => String(entry.code) === String(code)) || {};
      const local = localConnectionPorts(element, item)[Number(i ? link.nachPort : link.vonPort) || 0];
      return local ? worldConnectionPort(element, local) : null;
    });
    if (ports.every(Boolean) && Math.hypot(ports[0].x - ports[1].x, ports[0].y - ports[1].y) > 2) issues.push({ severity: "warning", code: "GAP", title: `${elementLabel(from)} / ${elementLabel(to)}: Gleisl\u00fccke`, detail: "Die verbundenen Enden liegen nicht aufeinander. Trennen und erneut verbinden." });
  }
  const trackElements = elements.filter((element) => TRACK_TYPES.has(element.typ));

  if (!elements.length) {
    return [{ severity: "info", code: "EMPTY", title: "Plan ist noch leer", detail: "F\u00fcge das erste Gleiselement aus der Bauteilbibliothek hinzu." }];
  }

  elements.forEach((element) => {
    const label = elementLabel(element);
    const width = (Number(layout.metadaten?.plateWidthMm) || 3200) * .5;
    const height = (Number(layout.metadaten?.plateHeightMm) || 1800) * .5;
    if (element.x < 0 || element.y < 0 || element.x > width || element.y > height) issues.push({ severity: "warning", code: "OUTSIDE", elementId: element.id, title: `${label}: Au\u00dferhalb der Platte`, detail: "Position in den Eigenschaften anpassen oder Platte vergr\u00f6\u00dfern." });
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
      relayUse.get(key).push({
        purpose,
        label,
        sharingGroup: sharedSwitchGroupById.get(String(element.id)) || (element.stromkreis ? `circuit:${element.stromkreis}` : "")
      });
    });

    ledFields(element).forEach(([field, purpose]) => {
      if (Number(element[field] || 0)) {
        if (element.module) {
          const key = `${element.module}:${element[field]}`;
          if (ledUse.has(key)) issues.push({ severity: "error", code: "LED_CONFLICT", elementId: element.id, title: `${label}: LED-Kanal doppelt belegt`, detail: `${purpose} teilt einen Kanal mit ${ledUse.get(key)}.` });
          ledUse.set(key, label);
        }
        return;
      }
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
      title: `Relais-Konflikt: ${module} \u00b7 ${channel}`,
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
  summary.textContent = errors || warnings ? `${errors} Fehler \u00b7 ${warnings} Hinweise` : "Keine Probleme erkannt";
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
