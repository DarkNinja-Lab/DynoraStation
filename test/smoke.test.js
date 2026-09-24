"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { createApp } = require("../src/app/createApp");

const projectDir = path.resolve(__dirname, "..");
let server;
let baseUrl;
const dataFiles = ["layout.json", "hardware.json", "rules.json"];
const dataSnapshot = new Map();

function compatibleHeartbeat(payload = {}) {
  return { firmwareVersion: "2.0.7", protocolVersion: 2, hardwareType: "TEST_ESP8266", ...payload };
}

async function nextCommand(moduleId) {
  return (await (await fetch(`${baseUrl}/api/module/next-command?module=${encodeURIComponent(moduleId)}`)).json()).command;
}

async function ackCommand(moduleId, command, ok = true, error = "") {
  assert.ok(command?.id, `Kein Befehl für ${moduleId}`);
  const response = await fetch(`${baseUrl}/api/module/ack`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ id: command.id, module: moduleId, ok, error })
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function ackAll(moduleId) {
  const commands = [];
  while (true) {
    const command = await nextCommand(moduleId);
    if (!command) break;
    commands.push(command);
    await ackCommand(moduleId, command);
  }
  return commands;
}

test.before(async () => {
  for (const name of dataFiles) {
    const file = path.join(projectDir, "data", name);
    dataSnapshot.set(file, fs.existsSync(file) ? fs.readFileSync(file) : null);
  }
  const app = createApp();
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  for (const [file, content] of dataSnapshot) {
    if (content === null) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } else {
      fs.writeFileSync(file, content);
    }
  }
});

test("UI und Kern-API sind erreichbar", async () => {
  const endpoints = ["/", "/style.css", "/healthz", "/api/status", "/api/track-catalog", "/api/layout", "/api/rules", "/api/hardware", "/api/light-buttons"];
  for (const endpoint of endpoints) {
    const response = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(response.status, 200, endpoint);
  }
});

test("Navigation und responsive Arbeitsbereiche sind konsistent eingebunden", () => {
  const html = fs.readFileSync(path.join(projectDir, "public", "index.html"), "utf8");
  const workspaceCss = fs.readFileSync(path.join(projectDir, "public", "style.css"), "utf8");
  assert.match(html, /data-settings-view="rules"/);
  assert.match(html, /data-settings-section="rules"/);
  assert.doesNotMatch(html, /id="page-rules"/);
  assert.match(html, /class="global-header"/);
  assert.match(html, /class="system-drawer"/);
  assert.match(html, /class="dashboard-control-stack"/);
  assert.match(workspaceCss, /#page-dashboard\.active/);
  assert.match(workspaceCss, /#page-builder\.active/);
  assert.match(workspaceCss, /#page-track\.active/);
  assert.match(workspaceCss, /\.settings-tabs\s*\{[^}]*display:\s*flex/s);
  assert.match(html, /MÄRKLIN M-GLEIS/);
  assert.match(html, /id="trackSystemNotice"/);
});

test("Server ist in App-Konfiguration, Runtime-Kontext und Lifecycle getrennt", () => {
  const createApp = fs.readFileSync(path.join(projectDir, "src", "app", "createApp.js"), "utf8");
  assert.match(createApp, /createRuntimeContext/);
  assert.match(createApp, /configureApp/);
  assert.ok(fs.existsSync(path.join(projectDir, "src", "bootstrap", "startServer.js")));
  assert.ok(fs.existsSync(path.join(projectDir, "src", "app", "configureApp.js")));
});

test("Status liefert große Live-Daten nur bei geänderter Revision", async () => {
  const first = await (await fetch(`${baseUrl}/api/status`)).json();
  assert.ok(first.layout);
  assert.ok(Array.isArray(first.events));
  const second = await (await fetch(`${baseUrl}/api/status?layoutRevision=${first.revisions.layout}&eventRevision=${first.revisions.events}`)).json();
  assert.equal(second.layout, null);
  assert.equal(second.events, null);
  assert.ok(second.hardware);
});

test("alle Gleisbilder werden vollständig ausgeliefert", async () => {
  const assetDir = path.join(projectDir, "public", "assets", "track");
  const files = fs.readdirSync(assetDir).filter((file) => file.endsWith(".jpg"));
  assert.ok(files.length > 0);

  await Promise.all(files.map(async (file) => {
    const response = await fetch(`${baseUrl}/assets/track/${encodeURIComponent(file)}`);
    assert.equal(response.status, 200, file);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(body.length, fs.statSync(path.join(assetDir, file)).size, file);
    assert.equal(body[0], 0xff, file);
    assert.equal(body[1], 0xd8, file);
  }));
});

test("fehlerhafte API-Payloads werden kontrolliert abgewiesen", async () => {
  const response = await fetch(`${baseUrl}/api/rules`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({})
  });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.ok, false);
  assert.equal(body.code, "BAD_RULES");
});

test("ESP-Polling verbraucht nicht das Browser-Rate-Limit", async () => {
  const headers = { "content-type": "application/json" };
  const moduleIds = ["ESP8266-RATE-A", "ESP8266-RATE-B"];
  for (const moduleId of moduleIds) {
    const heartbeat = await fetch(`${baseUrl}/api/module/heartbeat`, {
      method: "POST", headers,
      body: JSON.stringify(compatibleHeartbeat({ module: moduleId, moduleType: "RELAY_CONTROLLER", relays: [false] }))
    });
    assert.equal(heartbeat.status, 200);
  }

  for (let index = 0; index < 70; index += 1) {
    for (const moduleId of moduleIds) {
      const poll = await fetch(`${baseUrl}/api/module/next-command?module=${moduleId}`);
      assert.equal(poll.status, 200, `${moduleId} Poll ${index + 1}`);
    }
  }

  for (let index = 0; index < 30; index += 1) {
    const status = await fetch(`${baseUrl}/api/status`);
    assert.equal(status.status, 200, `Browser-Status ${index + 1}`);
  }

  for (const moduleId of moduleIds) {
    await fetch(`${baseUrl}/api/module/delete`, {
      method: "POST", headers, body: JSON.stringify({ module: moduleId })
    });
  }
});

test("BME280-Telemetrie wird validiert und im Status bereitgestellt", async () => {
  const moduleId = "ESP8266-BME280";
  const headers = { "content-type": "application/json" };
  const heartbeat = await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify({
      module: moduleId,
      moduleType: "RELAY_SENSOR_CONTROLLER",
      relays: Array(16).fill(false),
      sensorInventory: ["S1", "S2", "S3"],
      environment: { sensor: "BME280", temperatureC: 42.36, humidityPct: 51.24, pressureHpa: 1008.76 }
    })
  });
  assert.equal(heartbeat.status, 200);

  const status = await (await fetch(`${baseUrl}/api/status`)).json();
  const module = status.hardware.modules[moduleId];
  assert.ok(module.capabilities.includes("environment"));
  assert.equal(module.environment.sensor, "BME280");
  assert.equal(module.environment.temperatureC, 42.4);
  assert.equal(module.environment.humidityPct, 51.2);
  assert.equal(module.environment.pressureHpa, 1008.8);
  assert.equal(module.sensors.length, 3);

  await fetch(`${baseUrl}/api/module/delete`, {
    method: "POST", headers, body: JSON.stringify({ module: moduleId })
  });
});

