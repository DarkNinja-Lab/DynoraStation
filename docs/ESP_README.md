# ESP8266-Firmware

Die Firmware für die DynoraStation-Hardwaremodule liegt unter [`esp8266_code/`](../esp8266_code/README.md). Diese Anleitung beschreibt Installation und Inbetriebnahme; Profile und Kanalbelegung stehen unter [Hardware](HARDWARE.md).

## Dateien

### `relays_und_sensoren.ino`

Für ein NodeMCU/ESP8266-Modul mit:

- 24 Relais über zwei MCP23017 (`0x20`: Kanäle 1–16; `0x21`: Kanäle 17–24)
- drei Sensoreingängen an D5, D6 und D7
- optionalem BME280 für Temperatur, Luftfeuchte und Luftdruck
- HTTP-Heartbeat, Command Polling und UDP-Discovery

Verdrahtung der beiden MCP23017 und der dokumentierten Relaisboards: [MCP23017_ANSCHLUSS.md](MCP23017_ANSCHLUSS.md)

Weitere Varianten für 8, 16, 24 und 32 Relais liegen als eigene `.ino`-Dateien neben der Standardfirmware. Die vollständige Auswahl und die konfigurierbare Variante sind in [HARDWARE.md](HARDWARE.md#relais--und-sensorvarianten) beschrieben.

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
- Heartbeat als zweiter Befehls-Zustellweg
- stabile automatische Modul-ID aus der ESP8266-Chip-ID

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

## LED-Modul-ID bei bestehenden Installationen

Neue LED-Firmware erzeugt die technische ID standardmäßig aus der Chip-ID. Wenn ein bestehender Aufbau bereits Zuweisungen auf `LEDMOD_01` besitzt, vor dem Flashen `MODULE_ID_OVERRIDE` auf `"LEDMOD_01"` setzen. Für mehrere LED-Module muss jede feste Override-ID eindeutig sein.
