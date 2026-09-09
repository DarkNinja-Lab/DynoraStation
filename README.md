# H0-Bahn-Zentrale

Webbasierte Steuerzentrale für eine H0-Modellbahn mit mehreren ESP-Modulen.  
Die Anwendung kombiniert:

- **Track Builder** (Gleisplan erstellen, verbinden, speichern)
- **Live-Steuerung** (Gleise, Weichen, Signale, Licht-Buttons)
- **Hardware-Management** (Relais/Sensoren benennen, Status sehen)
- **Multi-ESP-Kommunikation** (Heartbeat, Sensor-Events, Command-Queue)

---

## Funktionen

## 1) Übersicht (Dashboard)
- Serverstatus (online/offline)
- Modulstatus (online/gesamt)
- Anzahl aktiver Relais
- Anzahl Gleiselemente im Layout
- Letzte Sensorauslösung
- Schnellzugriffe auf Builder, Strecke, Settings

## 2) Track Builder
- Elemente hinzufügen:
  - Gerades Gleis
  - Kurve
  - Weiche
  - Signal
- Auswahl-/Verschiebe-Tool
- Verbindungs-Tool mit Port-Logik
- Undo / Redo
- Speichern / Layout laden
- Raster + Snap + Labels
- Zoom + Zentrieren

## 3) Märklin M Gleiskatalog
- Katalog aus Backend (`/api/track-catalog`)
- Artikelcodes (z. B. 5106, 5107, 5100, 5202 ...)
- Bildbasierte Auswahl über `/assets/track/*.jpg`
- Fallback-Bild bei fehlenden Dateien

## 4) Strecke (Betrieb)
- Klick auf Gleis: schaltet zugewiesenes Relay
- Klick auf Weiche: toggelt `gerade/abzweig`
- Klick auf Signal: toggelt `halt/fahrt`
- Licht-Buttons 1–4 mit konfigurierbarer Modul/Relay-Zuordnung

## 5) Settings
- Relaiskarten + direkte Schaltbuttons (EIN/AUS)
- Sensorkarten mit Trigger-Status
- Relais/Sensoren umbenennen
- Licht-Button-Konfiguration speichern
- Default-Zustände (Weichen/Signale) definieren und anwenden

## 6) Multi-ESP Backend
- ESP-Heartbeat
- Sensor-Events
- Modulzustände online/offline
- Command-Queue für Schaltbefehle
- ACK-Mechanismus für abgeholte Befehle
- Persistenz in JSON-Dateien (`data/`)

---

## Projektstruktur (typisch)

```text
.
├─ server.cjs
├─ public/
│  ├─ index.html            # (oder dashboard.html, je nach Setup)
│  ├─ style.css             # (oder style-guide.css)
│  ├─ app.js                # (oder layout-manager.js)
│  └─ assets/
│     └─ track/
│        ├─ 5106.jpg
│        ├─ 5107.jpg
│        ├─ 5108.jpg
│        ├─ 5109.jpg
│        ├─ 5110.jpg
│        ├─ 5129.jpg
│        ├─ 5100.jpg
│        ├─ 5101.jpg
│        ├─ 5120.jpg
│        ├─ 5202.jpg
│        ├─ 5203.jpg
│        └─ fallback.jpg
└─ data/
   ├─ layout.json
   └─ hardware.json
```

---

## Voraussetzungen

- **Node.js** 18+ (empfohlen)
- npm (oder pnpm/yarn)
- Lokales Netzwerk für ESP-Module

---

## Starten

### Konfiguration

In `server.cjs`:

- `SERVER_IP`
- `SERVER_PORT`
- `MODULE_TIMEOUT`
- Queue-Limits:
  - `MAX_COMMANDS`
  - `MAX_EVENTS`
  - `COMMAND_MAX_AGE_MS`
  - `COMMAND_MAX_ATTEMPTS`


## 1) Abhängigkeiten installieren
```bash
npm install express
```

## 2) Server starten
```bash
node server.cjs
```

Der Server läuft standardmäßig auf:

- `http://192.168.1.115:8181`
- Bind auf `0.0.0.0`

---

## Bekannte Stolperfallen

1. **Dateinamen stimmen nicht**
   - Server lädt standardmäßig `public/index.html` und referenziert `/style.css`, `/app.js`.
   - Bei anderen Namen musst du Datei/Referenzen angleichen.

2. **Dropdown/Bilder werden nicht korrekt angezeigt**
   - Browser-Cache leeren (Hard Reload: `Strg+F5`)
   - Prüfen, ob Bilder wirklich unter `/public/assets/track/` liegen.

3. **ESP erscheint offline**
   - Heartbeat nicht gesendet oder `module`-ID abweichend.
   - `MODULE_TIMEOUT` prüfen.

4. **Schaltbefehl kommt nicht am ESP an**
   - `/api/module/next-command` polling prüfen.
   - ACK (`/api/module/ack`) korrekt senden.

---

## Entwicklungstipps

- Bei UI-Änderungen zuerst nur Frontend testen (`/api/status` mocked oder live).
- Bei Hardware-Problemen `/api/debug/commands` und `/api/debug/hardware` verwenden.
- Layout häufig speichern, da beim Status-Sync ggf. Serverlayout übernommen wird.

---

## Roadmap

- Fahrstraßen (Route-Makros)
- Gleisbesetzt-Logik mit Sensor-Ketten
- Benutzer/Passwort für Web-UI
- WebSocket statt Polling für Live-Status
- Import/Export von Layout-Profilen