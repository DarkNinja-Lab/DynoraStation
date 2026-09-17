# DynoraStation

Webbasierte Steuerzentrale für eine H0-Modellbahn mit mehreren ESP8266-Modulen. DynoraStation kombiniert Gleisbild-Editor, Live-Betrieb, Hardwareverwaltung und Wenn-Dann-Automationen.

Aktuelle Version: **1.7.2**. Das präzisere Magnet-Andocken verwendet nur freie Gleisanschlüsse, aktive gerade und gebogene Gleise leuchten klar grün, der PDF-Export arbeitet ohne ungültige SVG-Höhe oder mehrfach gebundene Popups und das Brassworks-Design besitzt einen vollständig neu aufgebauten Markenbereich.

## Eigenes Dynora-Logo einsetzen

Die Logo-Dateien liegen unter `public/assets/brand/`. Das mitgelieferte Zeichen ist ein Platzhalter und kann direkt ersetzt werden. Verwende dabei diese Dateinamen:

| Datei | Verwendung |
| --- | --- |
| `dynora-logo.svg` | skalierbare Masterdatei / Platzhalter |
| `dynora-logo-32.png` | Browser-Favicon |
| `dynora-logo-180.png` | iPhone-/iPad-Startbildschirm |
| `dynora-logo-192.png` | Android-/Web-App-Icon |
| `dynora-logo-512.png` | Logo in der Oberfläche und hochauflösendes Web-App-Icon |

Für das beste Ergebnis sollte das Logo quadratisch sein, einen transparenten Hintergrund besitzen und bis zum Rand etwas Luft lassen. Nach dem Ersetzen den Browser-Cache einmal vollständig neu laden.

> Status: Das Projekt befindet sich in aktiver Entwicklung. Relaislogik, Pins, Versorgung und NOT-AUS zuerst ohne Fahrzeuge testen.

## Funktionen

- Professionelle Betriebsübersicht im Industrial-/Steampunk-Design mit DB-roten Akzenten
- Visueller Gleisbild-Editor mit physischem Millimeter-Raster, magnetischen Gleisenden, Zoom und Undo/Redo
- Märklin-M-Gleiskatalog mit Geraden, Kurven, Weichen und Kreuzungsweiche
- Weichen 5118 (links), 5119 (rechts), 5141 (Bogenweiche links) und Prellbock 5129
- Frei konfigurierbare Anlagenplatte mit Breite, Tiefe und 10/25/50/90/180-mm-Raster
- Druckoptimierter PDF-Bauplan mit Artikelnummern, Stückliste und Montagekoordinaten
- Mobile Bedienoberfläche für iPhone/Android mit Drawer, unterer Schnellnavigation und Touch-Builder
- Direktsteuerung für Gleise, Licht, Weichen und zwei- oder dreibegriffige ESP-Signalmasten
- Rote Belegtmeldung im Gleisbild bei ausgelöstem, zugewiesenem Sensor
- Verwaltung mehrerer ESP-Module, Relais, Sensoren und LED-Kanäle
- Grundstellungen für den Betriebsstart
- Wenn-Dann-Automationen für Sensoren, Relais, LEDs, Weichen und Signale
- Persistenz von Layout, Hardwarekonfiguration und Regeln unter `data/`

## Voraussetzungen

- Node.js 18 oder neuer
- npm 8.3 oder neuer für `overrides`
- Webserver und ESP-Module in einem erreichbaren Netzwerk
- ArduinoJson und ESP8266-Bibliotheken für die Firmware

## Installation

```bash
npm install
cp .env.example .env
npm start
```

Danach ist die Oberfläche standardmäßig unter `http://<SERVER_IP>:8181` erreichbar.

Wichtig: `npm install` verwenden, nicht nur `npm install express`. Nur so wird der vollständige Abhängigkeitsbaum installiert und aktualisiert.

## Kurztest

```bash
npm test
```

Der Ordner `test/` enthält automatische Smoke- und Integrationstests. `npm test` prüft die wichtigsten UI-/API-Routen, sämtliche Gleisbilder, persistente Relais-/Sensor-/Lichtnamen, beide ESP-Signalmasttypen, die M-Gleis-Geometrie, ESP-Umbenennungen sowie den vollständigen Not-Aus-Ablauf. Der Ordner wird nur für die Qualitätskontrolle verwendet und nicht vom laufenden Webserver benötigt.

## Konfiguration mit `.env`

Die Datei `.env` wird beim Start durch `dotenv` geladen und überschreibt die Standardwerte aus `src/config/env.js`. Ohne Datei läuft der Server mit eingebauten Defaults. Für den Anlagenbetrieb ist eine eigene `.env` trotzdem sinnvoll.

`.env.example` dient als Vorlage. `SERVER_IP` ist die LAN-Adresse des Server-Rechners und muss zu `SERVER_HOST` in den ESP-Firmwares passen. Eine echte `.env` sollte nicht eingecheckt werden.

