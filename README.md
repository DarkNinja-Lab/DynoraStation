# DynoraStation

Webbasiertes **Analog-Stellwerk für Märklin H0 M-Gleis**. DynoraStation verbindet einen Gleisplan mit ESP8266-Modulen, Relais, Rückmeldern, Signalen und Ereignisregeln.

## Installation

Für Installation, Update und Deinstallation gibt es genau zwei Installer im Ordner `installer/`. Es existieren keine zusätzlichen `install.sh`, `update.sh`, `uninstall.sh` oder `install.ps1` im Projekt.

### Linux / Raspberry Pi

`DynoraStation-Linux.sh` herunterladen und starten:

```bash
chmod +x DynoraStation-Linux.sh
./DynoraStation-Linux.sh
```

Ohne Parameter erkennt der Installer zuerst den Installationsstatus. Ist DynoraStation noch nicht installiert, werden nur **Installieren** und **Abbrechen** angeboten. Bei einer vorhandenen Installation erscheinen **Aktualisieren**, **Reparieren / darüber installieren**, **Deinstallieren** und **Abbrechen**. Direkt geht es ebenfalls:

```bash
./DynoraStation-Linux.sh install
./DynoraStation-Linux.sh update
./DynoraStation-Linux.sh uninstall
./DynoraStation-Linux.sh uninstall --purge
```

Der Installer enthält die komplette Linux-Logik selbst. Er lädt das aktuelle `dynorastation-linux.tar.gz`, prüft das Runtime-Archiv und den aktuellen Linux-Installer gegen `SHA256SUMS.txt` und installiert anschließend direkt aus dem Runtime-Paket. Eine vorhandene `.env` und `data/` bleiben bei normaler Installation und Update erhalten.

Nach der Installation wird derselbe Installer als System-Manager unter `/usr/local/lib/dynorastation/` abgelegt. Dadurch funktionieren weiterhin:

```bash
sudo dynora-update
sudo dynora-update --check
sudo dynora-uninstall
sudo dynora-uninstall --purge
```

Der Updater erstellt vor Änderungen ein Backup, führt Syntaxchecks, Tests und einen Healthcheck aus und rollt bei einem Fehler auf die vorherige Programmversion zurück. Bei einem erfolgreichen Update wird auch der installierte System-Manager auf die aktuelle Installer-Version gebracht.

### Windows 10 / 11

`DynoraStation-Windows.cmd` herunterladen und per Doppelklick starten. Auch unter Windows erkennt das Menü den Installationsstatus: ohne Installation gibt es **Installieren / Abbrechen**, mit vorhandener Installation **Aktualisieren**, **Reparieren / darüber installieren**, **Deinstallieren** und **Abbrechen**. Alternativ in `cmd.exe`:

```bat
DynoraStation-Windows.cmd install
DynoraStation-Windows.cmd update
DynoraStation-Windows.cmd uninstall
DynoraStation-Windows.cmd uninstall --purge
```

Der Windows-Installer ist eine einzelne `.cmd`-Datei. Die benötigte PowerShell-Logik ist direkt in dieser Datei eingebettet und wird beim Start nur temporär ausgeführt; es gibt keine separate `install.ps1` mehr. Das Runtime-Archiv wird heruntergeladen, per SHA-256 geprüft und danach installiert bzw. aktualisiert.

Eine vorhandene `.env` und `data/` werden nicht überschrieben. Vor dem Ersetzen einer bestehenden Programmversion wird ein Backup erstellt; bei fehlgeschlagenem Update wird ein Rollback versucht. `uninstall` behält Nutzerdaten standardmäßig, `--purge` entfernt sie ebenfalls.

## GitHub Releases

Bei einem Tag wie `v3.1.2` prüft `.github/workflows/release.yml` Version, Tests sowie Installer-/JavaScript-Syntax und erstellt anschließend:

- `DynoraStation-Linux.sh`
- `DynoraStation-Windows.cmd`
- `dynorastation-linux.tar.gz`
- `dynorastation-windows.zip`
- `SHA256SUMS.txt`

`SHA256SUMS.txt` enthält Prüfsummen für beide Runtime-Archive und beide Installer. Die Runtime-Pakete enthalten den Ordner `installer/` nicht; Installer und Anwendungscode bleiben damit sauber getrennt.

Es gibt keinen `release/`-Quellordner mehr. Der Workflow baut alle Release-Artefakte direkt aus dem Repository. Beide Installer verwenden fest `DarkNinja-Lab/DynoraStation` als Release-Quelle; eine Repository-Abfrage oder `--repo`-Option gibt es nicht.

## Installation direkt aus dem Repository

Auch aus einem Checkout werden nur die beiden Dateien unter `installer/` verwendet. Beide Installer laden das aktuelle Runtime-Release immer aus `https://github.com/DarkNinja-Lab/DynoraStation`; eine Repository-Auswahl ist nicht erforderlich.

```bash
sudo ./installer/DynoraStation-Linux.sh install
```

Unter Windows:

```bat
installer\DynoraStation-Windows.cmd install
```

Für reine Entwicklung ist kein Installer nötig.

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
installer/           exakt zwei Installer mit kompletter Install/Update/Uninstall-Logik
.github/workflows/   automatischer GitHub-Release-Build
```

## Lizenz

Siehe [LICENSE](LICENSE).
