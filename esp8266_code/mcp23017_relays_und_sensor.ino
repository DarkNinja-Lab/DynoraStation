/*
  ESP8266 NodeMCU Controller für H0-Bahn-Server
  - Heartbeat + Relay-Status senden
  - Sensor-Events senden
  - Befehle vom Server pollen und ausführen (RELAY_SET, RELAY_PULSE, NOT_AUS)
  - NON-BLOCKING Pulse (kein delay im Loop)
  - HTTP Timeout + Retry + kleines Reconnect/Backoff
  - Wahlweise 16 Relais über MCP23017 oder 4 Relais direkt am ESP8266

  Verdrahtung MCP23017 -> NodeMCU:
  - VDD   -> 3V3
  - VSS   -> GND
  - SDA   -> D2 / GPIO4
  - SCL   -> D1 / GPIO5
  - RESET -> 3V3 (empfohlen über 10 kOhm Pull-up)
  - A0/A1/A2 -> GND für Adresse 0x20

  GPA0..GPA7 -> Relaisboard IN1..IN8
  GPB0..GPB7 -> Relaisboard IN9..IN16

  WICHTIG:
  Der MCP23017 steuert nur die Logikeingänge eines Relaisboards mit eigener
  Treiberstufe. Relaisspulen niemals direkt am MCP23017 betreiben.
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <Wire.h>

/* ============================ Konfiguration ============================= */

const char* WIFI_SSID = "DEIN_WLAN_NAME";
const char* WIFI_PASS = "DEIN_WLAN_PASSWORT";

// IPv4-Adresse des PCs mit DynoraStation (nicht "localhost" und nicht die ESP-IP).
const char* SERVER_HOST = "192.168.1.115";
const uint16_t SERVER_PORT = 8181;

// Nur der Anzeigename ist frei waehlbar. Die technische ID wird automatisch
// aus der Chip-ID gebildet und bleibt auch nach einer Umbenennung stabil.
const char* MODULE_NAME = "Relais und Sensoren";

const unsigned long HEARTBEAT_INTERVAL_MS = 2000;
const unsigned long COMMAND_POLL_INTERVAL_MS = 100;
const unsigned long SENSOR_SCAN_INTERVAL_MS = 10;
const unsigned long SENSOR_DEBOUNCE_MS = 30;

const uint16_t HTTP_TIMEOUT_MS = 1800;
const uint8_t HTTP_RETRIES = 1;

const unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;
const unsigned long HTTP_ERROR_LOG_INTERVAL_MS = 5000;

// MCP23017 / Relaisboard
// true: MCP23017 mit 16 Kanaelen; false: Relaisboard direkt an den GPIOs.
const bool USE_MCP23017 = true;
const uint8_t MCP23017_ADDRESS = 0x20;
const uint8_t MCP_SDA_PIN = D2;  // GPIO4
const uint8_t MCP_SCL_PIN = D1;  // GPIO5
const uint32_t MCP_I2C_CLOCK_HZ = 100000;
const unsigned long MCP_RETRY_INTERVAL_MS = 5000;

const uint8_t DIRECT_RELAY_COUNT = 4;
const uint8_t directRelayPins[DIRECT_RELAY_COUNT] = { D1, D2, D5, D6 };
const uint8_t RELAY_COUNT = USE_MCP23017 ? 16 : DIRECT_RELAY_COUNT;
// Auf false stellen, falls dein Board mit HIGH einschaltet.
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
bool relayHardwareReady = false;
String moduleId;
uint16_t mcpOutputLatch = 0xFFFF;
unsigned long lastMcpAttempt = 0;

// MCP23017 Register bei IOCON.BANK = 0 (Reset-Standard)
const uint8_t MCP_IODIRA = 0x00;
const uint8_t MCP_IODIRB = 0x01;
const uint8_t MCP_OLATA = 0x14;
const uint8_t MCP_OLATB = 0x15;

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

