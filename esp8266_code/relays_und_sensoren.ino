/*
  ESP8266 NodeMCU Controller für H0-Bahn-Server
  - Heartbeat + Relay-Status senden
  - Sensor-Events senden
  - Befehle vom Server pollen und ausführen (RELAY_SET, RELAY_PULSE, NOT_AUS)
  - NON-BLOCKING Pulse (kein delay im Loop)
  - HTTP Timeout + Retry + kleines Reconnect/Backoff
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>

/* ============================ Konfiguration ============================= */

const char* WIFI_SSID = "DEIN_WLAN_NAME";
const char* WIFI_PASS = "DEIN_WLAN_PASSWORT";

// IPv4-Adresse des PCs mit DynoraStation (nicht "localhost" und nicht die ESP-IP).
const char* SERVER_HOST = "192.168.1.115";
const uint16_t SERVER_PORT = 8181;

const char* MODULE_ID = "GLEIS_01";

const unsigned long HEARTBEAT_INTERVAL_MS = 2000;
const unsigned long COMMAND_POLL_INTERVAL_MS = 100;
const unsigned long SENSOR_SCAN_INTERVAL_MS = 10;
const unsigned long SENSOR_DEBOUNCE_MS = 30;

const uint16_t HTTP_TIMEOUT_MS = 1800;
const uint8_t HTTP_RETRIES = 1;

const unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;
const unsigned long HTTP_ERROR_LOG_INTERVAL_MS = 5000;

// Relais (aktiv LOW typisch bei 8-Kanal Boards)
const uint8_t RELAY_COUNT = 8;
const uint8_t relayPins[RELAY_COUNT] = {
  D1, D2, D3, D4, D5, D6, D7, D8
};
const bool RELAY_ACTIVE_LOW = true;

// Reed Sensoren (Beispiel 2 Stück)
const uint8_t SENSOR_COUNT = 2;
const uint8_t sensorPins[SENSOR_COUNT] = {
  D0, 3  // GPIO3 ist der RX-Pin; die Zahl funktioniert auch ohne RX-Pin-Alias.
};
const char* sensorIds[SENSOR_COUNT] = {
  "S1", "S2"
};

/* ============================ Zustand =================================== */

bool relayStates[RELAY_COUNT];
bool sensorStates[SENSOR_COUNT];
bool sensorRawStates[SENSOR_COUNT];
unsigned long sensorChangedAt[SENSOR_COUNT];

unsigned long lastHeartbeat = 0;
unsigned long lastCommandPoll = 0;
unsigned long lastSensorScan = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastHttpErrorLog = 0;
bool wifiConnectStarted = false;
bool wifiWasConnected = false;
bool serverWasReachable = false;
bool heartbeatConfirmed = false;

/* Non-blocking pulse state */
struct PulseState {
  bool active;
  unsigned long startedAt;
  unsigned long durationMs;
};
PulseState pulses[RELAY_COUNT];

/* ============================ Hilfsfunktionen =========================== */

String makeBaseUrl() {
  String url = "http://";
  url += SERVER_HOST;
  url += ":";
  url += String(SERVER_PORT);
  return url;
}

void logHttpFailure(const char* method, const String& path, int code, const String& response) {
  unsigned long now = millis();
  if ((unsigned long)(now - lastHttpErrorLog) < HTTP_ERROR_LOG_INTERVAL_MS) return;
  lastHttpErrorLog = now;

  Serial.print("[SERVER] ");
  Serial.print(method);
  Serial.print(" ");
  Serial.print(path);
  Serial.print(" fehlgeschlagen, Code ");
  Serial.print(code);
  if (response.length()) {
    Serial.print(": ");
    Serial.print(response);
  }
  Serial.println();
}

void setRelayHw(uint8_t idx, bool on) {
  if (idx >= RELAY_COUNT) return;
  relayStates[idx] = on;

  bool level = RELAY_ACTIVE_LOW ? !on : on;
  digitalWrite(relayPins[idx], level ? HIGH : LOW);
}

void allRelaysOff() {
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    setRelayHw(i, false);
  }
}

