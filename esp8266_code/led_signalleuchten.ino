/*
  ESP8266 NodeMCU LED Controller v2 für H0-Bahn-Server
  - Heartbeat + LED-Status senden
  - Befehle vom Server pollen und ausführen:
      LED_SET, LED_PWM, LED_BLINK, NOT_AUS
  - Non-blocking Blink-Logik (kein delay im Loop)
  - HTTP Timeout + Retry + WiFi Reconnect

  HINWEIS HARDWARE:
  - Jede LED braucht einen Vorwiderstand!
  - Bei vielen LEDs besser Treiberstufe (ULN2803 / MOSFET) verwenden.
*/

#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiUdp.h>
#include <ArduinoJson.h>

/* ============================ Konfiguration ============================= */

const char* WIFI_SSID = "DEIN_WLAN_NAME";
const char* WIFI_PASS = "DEIN_WLAN_PASSWORT";

const char* SERVER_HOST = "192.168.1.115";
const uint16_t SERVER_PORT = 8181;
const uint16_t DISCOVERY_PORT = 8182;

// Optional: feste technische ID fuer bestehende Installationen. Leer = stabile ID aus der ESP-Chip-ID.
// Wer von einer alten Firmware mit LEDMOD_01 migriert und bestehende Zuweisungen behalten
// moechte, traegt hier einmal "LEDMOD_01" ein. Fuer mehrere Module muss die ID eindeutig sein.
const char* MODULE_ID_OVERRIDE = "";
const char* MODULE_NAME = "LED-Signale";
const char* FIRMWARE_VERSION = "2.4.0";
const uint16_t PROTOCOL_VERSION = 2;
const char* HARDWARE_TYPE = "ESP8266_NODEMCU_LED_DIRECT";

// Taktung
const unsigned long HEARTBEAT_INTERVAL_MS    = 2000;
const unsigned long COMMAND_POLL_INTERVAL_MS = 100;
const unsigned long WIFI_RECONNECT_COOLDOWN_MS = 8000;

// Lokales LAN: lieber kurz timeouten und im naechsten Takt erneut versuchen,
// statt den ESP mehrere Sekunden in einem HTTP-Aufruf zu blockieren.
const uint16_t HTTP_TIMEOUT_MS = 750;
const uint8_t HTTP_RETRIES = 0;
const unsigned long DISCOVERY_RETRY_INTERVAL_MS = 5000;
const unsigned long STATION_LINK_TIMEOUT_MS = 6500;
const bool CONNECT_CHASE_ENABLED = true;
const unsigned long CONNECT_CHASE_STEP_MS = 70;

// LED-Ausgaenge (ESP8266 NodeMCU Pins).
// D4/GPIO2 ist absichtlich NICHT dabei: dort sitzt die blaue Onboard-LED und
// wird als Verbindungsstatus verwendet. Kanal 4 liegt deshalb auf D0/GPIO16.
// D3/GPIO0 und D8/GPIO15 bleiben Boot-Strap-Pins; externe Beschaltung darf
// die notwendigen Boot-Pegel nicht erzwingen.
const uint8_t LED_COUNT = 8;
const uint8_t ledPins[LED_COUNT] = {
  D1, D2, D3, D0, D5, D6, D7, D8
};

const uint8_t STATUS_LED_PIN = LED_BUILTIN; // NodeMCU: D4 / GPIO2, aktiv LOW
const bool STATUS_LED_ACTIVE_LOW = true;

// true = LED an bei HIGH; false = LED an bei LOW
const bool LED_ACTIVE_HIGH = true;

// Falls PWM genutzt wird:
const uint16_t PWM_RANGE = 255;      // 0..255
const uint16_t PWM_FREQ = 1000;      // 1kHz

/* ============================ Zustand =================================== */

bool ledStates[LED_COUNT];
uint8_t ledBrightness[LED_COUNT]; // 0..255

unsigned long lastHeartbeat = 0;
unsigned long lastCommandPoll = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastWifiStatusLog = 0;
unsigned long lastDiscoveryAttempt = 0;
unsigned long lastServerContactAt = 0;
bool wifiWasConnected = false;
bool wifiAttemptStarted = false;
bool serverWasReachable = false;
bool heartbeatConfirmed = false;
bool connectChaseActive = false;
uint8_t connectChaseStep = 0;
unsigned long connectChaseChangedAt = 0;
String activeServerHost = SERVER_HOST;
String moduleId;
WiFiUDP discoveryUdp;

