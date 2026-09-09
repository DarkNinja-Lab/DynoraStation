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

const char* SERVER_HOST = "192.168.1.115";
const uint16_t SERVER_PORT = 8181;

const char* MODULE_ID = "GLEIS_01";

const unsigned long HEARTBEAT_INTERVAL_MS = 2000;
const unsigned long COMMAND_POLL_INTERVAL_MS = 250;
const unsigned long SENSOR_SCAN_INTERVAL_MS = 25;

const uint16_t HTTP_TIMEOUT_MS = 2200;
const uint8_t HTTP_RETRIES = 2;

const unsigned long WIFI_RECONNECT_COOLDOWN_MS = 5000;

// Relais (aktiv LOW typisch bei 8-Kanal Boards)
const uint8_t RELAY_COUNT = 8;
const uint8_t relayPins[RELAY_COUNT] = {
  D1, D2, D3, D4, D5, D6, D7, D8
};
const bool RELAY_ACTIVE_LOW = true;

// Reed Sensoren (Beispiel 2 Stück)
const uint8_t SENSOR_COUNT = 2;
const uint8_t sensorPins[SENSOR_COUNT] = {
  D0, RX
};
const char* sensorIds[SENSOR_COUNT] = {
  "S1", "S2"
};

/* ============================ Zustand =================================== */

bool relayStates[RELAY_COUNT];
bool sensorStates[SENSOR_COUNT];

unsigned long lastHeartbeat = 0;
unsigned long lastCommandPoll = 0;
unsigned long lastSensorScan = 0;
unsigned long lastWifiAttempt = 0;

/* Non-blocking pulse state */
struct PulseState {
  bool active;
  uint8_t relayIndex;
  unsigned long startedAt;
  unsigned long durationMs;
};

PulseState pulse = { false, 0, 0, 0 };

/* ============================ Hilfsfunktionen =========================== */

String makeBaseUrl() {
  String url = "http://";
  url += SERVER_HOST;
  url += ":";
  url += String(SERVER_PORT);
  return url;
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
    responseOut = http.getString();
    http.end();

    if (code >= 200 && code < 300) return true;
    delay(40);
  }

  return false;
}

bool httpGet(const String& path, String& responseOut) {
  if (WiFi.status() != WL_CONNECTED) return false;

  for (uint8_t attempt = 0; attempt <= HTTP_RETRIES; attempt++) {
    WiFiClient client;
    HTTPClient http;

    String url = makeBaseUrl() + path;
    if (!http.begin(client, url)) {
      continue;
    }

    http.setTimeout(HTTP_TIMEOUT_MS);
    int code = http.GET();
    responseOut = http.getString();
    http.end();

    if (code >= 200 && code < 300) return true;
    delay(40);
  }

  return false;
}

void sendHeartbeat() {
  DynamicJsonDocument doc(768);
  doc["module"] = MODULE_ID;

  JsonArray relays = doc.createNestedArray("relays");
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    relays.add(relayStates[i]);
  }

  JsonArray inv = doc.createNestedArray("sensorInventory");
  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    inv.add(sensorIds[i]);
  }

  String payload;
  serializeJson(doc, payload);

  String response;
  httpPostJson("/api/module/heartbeat", payload, response);
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

  pulse.active = true;
  pulse.relayIndex = relayIndex;
  pulse.startedAt = millis();
  pulse.durationMs = durationMs > 0 ? durationMs : 220;
}

void tickPulse() {
  if (!pulse.active) return;

  unsigned long now = millis();
  if ((unsigned long)(now - pulse.startedAt) >= pulse.durationMs) {
    setRelayHw(pulse.relayIndex, false);
    pulse.active = false;
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
    pulse.active = false;
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
  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    bool raw = digitalRead(sensorPins[i]) == LOW; // Pullup + Reed -> LOW = ausgelöst
    if (raw != sensorStates[i]) {
      sensorStates[i] = raw;
      sendSensorEvent(sensorIds[i], raw);
    }
  }
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;

  unsigned long now = millis();
  if ((unsigned long)(now - lastWifiAttempt) < WIFI_RECONNECT_COOLDOWN_MS) return;

  lastWifiAttempt = now;

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && (unsigned long)(millis() - start) < 8000) {
    delay(200);
  }
}

/* ============================ Setup / Loop ============================== */

void setup() {
  Serial.begin(115200);
  delay(100);

  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    pinMode(relayPins[i], OUTPUT);
  }

  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    pinMode(sensorPins[i], INPUT_PULLUP);
    sensorStates[i] = (digitalRead(sensorPins[i]) == LOW);
  }

  allRelaysOff();
  ensureWifi();
  sendHeartbeat();
}

void loop() {
  ensureWifi();
  tickPulse();

  unsigned long now = millis();

  if ((unsigned long)(now - lastHeartbeat) >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  if ((unsigned long)(now - lastCommandPoll) >= COMMAND_POLL_INTERVAL_MS) {
    lastCommandPoll = now;
    pollNextCommand();
  }

  if ((unsigned long)(now - lastSensorScan) >= SENSOR_SCAN_INTERVAL_MS) {
    lastSensorScan = now;
    scanSensors();
  }
}