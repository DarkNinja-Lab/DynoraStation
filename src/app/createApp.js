"use strict";

const express = require("express");
const { createRuntimeContext } = require("../bootstrap/createRuntimeContext");
const { configureApp } = require("./configureApp");

function createApp() {
  const app = express();
  const context = createRuntimeContext();
  configureApp(app, context);
  app.locals.dynora = context;
  return app;
}

module.exports = { createApp };
