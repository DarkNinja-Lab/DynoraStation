# Betrieb und Updates

## Linux mit systemd

Status:

```bash
sudo systemctl status dynorastation
```

Neustart:

```bash
sudo systemctl restart dynorastation
```

Stoppen und starten:

```bash
sudo systemctl stop dynorastation
sudo systemctl start dynorastation
```

Logs:

```bash
sudo journalctl -u dynorastation -f
```

Letzte 100 Zeilen:

```bash
sudo journalctl -u dynorastation -n 100 --no-pager
```

Healthcheck:

```bash
curl http://127.0.0.1:8181/healthz
```

Falls ein anderer `SERVER_PORT` gesetzt ist, den Port entsprechend ersetzen.

## Linux-Update

Manuelle Update-Prüfung:

```bash
sudo dynora-update --check
```

Update installieren:

```bash
sudo dynora-update
```

Der Updater vergleicht den installierten Snapshot mit dem aktuellen `main`-Stand. Vor dem Ersetzen der Programmdateien wird unter `/var/backups/dynorastation` ein Backup erzeugt. `.env`, `data/` und `node_modules/` sind nicht Teil dieses Programm-Backups.

Nach dem Kopieren werden Dependencies installiert, Tests ausgeführt, der Dienst neu gestartet und `/healthz` geprüft. Bei einem Fehlschlag versucht der Updater, die vorherige Programmversion wiederherzustellen.

Automatische Updates werden über `dynorastation-update.timer` eingerichtet, wenn diese Option im Installer aktiviert wurde.

## Windows

DynoraStation läuft standardmäßig über die Windows-Aufgabenplanung als Task `DynoraStation`.

Task neu starten, PowerShell als Administrator:

```powershell
Stop-ScheduledTask -TaskName "DynoraStation"
Start-ScheduledTask -TaskName "DynoraStation"
```

Logdatei:

```text
%ProgramData%\DynoraStation\data\dynorastation.log
```

Update-Prüfung und Update werden mit der aktuellen Release-Datei des Windows-Installers durchgeführt:

```bat
DynoraStation-Windows.cmd update --check
DynoraStation-Windows.cmd update
```

Backups liegen unter:

```text
%ProgramData%\DynoraStation-backups
```

## Deinstallation

Linux:

```bash
sudo dynora-uninstall
sudo dynora-uninstall --purge
```

Windows:

```bat
DynoraStation-Windows.cmd uninstall
DynoraStation-Windows.cmd uninstall --purge
```

Ohne `--purge` bleiben `.env` und `data/` erhalten. Mit `--purge` werden auch Nutzerdaten und Installer-Backups entfernt.