// Blink pro Kanal (non-blocking)
struct BlinkState {
  bool active;
  bool stateOn; // aktueller Blinkzustand
  unsigned long onMs;
  unsigned long offMs;
  unsigned long lastToggle;
  unsigned long stopAt; // 0 = unendlich
};

BlinkState blinkers[LED_COUNT];

// Heartbeat und Polling verwenden denselben Befehls-Handler.
void executeCommand(const JsonObject& cmd);

/* ============================ Hilfsfunktionen =========================== */

inline bool elapsedSince(unsigned long now, unsigned long since, unsigned long interval) {
  return (unsigned long)(now - since) >= interval;
}

void writeStatusLed(bool on) {
  digitalWrite(STATUS_LED_PIN, STATUS_LED_ACTIVE_LOW ? (on ? LOW : HIGH) : (on ? HIGH : LOW));
}

bool stationConnected() {
  if (WiFi.status() != WL_CONNECTED || !heartbeatConfirmed || lastServerContactAt == 0) return false;
  return !elapsedSince(millis(), lastServerContactAt, STATION_LINK_TIMEOUT_MS);
}

void tickStatusLed() {
  unsigned long now = millis();

  if (heartbeatConfirmed && lastServerContactAt > 0 && elapsedSince(now, lastServerContactAt, STATION_LINK_TIMEOUT_MS)) {
    heartbeatConfirmed = false;
    serverWasReachable = false;
  }

  if (WiFi.status() != WL_CONNECTED) {
    // WLAN fehlt: schnelles Blinken.
    writeStatusLed((now % 400UL) < 200UL);
    return;
  }

  if (!stationConnected()) {
    // WLAN steht, DynoraStation aber noch nicht bestaetigt: kurzer langsamer Puls.
    writeStatusLed((now % 1200UL) < 120UL);
    return;
  }

  // Voll verbunden: dauerhaft an.
  writeStatusLed(true);
}

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

  const uint16_t localPort = 43000 + (ESP.getChipId() % 1000);
  if (!discoveryUdp.begin(localPort)) return false;
  discoveryUdp.beginPacket(IPAddress(255, 255, 255, 255), DISCOVERY_PORT);
  discoveryUdp.write("DYNORA_DISCOVER_V1");
  discoveryUdp.endPacket();

  const unsigned long startedAt = millis();
  while ((unsigned long)(millis() - startedAt) < 250) {
    int packetSize = discoveryUdp.parsePacket();
    if (packetSize > 0) {
      char reply[72] = {0};
      int readCount = discoveryUdp.read(reply, sizeof(reply) - 1);
      if (readCount > 0) reply[readCount] = '\0';
      if (String(reply).startsWith("DYNORA_STATION_V1|")) {
        activeServerHost = discoveryUdp.remoteIP().toString();
        discoveryUdp.stop();
        Serial.printf("[SERVER] automatisch gefunden: %s\n", makeBaseUrl().c_str());
        return true;
      }
    }
    delay(10);
    yield();
  }
  discoveryUdp.stop();
  Serial.printf("[SERVER] Auto-Erkennung ohne Treffer, Fallback: %s\n", makeBaseUrl().c_str());
  return false;
}

bool validChannel(int channel) {
  return channel >= 1 && channel <= LED_COUNT;
}

uint8_t channelToIdx(int channel) {
  return (uint8_t)(channel - 1);
}

int toPinLevelFromState(bool on) {
  if (LED_ACTIVE_HIGH) return on ? HIGH : LOW;
  return on ? LOW : HIGH;
}

int toPwmFromBrightness(uint8_t b) {
  if (LED_ACTIVE_HIGH) return map(b, 0, 255, 0, PWM_RANGE);
  return map(b, 0, 255, PWM_RANGE, 0);
}

void clearBlink(uint8_t idx) {
  if (idx >= LED_COUNT) return;
  blinkers[idx].active = false;
  blinkers[idx].stateOn = false;
  blinkers[idx].onMs = 0;
  blinkers[idx].offMs = 0;
  blinkers[idx].lastToggle = 0;
  blinkers[idx].stopAt = 0;
}

void setLedDigital(uint8_t idx, bool on) {
  if (idx >= LED_COUNT) return;

  clearBlink(idx); // manuelles Set stoppt Blink
  ledStates[idx] = on;
  ledBrightness[idx] = on ? 255 : 0;

  digitalWrite(ledPins[idx], toPinLevelFromState(on));
}

void setLedPwm(uint8_t idx, uint8_t brightness) {
  if (idx >= LED_COUNT) return;

  clearBlink(idx); // manuelles PWM stoppt Blink
  ledBrightness[idx] = brightness;
  ledStates[idx] = brightness > 0;

  analogWrite(ledPins[idx], toPwmFromBrightness(brightness));
}

