"use strict";

import { state } from "./state.js";

function commandTime(command) {
  return Number(command?.createdAt || command?.updatedAt || 0);
}

function aggregate(commands) {
  if (!commands.length) return null;
  const newest = commands.slice().sort((a, b) => commandTime(b) - commandTime(a))[0];
  const operationId = newest?.data?.operationId || `cmd:${newest.id}`;
  const related = commands.filter((item) => (item?.data?.operationId || `cmd:${item.id}`) === operationId);
  let status = "confirmed";
  if (related.some((item) => item.status === "timeout")) status = "timeout";
  else if (related.some((item) => item.status === "failed")) status = "failed";
  else if (related.some((item) => item.status === "pending")) status = "pending";
  return {
    status,
    operationId,
    commands: related,
    updatedAt: Math.max(...related.map((item) => Number(item.updatedAt || item.createdAt || 0))),
    reason: related.find((item) => item.status === status && item.reason)?.reason || ""
  };
}

function latestOperation(matches) {
  const list = (state.commands || []).filter(matches);
  if (!list.length) return null;
  const newest = list.slice().sort((a, b) => commandTime(b) - commandTime(a))[0];
  const op = newest?.data?.operationId || `cmd:${newest.id}`;
  return aggregate((state.commands || []).filter((item) => (item?.data?.operationId || `cmd:${item.id}`) === op));
}

export function commandFeedbackForElement(elementId) {
  const id = String(elementId || "");
  if (!id) return null;
  return latestOperation((command) =>
    String(command?.data?.elementId || "") === id ||
    (Array.isArray(command?.data?.affectedElementIds) && command.data.affectedElementIds.map(String).includes(id))
  );
}

export function commandFeedbackForRelay(moduleId, channel) {
  const module = String(moduleId || "");
  const relay = Number(channel || 0);
  if (!module || relay <= 0) return null;
  return latestOperation((command) =>
    command.module === module &&
    command.type === "RELAY_SET" &&
    Number(command?.data?.channel) === relay
  );
}

export function commandFeedbackForLed(moduleId, channel) {
  const module = String(moduleId || "");
  const led = Number(channel || 0);
  if (!module || led <= 0) return null;
  return latestOperation((command) =>
    command.module === module &&
    ["LED_SET", "LED_PWM", "LED_BLINK"].includes(command.type) &&
    Number(command?.data?.channel) === led
  );
}

export function commandStatusText(feedback) {
  if (!feedback) return "";
  if (feedback.status === "pending") return "Wird geschaltet …";
  if (feedback.status === "confirmed") return "Erfolgreich bestätigt";
  if (feedback.status === "timeout") return feedback.reason || "Zeitüberschreitung: keine ESP-Bestätigung";
  if (feedback.status === "failed") return feedback.reason ? `Fehlgeschlagen: ${feedback.reason}` : "Fehlgeschlagen";
  return "";
}

export function moduleControlInfo(moduleId) {
  const id = String(moduleId || "");
  const module = state.hardware?.modules?.[id];
  if (!id || !module) return { enabled: false, reason: "Kein ESP-Modul zugewiesen", module: null };
  if (!module.online) return { enabled: false, reason: "ESP offline", module };
  if (module.health?.relayDriverReady === false) return { enabled: false, reason: "MCP23017 nicht erreichbar", module };
  if (module.compatibility?.compatible === false) {
    return { enabled: false, reason: module.compatibility?.reason || "Firmware/Protokoll inkompatibel", module };
  }
  return { enabled: true, reason: "", module };
}

export function rememberPendingCommands(result) {
  const incoming = [];
  if (result?.befehl?.id) incoming.push(result.befehl);
  if (Array.isArray(result?.befehle)) incoming.push(...result.befehle);
  if (Array.isArray(result?.commands)) incoming.push(...result.commands);
  if (!incoming.length) return;
  const now = Date.now();
  const byId = new Map((state.commands || []).map((item) => [Number(item.id), item]));
  incoming.forEach((command) => {
    byId.set(Number(command.id), {
      id: command.id,
      module: command.module,
      type: command.type,
      data: { ...(command.data || {}) },
      status: "pending",
      reason: "",
      createdAt: Number(command.created || now),
      updatedAt: now,
      attempts: Number(command.attempts || 0)
    });
  });
  state.commands = Array.from(byId.values()).sort((a, b) => commandTime(b) - commandTime(a)).slice(0, 250);
}
