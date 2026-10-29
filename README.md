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

Die Sprache lässt sich rechts oben zwischen Deutsch, Englisch, Französisch, Spanisch, Italienisch, Niederländisch, Portugiesisch und Polnisch auswählen. Die Navigation und wichtigsten Status- und Seitenüberschriften sind übersetzt. Noch nicht einzeln übersetzte Oberflächentexte werden auf Englisch angezeigt.

## Installation

DynoraStation lässt sich auf vier Wegen installieren – vom einfachsten bis zum aufwendigsten. Alle Methoden funktionieren unter Windows und Linux (Details und Besonderheiten: [docs/INSTALLATION.md](docs/INSTALLATION.md)).

| # | Methode | Aufwand | Windows | Linux | Geeignet für |
| --- | --- | --- | --- | --- | --- |
| 1 | [One-Liner](#1-one-liner-am-schnellsten) | ⭐ sehr gering | ✅ | ✅ | Schnellster Start, ein einziger Befehl |
| 2 | [Installer-Dateien](#2-installer-dateien) | ⭐⭐ gering | ✅ | ✅ | Installer manuell laden, mit Menü und Update-/Deinstallationsfunktion |
| 3 | [Docker](#3-docker) | ⭐⭐⭐ mittel | ✅ | ✅ | Isolierter Betrieb, z. B. Unraid, NAS oder Server |
| 4 | [npm (manuell)](#4-npm-manuell) | ⭐⭐⭐⭐ höher | ✅ | ✅ | Entwicklung und volle Kontrolle, ohne Dienst/Autostart |

### 1. One-Liner (am schnellsten)

Lädt den Installer aus dem neuesten Release und installiert DynoraStation inklusive Dienst/Autostart.

**Linux:**

```bash
curl -fsSL https://github.com/DarkNinja-Lab/DynoraStation/releases/latest/download/DynoraStation-Linux.sh | sudo bash -s -- install
```

**Windows (PowerShell):**

```powershell
iwr https://github.com/DarkNinja-Lab/DynoraStation/releases/latest/download/DynoraStation-Windows.cmd -OutFile "$env:TEMP\DynoraStation-Windows.cmd"; Start-Process -Verb RunAs cmd.exe "/c `"$env:TEMP\DynoraStation-Windows.cmd`" install"
```

### 2. Installer-Dateien

`DynoraStation-Linux.sh` bzw. `DynoraStation-Windows.cmd` aus dem [neuesten Release](https://github.com/DarkNinja-Lab/DynoraStation/releases/latest) herunterladen und starten. Der Installer erkennt vorhandene Installationen und bietet Installieren, Aktualisieren, Reparieren und Deinstallieren an.

**Linux:**

```bash
chmod +x DynoraStation-Linux.sh
sudo ./DynoraStation-Linux.sh
```

**Windows:** `DynoraStation-Windows.cmd` per Rechtsklick **Als Administrator ausführen** starten.

Die Installer liegen bewusst **nicht im `main`-Branch**, sondern werden als Release-Assets gepflegt. Der Anwendungscode kommt immer aus `main`.

### 3. Docker

Benötigt Docker mit Docker Compose. Das Image enthält Node.js und die Werkzeuge für den ESP-Firmware-Build.

```bash
git clone https://github.com/DarkNinja-Lab/DynoraStation.git
cd DynoraStation
docker compose up -d --build
```

Die Weboberfläche ist danach unter `http://<server-ip>:8181` erreichbar. Daten liegen im Volume `DYNORA_APPDATA` (Standard: `/mnt/user/appdata/dynora_station/data`); den Pfad per `.env` oder Umgebungsvariable anpassen.

Hinweis: Die Compose-Datei nutzt `network_mode: host` für die UDP-Discovery der ESPs. Falls Docker Desktop Host-Netzwerk nicht unterstützt, `network_mode: host` entfernen und TCP `8181` sowie UDP `8182` veröffentlichen. UDP-Broadcast kann blockiert sein; dann die Server-IP in der ESP-Firmware als `SERVER_HOST` eintragen.

### 4. npm (manuell)

Benötigt Node.js 18 oder neuer, npm und Git bzw. das Repository-Archiv. Kein Dienst, kein Autostart – DynoraStation läuft im Vordergrund.

**Linux:**

```bash
git clone https://github.com/DarkNinja-Lab/DynoraStation.git
cd DynoraStation
npm install
cp .env.example .env
npm start
```

**Windows (`cmd.exe`):**

```bat
git clone https://github.com/DarkNinja-Lab/DynoraStation.git
cd DynoraStation
npm install
copy .env.example .env
npm start
```

Tests: `npm test`

## Dokumentation

Die vollständige technische Dokumentation liegt unter [docs/](docs/README.md):

| Datei | Inhalt |
| --- | --- |
| [INSTALLATION.md](docs/INSTALLATION.md) | Die vier Installationsmethoden (One-Liner, Installer, Docker, npm) unter Linux und Windows |
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
