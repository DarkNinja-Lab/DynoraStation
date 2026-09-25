# DynoraStation – Technische Dokumentation

Diese Datei bündelt Installation, Release-/Update-Architektur, Konfiguration, Hardware-Anbindung, Diagnose und technische Betriebsdetails.

## Voraussetzungen

- Node.js 18 oder neuer
- npm
- Netzwerkverbindung zwischen Server und ESP8266-Modulen
- Linux: `systemd`; für den Release-Download `curl` oder `wget`; optional nginx
- Windows 10/11: PowerShell 5.1+, Aufgabenplanung und Windows-Firewall; `winget` ist optional für die automatische Node.js-Installation
- Für reale Schaltvorgänge passende Relais-/Treiberhardware und eine fachgerecht aufgebaute Modellbahnelektrik

## Installer- und Release-Architektur

Die Installer sind von der Anwendung getrennt. Im Branch `main` liegen **keine Installer-Dateien** und kein `installer/`-Ordner. GitHub Releases werden manuell erstellt und enthalten ausschließlich:

```text
DynoraStation-Linux.sh
DynoraStation-Windows.cmd
```

Die Installer verwenden fest das Repository `DarkNinja-Lab/DynoraStation` und den Branch `main`. Eine Repository-Auswahl, `--repo`-Option oder alternative Downloadquelle ist nicht vorgesehen.

Die Anwendung selbst wird nicht als Release-Artefakt gebaut. Bei jeder Installation bzw. Update-Prüfung lädt der jeweilige Installer einen GitHub-Source-Archive des aktuellen `main`-Branches:

```text
Linux:   https://github.com/DarkNinja-Lab/DynoraStation/archive/refs/heads/main.tar.gz
Windows: https://github.com/DarkNinja-Lab/DynoraStation/archive/refs/heads/main.zip
```

Für die Update-Erkennung wird primär die aktuelle Commit-ID von `main` über die GitHub-API ermittelt. Anschließend lädt der Installer das Source-Archiv exakt dieses Commits. Falls die Branch-Metadaten temporär nicht verfügbar sind, fällt der Installer auf das direkte `main`-Archiv zurück und verwendet dessen lokal berechneten SHA-256-Wert als temporäre Snapshot-ID. Die Transportintegrität basiert auf HTTPS zu GitHub. Da `main` bewusst als Updatekanal verwendet wird, kann jeder neue Commit auf `main` bei der nächsten Update-Prüfung installiert werden.

### Trennung von Installer und Anwendung

Änderungen am Anwendungscode werden über `main` verteilt. Änderungen an der Installationslogik werden durch ein neues manuelles GitHub Release der beiden Installer verteilt. Dadurch muss kein Installer in `main` eingecheckt werden und Releases benötigen weder Runtime-ZIPs noch `SHA256SUMS.txt`.

## Linux: Installieren, Aktualisieren, Entfernen

Öffentlicher Einstieg ist die aus einem GitHub Release heruntergeladene Datei:

```bash
sudo ./DynoraStation-Linux.sh
```

Beim Start ohne Argumente wird der gespeicherte Installationspfad aus `/etc/dynorastation/installer.conf` berücksichtigt und anhand von `package.json` plus `src/server.js` geprüft, ob DynoraStation installiert ist. Ohne Installation zeigt das Menü nur **Installieren / Abbrechen**; bei vorhandener Installation **Aktualisieren / Reparieren / Deinstallieren / Abbrechen**. Eine Reparatur übernimmt gespeicherte Installationsparameter als Vorgaben.

Direkte Aktionen:

```bash
sudo ./DynoraStation-Linux.sh install
sudo ./DynoraStation-Linux.sh update
sudo ./DynoraStation-Linux.sh update --check
sudo ./DynoraStation-Linux.sh uninstall
sudo ./DynoraStation-Linux.sh uninstall --purge
```

`install` und `update` laden `main.tar.gz` direkt von GitHub, entpacken den enthaltenen Projektordner und prüfen mindestens `package.json` sowie `src/server.js`, bevor Dateien übernommen werden. Standardpfad ist `/opt/dynorastation`. Vorhandene `data/`-Daten und eine vorhandene `.env` werden nicht überschrieben. Gefährliche Root-Pfade wie `/`, `/etc`, `/usr` oder `/var` werden als Installationsziel abgewiesen.

