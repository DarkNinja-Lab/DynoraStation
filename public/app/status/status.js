"use strict";

import { apiCall } from "../core/api.js";
import { state } from "../core/state.js";
import { renderSidebarEspStatus, renderCs3Tiles } from "../ui/render.js";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setServerOnline(online) {
  const badge = document.getElementById("serverStatus");
  const sidebar = document.getElementById("sidebarServerStatus");
  const card = document.getElementById("serverCardStatus");

  if (badge) {
    badge.textContent = online ? "WEBSERVER ONLINE" : "WEBSERVER OFFLINE";
    badge.classList.toggle("offline", !online);
  }
  if (sidebar) sidebar.textContent = online ? "WebServer online" : "WebServer offline";
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

export async function statusLaden({ ruhig = true } = {}) {
  try {
    const data = await apiCall("/status");

    setServerOnline(true);

    const modules = normalizeModules(data?.hardware?.modules ?? data?.modules);
    state.hardware.modules = modules;

    const allModules = Object.values(modules);
    const onlineModules = allModules.filter(m => !!m.online).length;

    setText("moduleCardStatus", `${onlineModules} / ${allModules.length}`);

    let relayTotal = 0;
    let relayActive = 0;
    for (const m of allModules) {
      const relays = Array.isArray(m.relays) ? m.relays : [];
      relayTotal += relays.length;
      relayActive += relays.filter(r => !!(r?.active ?? r?.state)).length;
    }
    setText("relayCardStatus", `${relayActive} / ${relayTotal}`);

    const elementCount = Array.isArray(state?.layout?.elements) ? state.layout.elements.length : 0;
    setText("elementCardStatus", String(elementCount));

    if (Array.isArray(data?.cs3Tiles)) state.cs3Tiles = data.cs3Tiles;
    if (Array.isArray(data?.lightButtons)) state.lightButtons = data.lightButtons;

    renderSidebarEspStatus();
    renderCs3Tiles();
  } catch (err) {
    setServerOnline(false);
    if (!ruhig) {
      console.warn("Status laden fehlgeschlagen:", err?.message || err);
    }
  }
}