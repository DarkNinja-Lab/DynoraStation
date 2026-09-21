# NodeMCU + MCP23017 + 16-Kanal-Relaisboard

## I²C-Verbindung

| NodeMCU ESP8266 | MCP23017 |
| --- | --- |
| 3V3 | VDD |
| GND | VSS |
| D2 / GPIO4 | SDA |
| D1 / GPIO5 | SCL |

Der BME280 wird am selben I²C-Bus angeschlossen: `VIN/VCC → 3V3`, `GND → GND`, `SDA → D2`, `SCL → D1`. Die Firmware erwartet standardmäßig die Adresse `0x76`.

## Sensoreingänge am NodeMCU

| Sensor | NodeMCU | GPIO | Hinweis |
| --- | --- | ---: | --- |
| S1 | D5 | 14 | boot-sicher, interner Pull-up |
| S2 | D6 | 12 | boot-sicher, interner Pull-up |
| S3 | D7 | 13 | boot-sicher, interner Pull-up |

Die Sensoren schalten jeweils gegen GND. D3/GPIO0, D4/GPIO2 und D8/GPIO15 werden bewusst nicht verwendet, weil falsche Pegel dort den Start des ESP8266 verhindern können. RX/TX bleiben für Diagnoseausgaben frei; D0/GPIO16 bleibt Reserve.
| 3V3 über 10 kΩ | RESET |
| GND | A0, A1 und A2 |

Mit A0–A2 auf GND verwendet die Firmware die Adresse `0x20`. SDA und SCL benötigen Pull-ups nach 3,3 V; viele fertige MCP23017-Module haben diese bereits bestückt.

## Relaiskanäle

| MCP23017 | Relaisboard |
| --- | --- |
| GPA0–GPA7 | IN1–IN8 |
| GPB0–GPB7 | IN9–IN16 |

Das abgebildete Relaisboard besitzt eine eigene Treiberstufe. Der MCP23017 wird ausschließlich mit dessen Steuereingängen verbunden. Die Versorgung des Relaisboards erfolgt separat entsprechend der Beschriftung auf dem konkreten Board. Relaisspulen oder die Schraubkontakte der Relais niemals mit dem MCP23017 verbinden.

## Vor dem Anschluss prüfen

1. Versorgungsspannung des Relaisboards direkt an dessen Beschriftung oder Produktdatenblatt prüfen; sie ist auf dem Foto nicht zuverlässig lesbar.
2. Sicherstellen, dass an keinem Eingang des MCP23017 mehr als 3,3 V anliegen.
3. Bei Eingängen mit 5 V oder höher einen geeigneten Treiber beziehungsweise Pegelwandler einsetzen, beispielsweise ULN2803A.
4. Zuerst ohne angeschlossene Modellbahn testen.
5. Falls die Relais bei `AUS` anziehen, in `relays_und_sensoren.ino` `RELAY_ACTIVE_LOW` von `true` auf `false` ändern.

Nach erfolgreichem Start muss der serielle Monitor Folgendes anzeigen:

```text
[MCP23017] Online: 16 Relais an Adresse 0x20
[SERVER] Heartbeat OK: 16 Relais, 3 Sensoren
```

Danach erscheinen die Kanäle 1–16 automatisch in DynoraStation.
