# Architektur

DynoraStation besteht aus drei Bereichen: Weboberfläche, Node.js-Backend und ESP8266-Module.

```text
Browser
   |
   | HTTP / JSON
   v
Node.js + Express
   |            \
   |             \ UDP Discovery
   | HTTP          \
   v                v
ESP8266-Module <--- LAN
   |
   +-- Relais / MCP23017
   +-- Sensoren
   +-- LEDs / Signale
```

## Backend

Einstiegspunkt ist `src/server.js`. Beim Start wird der Runtime-Kontext aufgebaut, Express konfiguriert und anschließend der HTTP-Server sowie optional UDP-Discovery gestartet.

Wichtige Verzeichnisse:

```text
src/app/          Express-Konfiguration und Middleware
src/bootstrap/    Runtime-Aufbau und Serverstart
src/config/       Umgebungsvariablen
src/domain/       Layout-, Hardware- und Regel-Logik
src/routes/       HTTP-API
src/services/     Command Queue, Module, Discovery, Storage, Events
src/state/        zentraler Laufzeitzustand
src/utils/        Parsing, Validierung und Fehlerhilfen
```

## Runtime State

Der Server hält Layout, Hardwarezustand, Regeln, Module, Command Queue und Events im Speicher. Persistiert werden drei JSON-Dateien:

```text
data/layout.json
data/hardware.json
data/rules.json
```

Schreibvorgänge laufen über einen queued writer. Pro Datentyp wird in eine temporäre Datei geschrieben und anschließend per Rename ersetzt. Mehrere kurz hintereinander ausgelöste Writes werden zusammengeführt.

## Modulkommunikation

ESP8266-Module senden regelmäßig einen Heartbeat an `/api/module/heartbeat`. Dabei melden sie Identität, Firmware-/Protokollversion, Fähigkeiten und aktuelle Zustände.

Befehle werden serverseitig in einer Queue angelegt. Ein Modul erhält den nächsten Befehl entweder über `/api/module/next-command` oder direkt in der Heartbeat-Antwort. Nach Ausführung bestätigt das Modul den Befehl über `/api/module/ack`.

Zustände werden erst nach erfolgreicher Bestätigung als bestätigt übernommen. Dadurch kann die Oberfläche zwischen gewünschtem und tatsächlich bestätigtem Zustand unterscheiden.

## UDP-Discovery

Wenn `ENABLE_UDP_DISCOVERY=true` ist, lauscht der Server auf `DISCOVERY_PORT` nach:

```text
DYNORA_DISCOVER_V1
```

Die Antwort enthält HTTP-Port und Protokollversion:

```text
DYNORA_STATION_V1|<port>|<protocolVersion>
```

Die ESP-Firmware kann damit den Server im lokalen Netz finden und nutzt `SERVER_HOST` nur als Fallback.

## Frontend

Die Oberfläche liegt unter `public/` und wird direkt von Express ausgeliefert. Das Frontend ist in ES-Module unter `public/app/` aufgeteilt.

```text
public/app/builder/   Gleisplaner und Export
public/app/catalog/   Gleiskatalog
public/app/core/      API, State und Utilities
public/app/layout/    Layoutlogik
public/app/rules/     Regel-UI
public/app/status/    Status-Synchronisierung
public/app/track/     Betriebslogik für Gleis/Licht
public/app/ui/        Rendering, Events und Toasts
```

Die Weboberfläche fragt `/api/status` regelmäßig ab. Revisionen für Layout und Events verhindern, dass unveränderte größere Datenblöcke bei jedem Poll erneut übertragen werden.

## Layout und Hardware

Das Layout beschreibt die sichtbaren Anlagenobjekte und deren Zuordnung zu Hardwarekanälen. Hardwaredaten enthalten erkannte Module, Relais, LEDs, Sensoren, Lichtbuttons und Grundstellungen.

Beim Laden werden die Daten normalisiert. Ungültige oder doppelte Einträge werden begrenzt beziehungsweise verworfen. Die Layout-Schema-Version ist derzeit `32`.

## Regeln

Regeln werden separat in `data/rules.json` gespeichert. Sensor- und bestätigte Hardwareereignisse können Regeln auslösen. Die Regel-Engine erzeugt daraus normale Queue-Befehle; sie umgeht den regulären Hardwarepfad nicht.
