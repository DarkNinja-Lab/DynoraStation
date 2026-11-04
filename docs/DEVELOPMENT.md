# Entwicklung

## Lokal starten

Voraussetzung ist Node.js 18 oder neuer. Im Projektverzeichnis:

```bash
npm install
cp .env.example .env
npm start
```

Unter Windows die Konfiguration mit `Copy-Item .env.example .env` in PowerShell oder `copy .env.example .env` in cmd anlegen. `npm run dev` verwendet denselben Einstiegspunkt wie `npm start`; es gibt keinen separaten Frontend-Build.

Für eine isolierte Vorschau einen anderen `SERVER_PORT`, ein temporäres `DYNORA_DATA_DIR` und `ENABLE_UDP_DISCOVERY=false` verwenden. So bleiben die Daten der laufenden Station getrennt.

## Änderungen prüfen

```bash
npm run check
npm test
```

Ohne npm im Suchpfad funktionieren die zugrunde liegenden Node-Aufrufe:

```bash
node scripts/check.js
node --test test/*.test.js
```

| Tests | Schwerpunkt |
| --- | --- |
| `smoke.test.js` | HTTP-Endpunkte und bestätigte Hardwarebefehle |
| `safety.test.js` | Regeln, Grenzen und Schutz vor ungültigen Schaltbefehlen |
| `frontend.test.js`, `workspace.test.js`, `ui-structure.test.js` | Entwürfe, Bedienabläufe, Navigation und DOM-Struktur |
| `editor.test.js`, `geometry.test.js` | Editoroperationen und Gleisgeometrie |
| `events-persistence.test.js` | Speicherung des Logbuchs |
| `connection-settings.test.js`, `ota-build.test.js` | Firmwarekonfiguration und Buildprofile |
| `project-structure.test.js`, `update-version.test.js` | Projektkonventionen und Versionskopplungen |

HTTP-Tests verwenden temporäre Datenverzeichnisse. DOM-Tests ersetzen keine visuelle Browserprüfung: Übersicht, Betrieb, Gleisplan, Einstellungen und Hilfe auf Desktop und Handy kontrollieren. Bei Änderungen an Formularen auch Eingabe, Speichern und erneutes Laden prüfen.

## Zuständigkeiten

- `src/routes/`: HTTP-Eingaben, Antworten und Fehlercodes.
- `src/domain/`: Normalisierung und fachliche Regeln.
- `src/services/`: Module, Command Queue, Persistenz, Discovery und Firmware-Build.
- `public/app/core/`: Frontend-State, API, Übersetzung und gemeinsame Helfer.
- `public/app/settings/`: Darstellung und Modelle für Einstellungen.
- `public/app/rules/`: Automationsmodell und Regel-Editor.
- `public/app/ui/`: Navigation und übergreifende Interaktionen.

Geschäftslogik ohne Express-Abhängigkeit gehört nicht in Route-Handler. Neue Frontend-Funktionen möglichst in ihrem Fachmodul halten, statt die zentrale Eventdatei zu vergrößern.

## Daten und Sicherheit

Layout, Hardware und Regeln werden beim Laden und Speichern normalisiert. Schemaänderungen zusammen mit Normalisierern und Tests umsetzen. Die Layout-Version in Frontend und Backend muss übereinstimmen.

Persistente Änderungen über die vorhandenen queued writer speichern. Ein Schreibfehler darf nicht als Erfolg bestätigt werden. Für Pläne zusätzlich Versionsschutz und Archiv berücksichtigen; siehe [Architektur](ARCHITECTURE.md).

Dynamische HTML-Werte mit `esc` aus `core/utils.js` maskieren oder über `textContent` setzen. Schaltzustände erst nach erfolgreicher ESP-Bestätigung übernehmen. Änderungen am Modulprotokoll mit Server, Firmware und `PROTOCOL_VERSION` abstimmen.

## Styles und Browsercache

`public/style.css` enthält die gemeinsame Gestaltung und die Regeln für die einzelnen Bereiche. Bestehende Selektoren und ihre Medienbedingungen bearbeiten. Keine weiteren historischen Themes oder pauschalen Overrides anhängen. Abstände, Farben und Radien aus den gemeinsamen Variablen verwenden.

Versionierte Modulimporte und die Einstiegspunkte bei Änderungen zusammen aktualisieren, damit Browser keine alten Teilmodule weiterverwenden.

## Dokumentation und Releases

Anleitungen beginnen im [Dokumentationsindex](README.md). Bedienung wird unter [Einstellungen](SETTINGS.md) und [Gleisplan](BUILDER.md) gepflegt. Keine Änderungsprotokolle an bestehende Anleitungen anhängen.

`main` enthält Anwendungscode und Dokumentation. Installer werden separat als Release-Assets gepflegt. `version.txt` ist der Marker für die Stationsupdates; `package.json` enthält die npm-Paketversion.