bool mcpWriteRegister(uint8_t reg, uint8_t value) {
  Wire.beginTransmission(MCP23017_ADDRESS);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

bool mcpWriteBothPorts() {
  bool portAOk = mcpWriteRegister(MCP_OLATA, (uint8_t)(mcpOutputLatch & 0xFF));
  bool portBOk = mcpWriteRegister(MCP_OLATB, (uint8_t)(mcpOutputLatch >> 8));
  return portAOk && portBOk;
}

bool initMcp23017() {
  if (!USE_MCP23017) {
    const uint8_t offLevel = RELAY_ACTIVE_LOW ? HIGH : LOW;
    for (uint8_t i = 0; i < DIRECT_RELAY_COUNT; i++) {
      digitalWrite(directRelayPins[i], offLevel);
      pinMode(directRelayPins[i], OUTPUT);
      digitalWrite(directRelayPins[i], offLevel);
      relayStates[i] = false;
    }
    return true;
  }

  Wire.beginTransmission(MCP23017_ADDRESS);
  if (Wire.endTransmission() != 0) return false;

  // Sicheren AUS-Pegel vor dem Umschalten auf Ausgang vorladen.
  mcpOutputLatch = RELAY_ACTIVE_LOW ? 0xFFFF : 0x0000;
  if (!mcpWriteBothPorts()) return false;
  if (!mcpWriteRegister(MCP_IODIRA, 0x00)) return false;
  if (!mcpWriteRegister(MCP_IODIRB, 0x00)) return false;

  for (uint8_t i = 0; i < RELAY_COUNT; i++) relayStates[i] = false;
  return true;
}

bool setRelayHw(uint8_t idx, bool on) {
  if (idx >= RELAY_COUNT || !relayHardwareReady) return false;

  if (!USE_MCP23017) {
    digitalWrite(directRelayPins[idx], RELAY_ACTIVE_LOW ? (on ? LOW : HIGH) : (on ? HIGH : LOW));
    relayStates[idx] = on;
    return true;
  }

  bool level = RELAY_ACTIVE_LOW ? !on : on;
  uint16_t mask = (uint16_t)1U << idx;
  uint16_t nextLatch = level ? (mcpOutputLatch | mask) : (mcpOutputLatch & ~mask);
  uint8_t reg = idx < 8 ? MCP_OLATA : MCP_OLATB;
  uint8_t portValue = idx < 8 ? (uint8_t)(nextLatch & 0xFF) : (uint8_t)(nextLatch >> 8);

  if (!mcpWriteRegister(reg, portValue)) {
    relayHardwareReady = false;
    heartbeatConfirmed = false;
    Serial.println("[MCP23017] Schreibfehler, Neuverbindung wird versucht");
    return false;
  }

  mcpOutputLatch = nextLatch;
  relayStates[idx] = on;
  return true;
}

bool allRelaysOff() {
  for (uint8_t i = 0; i < RELAY_COUNT; i++) relayStates[i] = false;
  mcpOutputLatch = RELAY_ACTIVE_LOW ? 0xFFFF : 0x0000;
  if (!USE_MCP23017) {
    const uint8_t offLevel = RELAY_ACTIVE_LOW ? HIGH : LOW;
    for (uint8_t i = 0; i < DIRECT_RELAY_COUNT; i++) digitalWrite(directRelayPins[i], offLevel);
    return relayHardwareReady;
  }
  if (relayHardwareReady && !mcpWriteBothPorts()) {
    relayHardwareReady = false;
    heartbeatConfirmed = false;
    return false;
  }
  return relayHardwareReady;
}

void ensureMcp23017() {
  if (relayHardwareReady) return;
  unsigned long now = millis();
  if ((unsigned long)(now - lastMcpAttempt) < MCP_RETRY_INTERVAL_MS) return;
  lastMcpAttempt = now;

  relayHardwareReady = initMcp23017();
  if (relayHardwareReady) {
    if (USE_MCP23017) Serial.println("[RELAIS] MCP23017 online: 16 Kanaele an Adresse 0x20");
    else Serial.println("[RELAIS] Direkte GPIO-Ansteuerung online: 4 Kanaele");
  } else {
    Serial.println("[MCP23017] Nicht gefunden - pruefe SDA, SCL, Adresse und 3V3");
  }
}

void resetAllPulseStates() {
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    pulses[i].active = false;
    pulses[i].startedAt = 0;
    pulses[i].durationMs = 0;
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
  doc["module"] = moduleId;
  doc["moduleName"] = MODULE_NAME;
  doc["moduleType"] = "RELAY_SENSOR_CONTROLLER";
  doc["mcp23017"] = USE_MCP23017 && relayHardwareReady;
  doc["relayDriver"] = USE_MCP23017 ? "MCP23017" : "DIRECT_GPIO";

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
  doc["module"] = moduleId;
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

bool startPulse(uint8_t relayIndex, unsigned long durationMs) {
  if (relayIndex >= RELAY_COUNT) return false;

  // vorhandenen Pulse überschreiben -> sicherer Betrieb
  if (!setRelayHw(relayIndex, true)) return false;

  pulses[relayIndex].active = true;
  pulses[relayIndex].startedAt = millis();
  pulses[relayIndex].durationMs = durationMs > 0 ? durationMs : 220;
  return true;
}

void tickPulses() {
  unsigned long now = millis();
  for (uint8_t i = 0; i < RELAY_COUNT; i++) {
    if (pulses[i].active && (unsigned long)(now - pulses[i].startedAt) >= pulses[i].durationMs) {
      if (setRelayHw(i, false)) pulses[i].active = false;
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
    bool executed = false;
    if (channel >= 1 && channel <= RELAY_COUNT) {
      pulses[channel - 1].active = false;
      executed = setRelayHw((uint8_t)(channel - 1), state);
    } else executed = true; // Ungültigen Serverbefehl nicht endlos pollen.
    if (executed && id > 0) ackCommand(id);
    return;
  }

  if (strcmp(type, "RELAY_PULSE") == 0) {
    bool executed = false;
    if (channel >= 1 && channel <= RELAY_COUNT) {
      executed = startPulse((uint8_t)(channel - 1), (unsigned long)duration);
    } else executed = true;
    if (executed && id > 0) ackCommand(id);
    return;
  }

  if (strcmp(type, "NOT_AUS") == 0) {
    for (uint8_t i = 0; i < RELAY_COUNT; i++) pulses[i].active = false;
    bool executed = allRelaysOff();
    if (executed && id > 0) ackCommand(id);
    return;
  }

  // unbekannten Befehl ack-en, damit Queue nicht hängt
  if (id > 0) ackCommand(id);
}

void pollNextCommand() {
  String response;
  String path = "/api/module/next-command?module=" + moduleId;

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

  moduleId = "ESP8266-" + String(ESP.getChipId(), HEX);
  moduleId.toUpperCase();
  WiFi.hostname(moduleId);
  Serial.print("[MODUL] Stabile ID: ");
  Serial.println(moduleId);

  if (USE_MCP23017) {
    Wire.begin(MCP_SDA_PIN, MCP_SCL_PIN);
    Wire.setClock(MCP_I2C_CLOCK_HZ);
  }
  // Ersten Versuch sofort erlauben; danach wird bei Fehler alle 5 Sekunden erneut geprüft.
  lastMcpAttempt = millis() - MCP_RETRY_INTERVAL_MS;
  ensureMcp23017();
  resetAllPulseStates();

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
  ensureMcp23017();
  ensureWifi();
  tickPulses();

  unsigned long now = millis();

  if (WiFi.status() == WL_CONNECTED && (unsigned long)(now - lastHeartbeat) >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // Befehle erst abholen, wenn die Relais-Hardware erreichbar ist. So wird ein
  // Befehl bei einem I2C-Ausfall nicht bestätigt oder durch Poll-Versuche verworfen.
  if (relayHardwareReady && WiFi.status() == WL_CONNECTED && (unsigned long)(now - lastCommandPoll) >= COMMAND_POLL_INTERVAL_MS) {
    lastCommandPoll = now;
    pollNextCommand();
  }

  if ((unsigned long)(now - lastSensorScan) >= SENSOR_SCAN_INTERVAL_MS) {
    lastSensorScan = now;
    scanSensors();
  }
  yield();
}
