"use strict";

import { apiCall } from "../core/api.js?v=workspace-v11";
import { state } from "../core/state.js?v=workspace-v11";
import { esc } from "../core/utils.js?v=workspace-v11";
import { renderSidebarEspStatus, renderCs3Tiles, renderDashboardOverview } from "../ui/render.js?v=workspace-v11";
import { refreshSettingsHardwareStatus } from "../ui/events.js?v=workspace-v15";
import { renderTrackLightButtons } from "../track/lights.js?v=workspace-v11";
import { renderTrackLayout, renderTrackPowerSections } from "../track/track.js?v=workspace-v15";
import { layoutNormalisieren } from "../layout/layout.js?v=workspace-v11";
import { showToast } from "../ui/toast.js?v=workspace-v15";

export function renderEvents() {
  const host = document.getElementById("eventList");
  if (!host) return;
  const events = Array.isArray(state.events) ? state.events : [];
  const search = String(document.getElementById("eventSearch")?.value || "").trim().toLocaleLowerCase("de-DE");
  const sourceOf = event => String(event.source || "SYSTEM");
  const typeOf = event => String(event.type || "SYSTEM");
  const fillFilter = (id, label, values) => {
    const select = document.getElementById(id);
    if (!select) return "";
    const selected = select.value;
    const options = [...new Set([...values, ...(selected ? [selected] : [])])].sort((a,b) => a.localeCompare(b,"de"));
    const signature = options.join("\u0000");
    if (select.dataset.signature !== signature) {
      select.dataset.signature = signature;
      select.replaceChildren(new Option(label,""), ...options.map(value => new Option(value,value)));
      select.value = selected;
    }
    return select.value;
  };
  const type = fillFilter("eventTypeFilter","Alle Ereignisse",events.map(typeOf));
  const source = fillFilter("eventSourceFilter","Alle Quellen",events.map(sourceOf));
  const sort = document.getElementById("eventSortOrder")?.value || "newest";
  const timeOf = event => new Date(event.timestamp || event.time || 0).getTime() || 0;
  const filtered = events.filter(event => (!type || typeOf(event) === type) && (!source || sourceOf(event) === source) &&
    (!search || [typeOf(event),event.text,sourceOf(event)].some(value => String(value || "").toLocaleLowerCase("de-DE").includes(search))));
  filtered.sort((a,b) => sort === "source" ? sourceOf(a).localeCompare(sourceOf(b),"de") || timeOf(b)-timeOf(a)
    : sort === "type" ? typeOf(a).localeCompare(typeOf(b),"de") || timeOf(b)-timeOf(a)
    : sort === "oldest" ? timeOf(a)-timeOf(b) : timeOf(b)-timeOf(a));
  const count = document.getElementById("eventResultCount");
  if (count) count.textContent = `${filtered.length} von ${events.length} Einträgen`;
  host.innerHTML = filtered.length ? filtered.map(event => {
    const time = timeOf(event) ? new Date(timeOf(event)).toLocaleString("de-DE") : "–";
    return `<div class="event-row"><strong>${esc(typeOf(event))}</strong><span>${esc(event.text || "")}</span><small>${esc(sourceOf(event))} · ${time}</small></div>`;
  }).join("") : `<div class="empty-state">${events.length ? "Keine passenden Ereignisse gefunden." : "Noch keine Ereignisse vorhanden. Quellen und Typen erscheinen, sobald Meldungen eintreffen."}</div>`;
}
for (const id of ["eventSearch","eventTypeFilter","eventSourceFilter","eventSortOrder"]) {
  document.getElementById(id)?.addEventListener(id === "eventSearch" ? "input" : "change",renderEvents);
}
document.getElementById("clearEventsButton")?.addEventListener("click", async (event) => {
  if (!confirm("Das gesamte Logbuch dauerhaft löschen?")) return;
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await apiCall("/events", { method: "DELETE" });
    state.events = [];
    renderEvents();
    document.dispatchEvent(new CustomEvent("dynora:events-cleared"));
  } catch (error) {
    showToast(`Logbuch konnte nicht gelöscht werden: ${error.message || error}`, "error");
  } finally { button.disabled = false; }
});

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setServerOnline(online) {
  const badge = document.getElementById("serverStatus");
  const sidebar = document.getElementById("sidebarServerStatus");
  const card = document.getElementById("serverCardStatus");
  const dashboard = document.querySelector(".dashboard-commandbar");
  dashboard?.classList.toggle("online", online);
  dashboard?.classList.toggle("offline", !online);

  if (badge) {
    badge.textContent = online ? "DYNORASTATION ONLINE" : "DYNORASTATION OFFLINE";
    badge.classList.toggle("offline", !online);
    badge.classList.toggle("online", online);
  }
  if (sidebar) {
    sidebar.textContent = online ? "DynoraStation online" : "DynoraStation offline";
    sidebar.closest(".sidebar-status-box")?.classList.toggle("online", online);
    sidebar.closest(".sidebar-status-box")?.classList.toggle("offline", !online);
  }
  if (card) card.textContent = online ? "ONLINE" : "OFFLINE";
}