test("MCP23017-Ausfall wird sofort gemeldet statt in einen Timeout zu laufen", async () => {
  const moduleId = "ESP8266-MCP-OFFLINE";
  const headers = { "content-type": "application/json" };
  const heartbeat = await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify(compatibleHeartbeat({
      module: moduleId,
      moduleType: "RELAY_SENSOR_CONTROLLER",
      hardwareType: "ESP8266_NODEMCU_MCP23017_BME280",
      mcp23017: false,
      relayActiveLow: false,
      relayOutputLatch: 0,
      relays: Array(16).fill(false)
    }))
  });
  assert.equal(heartbeat.status, 200);
  const status = await (await fetch(`${baseUrl}/api/status`)).json();
  assert.equal(status.hardware.modules[moduleId].health.relayDriverReady, false);
  assert.equal(status.hardware.modules[moduleId].health.relayActiveLow, false);

  const control = await fetch(`${baseUrl}/api/control/relay`, {
    method: "POST", headers,
    body: JSON.stringify({ module: moduleId, channel: 1, state: true })
  });
  assert.equal(control.status, 503);
  const error = await control.json();
  assert.equal(error.code, "RELAY_DRIVER_OFFLINE");
  assert.match(error.fehler, /MCP23017/);
  assert.equal(await nextCommand(moduleId), null);

  await fetch(`${baseUrl}/api/module/delete`, { method: "POST", headers, body: JSON.stringify({ module: moduleId }) });
});

