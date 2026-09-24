"use strict";

const os = require("os");

function ipFromReq(req) {
  const raw = String(req.ip || req.headers["x-forwarded-for"] || "").trim();
  if (!raw) return "";
  return raw.replace(/^::ffff:/, "");
}

function lanIpv4Addresses() {
  try {
    return Object.values(os.networkInterfaces())
      .flatMap((entries) => Array.isArray(entries) ? entries : [])
      .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
      .map((entry) => entry.address)
      .filter(Boolean);
  } catch {
    // Manche Container und gehärtete Systeme blockieren die Interface-Abfrage.
    // Der Server bleibt erreichbar; lediglich die Komfortanzeige entfällt.
    return [];
  }
}

module.exports = { ipFromReq, lanIpv4Addresses };
