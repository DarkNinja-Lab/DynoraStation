"use strict";

require("dotenv").config();
const { createApp } = require("./app/createApp");
const { SERVER_IP, SERVER_PORT } = require("./config/env");

const app = createApp();

app.listen(SERVER_PORT, "0.0.0.0", () => {
  console.log(`H0-Bahn-Server läuft auf http://${SERVER_IP}:${SERVER_PORT}`);
});