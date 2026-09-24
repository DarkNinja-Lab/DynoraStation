# DynoraStation

Webbasiertes **Analog-Stellwerk für Märklin H0 M-Gleis**. DynoraStation verbindet einen übersichtlichen Gleisplan mit ESP8266-Modulen, Relais, Rückmeldern, Signalen und einfachen Automationen.

## Was kann DynoraStation?

- Gleisbild planen und im Betrieb als Stellwerk verwenden
- Weichen, Signale und Lichtausgänge schalten
- Rückmelder/Sensoren live anzeigen
- ESP8266-Module automatisch erkennen und verwalten
- Grundstellungen und Wenn-Dann-Abläufe konfigurieren
- Anlagenplan als PDF exportieren
- Bedienung auf Desktop, Tablet und Smartphone

## Schnellstart

Voraussetzung: Node.js 18 oder neuer.

```bash
npm install
cp .env.example .env
npm start
```

Danach im Browser `http://localhost:3000` öffnen. Für einen kurzen Funktionstest:

```bash
npm test
```

## Hardware

DynoraStation ist auf klassische analoge Märklin-M-Gleis-Anlagen ausgelegt. ESP8266-Module übernehmen die Verbindung zu Relais, Sensoren und LED-/Signalausgängen. Die Weboberfläche ist das zentrale Stellwerk; die Anlage bleibt elektrisch weiterhin eine analoge Anlage.

Die vollständige technische Einrichtung, Pin-/Modulhinweise, Umgebungsvariablen, Diagnose und Sicherheitsdetails stehen in [TECHNICAL.md](TECHNICAL.md).

## Bedienung

1. Unter **Planung** den Gleisplan erstellen.
2. Unter **System** ESP-Module und Kanäle zuweisen.
3. Unter **Betrieb** die Anlage über das große Stellwerksbild steuern.
4. Unter **Logbuch** Schalt- und Systemereignisse prüfen.

## Projektstruktur

```text
public/         Weboberfläche
public/app/     Frontend-Module
src/            Express-Backend
esp8266_code/   Firmware und Hardware-Hinweise
test/           Smoke- und Safety-Tests
```

## Lizenz

Siehe [LICENSE](LICENSE).
