# Releases

DynoraStation verwendet Releases nur für die beiden Bootstrap-Installer. Der Anwendungscode selbst wird aus `main` geladen.

## Release-Inhalt

Ein GitHub Release enthält manuell genau diese beiden Assets:

```text
DynoraStation-Linux.sh
DynoraStation-Windows.cmd
```

Nicht erforderlich sind:

```text
Runtime-ZIPs
dynorastation-linux.tar.gz
dynorastation-windows.zip
SHA256SUMS.txt
```

GitHub zeigt bei jedem Release zusätzlich automatisch `Source code (zip)` und `Source code (tar.gz)` an. Diese Archive sind GitHub-eigene Quellenarchive und keine manuell hochgeladenen DynoraStation-Assets.

## Was aus `main` kommt

Installation und Update beziehen den Projektstand direkt aus:

```text
DarkNinja-Lab/DynoraStation
Branch: main
```

Die Installer versuchen zunächst die Commit-ID von `main` zu bestimmen und laden diesen Commit als Source-Archiv. Dadurch kann ein Update auch erkannt werden, wenn sich die Versionsnummer in `package.json` nicht geändert hat.

## Was ein neues Installer-Release benötigt

Ein neues Installer-Release ist nur nötig, wenn sich die Installationslogik selbst ändert, zum Beispiel:

- Installationspfade oder Service-Setup
- nginx-/Firewall-Konfiguration
- Backup-/Rollback-Verhalten
- Update-Mechanik
- neue Installer-Optionen

Reine Änderungen an Weboberfläche, Backend oder Dokumentation benötigen kein neues Installer-Release. Sie werden über `main` verteilt.

## Empfohlener manueller Ablauf

1. Änderungen an `main` testen und pushen.
2. Falls nur Anwendungscode geändert wurde: kein Installer-Release nötig.
3. Falls Installer geändert wurden: Linux- und Windows-Datei lokal prüfen.
4. Neues GitHub Release mit eigenem Installer-Tag erstellen.
5. Nur die beiden Installer-Dateien als Assets hochladen.
6. Release Notes kurz auf die Installer-Änderungen beschränken.

Der Branch `main` enthält bewusst keinen `installer/`-Ordner und keinen automatischen Release-Build für diese Dateien.
