"use strict";

function apiError(status, code, message, details = null) {
  const err = new Error(message || "Fehler");
  err.status = status;
  err.code = code;
  err.details = details;
  return err;
}

function wrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function buildClientErrorDetails(err, req) {
  const isProd = process.env.NODE_ENV === "production";
  const base = {
    path: req.originalUrl || req.url || "",
    method: req.method || "",
    requestId: `REQ_${Date.now()}_${Math.floor(Math.random() * 10000)}`
  };

  if (!err) return base;

  if (!isProd) {
    return {
      ...base,
      hint: err?.code || "UNKNOWN",
      raw: String(err?.message || ""),
      stackTop: String(err?.stack || "").split("\n").slice(0, 2).join(" | ")
    };
  }

  return {
    ...base,
    hint: err?.code || "UNKNOWN"
  };
}

module.exports = {
  apiError,
  wrap,
  buildClientErrorDetails
};