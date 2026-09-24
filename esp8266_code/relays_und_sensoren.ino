/*
  ESP8266 NodeMCU Controller für H0-Bahn-Server
  - Heartbeat + Relay-Status senden
  - Sensor-Events senden
  - Befehle vom Server pollen und ausführen (RELAY_SET, RELAY_PULSE, NOT_AUS)
  - NON-BLOCKING Pulse (kein delay im Loop)
  - HTTP Timeout + Retry + kleines Reconnect/Backoff
  - 16 Relais ausschließlich über MCP23017
  - BME280 für Temperatur, Luftfeuchte und Luftdruck im Trafo-Gehäuse

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
#include <WiFiUdp.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_Sensor.h>
#include <Adafruit_BME280.h>

/* ============================ Konfiguration ============================= */

const char* WIFI_SSID = "DEIN_WLAN_NAME";
const char* WIFI_PASS = "DEIN_WLAN_PASSWORT";

// IPv4-Adresse des PCs mit DynoraStation (nicht "localhost" und nicht die ESP-IP).
const char* SERVER_HOST = "192.168.1.115";
const uint16_t SERVER_PORT = 8181;
const uint16_t DISCOVERY_PORT = 8182;

// Nur der Anzeigename ist frei waehlbar. Die technische ID wird automatisch
// aus der Chip-ID gebildet und bleibt auch nach einer Umbenennung stabil.
const char* MODULE_NAME = "Relais und Sensoren";
const char* FIRMWARE_VERSION = "2.5.0";
const uint16_t PROTOCOL_VERSION = 2;
const char* HARDWARE_TYPE = "ESP8266_NODEMCU_MCP23017_BME280";

const unsigned long HEARTBEAT_INTERVAL_MS = 2000;
const unsigned long COMMAND_POLL_INTERVAL_MS = 100;
const unsigned long SENSOR_SCAN_INTERVAL_MS = 10;
const unsigned long SENSOR_DEBOUNCE_MS = 30;

const uint16_t HTTP_TIMEOUT_MS = 1800;
const uint8_t HTTP_RETRIES = 1;

const unsigned long WIFI_CONNECT_TIMEOUT_MS = 15000;
const unsigned long HTTP_ERROR_LOG_INTERVAL_MS = 5000;
const unsigned long DISCOVERY_RETRY_INTERVAL_MS = 10000;

// MCP23017 / Relaisboard (Pflicht)
const uint8_t MCP23017_ADDRESS = 0x20;
const uint8_t MCP_SDA_PIN = D2;  // GPIO4
const uint8_t MCP_SCL_PIN = D1;  // GPIO5
const uint32_t MCP_I2C_CLOCK_HZ = 100000;
const unsigned long MCP_RETRY_INTERVAL_MS = 5000;

const uint8_t RELAY_COUNT = 16;
// Das vorhandene 16-Kanal-Board hat optogekoppelte, intern auf 5 V gezogene
// LOW-Trigger-Eingaenge. Der mit 3,3 V versorgte MCP23017 darf diese 5 V
// deshalb NICHT aktiv auf HIGH treiben.
//
// Ansteuerung als Open-Drain:
//   Relais EIN: MCP-Pin OUTPUT + OLAT=LOW -> Eingang wird auf GND gezogen
//   Relais AUS: MCP-Pin INPUT          -> Eingang ist hochohmig und steigt auf 5 V
const bool RELAY_ACTIVE_LOW = true;
const char* RELAY_DRIVE_MODE = "OPEN_DRAIN_IODIR";

// BME280 teilt sich SDA/SCL mit dem MCP23017. Übliche Adresse: 0x76.
const uint8_t BME280_I2C_ADDRESS = 0x76;
const unsigned long BME280_RETRY_INTERVAL_MS = 10000;
const unsigned long BME280_READ_INTERVAL_MS = 2000;

