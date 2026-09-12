# DynoraStation

Webbasierte Steuerzentrale für eine H0-Modellbahn mit mehreren ESP8266-Modulen. DynoraStation kombiniert Gleisbild-Editor, Live-Betrieb, Hardwareverwaltung und Wenn-Dann-Automationen.

> Status: Das Projekt befindet sich in aktiver Entwicklung. Relaislogik, Pins, Versorgung und NOT-AUS zuerst ohne Fahrzeuge testen.

## Funktionen

- Übersicht mit Server-, Modul-, Relais- und Anlagenstatus
- Visueller Gleisbild-Editor mit Raster, Snap, Verbindungen, Zoom und Undo/Redo
- Märklin-M-Gleiskatalog mit Geraden, Kurven, Weichen und Kreuzungsweiche
- Direktsteuerung für Gleise, Licht, Weichen und Signale
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

## Konfiguration mit `.env`

Die Datei `.env` wird beim Start durch `dotenv` geladen und überschreibt die Standardwerte aus `src/config/env.js`. Ohne Datei läuft der Server mit eingebauten Defaults. Für den Anlagenbetrieb ist eine eigene `.env` trotzdem sinnvoll.

`.env.example` dient als Vorlage. `SERVER_IP` ist die LAN-Adresse des Server-Rechners und muss zu `SERVER_HOST` in den ESP-Firmwares passen. Eine echte `.env` sollte nicht eingecheckt werden.

| Variable | Standard | Zweck |
| --- | ---: | --- |
| `SERVER_PORT` | `8181` | HTTP-Port |
| `MODULE_TIMEOUT` | `10000` | Zeit bis ein ESP als offline gilt |
| `UI_STATUS_INTERVAL_MS` | `400` | Live-UI-Takt; Minimum 250 ms |
| `JSON_LIMIT` | `2mb` | Maximale JSON-Nutzlast |
| `RL_GLOBAL_MAX` | `160` | Globales Request-Limit je Zeitfenster |
| `RL_MODULE_MAX` | `80` | Request-Limit der Modul-API |
| `ENABLE_DEBUG_ENDPOINTS` | `false` | Debug-Routen aktivieren |

## ESP8266 einrichten

Die Firmware liegt unter `esp8266_code/`:

- `relays_und_sensoren.ino` für Relais und Rückmelder
- `led_signalleuchten.ino` für LED- und Signalmasten

Vor dem Flashen WLAN, `SERVER_HOST`, `SERVER_PORT`, `MODULE_ID`, Pinbelegung und aktive Logik anpassen. Jedes Modul benötigt eine eindeutige `MODULE_ID`.

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

