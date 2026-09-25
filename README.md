# DynoraStation

Webbasiertes **Analog-Stellwerk für Märklin H0 M-Gleis**. DynoraStation verbindet einen Gleisplan mit ESP8266-Modulen, Relais, Rückmeldern, Signalen und Ereignisregeln.

# Dokumentation

| Datei | Inhalt |
| --- | --- |
| [INSTALLATION.md](INSTALLATION.md) | Installation unter Linux und Windows |
| [CONFIGURATION.md](CONFIGURATION.md) | `.env`, Ports, Discovery, CORS und Limits |
| [OPERATIONS.md](OPERATIONS.md) | Start, Stop, Neustart, Update, Backups und Logs |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Aufbau von Backend, Frontend, Persistenz und ESP-Kommunikation |
| [API.md](API.md) | HTTP-Endpunkte und Modulprotokoll |
| [HARDWARE.md](HARDWARE.md) | ESP8266-Firmware, Relais, Sensoren und Signale |
| [SECURITY.md](SECURITY.md) | Sicherheitsmodell und empfohlener Betrieb |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Diagnose typischer Fehler |
| [DEVELOPMENT.md](DEVELOPMENT.md) | Lokales Setup, Tests und Code-Struktur |
| [RELEASES.md](RELEASES.md) | Trennung zwischen `main` und Release-only Installern |


## Installation

Die Installer werden bewusst **nicht im `main`-Branch gespeichert**. Ein GitHub Release enthält ausschließlich diese zwei Dateien:

- `DynoraStation-Linux.sh`
- `DynoraStation-Windows.cmd`

Die Installer sind nur der Bootstrap für Installation, Update und Deinstallation. Den eigentlichen DynoraStation-Projektstand laden sie immer direkt aus dem Branch `main` von `DarkNinja-Lab/DynoraStation`.

GitHub Releases: `https://github.com/DarkNinja-Lab/DynoraStation/releases`

### Linux / Raspberry Pi

`DynoraStation-Linux.sh` aus einem GitHub Release herunterladen und starten:

```bash
chmod +x DynoraStation-Linux.sh
sudo ./DynoraStation-Linux.sh
```

Ohne Parameter erkennt der Installer zuerst den Installationsstatus. Ist DynoraStation noch nicht installiert, werden nur **Installieren** und **Abbrechen** angeboten. Bei einer vorhandenen Installation erscheinen **Aktualisieren**, **Reparieren / darüber installieren**, **Deinstallieren** und **Abbrechen**.

Direkte Aktionen:

```bash
sudo ./DynoraStation-Linux.sh install
sudo ./DynoraStation-Linux.sh update
sudo ./DynoraStation-Linux.sh update --check
sudo ./DynoraStation-Linux.sh uninstall
sudo ./DynoraStation-Linux.sh uninstall --purge
```

Für Installation und Update lädt der Installer den aktuellen `main`-Stand als GitHub-Tarball. Eine vorhandene `.env` und `data/` bleiben bei normalen Installationen und Updates erhalten.

Nach der Installation wird eine lokale Kopie des Linux-Installers als System-Manager unter `/usr/local/lib/dynorastation/` abgelegt. Dadurch funktionieren weiterhin:

```bash
sudo dynora-update
sudo dynora-update --check
sudo dynora-uninstall
sudo dynora-uninstall --purge
```

Der Updater vergleicht den heruntergeladenen `main`-Snapshot mit dem zuletzt installierten Snapshot, erstellt vor Änderungen ein Backup, führt Tests und einen Healthcheck aus und rollt bei Fehlern auf die vorherige Programmversion zurück.

Der lokale Linux-System-Manager aktualisiert sich dabei bewusst nicht aus `main`. Wenn sich die Installer-Logik selbst ändert, den neuen `DynoraStation-Linux.sh` aus dem nächsten GitHub Release einmal manuell ausführen; dadurch wird die lokale Manager-Kopie ersetzt.

### Windows 10 / 11

`DynoraStation-Windows.cmd` aus einem GitHub Release herunterladen und per Doppelklick starten. Auch unter Windows erkennt das Menü den Installationsstatus: ohne Installation gibt es **Installieren / Abbrechen**, mit vorhandener Installation **Aktualisieren**, **Reparieren / darüber installieren**, **Deinstallieren** und **Abbrechen**.

Alternativ in `cmd.exe`:

```bat
DynoraStation-Windows.cmd install
DynoraStation-Windows.cmd update
DynoraStation-Windows.cmd update --check
DynoraStation-Windows.cmd uninstall
DynoraStation-Windows.cmd uninstall --purge
```

Der Windows-Installer ist eine einzelne `.cmd`-Datei mit eingebetteter PowerShell-Logik. Installation und Update laden den aktuellen `main`-Stand als GitHub-ZIP. Eine vorhandene `.env` und `data/` werden nicht überschrieben. Vor Änderungen wird ein Backup erstellt; bei einem fehlgeschlagenen Update wird ein Rollback versucht.

## GitHub Releases

Releases werden bewusst manuell gepflegt. Pro Release werden **nur** diese beiden Assets hochgeladen:

```text
DynoraStation-Linux.sh
DynoraStation-Windows.cmd
```

Es gibt keine Runtime-Archive, keine `SHA256SUMS.txt` und keinen automatischen Release-Build im `main`-Branch. Der Anwendungscode kommt immer aus:

```text
https://github.com/DarkNinja-Lab/DynoraStation/tree/main
```

Damit sind Installer-Version und Anwendungscode voneinander getrennt: Änderungen am Projekt werden über `main` verteilt, Änderungen an der Installationslogik über ein neues GitHub Release der beiden Installer.

## Entwicklung

```bash
npm install
cp .env.example .env
npm start
```

Unter Windows entspricht `copy .env.example .env` dem zweiten Schritt. Tests:

```bash
npm test
```

## Was kann DynoraStation?

- Gleisbild planen und im Betrieb als Stellwerk verwenden
- Weichen, Signale, Gleisstrom und Lichtausgänge schalten
- Rückmelder/Sensoren live anzeigen
- ESP8266-Module automatisch erkennen und verwalten
- Grundstellungen und Wenn-Dann-Ereignisse konfigurieren
- Anlagenplan als PDF exportieren
- Bedienung auf Desktop, Tablet und Smartphone

## Hardware

DynoraStation ist auf klassische analoge Märklin-M-Gleis-Anlagen ausgelegt. ESP8266-Module übernehmen die Verbindung zu Relais, Sensoren und LED-/Signalausgängen. Die Weboberfläche ist das zentrale Stellwerk; die Anlage bleibt elektrisch weiterhin eine analoge Anlage.

Die vollständige technische Einrichtung, Installer-Architektur, Umgebungsvariablen, Diagnose und Sicherheitsdetails stehen in [TECHNICAL.md](TECHNICAL.md).

## Projektstruktur

```text
public/              Weboberfläche
public/app/          Frontend-Module
src/                 Express-Backend
esp8266_code/        Firmware und Hardware-Hinweise
test/                Smoke-, Safety- und Strukturtests
.github/              GitHub-Konfiguration; keine Release-Build-Pipeline
```

Die Release-only Installer sind absichtlich kein Bestandteil dieser Struktur.

## Lizenz

Siehe [LICENSE](LICENSE).
