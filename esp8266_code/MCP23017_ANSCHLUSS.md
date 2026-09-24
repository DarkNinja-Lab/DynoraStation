# NodeMCU + MCP23017 + 16-Kanal-Relaisboard

## I²C-Verbindung

| NodeMCU ESP8266 | MCP23017 |
| --- | --- |
| 3V3 | VDD |
| GND | VSS |
| D2 / GPIO4 | SDA |
| D1 / GPIO5 | SCL |
| 3V3 über 10 kΩ | RESET |
| GND | A0, A1 und A2 |

Mit A0–A2 auf GND verwendet die Firmware die Adresse `0x20`. SDA und SCL benötigen Pull-ups nach 3,3 V; viele fertige MCP23017-Module haben diese bereits bestückt.

Der BME280 teilt sich den I²C-Bus: `VIN/VCC → 3V3`, `GND → GND`, `SDA → D2`, `SCL → D1`. Die Firmware erwartet standardmäßig `0x76`.

## Relaisboard – bestätigte Eingangsschaltung

Das vorhandene 16-Kanal-Board ist LOW-triggered und hat optogekoppelte Eingänge, die offen ungefähr 5 V führen:

- `INx → GND` = Relais EIN
- `INx offen` = Relais AUS
- der MCP23017 läuft mit 3,3 V

Darum werden die Relais **nicht** mit normalem HIGH/LOW angesteuert. Die Firmware verwendet den MCP23017 als Open-Drain-artigen Stromsenker:

- Relais EIN: MCP-Pin wird `OUTPUT`, sein OLAT bleibt `LOW` → INx wird auf GND gezogen.
- Relais AUS: MCP-Pin wird `INPUT` → hochohmig; das Relayboard zieht INx intern wieder auf ca. 5 V.

So treibt der 3,3-V-MCP niemals aktiv gegen die 5-V-Eingangsschaltung des Relayboards.

## Relaiskanäle

| MCP23017 | Relaisboard |
| --- | --- |
| GPA0–GPA7 | IN1–IN8 |
| GPB0–GPB7 | IN9–IN16 |

**Gemeinsame Masse:** GND von ESP8266/MCP23017 und GND des Relayboards müssen verbunden sein.

Die Optokoppler auf dem Relayboard **nicht brücken**. Die auf dem Relayboard vorhandenen ULN2803 bleiben ebenfalls unverändert.

## Sensoreingänge am NodeMCU

| Sensor | NodeMCU | GPIO | Hinweis |
| --- | --- | ---: | --- |
| S1 | D5 | 14 | boot-sicher, interner Pull-up |
| S2 | D6 | 12 | boot-sicher, interner Pull-up |
| S3 | D7 | 13 | boot-sicher, interner Pull-up |

Die Sensoren schalten jeweils gegen GND. D3/GPIO0, D4/GPIO2 und D8/GPIO15 werden wegen der Boot-Straps nicht verwendet. RX/TX bleiben für Diagnoseausgaben frei; D0/GPIO16 bleibt Reserve.

## Erwartetes Verhalten

Beim Start setzt die Firmware zuerst `OLATA/OLATB = 0x00` und anschließend `IODIRA/IODIRB = 0xFF`. Damit sind alle 16 Relais AUS. Ein eingeschalteter Kanal bekommt im zugehörigen IODIR-Register eine `0` und zieht dadurch den Eingang auf GND.

Im seriellen Monitor erscheinen Schaltvorgänge beispielsweise als:

```text
[MCP] Kanal 1 EIN · IODIR=0xFFFE
[MCP] Kanal 1 AUS · IODIR=0xFFFF
```

Der MCP23017 muss beim Start an `0x20` gefunden werden.
