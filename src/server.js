"use strict";

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { createApp } = require("./app/createApp");
const { startServer } = require("./bootstrap/startServer");

const app = createApp();
const context = app.locals.dynora;
const lifecycle = startServer({ app, env: context.env, connectionInfo: context.connectionInfo });

process.once("SIGINT", () => lifecycle.stop("SIGINT"));
process.once("SIGTERM", () => lifecycle.stop("SIGTERM"));
process.on("unhandledRejection", (error) => {
  console.error("[FATAL] Unbehandelte Promise-Ablehnung:", error);
  lifecycle.stop("unhandledRejection");
});
process.on("uncaughtException", (error) => {
  console.error("[FATAL] Unbehandelter Fehler:", error);
  lifecycle.stop("uncaughtException");
});
