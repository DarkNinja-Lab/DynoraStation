"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { FIRMWARE_FQBN, sketchNameFor, configureHardwareProfile } = require("../src/services/ota/buildFirmware");

test("ESP8266 OTA build uses a valid NodeMCU 4 MB OTA flash menu option", () => {
  assert.equal(FIRMWARE_FQBN, "esp8266:esp8266:nodemcuv2:eesz=4M1M");
  assert.doesNotMatch(FIRMWARE_FQBN, /FlashSize/);
});

test("Relay firmware profiles keep their MCP channel split when built through OTA", () => {
  assert.equal(sketchNameFor("ESP8266_NODEMCU_MCP23017_16R_2MCP"), "relays_und_sensoren");
  const source = configureHardwareProfile("const char* FIRMWARE_VERSION = \"placeholder\";", "ESP8266_NODEMCU_MCP23017_16R_2MCP");
  assert.match(source, /DYNORA_MCP1_RELAY_COUNT 8/);
  assert.match(source, /DYNORA_MCP2_RELAY_COUNT 8/);
  assert.match(source, /DYNORA_SENSOR_COUNT 3/);
  assert.match(source, /DYNORA_HARDWARE_TYPE "ESP8266_NODEMCU_MCP23017_16R_2MCP"/);
});

test("Preconfigured relay sketches delegate to the shared, configurable firmware", () => {
  const root = path.join(__dirname, "..");
  for (const filename of [
    "relays_und_sensoren_8r_1mcp.ino",
    "relays_und_sensoren_16r_1mcp.ino",
    "relays_und_sensoren_16r_2mcp.ino",
    "relays_und_sensoren_24r_2mcp.ino",
    "relays_und_sensoren_32r_2mcp.ino",
    "relays_und_sensoren_custom.ino"
  ]) {
    const source = fs.readFileSync(path.join(root, "esp8266_code", filename), "utf8");
    assert.match(source, /#include "relays_und_sensoren\.ino"/);
    assert.match(source, /DYNORA_MCP1_RELAY_COUNT/);
    assert.match(source, /DYNORA_SENSOR_COUNT/);
  }
});
