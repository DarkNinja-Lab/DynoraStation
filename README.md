# DynoraStation

Webbasiertes **Analog-Stellwerk für Märklin H0 M-Gleis**.
DynoraStation verbindet Gleisplan, ESP8266-Module, Relais, Rückmelder, Signale und Automationen in einer Oberfläche.

## Überblick

- Gleisbild planen und direkt im Betrieb nutzen
- Weichen, Signale, Gleisstrom und Lichtausgänge schalten
- Rückmelder und Modulstatus live beobachten
- Regeln für Sensoren, Weichen und Signale konfigurieren
- Anlagenplan validieren, importieren, exportieren und als PDF drucken
- Bedienung auf Desktop, Tablet und Smartphone

## Schnellstart

```bash
npm install
cp .env.example .env
npm start
```

Unter Windows:

```bat
copy .env.example .env
npm start
```

Tests:

```bash
npm test
```

## Installation mit Installer-Skripten

Die Installer liegen bewusst **nicht im `main`-Branch** und werden getrennt als Release-Assets gepflegt:

- `DynoraStation-Linux.sh`
- `DynoraStation-Windows.cmd`

Sie dienen als Bootstrap für Installation, Update und Deinstallation. Der Anwendungscode kommt immer aus `main`.

## Dokumentation

Die vollständige technische Dokumentation liegt unter [docs/](docs/README.md):

| Datei | Inhalt |
| --- | --- |
| [INSTALLATION.md](docs/INSTALLATION.md) | Installation unter Linux und Windows |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | `.env`, Ports, Discovery, CORS und Limits |
| [OPERATIONS.md](docs/OPERATIONS.md) | Start, Stop, Neustart, Update, Backups und Logs |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Aufbau von Backend, Frontend, Persistenz und ESP-Kommunikation |
| [API.md](docs/API.md) | HTTP-Endpunkte und Modulprotokoll |
| [HARDWARE.md](docs/HARDWARE.md) | ESP8266-Firmware, Relais, Sensoren und Signale |
| [SECURITY.md](docs/SECURITY.md) | Sicherheitsmodell und empfohlener Betrieb |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Diagnose typischer Fehler |
| [DEVELOPMENT.md](docs/DEVELOPMENT.md) | Lokales Setup, Tests und Code-Struktur |
| [BUILDER.md](docs/BUILDER.md) | Bedienung des Gleisplan-Builders |

## Hardware

DynoraStation ist für klassische analoge Märklin-M-Gleis-Anlagen ausgelegt.
ESP8266-Module verbinden Relais, Sensoren und LED-/Signalausgänge mit dem Web-Stellwerk.

## Projektstruktur

```text
public/              Weboberfläche
public/app/          Frontend-Module
src/                 Express-Backend
esp8266_code/        Firmware und Hardware-Hinweise
test/                Smoke-, Safety- und Strukturtests
.github/             GitHub-Konfiguration
```
