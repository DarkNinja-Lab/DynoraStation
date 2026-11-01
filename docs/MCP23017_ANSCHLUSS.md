# Zwei MCP23017 und Relaisboards

Die Standardfirmware `relays_und_sensoren.ino` steuert 24 Relais ueber zwei MCP23017 am selben I2C-Bus. MCP `0x20` versorgt Kanaele 1 bis 16; MCP `0x21` versorgt Kanaele 17 bis 24 ueber GPA0 bis GPA7. GPB am zweiten MCP bleibt unbelegt. Varianten mit einem MCP sowie 8, 16 oder 32 Relais sind in [`HARDWARE.md`](HARDWARE.md#relais--und-sensorvarianten) beschrieben.

## NodeMCU, MCPs und BME280

| Signal | Anschluss |
| --- | --- |
| Versorgung | Beide MCPs und BME280 an 3V3 und GND |
| SDA | Beide MCPs und BME280 parallel an D2 / GPIO4 |
| SCL | Beide MCPs und BME280 parallel an D1 / GPIO5 |
| RESET | Beide MCPs an 3V3 (empfohlen mit 10 kOhm Pull-up) |
| MCP 1 Adresse | A0, A1, A2 an GND = `0x20` |
| MCP 2 Adresse | A0 an 3V3, A1 und A2 an GND = `0x21` |
| BME280 Adresse | Standardmaessig `0x76` |

SDA und SCL benoetigen Pull-ups nach 3,3 V. Viele MCP-Module haben diese bereits bestueckt. Zusaetzliche Pull-ups nur setzen, wenn der Bus sie benoetigt.

## Relaiskanaele

| MCP-Ausgaenge | Relaiskanaele |
| --- | --- |
| `0x20` GPA0 bis GPA7 | 1 bis 8 |
| `0x20` GPB0 bis GPB7 | 9 bis 16 |
| `0x21` GPA0 bis GPA7 | 17 bis 24 |

Die Firmware erwartet LOW-triggered Eingaenge: `INx` gegen GND schaltet EIN; offen bedeutet AUS. Die MCP-Pins arbeiten Open-Drain-artig: EIN ist OUTPUT LOW, AUS ist INPUT/hochohmig. MCP23017 und Relaisboard-Eingangsseite benoetigen eine gemeinsame Masse. Relaisspulen niemals direkt am MCP betreiben.

## Sensoren

| Sensor | NodeMCU | GPIO | Beschaltung |
| --- | --- | ---: | --- |
| S1 | D5 | 14 | Schalter/Sensor gegen GND, interner Pull-up |
| S2 | D6 | 12 | Schalter/Sensor gegen GND, interner Pull-up |
| S3 | D7 | 13 | Schalter/Sensor gegen GND, interner Pull-up |

D3/GPIO0, D4/GPIO2 und D8/GPIO15 bleiben wegen der Boot-Straps frei. RX/TX bleiben fuer die serielle Diagnose frei.

## Startverhalten und Inbetriebnahme

Beim Start setzt die Firmware beide MCPs auf sichere AUS-Zustaende (OLAT LOW, IODIR INPUT). Beide MCPs muessen erreichbar sein, damit das Modul die Relais als schaltbereit meldet.

1. Versorgung und Adresspins kontrollieren.
2. Mit einem I2C-Scanner die Adressen `0x20`, `0x21` und `0x76` pruefen.
3. Relais einzeln ohne angeschlossene Anlagenlast testen.
4. Verbraucher erst danach anschliessen.

Das Relaisboard kann eine eigene 5-V-Versorgung benoetigen. ESP8266-GPIOs und MCP-Ausgaenge sind nicht fuer Lampen- oder Relaisspulenlasten ausgelegt.