| Variable | Standard | Zweck |
| --- | ---: | --- |
| `SERVER_PORT` | `8181` | HTTP-Port |
| `MODULE_TIMEOUT` | `10000` | Zeit bis ein ESP als offline gilt |
| `UI_STATUS_INTERVAL_MS` | `400` | Live-UI-Takt; Minimum 250 ms |
| `JSON_LIMIT` | `2mb` | Maximale JSON-Nutzlast |
| `REQUEST_LOGGING` | `true` | Zeigt relevante API-Aufrufe im Terminal von `npm start` |
| `RL_GLOBAL_MAX` | `160` | Globales Request-Limit je Zeitfenster |
| `RL_MODULE_MAX` | `80` | Request-Limit der Modul-API |
| `ENABLE_DEBUG_ENDPOINTS` | `false` | Debug-Routen aktivieren |

## ESP8266 einrichten

Die Firmware liegt unter `esp8266_code/`:

- `relays_und_sensoren.ino` wahlweise für 16 Relais über MCP23017 oder vier direkt angeschlossene Relais sowie zwei Rückmelder
- `led_signalleuchten.ino` für LED- und Signalmasten

Vor dem Flashen WLAN, `SERVER_HOST`, `SERVER_PORT`, `MODULE_NAME`, Pinbelegung und aktive Logik anpassen. Die technische Modul-ID wird automatisch aus der eindeutigen ESP8266-Chip-ID erzeugt. Der Anzeigename kann später unter **Einstellungen → ESP-Module** beliebig geändert werden; Relais-, Sensor-, Gleisbild- und Regelzuordnungen bleiben dabei erhalten.

### MCP23017 und 16-Kanal-Relaisboard

Die Relais-Firmware verwendet den MCP23017 direkt über `Wire`; eine zusätzliche MCP-Bibliothek ist nicht erforderlich. Standardmäßig gilt Adresse `0x20` und aktiv-LOW-Logik.

| NodeMCU | MCP23017 |
| --- | --- |
| 3V3 | VDD und RESET über 10-kΩ-Pull-up |
| GND | VSS sowie A0, A1 und A2 |
| D2 / GPIO4 | SDA |
| D1 / GPIO5 | SCL |

`GPA0` bis `GPA7` steuern Relais 1–8, `GPB0` bis `GPB7` Relais 9–16. Die Ausgänge dürfen nur an die Logikeingänge eines Relaisboards mit eigener Treiberstufe angeschlossen werden, niemals direkt an Relaisspulen. Falls das verwendete Board aktiv-HIGH schaltet, in `relays_und_sensoren.ino` den Wert `RELAY_ACTIVE_LOW` auf `false` setzen.

### Relaisboard direkt am ESP8266

Im gleichen Sketch kann ohne MCP23017 gearbeitet werden:

```cpp
const bool USE_MCP23017 = false;
```

Standardmäßig werden dann vier Relais über `D1`, `D2`, `D5` und `D6` gesteuert. Die vom ESP gemeldete Kanalzahl passt sich automatisch an; am Webserver ist keine weitere Umstellung nötig. Das Relaisboard braucht weiterhin eine passende eigene Versorgung und eine gemeinsame Masse mit dem NodeMCU.

### Not-Aus und Live-Synchronisierung

Der Not-Aus löscht zuerst alle älteren wartenden Schaltbefehle, setzt sämtliche Live-Zustände auf AUS und sendet anschließend mit höchster Priorität `NOT_AUS` an jedes bekannte ESP-Modul. Offene Browser aktualisieren die Bedienoberfläche automatisch über den Live-Status. Änderungen vom Smartphone erscheinen damit auch am PC und umgekehrt. Die Direktsteuerung wird nur noch neu aufgebaut, wenn sich tatsächlich ein Zustand ändert; dadurch bleibt Hover und Touch stabil.

### Terminal-Logging

Bei `npm start` erscheinen Startmeldung, ESP-Verbindungen, Steuerbefehle, Fehlerstatus und Laufzeiten im Terminal. Häufiges Status- und ESP-Polling wird ausgeblendet, damit das Log lesbar bleibt. Mit `REQUEST_LOGGING=false` kann das HTTP-Logging deaktiviert werden.

Optimierte Standardtakte:

- Befehle vom Server: 100 ms
- Sensor-Scan: 10 ms
- Sensor-Entprellung: 30 ms
- Heartbeat: 2 Sekunden
- Browserstatus: 400 ms

Damit reagiert die Oberfläche typischerweise deutlich unter einer Sekunde. Schlechte WLAN-Verbindung, blockierende HTTP-Aufrufe und prellende Kontakte können weiterhin bremsen.

## Sensor einem Gleis zuweisen