Nach erfolgreicher Installation wird die gerade ausgeführte Installer-Datei unter `/usr/local/lib/dynorastation/DynoraStation-Linux.sh` als lokaler System-Manager gespeichert. `/usr/local/sbin/dynora-update` und `/usr/local/sbin/dynora-uninstall` verweisen auf diese Datei. Der Manager benötigt für Updates keinen Installer im Repository; er lädt ausschließlich den aktuellen `main`-Projektstand.

Der System-Manager aktualisiert seine eigene Installer-Logik nicht aus `main`. Eine neue Installer-Version wird übernommen, indem die neuere Release-Datei manuell gestartet und **Reparieren / darüber installieren** ausgeführt wird.

`dynora-update` vergleicht primär die aktuelle `main`-Commit-ID mit dem zuletzt erfolgreich installierten Snapshot. Bei einer Änderung erstellt er ein Backup, ersetzt nur Programmdateien und führt anschließend Tests sowie Healthcheck aus. Bei einem Fehler wird die vorherige Programmversion wiederhergestellt. `dynora-update --check` nimmt keine Programmänderungen vor.

Die Installation legt einen `systemd`-Dienst und optional eine nginx-Konfiguration an. Automatische Updates verwenden denselben lokal installierten Manager über einen `systemd`-Timer. Installer-Metadaten liegen unter `/etc/dynorastation/`, Backups unter `/var/backups/dynorastation/`.

`dynora-uninstall` entfernt Programmdateien und Systemintegration, behält standardmäßig `.env` und `data/`. `--purge` entfernt zusätzlich Nutzerdaten, Backups und den Systembenutzer.

Wenn nginx aktiviert wird, setzt eine neu erzeugte `.env` `TRUST_PROXY=true`. Ohne Reverse Proxy bleibt `TRUST_PROXY=false`. Eine vorhandene `.env` wird bei normalen Installationen und Updates nicht automatisch verändert.

## Windows: Installieren, Aktualisieren, Entfernen

Öffentlicher Einstieg ist die aus einem GitHub Release heruntergeladene Datei `DynoraStation-Windows.cmd`. Die Datei besteht aus einem kleinen CMD-Bootstrap und einer direkt eingebetteten PowerShell-Implementierung. Der Bootstrap extrahiert diesen Abschnitt zur Laufzeit in eine temporäre `.ps1`, führt ihn aus und löscht die temporäre Datei anschließend wieder.

Beim Start per Doppelklick liest die eingebettete PowerShell zuerst `%ProgramData%\DynoraStation-installer\config.json`, ermittelt damit den tatsächlichen Installationspfad und prüft dort `package.json` sowie `src\server.js`. Das Menü zeigt anschließend nur die zum Zustand passenden Aktionen.

Beispiele:

```bat
DynoraStation-Windows.cmd install
DynoraStation-Windows.cmd update
DynoraStation-Windows.cmd update --check
DynoraStation-Windows.cmd uninstall
DynoraStation-Windows.cmd uninstall --purge
```

Installation und Update laden `main.zip` direkt von GitHub. Nach dem Entpacken wird der enthaltene Projektordner anhand von `package.json` und `src\server.js` validiert. Die `main`-Commit-ID wird zusammen mit dem lokalen ZIP-Hash in der Installer-Konfiguration gespeichert und bei späteren Update-Prüfungen mit dem aktuellen `main`-Snapshot verglichen.

Standardpfad ist `%ProgramData%\DynoraStation`. Beim ersten Setup wird `.env` aus `.env.example` erzeugt, `NODE_ENV=production` gesetzt und `TRUST_PROXY=false` verwendet. Eine bestehende `.env` und `data/` bleiben erhalten.

Vor dem Ersetzen einer bestehenden Programmversion wird unter `%ProgramData%\DynoraStation-backups` ein Backup angelegt; maximal zehn Backups werden behalten. Ein Update führt vor dem Neustart `npm test` aus und versucht bei Fehlern ein Rollback.