void allLedsOff() {
  for (uint8_t i = 0; i < LED_COUNT; i++) {
    clearBlink(i);
    ledStates[i] = false;
    ledBrightness[i] = 0;
    digitalWrite(ledPins[i], toPinLevelFromState(false));
  }
}

void applyLedHardware(uint8_t idx) {
  if (idx >= LED_COUNT) return;

  if (blinkers[idx].active) {
    digitalWrite(ledPins[idx], toPinLevelFromState(blinkers[idx].stateOn));
    return;
  }

  if (ledBrightness[idx] == 0 || ledBrightness[idx] == 255) {
    digitalWrite(ledPins[idx], toPinLevelFromState(ledStates[idx]));
    return;
  }

  analogWrite(ledPins[idx], toPwmFromBrightness(ledBrightness[idx]));
}

void restoreAllLedHardware() {
  for (uint8_t i = 0; i < LED_COUNT; i++) applyLedHardware(i);
}

void startConnectChase() {
  if (!CONNECT_CHASE_ENABLED) return;
  connectChaseActive = true;
  connectChaseStep = 0;
  connectChaseChangedAt = millis() - CONNECT_CHASE_STEP_MS;
  Serial.println("[LEDMOD] DynoraStation verbunden - Signaltest");
}

void tickConnectChase() {
  if (!connectChaseActive) return;

  unsigned long now = millis();
  if (!elapsedSince(now, connectChaseChangedAt, CONNECT_CHASE_STEP_MS)) return;
  connectChaseChangedAt = now;

  // Nur die physische Ausgabe ueberlagern. Die eigentlichen Kanalzustaende
  // bleiben erhalten und werden nach dem kurzen Lauflicht wiederhergestellt.
  for (uint8_t i = 0; i < LED_COUNT; i++) {
    digitalWrite(ledPins[i], toPinLevelFromState(false));
  }

  if (connectChaseStep < LED_COUNT) {
    digitalWrite(ledPins[connectChaseStep], toPinLevelFromState(true));
    connectChaseStep++;
    return;
  }

  connectChaseActive = false;
  restoreAllLedHardware();
}

bool httpPostJson(const String& path, const String& payload, String& responseOut) {
  responseOut = "";
  if (WiFi.status() != WL_CONNECTED) return false;

  for (uint8_t attempt = 0; attempt <= HTTP_RETRIES; attempt++) {
    WiFiClient client;
    HTTPClient http;

    String url = makeBaseUrl() + path;
    if (!http.begin(client, url)) {
      yield();
      continue;
    }

    http.setTimeout(HTTP_TIMEOUT_MS);
    http.addHeader("Content-Type", "application/json");

    int code = http.POST(payload);
    responseOut = http.getString();
    http.end();

    if (code >= 200 && code < 300) {
      serverWasReachable = true;
      lastServerContactAt = millis();
      return true;
    }

    delay(40);
    yield();
  }
  serverWasReachable = false;
  Serial.printf("[SERVER] POST %s nicht erreichbar\n", path.c_str());
  return false;
}

bool httpGet(const String& path, String& responseOut) {
  responseOut = "";
  if (WiFi.status() != WL_CONNECTED) return false;

  for (uint8_t attempt = 0; attempt <= HTTP_RETRIES; attempt++) {
    WiFiClient client;
    HTTPClient http;

    String url = makeBaseUrl() + path;
    if (!http.begin(client, url)) {
      yield();
      continue;
    }

    http.setTimeout(HTTP_TIMEOUT_MS);
    int code = http.GET();
    responseOut = http.getString();
    http.end();

    if (code >= 200 && code < 300) {
      serverWasReachable = true;
      lastServerContactAt = millis();
      return true;
    }

    delay(40);
    yield();
  }
  serverWasReachable = false;
  return false;
}