// Drei boot-sichere Sensoreingänge mit internem Pull-up.
// D3/GPIO0, D4/GPIO2 und D8/GPIO15 bleiben wegen der Boot-Straps frei.
// D1/D2 sind I2C, RX/TX bleiben für Serial frei, D0 ist nur Reserve.
const uint8_t SENSOR_COUNT = 3;
const uint8_t sensorPins[SENSOR_COUNT] = {
  D5, D6, D7
};
const char* sensorIds[SENSOR_COUNT] = {
  "S1", "S2", "S3"
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
String activeServerHost = SERVER_HOST;
WiFiUDP discoveryUdp;
unsigned long lastDiscoveryAttempt = 0;
String moduleId;
uint16_t mcpOutputLatch = 0x0000;
uint16_t mcpDirectionMask = 0xFFFF; // 1=INPUT/AUS, 0=OUTPUT LOW/EIN
unsigned long lastMcpAttempt = 0;
Adafruit_BME280 bme280;
bool bme280Ready = false;
unsigned long lastBme280Attempt = 0;
unsigned long lastBme280Read = 0;
float temperatureC = NAN;
float humidityPct = NAN;
float pressureHpa = NAN;

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

// Heartbeat und Polling verwenden denselben Befehls-Handler.
void executeCommand(const JsonObject& cmd);

/* ============================ Hilfsfunktionen =========================== */

String makeBaseUrl() {
  String url = "http://";
  url += activeServerHost;
  url += ":";
  url += String(SERVER_PORT);
  return url;
}

bool discoverDynoraStation() {
  if (WiFi.status() != WL_CONNECTED) return false;
  lastDiscoveryAttempt = millis();

  const uint16_t localPort = 42000 + (ESP.getChipId() % 1000);
  if (!discoveryUdp.begin(localPort)) return false;
  discoveryUdp.beginPacket(IPAddress(255, 255, 255, 255), DISCOVERY_PORT);
  discoveryUdp.write("DYNORA_DISCOVER_V1");
  discoveryUdp.endPacket();

  const unsigned long startedAt = millis();
  while ((unsigned long)(millis() - startedAt) < 450) {
    int packetSize = discoveryUdp.parsePacket();
    if (packetSize > 0) {
      char reply[72] = {0};
      int readCount = discoveryUdp.read(reply, sizeof(reply) - 1);
      if (readCount > 0) reply[readCount] = '\0';
      if (String(reply).startsWith("DYNORA_STATION_V1|")) {
        activeServerHost = discoveryUdp.remoteIP().toString();
        discoveryUdp.stop();
        Serial.print("[SERVER] Automatisch gefunden: ");
        Serial.println(makeBaseUrl());
        return true;
      }
    }
    delay(10);
    yield();
  }
  discoveryUdp.stop();
  Serial.print("[SERVER] Auto-Erkennung ohne Treffer, Fallback: ");
  Serial.println(makeBaseUrl());
  return false;
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

bool mcpReadRegister(uint8_t reg, uint8_t& value) {
  Wire.beginTransmission(MCP23017_ADDRESS);
  Wire.write(reg);
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom(MCP23017_ADDRESS, (uint8_t)1) != 1) return false;
  value = Wire.read();
  return true;
}

bool mcpWriteAndVerify(uint8_t reg, uint8_t value) {
  if (!mcpWriteRegister(reg, value)) return false;
  uint8_t readback = 0;
  return mcpReadRegister(reg, readback) && readback == value;
}

bool mcpWriteDirections(uint16_t directionMask) {
  // IODIR: 1 = INPUT (hochohmig/AUS), 0 = OUTPUT (OLAT LOW -> EIN)
  bool portAOk = mcpWriteAndVerify(MCP_IODIRA, (uint8_t)(directionMask & 0xFF));
  bool portBOk = mcpWriteAndVerify(MCP_IODIRB, (uint8_t)(directionMask >> 8));
  return portAOk && portBOk;
}

bool initMcp23017() {
  Wire.beginTransmission(MCP23017_ADDRESS);
  if (Wire.endTransmission() != 0) return false;

  // Wichtig fuer das 5-V-LOW-Trigger-Board:
  // OLAT bleibt dauerhaft LOW. AUS wird NICHT durch HIGH erzeugt, sondern
  // indem der jeweilige MCP-Pin als INPUT hochohmig geschaltet wird.
  mcpOutputLatch = 0x0000;
  if (!mcpWriteAndVerify(MCP_OLATA, 0x00)) return false;
  if (!mcpWriteAndVerify(MCP_OLATB, 0x00)) return false;

  // Alle Kanaele beim Start hochohmig = alle Relais AUS.
  mcpDirectionMask = 0xFFFF;
  if (!mcpWriteDirections(mcpDirectionMask)) return false;

  for (uint8_t i = 0; i < RELAY_COUNT; i++) relayStates[i] = false;
  return true;
}

bool setRelayHw(uint8_t idx, bool on) {
  if (idx >= RELAY_COUNT || !relayHardwareReady) return false;

  const uint16_t mask = (uint16_t)1U << idx;
  // EIN = OUTPUT LOW (IODIR-Bit 0), AUS = INPUT/Hi-Z (IODIR-Bit 1).
  const uint16_t nextDirections = on
    ? (mcpDirectionMask & ~mask)
    : (mcpDirectionMask | mask);

  const uint8_t reg = idx < 8 ? MCP_IODIRA : MCP_IODIRB;
  const uint8_t portValue = idx < 8
    ? (uint8_t)(nextDirections & 0xFF)
    : (uint8_t)(nextDirections >> 8);

  if (!mcpWriteAndVerify(reg, portValue)) {
    relayHardwareReady = false;
    heartbeatConfirmed = false;
    Serial.println("[MCP23017] IODIR-Schreibfehler, Neuverbindung wird versucht");
    return false;
  }

  mcpDirectionMask = nextDirections;
  relayStates[idx] = on;
  Serial.print("[MCP] Kanal ");
  Serial.print(idx + 1);
  Serial.print(on ? " EIN" : " AUS");
  Serial.print(" · IODIR=0x");
  if (mcpDirectionMask < 0x1000) Serial.print("0");
  if (mcpDirectionMask < 0x0100) Serial.print("0");
  if (mcpDirectionMask < 0x0010) Serial.print("0");
  Serial.println(mcpDirectionMask, HEX);
  return true;
}

bool allRelaysOff() {
  for (uint8_t i = 0; i < RELAY_COUNT; i++) relayStates[i] = false;
  mcpDirectionMask = 0xFFFF;
  if (relayHardwareReady && !mcpWriteDirections(mcpDirectionMask)) {
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
    Serial.println("[RELAIS] MCP23017 online: 16 Kanaele an Adresse 0x20");
  } else {
    Serial.println("[MCP23017] Nicht gefunden - pruefe SDA, SCL, Adresse und 3V3");
  }
}

void ensureBme280() {
  unsigned long now = millis();
  if (!bme280Ready) {
    if ((unsigned long)(now - lastBme280Attempt) < BME280_RETRY_INTERVAL_MS) return;
    lastBme280Attempt = now;
    bme280Ready = bme280.begin(BME280_I2C_ADDRESS, &Wire);
    if (bme280Ready) Serial.println("[BME280] Online an Adresse 0x76");
    else Serial.println("[BME280] Nicht gefunden - pruefe Adresse, SDA, SCL und 3V3");
    return;
  }
  if ((unsigned long)(now - lastBme280Read) < BME280_READ_INTERVAL_MS) return;
  lastBme280Read = now;
  const float nextTemperature = bme280.readTemperature();
  const float nextHumidity = bme280.readHumidity();
  const float nextPressure = bme280.readPressure() / 100.0F;
  if (isnan(nextTemperature) || isnan(nextHumidity) || isnan(nextPressure)) {
    bme280Ready = false;
    return;
  }
  temperatureC = nextTemperature;
  humidityPct = nextHumidity;
  pressureHpa = nextPressure;
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
  DynamicJsonDocument doc(1536);
  doc["module"] = moduleId;
  doc["moduleName"] = MODULE_NAME;
  doc["moduleType"] = "RELAY_SENSOR_CONTROLLER";
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["protocolVersion"] = PROTOCOL_VERSION;
  doc["hardwareType"] = HARDWARE_TYPE;
  doc["mcp23017"] = relayHardwareReady;
  doc["bme280"] = bme280Ready;
  doc["relayActiveLow"] = RELAY_ACTIVE_LOW;
  doc["relayOutputLatch"] = mcpOutputLatch;
  doc["relayDirectionMask"] = mcpDirectionMask;
  doc["relayDriveMode"] = RELAY_DRIVE_MODE;
  doc["relayDriver"] = "MCP23017";

  if (bme280Ready && !isnan(temperatureC)) {
    JsonObject environment = doc.createNestedObject("environment");
    environment["sensor"] = "BME280";
    environment["temperatureC"] = roundf(temperatureC * 10.0F) / 10.0F;
    environment["humidityPct"] = roundf(humidityPct * 10.0F) / 10.0F;
    environment["pressureHpa"] = roundf(pressureHpa * 10.0F) / 10.0F;
  }

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
    DynamicJsonDocument reply(1024);
    DeserializationError err = deserializeJson(reply, response);
    if (!err && reply["ok"] == true) {
      if (!heartbeatConfirmed) {
        heartbeatConfirmed = true;
        Serial.print("[SERVER] Heartbeat OK: ");
        Serial.print(RELAY_COUNT);
        Serial.print(" Relais, ");
        Serial.print(SENSOR_COUNT);
        Serial.println(" Sensoren");
      }
      JsonVariant heartbeatCommand = reply["command"];
      if (!heartbeatCommand.isNull()) executeCommand(heartbeatCommand.as<JsonObject>());
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

bool ackCommand(int id, bool ok = true, const char* error = "") {
  DynamicJsonDocument doc(256);
  doc["id"] = id;
  doc["module"] = moduleId;
  doc["ok"] = ok;
  if (!ok && error && error[0] != '\0') doc["error"] = error;

  String payload;
  serializeJson(doc, payload);

  String response;
  bool sent = httpPostJson("/api/module/ack", payload, response);
  if (!sent) {
    Serial.print("[ACK] Bestaetigung fuer Befehl #");
    Serial.print(id);
    Serial.println(" konnte nicht gesendet werden");
  }
  return sent;
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

  Serial.print("[BEFEHL] #");
  Serial.print(id);
  Serial.print(" ");
  Serial.print(type);
  if (channel > 0) {
    Serial.print(" · Kanal ");
    Serial.print(channel);
  }
  Serial.println();

  if (strcmp(type, "RELAY_SET") == 0) {
    if (channel < 1 || channel > RELAY_COUNT) {
      if (id > 0) ackCommand(id, false, "Ungueltiger Relaiskanal");
      return;
    }
    pulses[channel - 1].active = false;
    bool executed = setRelayHw((uint8_t)(channel - 1), state);
    if (id > 0) ackCommand(id, executed, executed ? "" : "MCP23017 nicht bereit oder Schreibfehler");
    return;
  }

  if (strcmp(type, "RELAY_PULSE") == 0) {
    if (channel < 1 || channel > RELAY_COUNT) {
      if (id > 0) ackCommand(id, false, "Ungueltiger Relaiskanal");
      return;
    }
    bool executed = startPulse((uint8_t)(channel - 1), (unsigned long)duration);
    if (id > 0) ackCommand(id, executed, executed ? "" : "Relaispuls konnte nicht gestartet werden");
    return;
  }

  if (strcmp(type, "NOT_AUS") == 0) {
    for (uint8_t i = 0; i < RELAY_COUNT; i++) pulses[i].active = false;
    bool executed = allRelaysOff();
    if (id > 0) ackCommand(id, executed, executed ? "" : "Not-Aus konnte nicht auf Hardware geschrieben werden");
    return;
  }

  if (id > 0) ackCommand(id, false, "Unbekannter Befehl");
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
      discoverDynoraStation();
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
  Serial.print("[RELAIS] Schaltlogik: ");
  Serial.println("aktiv-LOW / Open-Drain via IODIR (5-V Optokoppler-Eingaenge)");

  Wire.begin(MCP_SDA_PIN, MCP_SCL_PIN);
  Wire.setClock(MCP_I2C_CLOCK_HZ);
  // Ersten Versuch sofort erlauben; danach wird bei Fehler alle 5 Sekunden erneut geprüft.
  lastMcpAttempt = millis() - MCP_RETRY_INTERVAL_MS;
  lastBme280Attempt = millis() - BME280_RETRY_INTERVAL_MS;
  ensureMcp23017();
  ensureBme280();
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
  ensureBme280();
  ensureWifi();
  tickPulses();

  unsigned long now = millis();

  if (
    WiFi.status() == WL_CONNECTED &&
    !serverWasReachable &&
    (unsigned long)(now - lastDiscoveryAttempt) >= DISCOVERY_RETRY_INTERVAL_MS
  ) {
    discoverDynoraStation();
  }

  if (WiFi.status() == WL_CONNECTED && (unsigned long)(now - lastHeartbeat) >= HEARTBEAT_INTERVAL_MS) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // Auch bei einem MCP-Ausfall pollen: Der Server bekommt dann sofort eine
  // konkrete negative Bestätigung statt erst nach einem Queue-Timeout.
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