bool httpPostJson(const String& path, const String& payload, String& responseOut) {
  if (WiFi.status() != WL_CONNECTED) return false;

  int lastCode = 0;

  for (uint8_t attempt = 0; attempt <= HTTP_RETRIES; attempt++) {
    WiFiClient client;
    HTTPClient http;

    String url = makeBaseUrl() + path;
    if (!http.begin(client, url)) {
      continue;
    }

    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");

    int code = http.POST(payload);
    lastCode = code;
    responseOut = http.getString();
    http.end();

    if (code >= 200 && code < 300) {
      serverWasReachable = true;
      return true;
    }
    delay(40);
  }

  serverWasReachable = false;
  logHttpFailure("POST", path, lastCode, responseOut);
  return false;
}

bool httpGet(const String& path, String& responseOut) {
  if (WiFi.status() != WL_CONNECTED) return false;

  int lastCode = 0;

  for (uint8_t attempt = 0; attempt <= HTTP_RETRIES; attempt++) {
    WiFiClient client;
    HTTPClient http;

    String url = makeBaseUrl() + path;
    if (!http.begin(client, url)) {
      continue;
    }

    http.setTimeout(HTTP_TIMEOUT_MS);
    int code = http.GET();
    lastCode = code;
    responseOut = http.getString();
    http.end();

    if (code >= 200 && code < 300) {
      serverWasReachable = true;
      return true;
    }
    delay(40);
  }

  serverWasReachable = false;
  logHttpFailure("GET", path, lastCode, responseOut);
  return false;
}

bool sendHeartbeat() {
  DynamicJsonDocument doc(1280);
  doc["module"] = MODULE_ID;
  doc["moduleType"] = "RELAY_SENSOR_CONTROLLER";

  JsonArray relays = doc.createNestedArray("relays");
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    relays.add(relayStates[i]);
  }

  JsonArray inv = doc.createNestedArray("sensorInventory");
  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    inv.add(sensorIds[i]);
  }

  JsonArray sensors = doc.createNestedArray("sensors");
  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    JsonObject sensor = sensors.createNestedObject();
    sensor["id"] = sensorIds[i];
    sensor["triggered"] = sensorStates[i];
  }

  String payload;
  serializeJson(doc, payload);

  String response;
  bool ok = httpPostJson("/api/module/heartbeat", payload, response);
  if (ok) {
    StaticJsonDocument<384> reply;
    DeserializationError err = deserializeJson(reply, response);
    if (!err && reply["ok"] == true && !heartbeatConfirmed) {
      heartbeatConfirmed = true;
      Serial.print("[SERVER] Heartbeat OK: ");
      Serial.print(RELAY_COUNT);
      Serial.print(" Relais, ");
      Serial.print(SENSOR_COUNT);
      Serial.println(" Sensoren");
    }
  }
  return ok;
}

void sendSensorEvent(const char* sensorId, bool triggered) {
  DynamicJsonDocument doc(256);
  doc["module"] = MODULE_ID;
  doc["sensor"] = sensorId;
  doc["triggered"] = triggered;

  String payload;
  serializeJson(doc, payload);

  String response;
  httpPostJson("/api/module/sensor", payload, response);
}

void ackCommand(int id) {
  DynamicJsonDocument doc(128);
  doc["id"] = id;

  String payload;
  serializeJson(doc, payload);

  String response;
  httpPostJson("/api/module/ack", payload, response);
}

void startPulse(uint8_t relayIndex, unsigned long durationMs) {
  if (relayIndex >= RELAY_COUNT) return;

  // vorhandenen Pulse überschreiben -> sicherer Betrieb
  setRelayHw(relayIndex, true);

  pulses[relayIndex].active = true;
  pulses[relayIndex].startedAt = millis();
  pulses[relayIndex].durationMs = durationMs > 0 ? durationMs : 220;
}

void tickPulses() {
  unsigned long now = millis();
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    if (pulses[i].active && (unsigned long)(now - pulses[i].startedAt) >= pulses[i].durationMs) {
      setRelayHw(i, false); pulses[i].active = false;
    }
  }
}

