"use strict";

function ipFromReq(req) {
  const raw = String(req.ip || req.headers["x-forwarded-for"] || "").trim();
  if (!raw) return "";
  return raw.replace(/^::ffff:/, "");
}

module.exports = { ipFromReq };