# Installation

DynoraStation trennt Anwendungscode und Installer. Der Branch `main` enthält keine Installer-Dateien. Die beiden Installer werden manuell als GitHub-Release-Assets veröffentlicht und laden den aktuellen Stand von `main`.

Repository: `DarkNinja-Lab/DynoraStation`

## Voraussetzungen

Für den Betrieb werden Node.js 18 oder neuer und npm benötigt. Die Installer richten fehlende Abhängigkeiten soweit möglich selbst ein.

Linux benötigt `systemd`. Für Downloads wird `curl` oder `wget` verwendet. nginx ist optional.

Windows unterstützt Windows 10/11 und nutzt PowerShell, Aufgabenplanung und Windows-Firewall. `winget` kann für die Node.js-Installation verwendet werden.

## Linux

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