test("Heartbeat liefert wartende Relaisbefehle als redundanten Zustellweg", async () => {
  const moduleId = "ESP8266-HEARTBEAT-COMMAND";
  const headers = { "content-type": "application/json" };
  const heartbeatBody = compatibleHeartbeat({
    module: moduleId,
    moduleType: "RELAY_SENSOR_CONTROLLER",
    hardwareType: "ESP8266_NODEMCU_MCP23017_BME280",
    mcp23017: true,
    relayActiveLow: false,
    relayOutputLatch: 0,
    relays: Array(16).fill(false)
  });
  assert.equal((await fetch(`${baseUrl}/api/module/heartbeat`, { method: "POST", headers, body: JSON.stringify(heartbeatBody) })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/control/relay`, {
    method: "POST", headers, body: JSON.stringify({ module: moduleId, channel: 4, state: true })
  })).status, 200);

  const heartbeat = await (await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers, body: JSON.stringify(heartbeatBody)
  })).json();
  assert.equal(heartbeat.command.type, "RELAY_SET");
  assert.equal(heartbeat.command.channel, 4);
  assert.equal(heartbeat.command.state, true);
  await ackCommand(moduleId, heartbeat.command);
  await fetch(`${baseUrl}/api/module/delete`, { method: "POST", headers, body: JSON.stringify({ module: moduleId }) });
});

test("Relais-Firmware bestätigt Befehle auch bei Hardwarefehlern eindeutig", () => {
  const firmware = fs.readFileSync(path.join(projectDir, "esp8266_code", "relays_und_sensoren.ino"), "utf8");
  assert.match(firmware, /FIRMWARE_VERSION = "2\.5\.0"/);
  assert.match(firmware, /RELAY_ACTIVE_LOW = true/);
  assert.match(firmware, /RELAY_DRIVE_MODE = "OPEN_DRAIN_IODIR"/);
  assert.match(firmware, /mcpWriteAndVerify/);
  assert.match(firmware, /reply\["command"\]/);
  assert.match(firmware, /MCP23017 nicht bereit oder Schreibfehler/);
  assert.doesNotMatch(firmware, /if \(relayHardwareReady && WiFi\.status\(\) == WL_CONNECTED/);
});

test("Automations-Sperrzeit blockiert erneute Sensortrigger", async () => {
  const moduleId = "ESP8266-COOLDOWN";
  const headers = { "content-type": "application/json" };
  await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify(compatibleHeartbeat({ module: moduleId, relays: [false], sensorInventory: ["S1"], sensors: [{ id: "S1", triggered: false }] }))
  });
  const saveRules = await fetch(`${baseUrl}/api/rules`, {
    method: "POST", headers,
    body: JSON.stringify({ rules: [{
      id: "RULE_COOLDOWN_TEST",
      name: "Cooldown Test",
      enabled: true,
      cooldownMs: 5000,
      condition: { kind: "sensor", module: moduleId, sensorId: "S1", triggered: true },
      actions: [{ kind: "relay", module: moduleId, channel: 1, state: "on" }]
    }] })
  });
  assert.equal(saveRules.status, 200);

  const trigger = () => fetch(`${baseUrl}/api/module/sensor`, {
    method: "POST", headers,
    body: JSON.stringify({ module: moduleId, sensor: "S1", triggered: true })
  });
  const first = await (await trigger()).json();
  const second = await (await trigger()).json();
  assert.equal(first.automations.executed, 1);
  assert.equal(second.automations.executed, 0);

  await fetch(`${baseUrl}/api/rules`, { method: "POST", headers, body: JSON.stringify({ rules: [] }) });
  await fetch(`${baseUrl}/api/module/delete`, { method: "POST", headers, body: JSON.stringify({ module: moduleId }) });
});

test("ESP-Anzeigename kann geaendert werden, ohne die technische ID zu verlieren", async () => {
  const moduleId = "ESP8266-TEST123";
  const heartbeat = (moduleName) => fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ module: moduleId, moduleName, moduleType: "RELAY_SENSOR_CONTROLLER", relays: [false, false] })
  });

  assert.equal((await heartbeat("Firmware-Name")).status, 200);
  const rename = await fetch(`${baseUrl}/api/module/rename`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ module: moduleId, name: "Bahnhof West" })
  });
  assert.equal(rename.status, 200);

  // Ein anderer Firmware-/Host-Name darf die Benutzerwahl nicht ueberschreiben.
  assert.equal((await heartbeat("Komplett anderer ESP-Name")).status, 200);
  const status = await (await fetch(`${baseUrl}/api/status`)).json();
  assert.equal(status.hardware.modules[moduleId].name, "Bahnhof West");
  assert.equal(status.hardware.modules[moduleId].id, moduleId);
  assert.equal(status.hardware.modules[moduleId].customName, true);

  const remove = await fetch(`${baseUrl}/api/module/delete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ module: moduleId })
  });
  assert.equal(remove.status, 200);
});

test("LED-ESP wird erkannt und LED-Konfiguration ueberlebt weitere Heartbeats", async () => {
  const moduleId = "ESP8266-LEDTEST";
  const headers = { "content-type": "application/json" };
  const heartbeatBody = compatibleHeartbeat({
    module: moduleId,
    moduleName: "LED Bahnhof",
    moduleType: "LED_CONTROLLER",
    leds: Array.from({ length: 3 }, (_, index) => ({ channel: index + 1, state: false, brightness: 0, blinking: false }))
  });
  await fetch(`${baseUrl}/api/module/heartbeat`, { method: "POST", headers, body: JSON.stringify(heartbeatBody) });
  await fetch(`${baseUrl}/api/control/settings`, {
    method: "POST", headers,
    body: JSON.stringify({ ledConfig: { [`${moduleId}:1`]: { name: "Ausfahrt Rot", color: "rot", brightness: 73 } } })
  });
  await fetch(`${baseUrl}/api/module/heartbeat`, { method: "POST", headers, body: JSON.stringify(heartbeatBody) });

  const status = await (await fetch(`${baseUrl}/api/status`)).json();
  assert.equal(status.hardware.modules[moduleId].kind, "SIGNAL_LED");
  assert.equal(status.hardware.modules[moduleId].leds.length, 3);
  assert.ok(status.hardware.modules[moduleId].capabilities.includes("led"));
  const persisted = status.hardware.leds.find((led) => led.module === moduleId && led.channel === 1);
  assert.equal(persisted.name, "Ausfahrt Rot");
  assert.equal(persisted.color, "rot");
  assert.equal(status.ledConfig[`${moduleId}:1`].brightness, 73);

  const control = await fetch(`${baseUrl}/api/led`, {
    method: "POST", headers,
    body: JSON.stringify({ module: moduleId, channel: 1, mode: "pwm", brightness: 73 })
  });
  assert.equal(control.status, 200);
  const command = await (await fetch(`${baseUrl}/api/module/next-command?module=${moduleId}`)).json();
  assert.equal(command.command.type, "LED_PWM");
  assert.equal(command.command.brightness, 73);

  await fetch(`${baseUrl}/api/module/delete`, {
    method: "POST", headers, body: JSON.stringify({ module: moduleId })
  });
});

