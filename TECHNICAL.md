# DynoraStation – Technische Dokumentation

Diese Datei bündelt Installation, Konfiguration, Hardware-Anbindung, Diagnose und technische Betriebsdetails. Die README bleibt bewusst kurz und produktorientiert.

## Voraussetzungen

- Node.js 18 oder neuer
- Netzwerkverbindung zwischen Server und ESP8266-Modulen
- Für reale Schaltvorgänge passende Relais-/Treiberhardware und eine fachgerecht aufgebaute Modellbahnelektrik

## Installation

```bash
npm install
cp .env.example .env
npm start
```

Entwicklung und Start verwenden aktuell denselben Server:

```bash
npm run dev
```

Tests:

```bash
npm test
```

## Konfiguration mit `.env`

Die verfügbaren Variablen und Beispielwerte stehen in `.env.example`. Änderungen an Netzwerkadressen, Ports oder Hardwareparametern sollten zuerst dort nachvollziehbar dokumentiert werden.

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

Der Node/Express-Server stellt die Weboberfläche und API bereit. ESP-Module melden ihren Zustand an den Server; die Oberfläche synchronisiert Betriebszustände laufend. Die Oberfläche zeigt Verbindungsprobleme getrennt für Webserver und Module an.

## Anlagenplan und Maßstab

Der Planer arbeitet intern in einer einheitlichen SVG-Koordinatebene. Anlagenplattenmaße und Planungsraster werden als Metadaten gespeichert. Zoom und Pan verändern nur die Ansicht, nicht die gespeicherte Geometrie. Der PDF-Export verwendet dieselben Layoutdaten.

## Mobile Bedienung

Auf schmalen Displays werden Hauptbereiche über die untere Navigation geöffnet. Im Planer werden Arbeitsfläche, Bauteilbibliothek und Konfiguration als getrennte mobile Ansichten dargestellt. Für den Betrieb wird das Gleisbild priorisiert; Zusatzsteuerungen folgen darunter.

## Automationen

Wenn-Dann-Regeln verbinden Rückmeldeereignisse mit definierten Aktionen. Regeln sollten so aufgebaut werden, dass ein fehlerhafter oder dauerhaft aktiver Sensor keine unerwünschte Schaltkaskade auslöst.

## Diagnose

### Webserver offline

1. Prüfen, ob `npm start` ohne Fehler läuft.
2. Port und `.env` kontrollieren.
3. Lokale Firewall/Reverse Proxy prüfen.
4. Browser neu laden und Server-Log kontrollieren.

### ESP offline

1. Versorgung und WLAN prüfen.
2. Sicherstellen, dass Server und ESP im erreichbaren Netz liegen.
3. Firmware-Konfiguration prüfen.
4. Modul neu starten und Gerätecenter beobachten.

### Relais oder Sensor reagieren verzögert

Netzwerklatenz, instabile WLAN-Verbindung, Versorgungsspannung und doppelte/fehlerhafte Kanalzuweisungen prüfen. Anschließend Server- und Ereignislog vergleichen.

## Betriebssicherheit

Der NOT-AUS der Oberfläche ist eine Softwarefunktion und ersetzt keinen hardwareseitigen, fachgerecht ausgeführten Not-Aus bzw. eine sichere Abschaltmöglichkeit der Anlage. Änderungen an Verdrahtung und Leistungselektrik nur spannungsfrei durchführen.

## Wartung

Abhängigkeiten regelmäßig mit `npm audit` prüfen und Updates zunächst mit `npm test` validieren. Änderungen an Firmware und Server sollten gemeinsam versioniert werden, wenn sie ein Protokoll oder Kanalverhalten verändern.