function setLastSync(online) {
  const el = document.getElementById("lastSyncStatus");
  if (!el) return;
  el.textContent = online
    ? `Synchronisiert · ${new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`
    : "Verbindung unterbrochen";
  el.classList.toggle("offline", !online);
}

function updateTrackSystemNotice(modules) {
  const notice = document.getElementById("trackSystemNotice");
  if (!notice) return;
  const all = Object.values(modules || {});
  const online = all.filter((module) => module.online && module.compatibility?.compatible !== false && module.health?.relayDriverReady !== false).length;
  const assigned = (state.layout?.elemente || []).filter((element) => element.module).length;
  const total = (state.layout?.elemente || []).length;
  const title = notice.querySelector("strong");
  const detail = notice.querySelector("small");
  const ready = all.length > 0 && online === all.length;

  notice.classList.toggle("ready", ready);
  notice.classList.toggle("attention", !ready);
  if (title) {
    title.textContent = all.length === 0
      ? "Noch keine Steuerungsmodule registriert"
      : ready ? `${online} ${online === 1 ? "Modul" : "Module"} schaltbereit`
        : `${online} von ${all.length} Modulen schaltbereit`;
  }
  if (detail) {
    detail.textContent = total
      ? `${assigned} von ${total} Planelementen haben eine Hardwarezuweisung.`
      : "Lege zuerst im Planer deine Märklin M-Gleis-Anlage an.";
  }
}

function normalizeModules(rawModules) {
  if (Array.isArray(rawModules)) {
    const out = {};
    for (const m of rawModules) {
      const id = m?.id || m?.name || crypto.randomUUID();
      out[id] = { ...m, id };
    }
    return out;
  }
  if (rawModules && typeof rawModules === "object") {
    return rawModules;
  }
  return {};
}

let lastTrackRenderSignature = "";
let lastDirectControlSignature = "";
let lastLightButtonSignature = "";
let lastSidebarSignature = "";
let lastDashboardSignature = "";
let lastHardwareInventorySignature = "";

function trackRenderSignature(layout, modules) {
  const liveStates = Object.values(modules).map((module) => ({
    id: module.id,
    relays: module.relays,
    sensors: (module.sensors || []).map((sensor) => ({
      id: sensor?.id,
      triggered: Boolean(sensor?.triggered ?? sensor?.active ?? sensor?.state)
    })),
    leds: module.leds,
    environment: module.environment,
    online: module.online,
    compatibility: module.compatibility
  }));
  return JSON.stringify({ layout, liveStates, commands: state.commands || [] });
}

function directControlSignature(layout, modules) {
  return JSON.stringify({
    elements: (layout?.elemente || [])
    .filter((element) => element.showInDirectControl !== false && ["switch", "xtrack", "crossing", "signal", "ledSignal", "espSignal"].includes(element.typ))
    .map((element) => ({
      id: element.id,
      name: element.name,
      typ: element.typ,
      showInDirectControl: element.showInDirectControl,
      switchState: element.switchState,
      xState: element.xState,
      signalState: element.signalState,
      ledState: element.ledState,
      espState: element.espState,
      module: element.module
    })),
    modules: Object.values(modules || {}).map((module) => ({ id: module.id, online: module.online, compatibility: module.compatibility, health: module.health })),
    commands: state.commands || []
  });
}