test("Relais-, Sensor- und Lichtnamen werden atomar gespeichert und nicht vom Heartbeat verworfen", async () => {
  const moduleId = "ESP8266-CONFIGTEST";
  const headers = { "content-type": "application/json" };
  const heartbeatBody = {
    module: moduleId,
    moduleName: "Konfigurationstest",
    moduleType: "RELAY_SENSOR_CONTROLLER",
    relays: [false, false],
    sensorInventory: ["S1", "S2"]
  };
  assert.equal((await fetch(`${baseUrl}/api/module/heartbeat`, { method: "POST", headers, body: JSON.stringify(heartbeatBody) })).status, 200);

  const save = await fetch(`${baseUrl}/api/control/settings`, {
    method: "POST", headers,
    body: JSON.stringify({
      relayConfig: { [`${moduleId}:1`]: { name: "Bahnsteiglicht", role: "Beleuchtung" } },
      sensorConfig: { [`${moduleId}:S1`]: { name: "Einfahrt West" } },
      lightButtons: [
        { name: "Bahnsteig", moduleId, relayIndex: 1 },
        { name: "Licht 2", moduleId: "", relayIndex: 0 },
        { name: "Licht 3", moduleId: "", relayIndex: 0 },
        { name: "Licht 4", moduleId: "", relayIndex: 0 }
      ]
    })
  });
  assert.equal(save.status, 200);
  assert.equal((await fetch(`${baseUrl}/api/module/heartbeat`, { method: "POST", headers, body: JSON.stringify(heartbeatBody) })).status, 200);

  const status = await (await fetch(`${baseUrl}/api/status`)).json();
  const relay = status.hardware.relays.find((item) => item.module === moduleId && item.channel === 1);
  const sensor = status.hardware.sensors.find((item) => item.module === moduleId && item.id === "S1");
  assert.equal(relay.name, "Bahnsteiglicht");
  assert.equal(relay.role, "Beleuchtung");
  assert.equal(sensor.name, "Einfahrt West");
  assert.equal(status.hardware.modules[moduleId].sensors.find((item) => item.id === "S1").name, "Einfahrt West");
  assert.equal(status.lightButtons[0].name, "Bahnsteig");
  assert.equal(status.lightButtons[0].module, moduleId);
  assert.equal(status.lightButtons[0].relay, 1);

  const persisted = JSON.parse(fs.readFileSync(path.join(projectDir, "data", "hardware.json"), "utf8"));
  assert.equal(persisted.relays.find((item) => item.module === moduleId && item.channel === 1).role, "Beleuchtung");
  assert.equal(persisted.sensors.find((item) => item.module === moduleId && item.id === "S1").name, "Einfahrt West");
  assert.equal(persisted.lightButtons[0].name, "Bahnsteig");

  await fetch(`${baseUrl}/api/module/delete`, { method: "POST", headers, body: JSON.stringify({ module: moduleId }) });
});

test("Anlagenplattenmasse und Raster werden sofort persistent gespeichert", async () => {
  const headers = { "content-type": "application/json" };
  const response = await fetch(`${baseUrl}/api/layout`, {
    method: "POST", headers,
    body: JSON.stringify({
      metadaten: { name: "Mass-Test", massstab: "H0", plateWidthMm: 4200, plateHeightMm: 2100, rasterMm: 25, raster: 12.5 },
      elemente: [{ id: "hidden-switch", typ: "switch", x: 200, y: 200, switchCode: "5141", showInDirectControl: false }],
      verbindungen: [], stromkreise: []
    })
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.layout.metadaten.plateWidthMm, 4200);
  assert.equal(body.layout.metadaten.plateHeightMm, 2100);
  assert.equal(body.layout.metadaten.rasterMm, 25);
  assert.equal(body.layout.elemente[0].showInDirectControl, false);

  const persisted = JSON.parse(fs.readFileSync(path.join(projectDir, "data", "layout.json"), "utf8"));
  assert.equal(persisted.metadaten.plateWidthMm, 4200);
  assert.equal(persisted.metadaten.plateHeightMm, 2100);
  assert.equal(persisted.metadaten.rasterMm, 25);
  assert.equal(persisted.elemente[0].showInDirectControl, false);
});

test("Relais-Grundstellungen werden angewendet und als Befehl ausgeliefert", async () => {
  const moduleId = "ESP8266-DEFAULT-RELAY";
  const headers = { "content-type": "application/json" };
  assert.equal((await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify(compatibleHeartbeat({ module: moduleId, moduleType: "RELAY_CONTROLLER", relays: [false] }))
  })).status, 200);

  const response = await fetch(`${baseUrl}/api/control/defaults/apply`, {
    method: "POST", headers,
    body: JSON.stringify({ defaults: [{ targetType: "relay", targetId: `${moduleId}:1`, action: "on" }] })
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).applied.length, 1);

  const command = await (await fetch(`${baseUrl}/api/module/next-command?module=${moduleId}`)).json();
  assert.equal(command.command.type, "RELAY_SET");
  assert.equal(command.command.channel, 1);
  assert.equal(command.command.state, true);

  await fetch(`${baseUrl}/api/module/delete`, {
    method: "POST", headers, body: JSON.stringify({ module: moduleId })
  });
});