Standardmäßig läuft DynoraStation über die Windows-Aufgabenplanung als `SYSTEM`. Mit `--no-autostart` wird kein Autostart-Task angelegt. Firewallregeln werden für Web- und UDP-Discovery-Port verwaltet.

Bei `uninstall` werden Task, Firewallregeln und Programmdateien entfernt. Ohne `--purge` bleiben `.env` und `data/` erhalten. `--purge` entfernt zusätzlich Backups und die globale Installer-Konfiguration.

## Manuelle Entwicklung

```bash
npm install
cp .env.example .env
npm start
```

Entwicklungsstart:

```bash
npm run dev
```

Tests:

```bash
npm test
```

## Konfiguration mit `.env`

Die verfügbaren Variablen und Beispielwerte stehen in `.env.example`.

Wichtige Werte:

- `SERVER_IP`, `SERVER_PORT`: Bind-/Anzeigeadresse und HTTP-Port
- `DISCOVERY_PORT`, `ENABLE_UDP_DISCOVERY`: ESP8266-Discovery
- `PROTOCOL_VERSION`: erwartete Modul-Protokollversion
- `TRUST_PROXY`: nur aktivieren, wenn DynoraStation tatsächlich hinter einem vertrauenswürdigen Reverse Proxy betrieben wird
- `MODULE_TIMEOUT`: Zeit bis ein Modul als offline gilt
- `MAX_COMMANDS`, `MAX_EVENTS`: Grenzen der In-Memory-Historien
- `COMMAND_MAX_AGE_MS`, `COMMAND_MAX_ATTEMPTS`: Queue-Limits
- `UI_STATUS_INTERVAL_MS`: Polling-Intervall des Frontends
- `RL_*`: Rate-Limit-Fenster und Limits
- `ENABLE_SECURITY_HEADERS`: Security-Header
- `ENABLE_DEBUG_ENDPOINTS`: Debug-Routen; produktiv normalerweise `false`
- `CORS_ENABLED`, `CORS_ALLOWED_ORIGINS`: optionale Cross-Origin-Freigabe

`TRUST_PROXY` ist absichtlich standardmäßig `false`, damit direkte Installationen keine vom Client frei gesetzten `X-Forwarded-For`-Header für IP-basierte Logik/Rate-Limits vertrauen. Modul-Endpunkte werden pro Client-IP begrenzt, nicht anhand einer frei wählbaren Modul-ID.

Wenn CORS deaktiviert ist, blockiert der Server zustandsändernde Browser-Anfragen mit einem fremden `Origin`-Header. ESP-/CLI-Clients ohne `Origin` bleiben davon unberührt. Das reduziert Cross-Site-Requests auf eine lokale DynoraStation-Instanz.

## Persistierte Daten und Normalisierung

Laufzeitdaten liegen unter `data/`. Layout, Hardwarekonfiguration und Regeln werden beim Laden normalisiert. Ungültige Kanäle und Werte werden begrenzt bzw. verworfen; doppelte Layout-Elemente, Verbindungen, Stromkreis-IDs und Regel-IDs werden nicht mehrfach übernommen.

Die aktuelle Layout-Version ist `32` in Backend und Frontend-Fallback. Dadurch starten neue/leere Frontends nicht mehr mit einer abweichenden Schema-Version.

## Frontend-Ausgabe und HTML-Sicherheit

Dynamische Texte, die über `innerHTML` gerendert werden, verwenden die gemeinsame Escape-Funktion aus `public/app/core/utils.js`. Konfigurierbare Namen, Statuswerte und Katalogtexte werden damit vor dem Einsetzen als HTML maskiert. Reine DOM-Attribute, die über `setAttribute` geschrieben werden, benötigen keine HTML-String-Interpolation.

## ESP8266 und Hardware

Die Firmware liegt unter `esp8266_code/`:

- `relays_und_sensoren.ino` – Relais- und Sensormodul
- `led_signalleuchten.ino` – LED-/Signalausgänge
- `MCP23017_ANSCHLUSS.md` – Anschlussinformationen für MCP23017 und Relaisboard

DynoraStation erkennt kompatible Module im Netz und führt sie in der Systemverwaltung. Modulnamen und Kanalzuweisungen werden in der Weboberfläche gepflegt.

