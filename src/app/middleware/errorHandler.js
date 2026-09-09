"use strict";

const { buildClientErrorDetails } = require("../../utils/errors");

function errorHandler(err, req, res, next) {
  const status = Number(err?.status) || 500;
  const code = String(err?.code || "INTERNAL_ERROR");
  const message = String(err?.message || "Interner Serverfehler");

  if (status >= 500) {
    console.error("Unhandled error:", err);
  }

  const safeDetails = err?.details ?? buildClientErrorDetails(err, req);

  res.status(status).json({
    ok: false,
    code,
    fehler: message,
    details: safeDetails,
    timestamp: Date.now()
  });
}

module.exports = { errorHandler };