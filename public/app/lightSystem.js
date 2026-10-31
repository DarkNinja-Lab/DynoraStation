"use strict";

import { apiCall } from "./core/api.js?v=workspace-v11";
import { state } from "./core/state.js?v=workspace-v11";
import { esc } from "./core/utils.js?v=workspace-v11";
import { showToast } from "./ui/toast.js?v=workspace-v15";

const DEFAULT_LOCATION = { name: "Deutschland (Mitte)", latitude: 51.1657, longitude: 10.4515, timezone: "Europe/Berlin" };
const DEFAULT_SETTINGS = {
  startTime: "18:00", endTime: "23:30", onTime: "18:00", offTime: "23:00",
  minOnMin: 2, maxOnMin: 12, minOffMin: 1, maxOffMin: 8,
  sunsetOffsetMin: 0, sunriseOffsetMin: 15
};
let system = { location: { ...DEFAULT_LOCATION }, groups: [] };
let runtime = { groups: {} };
let draft = null;
let editingId = "";
let renderSignature = "";
let formBackStep = "lightWizardChoice";

const byId = (id) => document.getElementById(id);
const makeId = () => `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function relayInventory() {
  const inventory = [];
  const modules = Object.values(state.hardware?.modules || {});
  for (const module of modules) {
    if (!(module.capabilities?.includes("relay") || ["RELAY_SENSOR", "HYBRID"].includes(module.kind))) continue;
    for (let index = 0; index < (module.relays || []).length; index += 1) {
      const channel = index + 1;
      const key = `${module.id}:${channel}`;
      const config = state.relayConfig?.[key] || {};
      const saved = state.hardware?.relays?.find((relay) => relay.module === module.id && Number(relay.channel) === channel);
      inventory.push({
        module: module.id, channel, moduleName: module.name || module.id,
        name: String(config.name || saved?.name || "").trim(),
        state: Boolean(module.relays[index])
      });
    }
  }
  return inventory;
}

function behaviorName(behavior) {
  return ({ presence: "Anwesenheit simulieren", sunset: "Sonnenuntergang bis Sonnenaufgang", daily: "Feste Uhrzeiten", manual: "Manuell" })[behavior] || "Feste Uhrzeiten";
}

function describeGroup(group) {
  const settings = group.settings || {};
  if (group.behavior === "presence") return `Zufällige Zimmerlichter · ${settings.startTime} bis ${settings.endTime}`;
  if (group.behavior === "sunset") return `Sonnenuntergang bis Sonnenaufgang · ${system.location?.name || DEFAULT_LOCATION.name}`;
  if (group.behavior === "daily") return `Täglich um ${settings.onTime} an und um ${settings.offTime} aus`;
  return "Du schaltest diese Gruppe bei Bedarf selbst.";
}

function renderGroups() {
  const host = byId("lightSystemGroups");
  if (!host) return;
  const signature = JSON.stringify({
    groups: system.groups,
    runtime: runtime.groups,
    relays: system.groups.map((group) => group.relays.map((relay) => {
      const module = state.hardware?.modules?.[relay.module];
      return module?.relays?.[relay.channel - 1] ?? null;
    }))
  });
  if (signature === renderSignature) return;
  renderSignature = signature;
  if (!system.groups.length) {
    host.innerHTML = `<div class="light-groups-empty"><span aria-hidden="true">☼</span><h3>Hier erscheinen deine Lichtgruppen</h3><p>Lege zum Beispiel ein Haus mit zufälligen Zimmerlichtern oder eine Straßenbeleuchtung mit Sonnenuntergangs-Zeitplan an.</p><button class="primary-button" data-open-light-wizard type="button">Lichtgruppe einrichten</button></div>`;
    return;
  }
  host.innerHTML = system.groups.map((group) => {
    const current = runtime.groups?.[group.id] || {};
    const live = group.relays.map((relay) => state.hardware?.modules?.[relay.module]?.relays?.[relay.channel - 1]);
    const manualState = live.length && live.every((on) => on === true) ? "Alle Lichter an"
      : live.length && live.every((on) => on === false) ? "Alle Lichter aus" : "Lichtgruppe";
    const stateText = group.enabled ? (group.behavior === "manual" ? manualState : current.state || "Zeitplan wird gestartet") : "Pausiert";
    const relayNames = group.relays.map((relay) => relay.name || `Relais ${relay.channel}`).join(", ");
    return `<article class="light-group-card">
      <div class="light-group-icon ${esc(group.kind)}" aria-hidden="true">${group.kind === "street" ? "☾" : group.kind === "house" ? "⌂" : "☼"}</div>
      <div class="light-group-main"><div class="light-group-title"><h3>${esc(group.name)}</h3><span class="light-group-status ${group.enabled ? "active" : "paused"}">${esc(stateText)}</span></div>
        <p>${esc(describeGroup(group))}</p><small>${group.relays.length} ${group.relays.length === 1 ? "Relais" : "Relais"} · ${esc(relayNames)}</small>
      </div>
      <div class="light-group-actions">
        ${group.behavior === "manual" ? `<button class="secondary-button" data-group-control="${esc(group.id)}" data-group-state="true" type="button">Licht an</button><button class="secondary-button" data-group-control="${esc(group.id)}" data-group-state="false" type="button">Licht aus</button>` : `<button class="secondary-button" data-group-toggle="${esc(group.id)}" type="button">${group.enabled ? "Pausieren" : "Fortsetzen"}</button>`}
        <button class="text-button" data-group-edit="${esc(group.id)}" type="button">Bearbeiten</button>
        <button class="text-button" data-group-delete="${esc(group.id)}" type="button">Löschen</button>
      </div>
    </article>`;
  }).join("");
}

function showWizardStep(id) {
  document.querySelectorAll(".light-wizard-step").forEach((section) => { section.hidden = section.id !== id; });
  const title = byId("lightWizardTitle");
  const subtitle = byId("lightWizardSubtitle");
  const copy = {
    lightWizardChoice: ["Wie möchtest du starten?", "Du kannst einen fertigen Ablauf nehmen oder alles selbst zusammenstellen."],
    lightWizardTemplates: ["Fertigen Modus wählen", "Wähle, welches Verhalten zu deiner Lichtgruppe passt."],
    lightWizardForm: [editingId ? "Lichtgruppe bearbeiten" : "Lichtgruppe einrichten", "Wir führen dich durch Relais, Zeiten und Verhalten."]
  }[id];
  if (copy) { title.textContent = copy[0]; subtitle.textContent = copy[1]; }
}

function openWizard() {
  draft = null;
  editingId = "";
  byId("lightSystemWizard").showModal();
  showWizardStep("lightWizardChoice");
}

function selectedRelays() {
  return Array.from(document.querySelectorAll("#lightGroupRelayChoices input[type='checkbox']:checked"))
    .map((input) => {
      const relay = relayInventory().find((item) => item.module === input.dataset.module && item.channel === Number(input.dataset.channel));
      return relay ? { module: relay.module, channel: relay.channel, name: relay.name || `Relais ${relay.channel}` } : null;
    }).filter(Boolean);
}

function renderRelayChoices(selected = []) {
  const host = byId("lightGroupRelayChoices");
  const inventory = relayInventory();
  const chosen = new Set(selected.map((relay) => `${relay.module}:${relay.channel}`));
  if (!inventory.length) {
    host.innerHTML = `<div class="light-no-relays"><strong>Noch keine Relais gefunden</strong><span>Verbinde ein Relaismodul. Danach kannst du die Lichtgruppe hier einrichten.</span><button class="text-button" type="button" data-go-settings="modules">Geräte öffnen →</button></div>`;
    return;
  }
  host.innerHTML = inventory.map((relay) => {
    const key = `${relay.module}:${relay.channel}`;
    const name = relay.name ? `${relay.name} · Relais ${relay.channel}` : `Relais ${relay.channel}`;
    return `<label class="light-relay-choice"><input type="checkbox" data-module="${esc(relay.module)}" data-channel="${relay.channel}" ${chosen.has(key) ? "checked" : ""}><span class="light-relay-state ${relay.state ? "on" : ""}" aria-hidden="true"></span><span><strong>${esc(name)}</strong><small>${esc(relay.moduleName)}</small></span></label>`;
  }).join("");
}

function numberField(id, label, value, min, max, suffix = "Minuten") {
  return `<label class="light-setting-field">${label}<span><input id="${id}" type="number" min="${min}" max="${max}" value="${Number(value)}"><small>${suffix}</small></span></label>`;
}

function renderBehaviorFields() {
  const host = byId("lightGroupBehaviorFields");
  const behavior = byId("lightGroupBehavior").value;
  const settings = { ...DEFAULT_SETTINGS, ...(draft?.settings || {}) };
  if (behavior === "presence") {
    host.innerHTML = `<div class="light-behavior-explainer"><strong>So wirkt es, als wäre jemand zuhause</strong><span>Jedes Relais bekommt eigene, zufällige Wechsel. Die Lichter bleiben unterschiedlich lange an und aus.</span></div>
      <div class="light-settings-grid"><label class="light-setting-field">Abends beginnen<input id="lightStartTime" type="time" value="${esc(settings.startTime)}"></label><label class="light-setting-field">Nachts beenden<input id="lightEndTime" type="time" value="${esc(settings.endTime)}"></label>
      ${numberField("lightMinOn", "Licht mindestens an", settings.minOnMin, 1, 180)}${numberField("lightMaxOn", "Licht höchstens an", settings.maxOnMin, 1, 240)}
      ${numberField("lightMinOff", "Pause mindestens", settings.minOffMin, 1, 180)}${numberField("lightMaxOff", "Pause höchstens", settings.maxOffMin, 1, 240)}</div>`;
  } else if (behavior === "sunset") {
    const place = system.location || DEFAULT_LOCATION;
    host.innerHTML = `<div class="light-behavior-explainer"><strong>Schaltet passend zu Tag und Nacht</strong><span>Die Zeiten für Sonnenuntergang und Sonnenaufgang werden für deinen Standort und die Ortszeit berechnet.</span></div>
      <div class="light-settings-grid"><label class="light-setting-field">Ort<input id="lightLocationName" maxlength="64" value="${esc(place.name)}" placeholder="z. B. Berlin"></label>
      <label class="light-setting-field">Zeitzone<input id="lightTimezone" value="${esc(place.timezone)}" placeholder="Europe/Berlin"></label>
      <label class="light-setting-field">Breitengrad<input id="lightLatitude" type="number" min="-90" max="90" step="0.0001" value="${Number(place.latitude)}"></label>
      <label class="light-setting-field">Längengrad<input id="lightLongitude" type="number" min="-180" max="180" step="0.0001" value="${Number(place.longitude)}"></label>
      ${numberField("lightSunsetOffset", "Einschalten nach Sonnenuntergang", settings.sunsetOffsetMin, -180, 180)}${numberField("lightSunriseOffset", "Ausschalten nach Sonnenaufgang", settings.sunriseOffsetMin, -180, 180)}</div>
      <button class="text-button light-location-default" type="button" data-location-default>Deutschland-Mitte verwenden</button>`;
  } else if (behavior === "daily") {
    host.innerHTML = `<div class="light-behavior-explainer"><strong>Einfacher täglicher Zeitplan</strong><span>Alle Relais dieser Gruppe schalten gemeinsam zu den gewählten Uhrzeiten.</span></div>
      <div class="light-settings-grid"><label class="light-setting-field">Einschalten um<input id="lightOnTime" type="time" value="${esc(settings.onTime)}"></label><label class="light-setting-field">Ausschalten um<input id="lightOffTime" type="time" value="${esc(settings.offTime)}"></label></div>`;
  } else {
    host.innerHTML = `<div class="light-behavior-explainer"><strong>Du entscheidest selbst</strong><span>Die Gruppe bekommt keine automatische Schaltzeit. Du kannst sie jederzeit mit „Licht an“ und „Licht aus“ bedienen.</span></div>`;
  }
}

function openGroupForm(group = null, template = null) {
  editingId = group?.id || "";
  formBackStep = template ? "lightWizardTemplates" : "lightWizardChoice";
  draft = group ? JSON.parse(JSON.stringify(group)) : {
    id: makeId(), name: template?.name || "", kind: template?.kind || "custom",
    behavior: template?.behavior || "daily", enabled: true, relays: [],
    settings: { ...DEFAULT_SETTINGS, ...(template?.settings || {}) }
  };
  byId("lightWizardFormTitle").textContent = editingId ? "Gruppe und Ablauf bearbeiten" : "Lichtgruppe einrichten";
  const backButton = byId("lightWizardForm").querySelector("[data-wizard-back]");
  if (backButton) backButton.dataset.wizardBack = formBackStep === "lightWizardTemplates" ? "templates" : "choice";
  byId("lightGroupName").value = draft.name || "";
  byId("lightGroupKind").value = draft.kind || "custom";
  byId("lightGroupBehavior").value = draft.behavior || "daily";
  renderRelayChoices(draft.relays);
  renderBehaviorFields();
  showWizardStep("lightWizardForm");
}

function readSettings(behavior) {
  const settings = { ...(draft?.settings || DEFAULT_SETTINGS) };
  if (behavior === "presence") {
    settings.startTime = byId("lightStartTime").value || "18:00";
    settings.endTime = byId("lightEndTime").value || "23:30";
    settings.minOnMin = Number(byId("lightMinOn").value) || 2;
    settings.maxOnMin = Number(byId("lightMaxOn").value) || 12;
    settings.minOffMin = Number(byId("lightMinOff").value) || 1;
    settings.maxOffMin = Number(byId("lightMaxOff").value) || 8;
  } else if (behavior === "daily") {
    settings.onTime = byId("lightOnTime").value || "18:00";
    settings.offTime = byId("lightOffTime").value || "23:00";
  } else if (behavior === "sunset") {
    settings.sunsetOffsetMin = Number(byId("lightSunsetOffset").value) || 0;
    settings.sunriseOffsetMin = Number(byId("lightSunriseOffset").value) || 15;
  }
  return settings;
}

async function persist() {
  const result = await apiCall("/light-system", { method: "POST", body: { lightSystem: system } });
  system = result.lightSystem;
  runtime = result.runtime || runtime;
  state.hardware.lightSystem = system;
  renderGroups();
}

async function saveGroup() {
  const name = byId("lightGroupName").value.trim();
  const relays = selectedRelays();
  const behavior = byId("lightGroupBehavior").value;
  if (!name) throw new Error("Gib der Gruppe bitte einen Namen, zum Beispiel „Haus 1“.");
  if (!relays.length) throw new Error("Wähle mindestens ein Relais für diese Gruppe aus.");
  if (behavior === "sunset") {
    const latitude = Number(byId("lightLatitude").value);
    const longitude = Number(byId("lightLongitude").value);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new Error("Bitte prüfe Breitengrad und Längengrad.");
    }
    system.location = {
      name: byId("lightLocationName").value.trim() || "Deutschland (Mitte)",
      latitude, longitude,
      timezone: byId("lightTimezone").value.trim() || "Europe/Berlin"
    };
  }
  const next = {
    ...draft, name, kind: byId("lightGroupKind").value, behavior,
    enabled: draft.enabled !== false, relays, settings: readSettings(behavior)
  };
  const index = system.groups.findIndex((group) => group.id === next.id);
  if (index < 0) system.groups.push(next); else system.groups[index] = next;
  const wasEditing = Boolean(editingId);
  await persist();
  byId("lightSystemWizard").close();
  showToast(wasEditing ? "Lichtgruppe aktualisiert." : "Lichtgruppe erstellt.");
  draft = null; editingId = "";
}

async function updateGroup(id, change) {
  const index = system.groups.findIndex((group) => group.id === id);
  if (index < 0) return;
  system.groups[index] = { ...system.groups[index], ...change };
  await persist();
}

async function manualControl(id, on) {
  const result = await apiCall(`/light-system/groups/${encodeURIComponent(id)}/control`, {
    method: "POST", body: { state: on }
  });
  runtime = result.runtime || runtime;
  renderGroups();
  showToast(on ? "Lichtgruppe eingeschaltet." : "Lichtgruppe ausgeschaltet.");
}

function resetWizard() {
  draft = null;
  editingId = "";
  showWizardStep("lightWizardChoice");
}

export async function initializeLightSystem() {
  try {
    const result = await apiCall("/light-system");
    system = result.lightSystem || system;
    runtime = result.runtime || runtime;
  } catch (error) { showToast(`Lichtgruppen konnten nicht geladen werden: ${error.message}`, "error"); }
  renderGroups();

  byId("addLightGroup").addEventListener("click", openWizard);
  byId("closeLightWizard").addEventListener("click", () => { byId("lightSystemWizard").close(); resetWizard(); });
  byId("cancelLightGroup").addEventListener("click", () => { byId("lightSystemWizard").close(); resetWizard(); });
  byId("lightSystemWizard").addEventListener("click", (event) => { if (event.target === byId("lightSystemWizard")) { byId("lightSystemWizard").close(); resetWizard(); } });
  byId("lightSystemWizard").addEventListener("close", resetWizard);
  byId("lightGroupBehavior").addEventListener("change", renderBehaviorFields);

  document.addEventListener("click", async (event) => {
    const choice = event.target.closest("[data-wizard-choice]");
    const template = event.target.closest("[data-wizard-template]");
    const back = event.target.closest("[data-wizard-back]");
    const open = event.target.closest("[data-open-light-wizard]");
    const edit = event.target.closest("[data-group-edit]");
    const remove = event.target.closest("[data-group-delete]");
    const toggle = event.target.closest("[data-group-toggle]");
    const control = event.target.closest("[data-group-control]");
    const settings = event.target.closest("[data-go-settings]");
    const locationDefault = event.target.closest("[data-location-default]");
    try {
      if (choice?.dataset.wizardChoice === "preset") showWizardStep("lightWizardTemplates");
      else if (choice?.dataset.wizardChoice === "custom") openGroupForm();
      else if (template?.dataset.wizardTemplate) {
        const templates = {
          house: { name: "Haus 1", kind: "house", behavior: "presence" },
          street: { name: "Straßenlicht", kind: "street", behavior: "sunset" },
          daily: { name: "Neue Lichtgruppe", kind: "custom", behavior: "daily" }
        };
        openGroupForm(null, templates[template.dataset.wizardTemplate]);
      } else if (back) showWizardStep(back.dataset.wizardBack === "choice" ? "lightWizardChoice" : "lightWizardTemplates");
      else if (open) openWizard();
      else if (edit) {
        const group = system.groups.find((item) => item.id === edit.dataset.groupEdit);
        if (group) { byId("lightSystemWizard").showModal(); openGroupForm(group); }
      } else if (remove) {
        const group = system.groups.find((item) => item.id === remove.dataset.groupDelete);
        if (!group || !confirm(`Lichtgruppe „${group.name}“ löschen?`)) return;
        system.groups = system.groups.filter((item) => item.id !== group.id);
        await persist();
        showToast("Lichtgruppe gelöscht.");
      } else if (toggle) {
        const group = system.groups.find((item) => item.id === toggle.dataset.groupToggle);
        if (group) await updateGroup(group.id, { enabled: !group.enabled });
      } else if (control) {
        await manualControl(control.dataset.groupControl, control.dataset.groupState === "true");
      } else if (settings) {
        byId("lightSystemWizard").close();
        document.querySelector(`.nav-button[data-page="settings"]`)?.click();
        document.querySelector(`[data-settings-view="${settings.dataset.goSettings}"]`)?.click();
      } else if (locationDefault) {
        byId("lightLocationName").value = DEFAULT_LOCATION.name;
        byId("lightLatitude").value = DEFAULT_LOCATION.latitude;
        byId("lightLongitude").value = DEFAULT_LOCATION.longitude;
        byId("lightTimezone").value = DEFAULT_LOCATION.timezone;
      }
    } catch (error) { showToast(error.message || String(error), "error"); }
  });

  byId("saveLightGroup").addEventListener("click", async () => {
    try { await saveGroup(); } catch (error) { showToast(error.message || String(error), "error"); }
  });
  document.addEventListener("dynora:status-updated", () => {
    if (state.hardware?.lightSystem) system = state.hardware.lightSystem;
    if (state.lightSystemRuntime) runtime = state.lightSystemRuntime;
    renderGroups();
  });
  document.querySelector(".nav-button[data-page='lightsystem']")?.addEventListener("click", () => {
    renderGroups();
    if (!system.groups.length) {
      try { if (sessionStorage.getItem("dynora.lightWizard.dismissed") !== "1") { openWizard(); sessionStorage.setItem("dynora.lightWizard.dismissed", "1"); } } catch { openWizard(); }
    }
  });
  byId("lightSystemWizard").addEventListener("close", () => {
    if (!system.groups.length) {
      try { sessionStorage.setItem("dynora.lightWizard.dismissed", "1"); } catch {}
    }
  });
  if (document.body.dataset.page === "lightsystem" && !system.groups.length) {
    try { if (sessionStorage.getItem("dynora.lightWizard.dismissed") !== "1") openWizard(); } catch { openWizard(); }
  }
}