async function loadStatus({ ruhig = true } = {}) {
  try {
    const revisions = state.statusRevisions || { layout: 0, events: 0 };
    const query = new URLSearchParams({
      layoutRevision: String(revisions.layout || 0),
      eventRevision: String(revisions.events || 0),
      instanceId: state.stationInstanceId || ""
    });
    const data = await apiCall(`/status?${query}`, { timeoutMs: 8000 });
    if (data?.instanceId) state.stationInstanceId = data.instanceId;
    if (data?.revisions) state.statusRevisions = { ...revisions, ...data.revisions };
    state.statusPollMs = Math.max(200, Number(data?.uiStatusIntervalMs) || 200);
    state.connection = data?.connection && typeof data.connection === "object" ? data.connection : null;
    state.serverVersion = String(data?.serverVersion || "");
    state.serverUptimeSec = Math.max(0, Number(data?.uptimeSec) || 0);
    state.stationStatus = data?.station && typeof data.station === "object"
      ? data.station
      : { state: "running", managedBy: "unknown", pid: 0, uptimeSec: state.serverUptimeSec };

    setServerOnline(true);
    setLastSync(true);

    const modules = normalizeModules(data?.hardware?.modules ?? data?.modules);
    state.hardware = {
      ...(state.hardware || {}),
      ...(data?.hardware && typeof data.hardware === "object" ? data.hardware : {}),
      modules
    };
    if (Array.isArray(data?.commands)) state.commands = data.commands;
    state.relayConflicts = Array.isArray(data?.warnings?.relayConflicts) ? data.warnings.relayConflicts : [];
    const settingsSnapshotIsFresh = Number(data?.hardware?.updatedAt || 0) >= Number(state.settingsPersistedAt || 0);
    if (settingsSnapshotIsFresh && !state.settingsDirty?.leds && !state.ledConfigDirty && data?.ledConfig && typeof data.ledConfig === "object") state.ledConfig = data.ledConfig;

    const allModules = Object.values(modules);
    const onlineModules = allModules.filter(m => !!m.online).length;
    updateTrackSystemNotice(modules);

    const hardwareInventorySignature = JSON.stringify({
      modules: allModules.map((module) => ({
        id: module.id,
        name: module.name,
        capabilities: module.capabilities,
        kind: module.kind,
        firmwareVersion: module.firmwareVersion,
        protocolVersion: module.protocolVersion,
        hardwareType: module.hardwareType,
        compatibility: module.compatibility,
        health: module.health,
        relayCount: module.relays?.length || 0,
        sensorIds: (module.sensors || []).map((sensor) => sensor?.id),
        ledCount: module.leds?.length || 0
      })),
      ledConfig: state.ledConfig
    });
    if (hardwareInventorySignature !== lastHardwareInventorySignature) {
      lastHardwareInventorySignature = hardwareInventorySignature;
      document.dispatchEvent(new CustomEvent("dynora:modules-updated"));
    }

    const incompatibleModules = allModules.filter((module) => module.compatibility?.compatible === false).length;
    setText("moduleCardStatus", `${onlineModules} / ${allModules.length}`);
    setText("dashboardSummary", state.relayConflicts.length
      ? `${state.relayConflicts.length} Relais-Konflikt(e) erkannt`
      : incompatibleModules
        ? `${incompatibleModules} inkompatible(s) Modul(e)`
        : onlineModules === allModules.length && allModules.length
          ? allModules.some((module) => module.health?.relayDriverReady === false)
            ? "MCP23017 nicht erreichbar"
            : "Alle Systeme betriebsbereit"
          : allModules.length ? `${allModules.length - onlineModules} Modul(e) offline` : "Noch keine Module registriert");

    let relayTotal = 0;
    let relayActive = 0;
    for (const m of allModules) {
      const relays = Array.isArray(m.relays) ? m.relays : [];
      relayTotal += relays.length;
      relayActive += relays.filter(r => typeof r === "boolean" ? r : !!(r?.active ?? r?.state)).length;
    }
    setText("relayCardStatus", `${relayActive} / ${relayTotal}`);

    const elementCount = Array.isArray(state?.layout?.elemente) ? state.layout.elemente.length : 0;
    setText("elementCardStatus", String(elementCount));

    const transformerModuleIds = (state.layout?.elemente || [])
      .filter((element) => element.typ === "transformer" && element.module)
      .map((element) => element.module);
    const environmentModule = transformerModuleIds
      .map((moduleId) => modules[moduleId])
      .find((module) => Number.isFinite(Number(module?.environment?.temperatureC)))
      || allModules.find((module) => Number.isFinite(Number(module?.environment?.temperatureC)));
    if (environmentModule?.online) {
      const environment = environmentModule.environment;
      setText("temperatureCardStatus", `${Number(environment.temperatureC).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`);
      setText("temperatureCardDetail", `${Number(environment.humidityPct).toLocaleString("de-DE", { maximumFractionDigits: 1 })} % rF · ${Number(environment.pressureHpa).toLocaleString("de-DE", { maximumFractionDigits: 0 })} hPa`);
    } else {
      setText("temperatureCardStatus", "–");
      setText("temperatureCardDetail", environmentModule ? "BME280-Modul offline" : "BME280 nicht gemeldet");
    }

    if (Array.isArray(data?.cs3Tiles)) state.cs3Tiles = data.cs3Tiles;
    const editorOpen = document.getElementById("page-builder")?.classList.contains("active");
    if (data?.layout && typeof data.layout === "object") {
      state.pendingStationLayout = data.layout;
      state.pendingStationVersion = data.layoutVersion;
    }
    if (state.pendingStationLayout && !state.layoutDirty && !editorOpen) {
      state.layout = state.pendingStationLayout;
      state.layoutVersion = state.pendingStationVersion;
      state.pendingStationLayout = null;
      layoutNormalisieren();
    }
    if (!editorOpen) {
      const signature = trackRenderSignature(state.layout, modules);
      if (signature !== lastTrackRenderSignature) {
        lastTrackRenderSignature = signature;
        renderTrackLayout();
      }
    }
    if (Array.isArray(data?.events)) {
      state.events = data.events;
      renderEvents();
    }
    if (settingsSnapshotIsFresh && !state.settingsDirty?.defaults && Array.isArray(data?.defaults)) state.defaults = data.defaults;

    // Namen/Rollen aus persistenter Hardware in die Settings-UI spiegeln.
    const hwRelays = Array.isArray(data?.hardware?.relays) ? data.hardware.relays : [];
    if (settingsSnapshotIsFresh && !state.settingsDirty?.relays) {
      state.relayConfig = {};
      for (const r of hwRelays) state.relayConfig[`${r.module}:${r.channel}`] = { name: r.name || "", role: r.role || "" };
      renderTrackPowerSections();
    }
    const hwSensors = Array.isArray(data?.hardware?.sensors) ? data.hardware.sensors : [];
    if (settingsSnapshotIsFresh && !state.settingsDirty?.sensors) {
      state.sensorConfig = {};
      for (const s of hwSensors) state.sensorConfig[`${s.module}:${s.id}`] = { name: s.name || "" };
    }
    if (settingsSnapshotIsFresh && !state.settingsDirty?.lights && Array.isArray(data?.lightButtons)) {
      state.lightButtons = data.lightButtons.map((b) => {
        const moduleId = b.module || b.moduleId || "";
        const relayIndex = Number(b.relay ?? b.relayIndex ?? 0);
        return {
          id: b.id,
          name: b.name,
          moduleId,
          relayIndex,
          active: relayIndex > 0 ? Boolean(modules[moduleId]?.relays?.[relayIndex - 1]) : false
        };
      });
    } else if (Array.isArray(state.lightButtons)) {
      state.lightButtons.forEach((button) => {
        const channel = Number(button.relayIndex || 0);
        button.active = channel > 0 ? Boolean(modules[button.moduleId]?.relays?.[channel - 1]) : false;
      });
    }

    const sidebarSignature = JSON.stringify(allModules.map((module) => ({
      id: module.id, name: module.name, online: module.online, kind: module.kind, ip: module.ip, health: module.health,
      firmwareVersion: module.firmwareVersion, protocolVersion: module.protocolVersion, hardwareType: module.hardwareType, compatibility: module.compatibility
    })));
    if (sidebarSignature !== lastSidebarSignature) {
      lastSidebarSignature = sidebarSignature;
      renderSidebarEspStatus();
    }

    const controlsSignature = directControlSignature(state.layout, modules);
    if (controlsSignature !== lastDirectControlSignature) {
      lastDirectControlSignature = controlsSignature;
      renderCs3Tiles();
    }

    const lightSignature = JSON.stringify({
      lights: state.lightButtons || [],
      modules: Object.values(modules).map((module) => ({ id: module.id, online: module.online, compatibility: module.compatibility, health: module.health })),
      commands: state.commands || []
    });
    if (lightSignature !== lastLightButtonSignature) {
      lastLightButtonSignature = lightSignature;
      renderTrackLightButtons();
    }

    const dashboardSignature = JSON.stringify({
      modules: allModules,
      layout: state.layout,
      events: state.events?.slice(0, 5),
      relayConflicts: state.relayConflicts
    });
    if (dashboardSignature !== lastDashboardSignature) {
      lastDashboardSignature = dashboardSignature;
      renderDashboardOverview();
    }
    refreshSettingsHardwareStatus();
  } catch (err) {
    state.statusPollMs = Math.min(10000,Math.max(1000,(state.statusPollMs || 400) * 2));
    setServerOnline(false);
    setLastSync(false);
    if (!ruhig) {
      console.warn("Status laden fehlgeschlagen:", err?.message || err);
    }
  }
}

// One request at a time, including manual refreshes and a resumed mobile tab.
let statusRequest = null;
export function statusLaden(options = {}) {
  if (statusRequest) return statusRequest;
  statusRequest = loadStatus(options).finally(() => { statusRequest = null; });
  return statusRequest;
}
