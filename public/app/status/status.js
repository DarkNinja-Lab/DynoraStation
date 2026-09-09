"use strict";

import { state } from "../core/state.js";
import { apiCall } from "../core/api.js";

export async function statusLaden(options = {}) {
  try {
    const data = await apiCall("/status");
    
    // Update state
    if (data.layout) state.layout = data.layout;
    if (data.hardware) state.hardware = data.hardware;
    if (data.rules) state.rules = data.rules;
    if (data.events || data.ereignisse) state.events = data.events || data.ereignisse;
    
    // WICHTIG: Module aus moduleMap nehmen
    if (data.moduleMap) {
      state.hardware.modules = data.moduleMap;
    }
    
    // Update UI
    const serverOnline = data.server?.online === true;
    updateServerStatus(serverOnline);
    updateModuleStatus(data.moduleMap || {});
    updateEventList(state.events);
    
    if (!options.ruhig) {
      console.log("✅ Status geladen:", data);
    }
  } catch (error) {
    console.error("❌ Status laden fehlgeschlagen:", error);
    updateServerStatus(false);
  }
}

function updateServerStatus(online) {
  console.log(`🌐 Server Status: ${online ? "ONLINE" : "OFFLINE"}`);
  
  const statusPill = document.getElementById("serverStatus");
  const serverCard = document.getElementById("serverCardStatus");
  const sidebarStatus = document.getElementById("sidebarServerStatus");
  
  if (statusPill) {
    statusPill.classList.remove("online", "offline");
    statusPill.classList.add(online ? "online" : "offline");
    statusPill.textContent = online ? "✅ WEBSERVER ONLINE" : "⚠️ WEBSERVER OFFLINE";
  }
  
  if (serverCard) {
    serverCard.textContent = online ? "ONLINE" : "OFFLINE";
    serverCard.style.color = online ? "#4caf50" : "#f44336";
  }
  
  if (sidebarStatus) {
    sidebarStatus.textContent = online ? "WebServer aktiv" : "WebServer offline";
    sidebarStatus.style.color = online ? "#4caf50" : "#f44336";
  }
}

function updateModuleStatus(modules) {
  console.log(`📡 Module: ${JSON.stringify(modules)}`);
  
  const onlineCount = Object.values(modules).filter(m => m.online).length;
  const totalCount = Object.keys(modules).length;
  
  const moduleCard = document.getElementById("moduleCardStatus");
  if (moduleCard) {
    moduleCard.textContent = `${onlineCount} / ${totalCount}`;
    moduleCard.style.color = onlineCount > 0 ? "#4caf50" : "#f44336";
  }
  
  // Update Sidebar ESP List
  const espList = document.getElementById("sidebarEspList");
  if (espList) {
    if (totalCount === 0) {
      espList.innerHTML = '<div class="sidebar-esp-empty">Noch kein ESP verbunden.</div>';
    } else {
      espList.innerHTML = Object.values(modules).map(m => `
        <div class="sidebar-esp-item ${m.online ? "online" : "offline"}">
          <div class="esp-status-dot" style="background: ${m.online ? '#4caf50' : '#f44336'}; width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 8px;"></div>
          <div>
            <strong>${m.name || m.id}</strong>
            <small>${m.ip || "Unbekannt"} • ${m.relayCount} Relais • ${m.sensorCount} Sensoren</small>
          </div>
        </div>
      `).join("");
    }
  }
}

function updateEventList(events) {
  const eventList = document.getElementById("eventList");
  if (!eventList) return;

  if (!events || events.length === 0) {
    eventList.innerHTML = '<div class="empty-state">Noch keine Ereignisse</div>';
    return;
  }

  const html = events.slice(-20).reverse().map(e => `
    <div class="event-item" style="padding: 8px; border-bottom: 1px solid #333; font-size: 12px;">
      <div class="event-time" style="color: #999; font-size: 11px;">${new Date(e.timestamp).toLocaleTimeString()}</div>
      <div class="event-message" style="color: #fff; margin-top: 4px;">${e.text || e.type || e.message}</div>
    </div>
  `).join("");

  eventList.innerHTML = html;
}