bool sendHeartbeat() {
  DynamicJsonDocument doc(1600);
  doc["module"] = moduleId;
  doc["moduleName"] = MODULE_NAME;
  doc["moduleType"] = "LED_CONTROLLER";
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["protocolVersion"] = PROTOCOL_VERSION;
  doc["hardwareType"] = HARDWARE_TYPE;

  JsonArray leds = doc.createNestedArray("leds");
  for (uint8_t i = 0; i < LED_COUNT; i++) {
    JsonObject o = leds.createNestedObject();
    o["channel"] = i + 1;
    o["state"] = ledStates[i];
    o["brightness"] = ledBrightness[i];
    o["blinking"] = blinkers[i].active;
  }

  String payload;
  serializeJson(doc, payload);

  String response;
  bool ok = httpPostJson("/api/module/heartbeat", payload, response);
  if (!ok) return false;

  DynamicJsonDocument reply(1024);
  DeserializationError err = deserializeJson(reply, response);
  if (err || reply["ok"] != true) return false;

  bool firstConfirmedContact = !heartbeatConfirmed;
  heartbeatConfirmed = true;
  lastServerContactAt = millis();

  if (firstConfirmedContact) {
    Serial.printf("[SERVER] Heartbeat OK: %s\n", makeBaseUrl().c_str());
    startConnectChase();
  }

  JsonVariant heartbeatCommand = reply["command"];
  if (!heartbeatCommand.isNull() && heartbeatCommand.is<JsonObject>()) {
    executeCommand(heartbeatCommand.as<JsonObject>());
  }
  return true;
}

void ackCommand(int id, bool ok = true, const char* error = "") {
  DynamicJsonDocument doc(256);
  doc["id"] = id;
  doc["module"] = moduleId;
  doc["ok"] = ok;
  if (!ok && error && error[0] != '\0') doc["error"] = error;

  String payload;
  serializeJson(doc, payload);

  String response;
  httpPostJson("/api/module/ack", payload, response);
}

void startBlink(uint8_t idx, unsigned long onMs, unsigned long offMs, unsigned long durationMs) {
  if (idx >= LED_COUNT) return;
  if (onMs == 0) onMs = 300;
  if (offMs == 0) offMs = 300;

  unsigned long now = millis();

  blinkers[idx].active = true;
  blinkers[idx].stateOn = true;
  blinkers[idx].onMs = onMs;
  blinkers[idx].offMs = offMs;
  blinkers[idx].lastToggle = now;
  blinkers[idx].stopAt = durationMs > 0 ? (now + durationMs) : 0;

  ledStates[idx] = true;
  ledBrightness[idx] = 255;
  digitalWrite(ledPins[idx], toPinLevelFromState(true));
}

void tickBlinkers() {
  unsigned long now = millis();

  for (uint8_t i = 0; i < LED_COUNT; i++) {
    if (!blinkers[i].active) continue;

    if (blinkers[i].stopAt > 0 && (long)(now - blinkers[i].stopAt) >= 0) {
      clearBlink(i);
      ledStates[i] = false;
      ledBrightness[i] = 0;
      digitalWrite(ledPins[i], toPinLevelFromState(false));
      continue;
    }

    unsigned long phaseMs = blinkers[i].stateOn ? blinkers[i].onMs : blinkers[i].offMs;
    if (elapsedSince(now, blinkers[i].lastToggle, phaseMs)) {
      blinkers[i].lastToggle = now;
      blinkers[i].stateOn = !blinkers[i].stateOn;

      ledStates[i] = blinkers[i].stateOn;
      ledBrightness[i] = blinkers[i].stateOn ? 255 : 0;
      digitalWrite(ledPins[i], toPinLevelFromState(blinkers[i].stateOn));
    }
  }
}

