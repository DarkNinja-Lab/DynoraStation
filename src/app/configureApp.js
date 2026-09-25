"use strict";

const express = require("express");
const path = require("path");
const { rateLimitFactory } = require("./middleware/rateLimit");
const { errorHandler } = require("./middleware/errorHandler");
const { requestLogger } = require("./middleware/requestLogger");
const { createRoutes } = require("../routes");
const { apiError } = require("../utils/errors");

function configureSecurityHeaders(app) {
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    next();
  });
}

function configureCors(app, env) {
  app.use((req, res, next) => {
    const origin = String(req.headers.origin || "");
    if (!origin) return next();
    const allowed = env.CORS_ALLOWED_ORIGINS.includes("*") || env.CORS_ALLOWED_ORIGINS.includes(origin);
    if (!allowed) return next(apiError(403, "CORS_FORBIDDEN", "Origin nicht erlaubt"));
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.status(204).end();
    next();
  });
}

function configureApp(app, context) {
  const { env, runtimeState } = context;
  const publicDir = path.join(runtimeState.paths.PROJECT_DIR, "public");
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);
  app.use(express.json({ limit: env.JSON_LIMIT }));
  app.use(express.urlencoded({ extended: false }));
  if (env.REQUEST_LOGGING) app.use(requestLogger);
  if (env.ENABLE_SECURITY_HEADERS) configureSecurityHeaders(app);
  if (env.CORS_ENABLED) configureCors(app, env);

  // Compatibility for clients with an older cached HTML shell. Keep one physical CSS file.
  app.get("/station-v4.css", (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, "/style.css");
  });

  app.use(express.static(publicDir, {
    etag: true,
    maxAge: env.NODE_ENV === "production" ? "1h" : 0,
    setHeaders(res, filePath) {
      if (/\.(?:html|webmanifest|js|css)$/i.test(filePath)) res.setHeader("Cache-Control", "no-cache");
    }
  }));

  const rateLimit = rateLimitFactory(runtimeState.rateBuckets);
  app.use(rateLimit({
    keyPrefix: "global", windowMs: env.RL_GLOBAL_WINDOW_MS, max: env.RL_GLOBAL_MAX,
    skip: (req) => req.path === "/api/module" || req.path.startsWith("/api/module/")
  }));
  app.use("/api/module", rateLimit({
    keyPrefix: "module", windowMs: env.RL_MODULE_WINDOW_MS, max: env.RL_MODULE_MAX,
    key: (req, ip) => req.body?.module || req.query?.module || ip
  }));

  app.get("/", (req, res) => res.sendFile(path.join(publicDir, "index.html")));
  app.get("/favicon.ico", (req, res) => res.status(204).end());
  app.use(createRoutes(context));
  app.use(errorHandler);
  return app;
}

module.exports = { configureApp };
