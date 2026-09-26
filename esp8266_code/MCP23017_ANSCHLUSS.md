# MCP23017 und 16-Kanal-Relaisboard

Diese Verdrahtung gehört zu `relays_und_sensoren.ino`. Sie beschreibt den aktuell verwendeten Aufbau mit einem 3,3-V-MCP23017 und einem LOW-triggered 16-Kanal-Relaisboard.

## NodeMCU ↔ MCP23017

| NodeMCU ESP8266 | MCP23017 | Funktion |
| --- | --- | --- |
| `3V3` | `VDD` | Logikversorgung |
| `GND` | `VSS` | Masse |
| `D2 / GPIO4` | `SDA` | I²C-Daten |
| `D1 / GPIO5` | `SCL` | I²C-Takt |
| `3V3` über 10 kΩ | `RESET` | Reset-Pull-up |
| `GND` | `A0`, `A1`, `A2` | Adresse `0x20` |

SDA und SCL benötigen Pull-ups nach 3,3 V. Viele fertige MCP23017-Boards haben diese bereits bestückt. Zusätzliche Pull-ups nur setzen, wenn das verwendete Modul sie nicht besitzt beziehungsweise der Bus sie benötigt.

Der BME280 hängt am selben I²C-Bus:

| BME280 | NodeMCU |
| --- | --- |
| `VIN/VCC` | `3V3` |
| `GND` | `GND` |
| `SDA` | `D2 / GPIO4` |
| `SCL` | `D1 / GPIO5` |

Die Firmware erwartet den BME280 standardmäßig auf `0x76`.

## Relaisboard

Das dokumentierte 16-Kanal-Board besitzt optogekoppelte LOW-triggered Eingänge. Im vorhandenen Aufbau liegen offene `INx`-Eingänge ungefähr auf 5 V.

```text
INx -> GND    Relais EIN
INx offen     Relais AUS
```

Der MCP23017 läuft dagegen mit 3,3 V. Deshalb darf er die Relais-Eingänge nicht aktiv auf HIGH treiben.

Die Firmware verwendet die MCP-Pins als Open-Drain-artige Stromsenke:

```text
Relais EIN:  Pin = OUTPUT, OLAT = LOW
Relais AUS:  Pin = INPUT, hochohmig
```

Damit zieht der MCP23017 den Eingang nur nach GND oder gibt ihn frei.

Diese Schaltung gilt für das konkret verwendete Relaisboard. Bei einem anderen Board zuerst Eingangsschaltung und Triggerlogik prüfen.

## Kanalbelegung

| MCP23017 | Relaisboard |
| --- | --- |
| `GPA0` … `GPA7` | `IN1` … `IN8` |
| `GPB0` … `GPB7` | `IN9` … `IN16` |

ESP8266/MCP23017 und die Eingangsseite des Relaisboards benötigen eine gemeinsame Masse.

Die Optokoppler und vorhandenen ULN2803 des Relaisboards bleiben unverändert. Relaisspulen werden nicht direkt vom MCP23017 versorgt.

## Sensoreingänge

| Sensor | NodeMCU | GPIO | Beschaltung |
| --- | --- | ---: | --- |
| `S1` | `D5` | 14 | Schalter/Sensor gegen GND, interner Pull-up |
| `S2` | `D6` | 12 | Schalter/Sensor gegen GND, interner Pull-up |
| `S3` | `D7` | 13 | Schalter/Sensor gegen GND, interner Pull-up |

D3/GPIO0, D4/GPIO2 und D8/GPIO15 werden hier nicht als Sensorpins verwendet, weil sie beim Booten definierte Pegel benötigen. RX/TX bleiben für die serielle Diagnose frei.

## Verhalten beim Start

Die Firmware setzt zuerst beide MCP-Ausgangslatches auf LOW und danach alle 16 Richtungsbits auf INPUT:

```text
OLATA  = 0x00
OLATB  = 0x00
IODIRA = 0xFF
IODIRB = 0xFF
```

Damit sind nach erfolgreicher MCP-Initialisierung alle Relais AUS.

Beim Einschalten eines Kanals wird nur das zugehörige IODIR-Bit auf `0` gesetzt. Der Pin wird dadurch `OUTPUT LOW` und zieht den Relais-Eingang nach GND.

Beispiel aus dem seriellen Monitor:

```text
[MCP] Kanal 1 EIN · IODIR=0xFFFE
[MCP] Kanal 1 AUS · IODIR=0xFFFF
```

## Inbetriebnahme

Vor dem Anschluss der Anlage:

1. Versorgungsspannungen prüfen.
2. Mit einem I²C-Scanner kontrollieren, ob `0x20` erreichbar ist.
3. Firmware starten und auf eine erfolgreiche MCP-Initialisierung achten.
4. Relaiskanäle einzeln ohne angeschlossene Modellbahnlast testen.
5. Erst danach Verbraucher beziehungsweise Anlagenstromkreise anschließen.

Wenn der MCP23017 nicht erkannt wird, zuerst `VDD`, `GND`, `SDA`, `SCL`, `RESET` und `A0-A2` prüfen.

## Stromversorgung

Den ESP8266, den MCP23017 und die Relaisversorgung nicht allein aufgrund gleicher Steckverbinder zusammenschalten. Das Relaisboard kann eine eigene 5-V-Versorgung benötigen. Entscheidend ist die Schaltung des verwendeten Boards.

Der MCP23017 darf keine Relaisspulen direkt treiben. Auch ESP8266-GPIOs sind nicht für Relais- oder Lampenlasten ausgelegt.