test("ESP-Signalmasten schalten mit zwei oder drei Signalbegriffen ohne Kanalfehler", async () => {
  const moduleId = "ESP8266-SIGNALTEST";
  const headers = { "content-type": "application/json" };
  await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify(compatibleHeartbeat({
      module: moduleId,
      moduleType: "LED_CONTROLLER",
      leds: [1, 2, 3].map((channel) => ({ channel, state: false, brightness: 0 }))
    }))
  });
  const baseElement = { id: "signal-test", typ: "espSignal", x: 200, y: 200, module: moduleId, ledChannelRed: 1, ledChannelGreen: 2, ledState: "halt" };

  let response = await fetch(`${baseUrl}/api/layout`, {
    method: "POST", headers,
    body: JSON.stringify({ metadaten: {}, elemente: [{ ...baseElement, signalAspectMode: "rg", ledChannelYellow: 0 }], verbindungen: [], stromkreise: [] })
  });
  assert.equal(response.status, 200);
  response = await fetch(`${baseUrl}/api/esp-signal/control`, { method: "POST", headers, body: JSON.stringify({ elementId: "signal-test", state: "fahrt" }) });
  assert.equal(response.status, 200);
  await ackAll(moduleId);
  response = await fetch(`${baseUrl}/api/esp-signal/control`, { method: "POST", headers, body: JSON.stringify({ elementId: "signal-test", state: "warnung" }) });
  assert.equal(response.status, 400);

  response = await fetch(`${baseUrl}/api/layout`, {
    method: "POST", headers,
    body: JSON.stringify({ metadaten: {}, elemente: [{ ...baseElement, signalAspectMode: "rgy", ledChannelYellow: 3 }], verbindungen: [], stromkreise: [] })
  });
  assert.equal(response.status, 200);
  response = await fetch(`${baseUrl}/api/esp-signal/control`, { method: "POST", headers, body: JSON.stringify({ elementId: "signal-test", state: "warnung" }) });
  assert.equal(response.status, 200);

  await fetch(`${baseUrl}/api/module/delete`, { method: "POST", headers, body: JSON.stringify({ module: moduleId }) });
});

test("M-Gleis-Katalog verwendet konsistente reale Laengen, Radien und Winkel", () => {
  const { TRACK_CATALOG } = require("../src/domain/trackCatalog");
  assert.equal(TRACK_CATALOG["5106"].length, 180);
  assert.equal(TRACK_CATALOG["5100"].radius, 360);
  assert.equal(TRACK_CATALOG["5100"].angleDeg, 30);
  assert.ok(Math.abs(TRACK_CATALOG["5100"].arcLength - (Math.PI * 360 / 6)) < 0.1);
  assert.ok(Math.abs(TRACK_CATALOG["5202"].radius * Math.sin(TRACK_CATALOG["5202"].angleDeg * Math.PI / 180) - TRACK_CATALOG["5202"].length) < 0.2);
  assert.equal(TRACK_CATALOG["5128"].crossingAngleDeg, 30);
  assert.equal(TRACK_CATALOG["5141"].branchRadius, 437.4);
  assert.equal(TRACK_CATALOG["5141"].radius, 360);
  assert.equal(TRACK_CATALOG["5141"].angleDeg, 30);
  assert.equal(TRACK_CATALOG["5141"].innerCurveCode, "5100");
  assert.equal(TRACK_CATALOG["5141"].outerCurveCode, "5200");
  assert.equal(TRACK_CATALOG["5141"].switchGeometry, "5141");
  assert.ok(Math.abs((TRACK_CATALOG["5141"].branchRadius - TRACK_CATALOG["5141"].radius) - 77.4) < 0.001);
});

