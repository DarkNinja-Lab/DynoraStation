"use strict";

import { apiCall } from "../core/api.js";
import { state } from "../core/state.js";
import { renderSidebarEspStatus, renderCs3Tiles, renderDashboardOverview } from "../ui/render.js";
import { refreshSettingsHardwareStatus } from "../ui/events.js";
import { renderTrackLightButtons } from "../track/lights.js";
import { renderTrackLayout } from "../track/track.js";
import { layoutNormalisieren } from "../layout/layout.js";

function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function renderEvents() {
  const host = document.getElementById("eventList");
  if (!host) return;
  const events = Array.isArray(state.events) ? state.events : [];
  host.innerHTML = events.length ? events.map((event) => {
    const timeValue = event.timestamp || event.time;
    const time = timeValue ? new Date(timeValue).toLocaleTimeString("de-DE") : "–";
    return `<div class="event-row"><strong>${escapeHtml(event.type || "SYSTEM")}</strong><span>${escapeHtml(event.text || "")}</span><small>${escapeHtml(event.source || "")} · ${time}</small></div>`;
  }).join("") : '<div class="empty-state">Noch keine Ereignisse vorhanden.</div>';
}

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
    badge.textContent = online ? "WEBSERVER ONLINE" : "WEBSERVER OFFLINE";
    badge.classList.toggle("offline", !online);
    badge.classList.toggle("online", online);
  }
  if (sidebar) {
    sidebar.textContent = online ? "WebServer online" : "WebServer offline";
    sidebar.closest(".sidebar-status-box")?.classList.toggle("online", online);
    sidebar.closest(".sidebar-status-box")?.classList.toggle("offline", !online);
  }
  if (card) card.textContent = online ? "ONLINE" : "OFFLINE";
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

function trackRenderSignature(layout, modules) {
  const liveStates = Object.values(modules).map((module) => ({
    id: module.id,
    relays: module.relays,
    sensors: (module.sensors || []).map((sensor) => ({
      id: sensor?.id,
      triggered: Boolean(sensor?.triggered ?? sensor?.active ?? sensor?.state)
    })),
    leds: module.leds
  }));
  return JSON.stringify({ layout, liveStates });
}

export async function statusLaden({ ruhig = true } = {}) {
  try {
    const data = await apiCall("/status");
    state.statusPollMs = Math.max(250, Number(data?.uiStatusIntervalMs) || 400);

    setServerOnline(true);

    const modules = normalizeModules(data?.hardware?.modules ?? data?.modules);
    state.hardware.modules = modules;

    const allModules = Object.values(modules);
    const onlineModules = allModules.filter(m => !!m.online).length;

    setText("moduleCardStatus", `${onlineModules} / ${allModules.length}`);
    setText("dashboardSummary", onlineModules === allModules.length && allModules.length ? "Alle Systeme betriebsbereit" : allModules.length ? `${allModules.length - onlineModules} Modul(e) offline` : "Noch keine Module registriert");

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

    if (Array.isArray(data?.cs3Tiles)) state.cs3Tiles = data.cs3Tiles;
    const editorOpen = document.getElementById("page-builder")?.classList.contains("active");
    if (data?.layout && typeof data.layout === "object" && !state.layoutDirty && !editorOpen) {
      state.layout = data.layout;
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
    if (Array.isArray(data?.defaults)) state.defaults = data.defaults;
    if (data?.ledConfig && typeof data.ledConfig === "object") state.ledConfig = data.ledConfig;

    // Namen/Rollen aus persistenter Hardware in die Settings-UI spiegeln.
    const hwRelays = Array.isArray(data?.hardware?.relays) ? data.hardware.relays : [];
    for (const r of hwRelays) state.relayConfig[`${r.module}:${r.channel}`] = { name: r.name || "", role: r.role || "" };
    const hwSensors = Array.isArray(data?.hardware?.sensors) ? data.hardware.sensors : [];
    for (const s of hwSensors) state.sensorConfig[`${s.module}:${s.id}`] = { name: s.name || "" };
    if (Array.isArray(data?.lightButtons)) {
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
    }

    renderSidebarEspStatus();
    renderCs3Tiles();
    renderDashboardOverview();
    renderTrackLightButtons();
    refreshSettingsHardwareStatus();
  } catch (err) {
    setServerOnline(false);
    if (!ruhig) {
      console.warn("Status laden fehlgeschlagen:", err?.message || err);
    }
  }
}
