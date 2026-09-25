# ESP8266-Firmware

Dieser Ordner enthält die Firmware für die DynoraStation-Hardwaremodule.

## Dateien

### `relays_und_sensoren.ino`

Für ein NodeMCU/ESP8266-Modul mit:

- 16 Relais über MCP23017
- drei Sensoreingängen an D5, D6 und D7
- optionalem BME280 für Temperatur, Luftfeuchte und Luftdruck
- HTTP-Heartbeat, Command Polling und UDP-Discovery

Verdrahtung des MCP23017 und des dokumentierten Relaisboards: [MCP23017_ANSCHLUSS.md](MCP23017_ANSCHLUSS.md)

Benötigte Arduino-Libraries:

- ESP8266WiFi
- ESP8266HTTPClient
- ArduinoJson
- Wire
- Adafruit Sensor
- Adafruit BME280

### `led_signalleuchten.ino`

Für ein separates NodeMCU/ESP8266-Modul mit bis zu acht LED-/Signalausgängen.

Unterstützt:

- Ein/Aus
- PWM-Helligkeit
- Blinken
- NOT-AUS
- HTTP-Heartbeat, Command Polling und UDP-Discovery

Benötigte Arduino-Libraries:

- ESP8266WiFi
- ESP8266HTTPClient
- ArduinoJson

## Vor dem Flashen

In der jeweiligen `.ino` mindestens WLAN und Fallback-Server prüfen:

```cpp
const char* WIFI_SSID = "DEIN_WLAN_NAME";
const char* WIFI_PASS = "DEIN_WLAN_PASSWORT";
const char* SERVER_HOST = "192.168.1.115";
```

Standardports:

```text
HTTP:          8181
UDP-Discovery: 8182
Protokoll:     2
```

Die Firmware versucht DynoraStation per UDP im lokalen Netz zu finden. `SERVER_HOST` wird verwendet, wenn Discovery keinen Treffer liefert.

## Diagnose

Für die Inbetriebnahme den seriellen Monitor geöffnet lassen. Dort werden WLAN-Verbindung, gefundener Server, HTTP-Fehler und Hardwarestatus ausgegeben.

Wenn ein Modul im Webinterface als inkompatibel erscheint, zuerst `PROTOCOL_VERSION` zwischen Firmware und Server vergleichen.
