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

## Voraussetzungen

- **Node.js** 18+ (empfohlen)
- npm (oder pnpm/yarn)
- WebServer und die ESP´s sollten im gleichen Netzwerk sein

---


## 1) Abhängigkeiten installieren
```bash
npm install express
```

## 2) Server starten
```bash
npm start
```