### MCP23017 und Relais

Für zusätzliche digitale Ein-/Ausgänge kann ein MCP23017 verwendet werden. Die konkrete Verdrahtung ist in `esp8266_code/MCP23017_ANSCHLUSS.md` beschrieben. Relais müssen zur verwendeten Versorgung, Last und Schaltlogik passen.

### Sensoren und Rückmeldung

Sensoren werden einem Modul/Kanal und anschließend funktional einem Gleis- oder Betriebsobjekt zugeordnet. Rückmeldungen erscheinen im Stellwerksbild und können Regeln auslösen.

### LED- und Signalausgänge

Das LED-Modul verwaltet Signalkanäle und Helligkeiten. Tests einzelner Kanäle sollten vor dem produktiven Betrieb mit angeschlossener Anlage erfolgen.

## Netzwerk und Live-Synchronisierung

Der Node/Express-Server stellt Weboberfläche und API bereit. ESP-Module melden ihren Zustand an den Server; die Oberfläche synchronisiert Betriebszustände laufend. Die Oberfläche zeigt Verbindungsprobleme getrennt für Webserver und Module an.

Bei einer unbehandelten Promise-Ablehnung oder Exception setzt der Server einen Fehler-Exitcode und fährt über den Lifecycle herunter. Dadurch kann `systemd` bzw. die Windows-Aufgabenplanung einen echten Prozessfehler erkennen.

## Anlagenplan und Maßstab

Der Planer arbeitet intern in einer einheitlichen SVG-Koordinatebene. Anlagenplattenmaße und Planungsraster werden als Metadaten gespeichert. Zoom und Pan verändern nur die Ansicht, nicht die gespeicherte Geometrie. Der PDF-Export verwendet dieselben Layoutdaten.

## Mobile Bedienung

Auf schmalen Displays werden Hauptbereiche über die untere Navigation geöffnet. Im Planer werden Arbeitsfläche, Bauteilbibliothek und Konfiguration als getrennte mobile Ansichten dargestellt. Für den Betrieb wird das Gleisbild priorisiert; Zusatzsteuerungen folgen darunter.

## Automationen

Wenn-Dann-Regeln verbinden Rückmeldeereignisse mit definierten Aktionen. Regeln sollten so aufgebaut werden, dass ein fehlerhafter oder dauerhaft aktiver Sensor keine unerwünschte Schaltkaskade auslöst.

## Diagnose

### Webserver offline

1. Prüfen, ob `npm start` bzw. der Systemdienst ohne Fehler läuft.
2. Port und `.env` kontrollieren.
3. Lokale Firewall und gegebenenfalls nginx prüfen.
4. `/healthz` lokal aufrufen und Server-Log kontrollieren.

Linux mit systemd:

```bash
sudo systemctl status dynorastation
sudo journalctl -u dynorastation -n 100 --no-pager
```

Windows: Standardlog ist `%ProgramData%\DynoraStation\data\dynorastation.log`.

### ESP offline

1. Versorgung und WLAN prüfen.
2. Sicherstellen, dass Server und ESP im erreichbaren Netz liegen.
3. `DISCOVERY_PORT` und Firewall prüfen.
4. Firmware-Konfiguration prüfen.
5. Modul neu starten und Gerätecenter beobachten.

### Relais oder Sensor reagieren verzögert

Netzwerklatenz, instabile WLAN-Verbindung, Versorgungsspannung und doppelte/fehlerhafte Kanalzuweisungen prüfen. Anschließend Server- und Ereignislog vergleichen.

## Betriebssicherheit

Der NOT-AUS der Oberfläche ist eine Softwarefunktion und ersetzt keinen hardwareseitigen, fachgerecht ausgeführten Not-Aus bzw. eine sichere Abschaltmöglichkeit der Anlage. Änderungen an Verdrahtung und Leistungselektrik nur spannungsfrei durchführen.

## Wartung

Abhängigkeiten regelmäßig mit `npm audit` prüfen. Änderungen sollten vor einem Release mit `npm test` validiert werden. Firmware und Server gemeinsam versionieren, wenn sich Protokoll oder Kanalverhalten ändern.