test("Direktsteuerung priorisiert bei ESP-Signalen den LED-Zustand", async () => {
  const { directControlState } = await import("../public/app/ui/render.js");
  assert.equal(directControlState({ typ: "signal", signalState: "fahrt" }), "fahrt");
  assert.equal(directControlState({ typ: "ledSignal", signalState: "halt", ledState: "fahrt" }), "fahrt");
  assert.equal(directControlState({ typ: "espSignal", signalState: "halt", ledState: "warnung" }), "warnung");
  assert.equal(directControlState({ typ: "switch", switchState: "abzweig" }), "abzweig");
  assert.equal(directControlState({ typ: "track", trackCode: "5112" }), "bereit");
});

test("Planprüfung erkennt Hardwarefehler, Relais-Konflikte und isolierte Gleise", async () => {
  const { analyzePlan } = await import("../public/app/builder/validation.js");
  const issues = analyzePlan({
    elemente: [
      { id: "A", typ: "track", trackCode: "5112", module: "ESP-A", relay: 2 },
      { id: "B", typ: "switch", switchCode: "5202", module: "ESP-A", relayStraight: 2, relayBranch: 3 },
      { id: "C", typ: "signal", relayHp0: 0, relayHp1: 0 }
    ],
    verbindungen: []
  });
  const codes = new Set(issues.map((issue) => issue.code));
  assert.ok(codes.has("RELAY_CONFLICT"));
  assert.ok(codes.has("NO_MODULE"));
  assert.ok(codes.has("NO_RELAY"));
  assert.ok(codes.has("ISOLATED"));

  const shared = analyzePlan({
    elemente: [
      { id: "D", typ: "track", module: "ESP-A", relay: 4, stromkreis: "C1" },
      { id: "E", typ: "curve", module: "ESP-A", relay: 4, stromkreis: "C1" }
    ],
    verbindungen: [{ von: "D", nach: "E" }]
  });
  assert.equal(shared.some((issue) => issue.code === "RELAY_CONFLICT"), false);
});

test("5141 stellt drei klar getrennte und korrekt ausgerichtete Anschluesse bereit", async () => {
  const { localConnectionPorts } = await import("../public/app/builder/shapes.js");
  const ports = localConnectionPorts({ typ: "switch" }, { switchStyle: "curved", switchGeometry: "5141", handed: "left", radius: 360, branchRadius: 437.4, angleDeg: 30 });
  assert.equal(ports.length, 3);
  assert.ok(Math.abs(ports[0].x + 67.32) < .02);
  assert.equal(ports[0].y, 0);
  assert.equal(ports[0].angle, 180);
  assert.ok(ports[1].y < ports[2].y);
  assert.equal(ports[1].angle, -38);
  assert.equal(ports[2].angle, -30);
  assert.notEqual(ports[1].x, ports[2].x);
});

test("Entkupplungsgleis 5112 nutzt einen sicheren Relais-Impuls und behält den Sensor", async () => {
  const moduleId = "ESP8266-UNCOUPLER";
  const headers = { "content-type": "application/json" };
  const catalog = await (await fetch(`${baseUrl}/api/track-catalog`)).json();
  assert.equal(catalog.tracks.find((item) => item.code === "5112")?.trackStyle, "uncoupler");

  assert.equal((await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify(compatibleHeartbeat({ module: moduleId, moduleType: "RELAY_CONTROLLER", relays: [false, false], sensors: [{ id: "S1", state: false }] }))
  })).status, 200);

  assert.equal((await fetch(`${baseUrl}/api/layout`, {
    method: "POST", headers,
    body: JSON.stringify({ metadaten: {}, stromkreise: [], verbindungen: [], elemente: [{
      id: "uncoupler-1", typ: "track", trackCode: "5112", module: moduleId, relay: 2,
      sensorId: "S1", uncouplerDurationMs: 650
    }] })
  })).status, 200);

  const response = await fetch(`${baseUrl}/api/track/control`, {
    method: "POST", headers, body: JSON.stringify({ elementId: "uncoupler-1", toggle: true })
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.requestedState, "pulse");
  assert.equal(result.duration, 650);
  const command = await nextCommand(moduleId);
  assert.equal(command.type, "RELAY_PULSE");
  assert.equal(command.channel, 2);
  assert.equal(command.duration, 650);
  await ackCommand(moduleId, command);

  const status = await (await fetch(`${baseUrl}/api/status`)).json();
  const element = status.layout.elemente.find((item) => item.id === "uncoupler-1");
  assert.equal(element.sensorId, "S1");
  assert.equal(element.uncouplerDurationMs, 650);
  await fetch(`${baseUrl}/api/module/delete`, { method: "POST", headers, body: JSON.stringify({ module: moduleId }) });
});

