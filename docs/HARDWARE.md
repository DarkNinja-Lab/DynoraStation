# Hardware und ESP8266

DynoraStation trennt Server und Hardware. Der Server schaltet keine Pins direkt; alle physischen Ein-/Ausgänge hängen an ESP8266-Modulen im lokalen Netz.

## Firmware

Unter [`esp8266_code/`](../esp8266_code/README.md) liegen derzeit zwei Firmwarevarianten:

- `relays_und_sensoren.ino` für 16 Relais über MCP23017, drei Sensoreingänge und optional BME280
- `led_signalleuchten.ino` für acht direkte LED-/Signalausgänge

Beide Firmwarevarianten verwenden Protokollversion `2`, senden Heartbeats und holen Befehle aus der Server-Queue.

## Relais-/Sensormodul

Das Relaismodul verwendet:

```text
ESP8266 NodeMCU
MCP23017 @ 0x20
16-Kanal-Relaisboard
Sensoren S1-S3 an D5/D6/D7
optional BME280 @ 0x76
```

Die genaue Verdrahtung und die Besonderheit des LOW-triggered Relaisboards stehen in [`esp8266_code/MCP23017_ANSCHLUSS.md`](../esp8266_code/MCP23017_ANSCHLUSS.md).

## LED-Modul

`led_signalleuchten.ino` verwendet standardmäßig acht GPIO-Ausgänge D1 bis D8. Jede LED benötigt einen passenden Vorwiderstand. Bei höheren Strömen oder mehreren LEDs pro Kanal ist eine Treiberstufe sinnvoll; GPIOs des ESP8266 sind keine Lasttreiber.

D3, D4 und D8 haben Boot-Strap-Funktionen. Eine angeschlossene Schaltung darf die erforderlichen Pegel beim Booten nicht verhindern.

## Netzwerk

Die Firmware versucht den Server zunächst per UDP-Discovery zu finden. Wenn kein Server antwortet, wird `SERVER_HOST` aus der Firmware als Fallback verwendet.

Server und ESP-Module müssen sich gegenseitig über HTTP erreichen können. Bei getrennten VLANs oder restriktiven Firewalls müssen sowohl der HTTP-Port als auch UDP-Discovery entsprechend freigegeben werden.

## Firmware anpassen

Vor dem Flashen mindestens WLAN-Zugangsdaten und den Fallback-Server prüfen:

```cpp
const char* WIFI_SSID = "...";
const char* WIFI_PASS = "...";
const char* SERVER_HOST = "...";
```

Beim LED-Modul ist zusätzlich `MODULE_ID` fest konfiguriert. Das Relais-/Sensormodul erzeugt seine technische Modul-ID aus der ESP-Chip-ID; `MODULE_NAME` ist nur der Anzeigename.

## Elektrische Sicherheit

Relais- oder Signallasten dürfen nicht direkt aus GPIOs oder dem MCP23017 versorgt werden. Versorgung, Treiberstufe und Relaisboard müssen zur verwendeten Spannung und Last passen.

Der Software-NOT-AUS ist keine galvanische oder hardwareseitige Sicherheitsabschaltung. Arbeiten an der Anlage nur spannungsfrei durchführen.