void executeCommand(const JsonObject& cmd) {
  const char* type = cmd["type"] | "";
  int id = cmd["id"] | 0;
  int channel = cmd["channel"] | 0;

  if (strcmp(type, "LED_SET") == 0) {
    if (!validChannel(channel)) { if (id > 0) ackCommand(id, false, "Ungueltiger LED-Kanal"); return; }
    bool state = cmd["state"] | false;
    setLedDigital(channelToIdx(channel), state);
    if (id > 0) ackCommand(id, true);
    return;
  }

  if (strcmp(type, "LED_PWM") == 0) {
    if (!validChannel(channel)) { if (id > 0) ackCommand(id, false, "Ungueltiger LED-Kanal"); return; }
    int b = cmd["brightness"] | 0;
    if (b < 0) b = 0;
    if (b > 255) b = 255;
    setLedPwm(channelToIdx(channel), (uint8_t)b);
    if (id > 0) ackCommand(id, true);
    return;
  }

  if (strcmp(type, "LED_BLINK") == 0) {
    if (!validChannel(channel)) { if (id > 0) ackCommand(id, false, "Ungueltiger LED-Kanal"); return; }
    long onMsRaw = cmd["onMs"] | 300;
    long offMsRaw = cmd["offMs"] | 300;
    long durationMsRaw = cmd["durationMs"] | 0;
    unsigned long onMs = (unsigned long)constrain(onMsRaw, 20L, 60000L);
    unsigned long offMs = (unsigned long)constrain(offMsRaw, 20L, 60000L);
    unsigned long durationMs = durationMsRaw <= 0 ? 0UL : (unsigned long)constrain(durationMsRaw, 1L, 3600000L);
    startBlink(channelToIdx(channel), onMs, offMs, durationMs);
    if (id > 0) ackCommand(id, true);
    return;
  }

  if (strcmp(type, "NOT_AUS") == 0) {
    allLedsOff();
    if (id > 0) ackCommand(id, true);
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
  if (!cmd.is<JsonObject>()) return;

  JsonObject obj = cmd.as<JsonObject>();
  executeCommand(obj);
}

void ensureWifi() {
  wl_status_t st = WiFi.status();
  if (st == WL_CONNECTED) {
    if (!wifiWasConnected) {
      wifiWasConnected = true;
      wifiAttemptStarted = false;
      Serial.printf("[WiFi] verbunden, IP=%s\n", WiFi.localIP().toString().c_str());

      // Schnellster Pfad: zuerst den konfigurierten/zuletzt bekannten Host testen.
      // UDP-Discovery wird nur benoetigt, wenn dieser direkte Heartbeat scheitert.
      bool heartbeatOk = sendHeartbeat();
      lastHeartbeat = millis();
      if (!heartbeatOk) {
        if (discoverDynoraStation()) {
          sendHeartbeat();
          lastHeartbeat = millis();
        }
      }
    }
    return;
  }

  if (wifiWasConnected) {
    wifiWasConnected = false;
    serverWasReachable = false;
    heartbeatConfirmed = false;
    lastServerContactAt = 0;
    connectChaseActive = false;
    Serial.println("[WiFi] Verbindung verloren");
  }

  unsigned long now = millis();

  // Der allererste Verbindungsversuch startet sofort. Nur Wiederholungen werden gedrosselt.
  if (wifiAttemptStarted && !elapsedSince(now, lastWifiAttempt, WIFI_RECONNECT_COOLDOWN_MS)) return;
  lastWifiAttempt = now;
  wifiAttemptStarted = true;

  if (elapsedSince(now, lastWifiStatusLog, 3000)) {
    lastWifiStatusLog = now;
    Serial.printf("[WiFi] nicht verbunden (status=%d), verbinde...\n", (int)st);
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
}

/* ============================ Setup / Loop ============================== */

void setup() {
  Serial.begin(115200);
  delay(120);

  analogWriteRange(PWM_RANGE);
  analogWriteFreq(PWM_FREQ);

  pinMode(STATUS_LED_PIN, OUTPUT);
  writeStatusLed(false);

  for (uint8_t i = 0; i < LED_COUNT; i++) {
    pinMode(ledPins[i], OUTPUT);
    ledStates[i] = false;
    ledBrightness[i] = 0;
    clearBlink(i);
    digitalWrite(ledPins[i], toPinLevelFromState(false));
  }

  moduleId = String(MODULE_ID_OVERRIDE);
  moduleId.trim();
  if (!moduleId.length()) {
    moduleId = "ESP8266-LED-" + String(ESP.getChipId(), HEX);
    moduleId.toUpperCase();
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.hostname(moduleId);

  Serial.printf("[LEDMOD] ID=%s, Name=%s\n", moduleId.c_str(), MODULE_NAME);
  Serial.println("[LEDMOD] Status-LED: D4/GPIO2 | Signalkanal 4: D0/GPIO16");
  ensureWifi();
  Serial.println("[LEDMOD] gestartet");
}

void loop() {
  ensureWifi();
  tickStatusLed();
  tickBlinkers();
  tickConnectChase();

  unsigned long now = millis();

  if (
    WiFi.status() == WL_CONNECTED &&
    !stationConnected() &&
    elapsedSince(now, lastDiscoveryAttempt, DISCOVERY_RETRY_INTERVAL_MS)
  ) {
    if (discoverDynoraStation()) {
      sendHeartbeat();
      lastHeartbeat = millis();
    }
  }

  if (WiFi.status() == WL_CONNECTED && elapsedSince(now, lastHeartbeat, HEARTBEAT_INTERVAL_MS)) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  // Wenn die Station offline ist, vermeiden wir blockierende GETs. Der Heartbeat
  // stellt die Verbindung wieder her; danach beginnt das schnelle Polling sofort.
  if (!connectChaseActive && stationConnected() && elapsedSince(now, lastCommandPoll, COMMAND_POLL_INTERVAL_MS)) {
    lastCommandPoll = now;
    pollNextCommand();
  }

  yield();
}
