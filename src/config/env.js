"use strict";

const { toInt, parseState } = require("../utils/parse");

const SERVER_IP = process.env.SERVER_IP || "127.0.0.1";
const SERVER_PORT = toInt(process.env.SERVER_PORT, 8181);

const MODULE_TIMEOUT = toInt(process.env.MODULE_TIMEOUT, 10000);
const MAX_COMMANDS = toInt(process.env.MAX_COMMANDS, 500);
const MAX_EVENTS = toInt(process.env.MAX_EVENTS, 800);
const COMMAND_MAX_AGE_MS = toInt(process.env.COMMAND_MAX_AGE_MS, 15000);
const COMMAND_MAX_ATTEMPTS = toInt(process.env.COMMAND_MAX_ATTEMPTS, 40);
const UI_STATUS_INTERVAL_MS = Math.max(250, toInt(process.env.UI_STATUS_INTERVAL_MS, 400));

const JSON_LIMIT = process.env.JSON_LIMIT || "2mb";
const TRUST_PROXY = parseState(process.env.TRUST_PROXY ?? "true");

const ENABLE_DEBUG_ENDPOINTS = parseState(process.env.ENABLE_DEBUG_ENDPOINTS ?? "false");
const ENABLE_SECURITY_HEADERS = parseState(process.env.ENABLE_SECURITY_HEADERS ?? "true");

const CORS_ENABLED = parseState(process.env.CORS_ENABLED ?? "false");
const CORS_ALLOWED_ORIGINS = String(process.env.CORS_ALLOWED_ORIGINS || "")
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);

const RL_GLOBAL_WINDOW_MS = toInt(process.env.RL_GLOBAL_WINDOW_MS, 10000);
const RL_GLOBAL_MAX = toInt(process.env.RL_GLOBAL_MAX, 160);
const RL_MODULE_WINDOW_MS = toInt(process.env.RL_MODULE_WINDOW_MS, 5000);
const RL_MODULE_MAX = toInt(process.env.RL_MODULE_MAX, 80);

module.exports = {
  SERVER_IP,
  SERVER_PORT,
  MODULE_TIMEOUT,
  MAX_COMMANDS,
  MAX_EVENTS,
  COMMAND_MAX_AGE_MS,
  COMMAND_MAX_ATTEMPTS,
  UI_STATUS_INTERVAL_MS,
  JSON_LIMIT,
  TRUST_PROXY,
  ENABLE_DEBUG_ENDPOINTS,
  ENABLE_SECURITY_HEADERS,
  CORS_ENABLED,
  CORS_ALLOWED_ORIGINS,
  RL_GLOBAL_WINDOW_MS,
  RL_GLOBAL_MAX,
  RL_MODULE_WINDOW_MS,
  RL_MODULE_MAX
};
