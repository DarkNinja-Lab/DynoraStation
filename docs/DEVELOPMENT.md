# Entwicklung

## Lokales Setup

Voraussetzung: Node.js 18 oder neuer.

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

`npm run dev` startet derzeit denselben Node-Einstiegspunkt wie `npm start`.

## Tests

```bash
npm test
```

Die Tests liegen unter `test/`:

```text
test/smoke.test.js
Testet zentrale API-Flows mit laufender Express-App.

test/safety.test.js
Prüft Normalisierung, Limits und sicherheitsrelevante Randfälle.

test/project-structure.test.js
Prüft Strukturkonventionen und gekoppelte Konfigurationen.
```

JavaScript-Dateien können zusätzlich mit Node auf Syntax geprüft werden:

```bash
find src public/app test -name '*.js' -print0 | xargs -0 -n1 node --check
```

## Backend-Struktur

Neue HTTP-Endpunkte gehören unter `src/routes/`. Geschäftslogik, die nicht an Express gebunden ist, gehört nach `src/domain/` oder `src/services/`.

Persistente Änderungen an Layout, Hardware oder Regeln sollten über die vorhandenen queued writer gespeichert werden. Direkte konkurrierende Writes auf die JSON-Dateien vermeiden.

## Frontend-Struktur

Frontend-Code liegt als native ES-Module unter `public/app/`. Gemeinsame Helfer gehören in `public/app/core/` und sollten nicht in mehreren Feature-Dateien kopiert werden.

Dynamische Werte nicht ungeescaped in `innerHTML` einsetzen. Für HTML-Strings die gemeinsame Escape-Funktion aus `public/app/core/utils.js` verwenden; wenn möglich DOM-APIs wie `textContent` bevorzugen.

## Datenmodelle

Layout-, Hardware- und Regeldaten werden beim Laden und Speichern normalisiert. Änderungen am Schema sollten deshalb immer gemeinsam mit den jeweiligen Normalizern und Tests umgesetzt werden.

Die Layout-Version in Backend und Frontend muss synchron bleiben. `test/project-structure.test.js` prüft diese Kopplung.

## ESP-Protokoll

Wenn sich Payloads oder Semantik zwischen Server und Firmware ändern, `PROTOCOL_VERSION` bewusst behandeln und Server sowie Firmware zusammen testen. Ein reines Firmware-Update ohne passende Serverunterstützung kann ein Modul als inkompatibel markieren.

## Release-Modell

Der `main`-Branch enthält nur Anwendungscode und Dokumentation. Installer werden separat gepflegt und manuell als Release-Assets hochgeladen. Details: [RELEASES.md](RELEASES.md).
