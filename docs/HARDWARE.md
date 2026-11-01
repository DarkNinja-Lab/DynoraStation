# Hardware und ESP8266

DynoraStation trennt Server und Hardware. Der Server schaltet keine Pins direkt; alle physischen Ein-/Ausgänge hängen an ESP8266-Modulen im lokalen Netz.

## Firmware

Unter [`esp8266_code/`](../esp8266_code/README.md) liegen zwei Firmwarefamilien:

- `relays_und_sensoren.ino` mit vorgefertigten Varianten für 8, 16, 24 oder 32 Relais über ein oder zwei MCP23017, drei Sensoreingänge und optional BME280
- `led_signalleuchten.ino` für acht direkte LED-/Signalausgänge

Beide Firmwarevarianten verwenden Protokollversion `2`, senden Heartbeats und holen Befehle aus der Server-Queue.

## Relais-/Sensormodul

Das Relaismodul verwendet:

```text
ESP8266 NodeMCU
MCP23017 @ 0x20 (Kanäle 1–16)
MCP23017 @ 0x21 (Kanäle 17–24)
zwei Relaisboards beziehungsweise 24 Relais-Eingänge
Sensoren S1-S3 an D5/D6/D7
optional BME280 @ 0x76
```

Die genaue Verdrahtung und die Besonderheit der LOW-triggered Relaisboards stehen in [`MCP23017_ANSCHLUSS.md`](MCP23017_ANSCHLUSS.md).

## Relais- und Sensorvarianten

Neben der Standarddatei gibt es vorgefertigte Sketches für gängige MCP23017- und Relaisboard-Kombinationen. Alle verwenden die Sensoranschlüsse D5, D6 und D7; die benutzerdefinierte Variante erlaubt zusätzlich null bis drei Sensoren.

| Sketch | MCP23017 | Relaiskanäle |
| --- | --- | --- |
| `relays_und_sensoren_8r_1mcp.ino` | `0x20` | 8 |
| `relays_und_sensoren_16r_1mcp.ino` | `0x20` | 16 |
| `relays_und_sensoren_16r_2mcp.ino` | `0x20` und `0x21` | 8 + 8 |
| `relays_und_sensoren_24r_2mcp.ino` | `0x20` und `0x21` | 16 + 8 |
| `relays_und_sensoren_32r_2mcp.ino` | `0x20` und `0x21` | 16 + 16 |
| `relays_und_sensoren_custom.ino` | ein oder zwei MCP23017 | frei konfigurierbar: 1–16 + 0–16 |

Für die benutzerdefinierte Variante werden die drei `DYNORA_*_COUNT`-Zeilen am Anfang angepasst. Den Sketch in einem eigenen, gleichnamigen Ordner öffnen oder die betreffende Datei in einen solchen Ordner kopieren; mehrere `.ino`-Dateien im selben Arduino-Sketch-Verzeichnis dürfen nicht gemeinsam kompiliert werden.

Die fünf festen Relaisprofile werden auch vom Server-OTA-Build unterstützt. Die freie Variante ist absichtlich nur für den USB-Flash gedacht, damit ein individuell angepasster Kanalaufbau nicht durch ein unpassendes OTA-Profil überschrieben wird.

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

Beide Firmwarevarianten erzeugen standardmäßig eine stabile technische Modul-ID aus der ESP-Chip-ID. Beim LED-Modul kann `MODULE_ID_OVERRIDE` gesetzt werden, um bei einer bestehenden Installation bewusst eine alte technische ID beizubehalten. Der Anzeigename kann unabhängig davon im Webinterface geändert werden.

## Elektrische Sicherheit

Relais- oder Signallasten dürfen nicht direkt aus GPIOs oder dem MCP23017 versorgt werden. Versorgung, Treiberstufe und Relaisboard müssen zur verwendeten Spannung und Last passen.

Der Software-NOT-AUS ist keine galvanische oder hardwareseitige Sicherheitsabschaltung. Arbeiten an der Anlage nur spannungsfrei durchführen.
