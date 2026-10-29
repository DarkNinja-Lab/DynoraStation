"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { FIRMWARE_FQBN } = require("../src/services/ota/buildFirmware");

test("ESP8266 OTA build uses a valid NodeMCU 4 MB OTA flash menu option", () => {
  assert.equal(FIRMWARE_FQBN, "esp8266:esp8266:nodemcuv2:eesz=4M1M");
  assert.doesNotMatch(FIRMWARE_FQBN, /FlashSize/);
});
