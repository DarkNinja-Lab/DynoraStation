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
  const endpoints = ["/", "/healthz", "/api/status", "/api/track-catalog", "/api/layout", "/api/rules", "/api/hardware", "/api/light-buttons"];
  for (const endpoint of endpoints) {
    const response = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(response.status, 200, endpoint);
  }
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
  const heartbeatBody = {
    module: moduleId,
    moduleName: "LED Bahnhof",
    moduleType: "LED_CONTROLLER",
    leds: Array.from({ length: 3 }, (_, index) => ({ channel: index + 1, state: false, brightness: 0, blinking: false }))
  };
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

test("ESP-Signalmasten schalten mit zwei oder drei Signalbegriffen ohne Kanalfehler", async () => {
  const moduleId = "ESP8266-SIGNALTEST";
  const headers = { "content-type": "application/json" };
  await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify({
      module: moduleId,
      moduleType: "LED_CONTROLLER",
      leds: [1, 2, 3].map((channel) => ({ channel, state: false, brightness: 0 }))
    })
  });
  const baseElement = { id: "signal-test", typ: "espSignal", x: 200, y: 200, module: moduleId, ledChannelRed: 1, ledChannelGreen: 2, ledState: "halt" };

  let response = await fetch(`${baseUrl}/api/layout`, {
    method: "POST", headers,
    body: JSON.stringify({ metadaten: {}, elemente: [{ ...baseElement, signalAspectMode: "rg", ledChannelYellow: 0 }], verbindungen: [], stromkreise: [] })
  });
  assert.equal(response.status, 200);
  response = await fetch(`${baseUrl}/api/esp-signal/control`, { method: "POST", headers, body: JSON.stringify({ elementId: "signal-test", state: "fahrt" }) });
  assert.equal(response.status, 200);
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
});

test("5141 stellt drei klar getrennte und korrekt ausgerichtete Anschluesse bereit", async () => {
  const { localConnectionPorts } = await import("../public/app/builder/shapes.js");
  const ports = localConnectionPorts({ typ: "switch" }, { switchStyle: "curved", switchGeometry: "5141", handed: "left", radius: 360, branchRadius: 437.4, angleDeg: 30 });
  assert.equal(ports.length, 3);
  assert.ok(Math.abs(ports[0].x + 54.675) < .001);
  assert.equal(ports[0].y, 0);
  assert.equal(ports[0].angle, 180);
  assert.ok(ports[1].y < ports[2].y);
  assert.equal(ports[1].angle, -30);
  assert.equal(ports[2].angle, -30);
  assert.notEqual(ports[1].x, ports[2].x);
});

test("Direktsteuerungs-Endpunkte schalten Gleis, Weiche, Kreuzung und Signal konsistent", async () => {
  const moduleId = "ESP8266-CONTROL-AUDIT";
  const headers = { "content-type": "application/json" };
  assert.equal((await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify({ module: moduleId, moduleType: "HYBRID", relays: Array(8).fill(false), leds: [{ channel: 1 }, { channel: 2 }] })
  })).status, 200);

  const elements = [
    { id: "audit-track", typ: "track", module: moduleId, relay: 7 },
    { id: "audit-switch", typ: "switch", module: moduleId, switchCode: "5141", relayStraight: 1, relayBranch: 2 },
    { id: "audit-crossing", typ: "crossing", module: moduleId, xTrackCode: "5128", relayA: 3, relayB: 4 },
    { id: "audit-signal", typ: "signal", module: moduleId, relayHp0: 5, relayHp1: 6 }
  ];
  assert.equal((await fetch(`${baseUrl}/api/layout`, {
    method: "POST", headers, body: JSON.stringify({ metadaten: {}, elemente: elements, verbindungen: [], stromkreise: [] })
  })).status, 200);

  const commands = [
    ["/api/track/control", { elementId: "audit-track", state: true }, true],
    ["/api/switch/control", { elementId: "audit-switch", state: "abzweig" }, "abzweig"],
    ["/api/xtrack/control", { elementId: "audit-crossing", state: "abzweig" }, "abzweig"],
    ["/api/signal/control", { elementId: "audit-signal", state: "fahrt" }, "fahrt"]
  ];
  for (const [endpoint, payload, expectedState] of commands) {
    const response = await fetch(`${baseUrl}${endpoint}`, { method: "POST", headers, body: JSON.stringify(payload) });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).state, expectedState);
  }

  const status = await (await fetch(`${baseUrl}/api/status`)).json();
  const byId = new Map(status.layout.elemente.map((element) => [element.id, element]));
  assert.equal(byId.get("audit-track").powerState, true);
  assert.equal(byId.get("audit-switch").switchState, "abzweig");
  assert.equal(byId.get("audit-crossing").xState, "abzweig");
  assert.equal(byId.get("audit-signal").signalState, "fahrt");
  await fetch(`${baseUrl}/api/module/delete`, { method: "POST", headers, body: JSON.stringify({ module: moduleId }) });
});

test("NOT-AUS schaltet Live-Zustaende ab und verwirft alte Schaltbefehle", async () => {
  const moduleId = "ESP8266-EMERGENCY";
  const headers = { "content-type": "application/json" };
  assert.equal((await fetch(`${baseUrl}/api/module/heartbeat`, {
    method: "POST", headers,
    body: JSON.stringify({ module: moduleId, moduleName: "Not-Aus-Test", relays: [true, true] })
  })).status, 200);

  assert.equal((await fetch(`${baseUrl}/api/control/relay`, {
    method: "POST", headers,
    body: JSON.stringify({ module: moduleId, channel: 1, state: true })
  })).status, 200);

  const emergency = await fetch(`${baseUrl}/api/emergency-stop`, { method: "POST", headers, body: "{}" });
  assert.equal(emergency.status, 200);
  const status = await (await fetch(`${baseUrl}/api/status`)).json();
  assert.deepEqual(status.hardware.modules[moduleId].relays, [false, false]);

  const first = await (await fetch(`${baseUrl}/api/module/next-command?module=${moduleId}`)).json();
  assert.equal(first.command.type, "NOT_AUS");
  await fetch(`${baseUrl}/api/module/ack`, {
    method: "POST", headers, body: JSON.stringify({ id: first.command.id })
  });
  const second = await (await fetch(`${baseUrl}/api/module/next-command?module=${moduleId}`)).json();
  assert.equal(second.command, null);

  await fetch(`${baseUrl}/api/module/delete`, {
    method: "POST", headers, body: JSON.stringify({ module: moduleId })
  });
});
