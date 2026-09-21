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
#include <ArduinoJson.h>

/* ============================ Konfiguration ============================= */

const char* WIFI_SSID = "DEIN_WLAN_NAME";
const char* WIFI_PASS = "DEIN_WLAN_PASSWORT";

const char* SERVER_HOST = "192.168.1.115";
const uint16_t SERVER_PORT = 8181;

// Muss zum Modul in deinem Server passen
const char* MODULE_ID = "LEDMOD_01";
const char* FIRMWARE_VERSION = "2.0.7";
const uint16_t PROTOCOL_VERSION = 2;
const char* HARDWARE_TYPE = "ESP8266_NODEMCU_LED_DIRECT";

// Taktung
const unsigned long HEARTBEAT_INTERVAL_MS    = 2000;
const unsigned long COMMAND_POLL_INTERVAL_MS = 100;
const unsigned long WIFI_RECONNECT_COOLDOWN_MS = 5000;

const uint16_t HTTP_TIMEOUT_MS = 2500;
const uint8_t HTTP_RETRIES = 2;

// LED-Ausgänge (ESP8266 NodeMCU Pins)
// ACHTUNG: D8 (GPIO15), D0 etc. haben Boot-Eigenheiten. Plane Hardware entsprechend.
const uint8_t LED_COUNT = 8;
const uint8_t ledPins[LED_COUNT] = {
  D1, D2, D3, D4, D5, D6, D7, D8
};

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

/* ============================ Hilfsfunktionen =========================== */

inline bool elapsedSince(unsigned long now, unsigned long since, unsigned long interval) {
  return (unsigned long)(now - since) >= interval;
}

String makeBaseUrl() {
  String url = "http://";
  url += SERVER_HOST;
  url += ":";
  url += String(SERVER_PORT);
  return url;
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

    if (code >= 200 && code < 300) return true;

    delay(40);
    yield();
  }
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

    if (code >= 200 && code < 300) return true;

    delay(40);
    yield();
  }
  return false;
}

void sendHeartbeat() {
  DynamicJsonDocument doc(1600);
  doc["module"] = MODULE_ID;
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
  if (!ok) {
    // absichtlich still; kann bei kurzzeitigem WLAN-Ausfall häufig passieren
  }
}

void ackCommand(int id, bool ok = true, const char* error = "") {
  DynamicJsonDocument doc(256);
  doc["id"] = id;
  doc["module"] = MODULE_ID;
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
    unsigned long onMs = (unsigned long)(cmd["onMs"] | 300);
    unsigned long offMs = (unsigned long)(cmd["offMs"] | 300);
    unsigned long durationMs = (unsigned long)(cmd["durationMs"] | 0);
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
  String path = "/api/module/next-command?module=" + String(MODULE_ID);

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
  if (st == WL_CONNECTED) return;

  unsigned long now = millis();

  // Nur alle X ms neu versuchen
  if (!elapsedSince(now, lastWifiAttempt, WIFI_RECONNECT_COOLDOWN_MS)) return;
  lastWifiAttempt = now;

  // Status alle paar Sekunden ins Log (nicht spammen)
  if (elapsedSince(now, lastWifiStatusLog, 5000)) {
    lastWifiStatusLog = now;
    Serial.printf("[WiFi] nicht verbunden (status=%d), reconnect...\n", (int)st);
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);

  if (WiFi.SSID() != String(WIFI_SSID)) {
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  } else {
    WiFi.reconnect();
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("[WiFi] verbunden, IP=%s\n", WiFi.localIP().toString().c_str());
  }
}

/* ============================ Setup / Loop ============================== */

void setup() {
  Serial.begin(115200);
  delay(120);

  analogWriteRange(PWM_RANGE);
  analogWriteFreq(PWM_FREQ);

  for (uint8_t i = 0; i < LED_COUNT; i++) {
    pinMode(ledPins[i], OUTPUT);
    ledStates[i] = false;
    ledBrightness[i] = 0;
    clearBlink(i);
    digitalWrite(ledPins[i], toPinLevelFromState(false));
  }

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.hostname(MODULE_ID);

  ensureWifi();
  sendHeartbeat();
  Serial.println("[LEDMOD] gestartet");
}

void loop() {
  ensureWifi();
  tickBlinkers();

  unsigned long now = millis();

  if (elapsedSince(now, lastHeartbeat, HEARTBEAT_INTERVAL_MS)) {
    lastHeartbeat = now;
    sendHeartbeat();
  }

  if (elapsedSince(now, lastCommandPoll, COMMAND_POLL_INTERVAL_MS)) {
    lastCommandPoll = now;
    pollNextCommand();
  }

  yield();
}