test("Direktsteuerungs-Endpunkte übernehmen Zustände erst nach ESP-Bestätigung", async () => {
  const moduleId = "ESP8266-CONTROL-AUDIT";
  const headers = { "content-type": "application/json" };
  assert.equal((await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify(compatibleHeartbeat({ module: moduleId, moduleType: "HYBRID", relays: Array(8).fill(false), leds: [{ channel: 1 }, { channel: 2 }] }))
  })).status, 200);

  const elements = [
    { id: "audit-track", typ: "track", module: moduleId, relay: 7 },
    { id: "audit-track-shared", typ: "curve", module: moduleId, relay: 7 },
    { id: "audit-switch", typ: "switch", module: moduleId, switchCode: "5141", relayStraight: 1, relayBranch: 2 },
    { id: "audit-crossing", typ: "crossing", module: moduleId, xTrackCode: "5128", relayA: 3, relayB: 4 },
    { id: "audit-signal", typ: "signal", module: moduleId, relayHp0: 5, relayHp1: 6 }
  ];
  assert.equal((await fetch(`${baseUrl}/api/layout`, {
    method: "POST", headers, body: JSON.stringify({ metadaten: {}, elemente: elements, verbindungen: [], stromkreise: [] })
  })).status, 200);

  const trackResponse = await fetch(`${baseUrl}/api/track/control`, { method: "POST", headers, body: JSON.stringify({ elementId: "audit-track", state: true }) });
  assert.equal(trackResponse.status, 200);
  const trackBody = await trackResponse.json();
  assert.equal(trackBody.commandStatus, "pending");
  assert.deepEqual(new Set(trackBody.affectedElementIds), new Set(["audit-track", "audit-track-shared"]));

  let status = await (await fetch(`${baseUrl}/api/status`)).json();
  let byId = new Map(status.layout.elemente.map((element) => [element.id, element]));
  assert.equal(byId.get("audit-track").powerState, false);
  assert.equal(byId.get("audit-track-shared").powerState, false);
  assert.equal(status.commands.find((item) => item.id === trackBody.befehl.id).status, "pending");

  const trackCommand = await nextCommand(moduleId);
  assert.equal(trackCommand.type, "RELAY_SET");
  await ackCommand(moduleId, trackCommand);

  status = await (await fetch(`${baseUrl}/api/status`)).json();
  byId = new Map(status.layout.elemente.map((element) => [element.id, element]));
  assert.equal(byId.get("audit-track").powerState, true);
  assert.equal(byId.get("audit-track-shared").powerState, true);
  assert.equal(status.hardware.modules[moduleId].relays[6], true);
  assert.equal(status.commands.find((item) => item.id === trackBody.befehl.id).status, "confirmed");

  const logicalCommands = [
    ["/api/switch/control", { elementId: "audit-switch", state: "abzweig" }, "audit-switch", "switchState", "abzweig"],
    ["/api/xtrack/control", { elementId: "audit-crossing", state: "abzweig" }, "audit-crossing", "xState", "abzweig"],
    ["/api/signal/control", { elementId: "audit-signal", state: "fahrt" }, "audit-signal", "signalState", "fahrt"]
  ];
  for (const [endpoint, payload, elementId, field, expected] of logicalCommands) {
    const response = await fetch(`${baseUrl}${endpoint}`, { method: "POST", headers, body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    status = await (await fetch(`${baseUrl}/api/status`)).json();
    byId = new Map(status.layout.elemente.map((element) => [element.id, element]));
    assert.notEqual(byId.get(elementId)[field], expected);
    const command = await nextCommand(moduleId);
    assert.equal(command.type, "RELAY_PULSE");
    await ackCommand(moduleId, command);
    status = await (await fetch(`${baseUrl}/api/status`)).json();
    byId = new Map(status.layout.elemente.map((element) => [element.id, element]));
    assert.equal(byId.get(elementId)[field], expected);
  }

  // Ein Heartbeat mit einem alten physischen Zustand ist die Ist-Meldung und
  // darf nicht durch einen noch nicht bestätigten Sollzustand überschrieben werden.
  const pendingOff = await fetch(`${baseUrl}/api/track/control`, {
    method: "POST", headers, body: JSON.stringify({ elementId: "audit-track", state: false })
  });
  assert.equal(pendingOff.status, 200);
  assert.equal((await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify(compatibleHeartbeat({ module: moduleId, moduleType: "HYBRID", relays: [false, false, false, false, false, false, true, false], leds: [{ channel: 1 }, { channel: 2 }] }))
  })).status, 200);
  status = await (await fetch(`${baseUrl}/api/status`)).json();
  byId = new Map(status.layout.elemente.map((element) => [element.id, element]));
  assert.equal(byId.get("audit-track").powerState, true);
  await ackCommand(moduleId, await nextCommand(moduleId));
  status = await (await fetch(`${baseUrl}/api/status`)).json();
  byId = new Map(status.layout.elemente.map((element) => [element.id, element]));
  assert.equal(byId.get("audit-track").powerState, false);

  await fetch(`${baseUrl}/api/module/delete`, { method: "POST", headers, body: JSON.stringify({ module: moduleId }) });
});

