"use strict";

function requestLogger(req, res, next) {
  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const path = String(req.originalUrl || req.url || "");
    if (!path.startsWith("/api") && path !== "/healthz") return;

    const quietSuccess =
      (req.method === "GET" && (path.startsWith("/api/status") || path.startsWith("/api/module/next-command"))) ||
      (req.method === "POST" && ["/api/module/heartbeat", "/api/module/ack", "/api/module/sensor"].some((item) => path.startsWith(item)));
    if (quietSuccess && res.statusCode < 400) return;

    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const ip = String(req.ip || req.socket?.remoteAddress || "-").replace(/^::ffff:/, "");
    console.log(`[HTTP] ${req.method} ${path} -> ${res.statusCode} · ${durationMs.toFixed(1)} ms · ${ip}`);
  });
  next();
}

module.exports = { requestLogger };