1. Im Gleisbild-Editor das Element auswählen.
2. Zuständiges ESP-Modul auswählen.
3. Unter „Sensor (Zugdetection)“ den Rückmelder zuweisen.
4. Gleisbild speichern.

Bei Auslösung leuchtet das Element im Betriebs-Gleisbild rot und erhält die Kennzeichnung „BELEGT“. Die Weichenlage bleibt separat amberfarben markiert.

## Anlagenplatte und PDF-Bauplan

Im **Builder → Ansicht → Anlagenplatte** Breite und Tiefe der realen Platte in Millimetern eintragen. Das Raster kann auf 25, 50 oder 100 mm gesetzt werden. Intern wird der Plan im Verhältnis `1 SVG-Einheit = 2 mm` geführt; vorhandene Märklin-Geometrien werden passend dazu dargestellt.

Über **PDF / Bauplan** öffnet DynoraStation eine druckoptimierte Ansicht. Diese enthält:

- den vollständigen Gleisplan mit Artikelnummern,
- eine nach Artikelnummer gruppierte Stückliste,
- X-/Y-Montagepositionen ab der linken oberen Plattenkante,
- Drehwinkel für jedes platzierte Element.

Im Browser anschließend **Als PDF speichern** wählen. Der gezeichnete Plan wird auf die Seite skaliert; für den realen Aufbau sind die Millimeterkoordinaten maßgeblich.

## Bedienung auf Smartphone und Tablet

Auf kleinen Displays steht unten eine feste Schnellnavigation für Start, Gleisbild, Builder und Einstellungen bereit. **Mehr** öffnet die vollständige Navigation mit Regeln und Ereignissen.

Der Builder ist mobil in drei Bereiche aufgeteilt:

- **Plan** für Verschieben, Zoomen und Verbinden,
- **Bauteile** für Katalog und Werkzeuge,
- **Eigenschaften** für das ausgewählte Element.

Für den produktiven Betrieb empfiehlt sich, das Gerät im Querformat zu verwenden. Die Schaltflächen sind trotzdem auch im Hochformat touchgerecht ausgelegt.

## Automationen

Jede Regel folgt einem klaren Ablauf:

1. **WENN:** Typ, Quelle und Zustand wählen.
2. **DANN:** Zieltyp, Ziel und Aktion wählen.
3. Optional den Wiederholschutz einstellen.
4. Änderungen speichern.

Unvollständige Quellen oder Ziele werden markiert. Automationen können einzeln pausiert werden.

## Sicherheitsupdate für `qs`

DynoraStation bleibt auf Express 4. Ein ungeprüfter Major-Wechsel auf Express 5 ist für die Behebung nicht nötig. `package.json` erzwingt stattdessen die gepatchte transitive Version:

```json
"overrides": {
  "qs": "6.16.0"
}
```

Danach lokal ausführen:

```bash
npm install
npm audit
```

Falls ein alter Lockfile-Stand noch `qs@6.15.x` enthält, `npm install` erneut ausführen und den aktualisierten `package-lock.json` einchecken. `npm audit fix --force` ist für diesen Fix nicht erforderlich.

## Projektstruktur

```text
DynoraStation/
├── esp8266_code/          ESP8266-Firmwares
├── public/                Browseroberfläche
│   ├── app/builder/       Editor und SVG-Formen
│   │   └── export.js       PDF-/Druckansicht und Stückliste
│   ├── app/rules/         Automationseditor
│   ├── app/status/        Live-Status
│   ├── app/track/         Betriebs-Gleisbild
│   └── style.css          UI-Design
├── src/                   Backend, API und Persistenz
├── .env.example
├── package.json
└── README.md
```

## Diagnose

### Webserver wird als offline angezeigt

- Server mit `npm start` starten.
- `SERVER_IP` und `SERVER_PORT` prüfen.

### ESP wird als offline angezeigt

- `SERVER_HOST` und `SERVER_PORT` in der Firmware prüfen.
- Firewall, WLAN und serielle Ausgabe kontrollieren.

### Relais oder Sensor reagieren verzögert

- WLAN-Signalstärke und serielle HTTP-Fehler prüfen.
- Keine zu niedrigen Rate-Limits konfigurieren.
- `UI_STATUS_INTERVAL_MS` nicht unter 250 ms setzen.
- Bei unruhigen Sensoren `SENSOR_DEBOUNCE_MS` vorsichtig erhöhen.

## Betriebssicherheit

- Relais zunächst ohne angeschlossene Anlage testen.
- Active-Low/Active-High-Konfiguration prüfen.
- LEDs nur mit Vorwiderstand betreiben.
- Für größere Lasten Treiberstufe, MOSFET oder ULN2803 verwenden.
- Die Softwaretaste NOT-AUS ersetzt keine hardwareseitig sichere Abschaltung.