test("NOT-AUS übernimmt Live-Zustände erst nach ESP-Bestätigung und verwirft alte Befehle", async () => {
  const moduleId = "ESP8266-EMERGENCY";
  const headers = { "content-type": "application/json" };
  assert.equal((await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify(compatibleHeartbeat({ module: moduleId, moduleName: "Not-Aus-Test", relays: [true, true] }))
  })).status, 200);

  assert.equal((await fetch(`${baseUrl}/api/control/relay`, {
    method: "POST", headers,
    body: JSON.stringify({ module: moduleId, channel: 1, state: true })
  })).status, 200);

  const emergency = await fetch(`${baseUrl}/api/emergency-stop`, { method: "POST", headers, body: "{}" });
  assert.equal(emergency.status, 200);
  const emergencyBody = await emergency.json();
  assert.equal(emergencyBody.commands.length, 1);

  let status = await (await fetch(`${baseUrl}/api/status`)).json();
  assert.deepEqual(status.hardware.modules[moduleId].relays, [true, true]);

  const first = await nextCommand(moduleId);
  assert.equal(first.type, "NOT_AUS");
  await ackCommand(moduleId, first);
  status = await (await fetch(`${baseUrl}/api/status`)).json();
  assert.deepEqual(status.hardware.modules[moduleId].relays, [false, false]);

  const second = await nextCommand(moduleId);
  assert.equal(second, null);

  await fetch(`${baseUrl}/api/module/delete`, {
    method: "POST", headers, body: JSON.stringify({ module: moduleId })
  });
});
test("Offline- und inkompatible ESP-Module werden serverseitig vom Schalten ausgeschlossen", async () => {
  const headers = { "content-type": "application/json" };
  const offlineId = "ESP-OFFLINE-GUARD";
  let response = await fetch(`${baseUrl}/api/control/relay`, {
    method: "POST", headers,
    body: JSON.stringify({ module: offlineId, channel: 1, state: true })
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "MODULE_OFFLINE");

  const incompatibleId = "ESP-INCOMPATIBLE-GUARD";
  response = await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify({
      module: incompatibleId,
      moduleType: "RELAY_CONTROLLER",
      firmwareVersion: "9.0.0",
      protocolVersion: 99,
      hardwareType: "TEST_ESP8266",
      relays: [false]
    })
  });
  assert.equal(response.status, 200);
  const heartbeat = await response.json();
  assert.equal(heartbeat.compatibility.compatible, false);

  response = await fetch(`${baseUrl}/api/control/relay`, {
    method: "POST", headers,
    body: JSON.stringify({ module: incompatibleId, channel: 1, state: true })
  });
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, "MODULE_INCOMPATIBLE");
  await fetch(`${baseUrl}/api/module/delete`, { method: "POST", headers, body: JSON.stringify({ module: incompatibleId }) });
});

test("Fehlgeschlagene ESP-Bestätigung ändert den bestätigten Relaiszustand nicht", async () => {
  const moduleId = "ESP-ACK-FAIL";
  const headers = { "content-type": "application/json" };
  await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify(compatibleHeartbeat({ module: moduleId, moduleType: "RELAY_CONTROLLER", relays: [false] }))
  });
  const control = await fetch(`${baseUrl}/api/control/relay`, {
    method: "POST", headers,
    body: JSON.stringify({ module: moduleId, channel: 1, state: true })
  });
  assert.equal(control.status, 200);
  const command = await nextCommand(moduleId);
  await ackCommand(moduleId, command, false, "Treiberfehler");

  const status = await (await fetch(`${baseUrl}/api/status`)).json();
  assert.equal(status.hardware.modules[moduleId].relays[0], false);
  const result = status.commands.find((item) => item.id === command.id);
  assert.equal(result.status, "failed");
  assert.equal(result.reason, "Treiberfehler");
  await fetch(`${baseUrl}/api/module/delete`, { method: "POST", headers, body: JSON.stringify({ module: moduleId }) });
});

test("Layout-API meldet Relais-Konflikte und akzeptiert explizite gemeinsame Stromkreise", async () => {
  const headers = { "content-type": "application/json" };
  let response = await fetch(`${baseUrl}/api/layout`, {
    method: "POST", headers,
    body: JSON.stringify({
      metadaten: {}, stromkreise: [], verbindungen: [],
      elemente: [
        { id: "conflict-a", typ: "track", module: "ESP-CONFLICT", relay: 4 },
        { id: "conflict-b", typ: "curve", module: "ESP-CONFLICT", relay: 4 }
      ]
    })
  });
  assert.equal(response.status, 200);
  let body = await response.json();
  assert.equal(body.warnings.relayConflicts.length, 1);

  response = await fetch(`${baseUrl}/api/layout`, {
    method: "POST", headers,
    body: JSON.stringify({
      metadaten: {},
      stromkreise: [{ id: "shared", name: "Gemeinsam", module: "ESP-CONFLICT", relay: 4 }],
      verbindungen: [],
      elemente: [
        { id: "shared-a", typ: "track", module: "ESP-CONFLICT", relay: 4, stromkreis: "shared" },
        { id: "shared-b", typ: "curve", module: "ESP-CONFLICT", relay: 4, stromkreis: "shared" }
      ]
    })
  });
  assert.equal(response.status, 200);
  body = await response.json();
  assert.deepEqual(body.warnings.relayConflicts, []);
});
