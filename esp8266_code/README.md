# DynoraStation ESP8266-Firmware

Dieser Ordner enthält die Firmware für die DynoraStation-Hardwaremodule. Die ausführliche Hardware-Dokumentation liegt unter [`docs/HARDWARE.md`](../docs/HARDWARE.md).

## Firmwarevarianten

- `relays_und_sensoren.ino`: 16 Relais über MCP23017, drei Sensoreingänge und optional BME280.
- `led_signalleuchten.ino`: bis zu acht LED-/Signalausgänge mit Ein/Aus, PWM und Blinkfunktion.

Beide Firmwares nutzen HTTP-Port `8181`, UDP-Discovery-Port `8182` und Protokollversion `2`. Vor dem Flashen müssen mindestens `WIFI_SSID`, `WIFI_PASS` und der Fallback `SERVER_HOST` geprüft werden.

Der Relais-/Sensor-ESP und der LED-ESP erzeugen standardmäßig eine stabile technische Modul-ID aus der ESP8266-Chip-ID. Beim LED-ESP kann `MODULE_ID_OVERRIDE` gesetzt werden, wenn eine bestehende Installation bewusst ihre alte ID (zum Beispiel `LEDMOD_01`) behalten soll. Anzeigenamen können anschließend im DynoraStation-Webinterface geändert werden.

## Verdrahtung

Für MCP23017 und das dokumentierte 16-Kanal-Relaisboard siehe [`MCP23017_ANSCHLUSS.md`](MCP23017_ANSCHLUSS.md).

## Bibliotheken

Relais/Sensoren: ESP8266WiFi, ESP8266HTTPClient, ArduinoJson, Wire, Adafruit Sensor und Adafruit BME280.

LED/Signale: ESP8266WiFi, ESP8266HTTPClient und ArduinoJson.
