# Installation

DynoraStation trennt Anwendungscode und Installer. Der Branch `main` enthält keine Installer-Dateien. Die beiden Installer werden manuell als GitHub-Release-Assets veröffentlicht und laden den aktuellen Stand von `main`.

Repository: `DarkNinja-Lab/DynoraStation`

## Installationsmethoden im Überblick

Es gibt vier Wege, DynoraStation zu installieren – sortiert vom einfachsten zum aufwendigsten. Jede Methode funktioniert unter Windows und Linux.

| # | Methode | Aufwand | Dienst/Autostart | Details |
| --- | --- | --- | --- | --- |
| 1 | One-Liner | sehr gering | ja | [Linux](#1-one-liner-linux) · [Windows](#1-one-liner-windows) |
| 2 | Installer-Dateien | gering | ja | [Linux](#linux) · [Windows](#windows) |
| 3 | Docker | mittel | ja (Container-Neustartrichtlinie) | [Docker](#3-docker-windows--linux) |
| 4 | npm (manuell) | höher | nein | [npm](#4-npm-windows--linux) |

### 1. One-Liner Linux

```bash
curl -fsSL https://github.com/DarkNinja-Lab/DynoraStation/releases/latest/download/DynoraStation-Linux.sh | sudo bash -s -- install
```

### 1. One-Liner Windows

PowerShell (der Installer fordert Administratorrechte an):

```powershell
iwr https://github.com/DarkNinja-Lab/DynoraStation/releases/latest/download/DynoraStation-Windows.cmd -OutFile "$env:TEMP\DynoraStation-Windows.cmd"; Start-Process -Verb RunAs cmd.exe "/c `"$env:TEMP\DynoraStation-Windows.cmd`" install"
```

### 2. Installer-Dateien

`DynoraStation-Linux.sh` bzw. `DynoraStation-Windows.cmd` aus dem GitHub Release herunterladen und starten. Optionen, Standardwerte und direkte Aktionen stehen in den Abschnitten [Linux](#linux) und [Windows](#windows) weiter unten.

### 3. Docker (Windows / Linux)

Voraussetzung: Docker mit Docker Compose (Linux: Docker Engine; Windows: Docker Desktop).

```bash
git clone https://github.com/DarkNinja-Lab/DynoraStation.git
cd DynoraStation
docker compose up -d --build
```

Die Weboberfläche läuft anschließend auf Port `8181`. Wichtige Einstellungen kommen aus Umgebungsvariablen oder einer `.env`-Datei neben `docker-compose.yaml`:

```text
SERVER_PORT=8181
DISCOVERY_PORT=8182
DYNORA_APPDATA=/pfad/zu/den/daten
OTA_SHARED_SECRET=<mindestens 24 Zeichen>
```

`docker-compose.yaml` verwendet `network_mode: host`, damit die UDP-Discovery der ESPs funktioniert. Unter Windows mit Docker Desktop ist Host-Netzwerk eingeschränkt; dort Ports `8181` und `8182/udp` veröffentlichen und ESPs auf die Server-IP einstellen.

Update: `git pull && docker compose up -d --build`. Stoppen: `docker compose down`.

### 4. npm (Windows / Linux)

Voraussetzung: Node.js 18 oder neuer, npm und Git. Es wird kein Dienst und kein Autostart eingerichtet.

```bash
git clone https://github.com/DarkNinja-Lab/DynoraStation.git
cd DynoraStation
npm install
cp .env.example .env    # Windows (cmd.exe): copy .env.example .env
npm start
```

Update: `git pull && npm install`, danach neu starten.

## Voraussetzungen

Für den Betrieb werden Node.js 18 oder neuer und npm benötigt. Die Installer richten fehlende Abhängigkeiten soweit möglich selbst ein.

Linux benötigt `systemd`. Für Downloads wird `curl` oder `wget` verwendet. nginx ist optional.

Windows unterstützt Windows 10/11 und nutzt PowerShell, Aufgabenplanung und Windows-Firewall. `winget` kann für die Node.js-Installation verwendet werden.

## Linux

One-Liner Installation:

```bash
curl -fsSL https://github.com/DarkNinja-Lab/DynoraStation/releases/latest/download/DynoraStation-Linux.sh | sudo bash -s -- install
```

`DynoraStation-Linux.sh` aus dem aktuellen GitHub Release herunterladen:

```bash
chmod +x DynoraStation-Linux.sh
sudo ./DynoraStation-Linux.sh
```

Ohne Argument erkennt der Installer den vorhandenen Installationsstatus.

Bei einer neuen Installation stehen nur `Installieren` und `Abbrechen` zur Auswahl. Bei einer vorhandenen Installation werden `Aktualisieren`, `Reparieren / darüber installieren`, `Deinstallieren` und `Abbrechen` angeboten.

Standardwerte:

```text
Installationspfad: /opt/dynorastation
HTTP-Port:         8181
UDP-Discovery:     8182
Service:           dynorastation
Systembenutzer:    dynorastation
```

Direkte Aktionen:

```bash
sudo ./DynoraStation-Linux.sh install
sudo ./DynoraStation-Linux.sh update
sudo ./DynoraStation-Linux.sh update --check
sudo ./DynoraStation-Linux.sh uninstall
sudo ./DynoraStation-Linux.sh uninstall --purge
```

Wichtige Optionen:

```text
--install-dir PATH
--port PORT
--discovery-port PORT
--with-nginx
--no-nginx
--auto-update
--no-auto-update
--yes
--quiet
--check
--purge
```

Bei einer normalen Installation oder Reparatur bleiben eine vorhandene `.env` und `data/` erhalten. `--purge` entfernt auch Nutzerdaten und Backups.

Nach der Installation legt der Installer eine lokale Manager-Kopie unter `/usr/local/lib/dynorastation/` ab. Dadurch stehen zur Verfügung:

```bash
sudo dynora-update
sudo dynora-update --check
sudo dynora-uninstall
sudo dynora-uninstall --purge
```

Die Installer-Version selbst wird nicht aus `main` aktualisiert. Wenn ein neuer Installer veröffentlicht wird, die neue Release-Datei einmal manuell starten und bei bestehender Installation `Reparieren / darüber installieren` wählen.

## Windows

One-Liner Installation (PowerShell als Administrator):

```powershell
iwr https://github.com/DarkNinja-Lab/DynoraStation/releases/latest/download/DynoraStation-Windows.cmd -OutFile "$env:TEMP\DynoraStation-Windows.cmd"; Start-Process -Verb RunAs cmd.exe "/c `"$env:TEMP\DynoraStation-Windows.cmd`" install"
```

`DynoraStation-Windows.cmd` aus dem GitHub Release herunterladen und als Administrator starten.

Standardpfad:

```text
%ProgramData%\DynoraStation
```

Direkte Aktionen in `cmd.exe`:

```bat
DynoraStation-Windows.cmd install
DynoraStation-Windows.cmd update
DynoraStation-Windows.cmd update --check
DynoraStation-Windows.cmd uninstall
DynoraStation-Windows.cmd uninstall --purge
```

Der Installer enthält seine PowerShell-Logik direkt in der `.cmd`-Datei. Er legt für den Betrieb keine separate Installer-`.ps1` im Projekt ab.

Bei Installation und Update bleiben `.env` und `data\` erhalten. Vor Änderungen an einer bestehenden Installation wird ein Backup erstellt.

Standardmäßig richtet der Installer einen Autostart-Task `DynoraStation` als `SYSTEM` sowie Firewallregeln für HTTP und UDP-Discovery ein. Mit `--no-autostart` kann der Autostart deaktiviert werden.

## Installation aus `main`

Die Installer verwenden für den Anwendungscode ausschließlich `main`. Sie versuchen zuerst, die aktuelle Commit-ID über GitHub zu bestimmen und laden anschließend das Archiv dieses Commits. Falls die Branch-Metadaten nicht verfügbar sind, wird direkt das `main`-Archiv verwendet.

Damit benötigt ein Release keine Runtime-ZIP und keine `SHA256SUMS.txt` für den Anwendungscode.
