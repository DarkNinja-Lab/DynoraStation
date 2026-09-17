"use strict";

const path = require("path");

require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const { createApp } = require("./app/createApp");
const { SERVER_IP, SERVER_PORT, REQUEST_LOGGING } = require("./config/env");

const app = createApp();

app.listen(SERVER_PORT, "0.0.0.0", () => {
  console.log(`[START] DynoraStation aktiv: http://${SERVER_IP}:${SERVER_PORT}`);
  if (REQUEST_LOGGING) console.log("[START] HTTP-Logging aktiv; Status- und ESP-Polling werden nicht gespammt.");
});