void executeCommand(const JsonObject& cmd) {
  const char* type = cmd["type"] | "";
  int id = cmd["id"] | 0;
  int channel = cmd["channel"] | 0;
  bool state = cmd["state"] | false;
  int duration = cmd["duration"] | 0;

  if (strcmp(type, "RELAY_SET") == 0) {
    if (channel >= 1 && channel <= RELAY_COUNT) {
      pulses[channel - 1].active = false;
      setRelayHw((uint8_t)(channel - 1), state);
    }
    if (id > 0) ackCommand(id);
    return;
  }

  if (strcmp(type, "RELAY_PULSE") == 0) {
    if (channel >= 1 && channel <= RELAY_COUNT) {
      startPulse((uint8_t)(channel - 1), (unsigned long)duration);
    }
    if (id > 0) ackCommand(id);
    return;
  }

  if (strcmp(type, "NOT_AUS") == 0) {
    for (uint8_t i = 0; i < RELAY_COUNT; i++) pulses[i].active = false;
    allRelaysOff();
    if (id > 0) ackCommand(id);
    return;
  }

  // unbekannten Befehl ack-en, damit Queue nicht hängt
  if (id > 0) ackCommand(id);
}

void pollNextCommand() {
  String response;
  String path = "/api/module/next-command?module=" + String(MODULE_ID);

  if (!httpGet(path, response)) return;
  if (response.length() < 8) return;

  DynamicJsonDocument doc(1024);
  DeserializationError err = deserializeJson(doc, response);
  if (err) return;

  JsonVariant cmd = doc["command"];
  if (cmd.isNull()) return;

  JsonObject obj = cmd.as<JsonObject>();
  executeCommand(obj);
}

void scanSensors() {
  unsigned long now = millis();
  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    bool raw = digitalRead(sensorPins[i]) == LOW; // Pullup + Reed -> LOW = ausgelöst
    if (raw != sensorRawStates[i]) { sensorRawStates[i] = raw; sensorChangedAt[i] = now; }
    if (raw != sensorStates[i] && (unsigned long)(now - sensorChangedAt[i]) >= SENSOR_DEBOUNCE_MS) {
      sensorStates[i] = raw;
      sendSensorEvent(sensorIds[i], raw);
    }
  }
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      wifiConnectStarted = false;
      Serial.print("[WLAN] Verbunden, ESP-IP: ");
      Serial.println(WiFi.localIP());
      Serial.print("[SERVER] Ziel: ");
      Serial.println(makeBaseUrl());
      // Nach jeder neuen WLAN-Verbindung Hardware sofort vollständig anmelden.
      sendHeartbeat();
      lastHeartbeat = millis();
    }
    return;
  }

  if (wifiWasConnected) {
    wifiWasConnected = false;
    serverWasReachable = false;
    heartbeatConfirmed = false;
    Serial.println("[WLAN] Verbindung verloren");
  }

  unsigned long now = millis();
  if (
    wifiConnectStarted &&
    (unsigned long)(now - lastWifiAttempt) < WIFI_CONNECT_TIMEOUT_MS
  ) return;

  lastWifiAttempt = now;
  wifiConnectStarted = true;

  Serial.print("[WLAN] Verbinde mit ");
  Serial.println(WIFI_SSID);
  WiFi.disconnect(false);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

/* ============================ Setup / Loop ============================== */

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println();
  Serial.println("Dynora Relay/Sensor Controller startet");

  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    // Ausgangspegel vor OUTPUT setzen, damit Active-LOW-Relais beim Start nicht kurz anziehen.
    digitalWrite(relayPins[i], RELAY_ACTIVE_LOW ? HIGH : LOW);
    pinMode(relayPins[i], OUTPUT);
    pulses[i].active = false; pulses[i].startedAt = 0; pulses[i].durationMs = 0;
  }

  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    pinMode(sensorPins[i], INPUT_PULLUP);
    sensorStates[i] = (digitalRead(sensorPins[i]) == LOW);
    sensorRawStates[i] = sensorStates[i]; sensorChangedAt[i] = millis();
  }

  allRelaysOff();
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  ensureWifi();
}

void loop() {
  ensureWifi();
  tickPulses();

  unsigned long now = millis();

  if (WiFi.status() == WL_CONNECTED && (unsigned long)(now - lastHeartbeat) >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  if (WiFi.status() == WL_CONNECTED && (unsigned long)(now - lastCommandPoll) >= COMMAND_POLL_INTERVAL_MS) {
    lastCommandPoll = now;
    pollNextCommand();
  }

  if ((unsigned long)(now - lastSensorScan) >= SENSOR_SCAN_INTERVAL_MS) {
    lastSensorScan = now;
    scanSensors();
  }
  yield();
}
