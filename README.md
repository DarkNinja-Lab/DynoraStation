# DynoraStation

Webbasiertes Analog-Stellwerk für **Märklin H0 M-Gleis**. DynoraStation verbindet Gleisplan, ESP8266-Module, Relais, Sensoren und Signale in einer Oberfläche für Desktop, Tablet und Smartphone.

## Funktionen

- **Übersicht:** Anlagenbild, Verbindungen und letzte Ereignisse.
- **Betrieb:** Weichen, Signale, Stromabschnitte und Licht schalten.
- **Gleisplan:** Bauteile platzieren, verbinden und Hardware zuweisen.
- **Lichtsystem:** Lichtgruppen mit Vorlagen und eigenen Zeitabläufen.
- **Einstellungen:** Geräte, Automationen und Grundstellungen verwalten.
- **Logbuch:** System-, Schalt- und Sensormeldungen durchsuchen.
- **Plansicherung:** Import, Export, Druck/PDF und die letzten 20 Planversionen.

Hardwarezustände werden nach bestätigter Rückmeldung der Module angezeigt. Die Anwendung ist für ein vertrauenswürdiges lokales Netz ausgelegt; Details stehen unter [Sicherheit](docs/SECURITY.md).

## Installation

Die [Installationsanleitung](docs/INSTALLATION.md) beschreibt alle vier Wege:

| Methode | Einstieg |
| --- | --- |
| One-Liner | Installation inklusive Dienst/Autostart unter Windows oder Linux |
| Installer | `DynoraStation-Linux.sh` oder `DynoraStation-Windows.cmd` aus den [Release-Assets](https://github.com/DarkNinja-Lab/DynoraStation/releases/latest) |
| Docker | Container mit optionalem Host-Netzwerk für UDP-Discovery |
| npm | Manueller Start mit Node.js 18 oder neuer |

Installer werden separat als Release-Assets gepflegt. Der Anwendungscode kommt aus `main`. Konfiguration, Updates und Backups sind unter [Konfiguration](docs/CONFIGURATION.md) und [Betrieb](docs/OPERATIONS.md) dokumentiert.

Standardadresse: `http://<server-ip>:8181`.

## Bedienung

1. Die [ESP-Firmware](docs/ESP_README.md) einrichten und die Module unter **Einstellungen → Module** prüfen.
2. Einen [Gleisplan erstellen](docs/BUILDER.md) und die Hardwarekanäle zuordnen.
3. Den Plan speichern und im **Betrieb** verwenden.
4. Bei Bedarf [Automationen und Grundstellungen](docs/SETTINGS.md) ergänzen.

Auf dem Handy befinden sich Einstellungen, Lichtsystem, Logbuch und Hilfe unter **Mehr**. Die Sprache lässt sich in der Oberfläche auswählen.

## Dokumentation

Der [Dokumentationsindex](docs/README.md) führt zu allen Bedienungsanleitungen und technischen Referenzen.

- [Fehlersuche](docs/TROUBLESHOOTING.md)
- [Hardware und Firmwareprofile](docs/HARDWARE.md)
- [MCP23017-Anschluss](docs/MCP23017_ANSCHLUSS.md)
- [Entwicklung und Tests](docs/DEVELOPMENT.md)
- [Architektur](docs/ARCHITECTURE.md)
- [HTTP-API](docs/API.md)

## Projektstruktur

```text
public/          Weboberfläche und native ES-Module
src/             Express-Backend und fachliche Logik
esp8266_code/    ESP8266-Firmware
docs/            Anleitungen und Referenzen
test/            Backend-, Persistenz- und UI-Tests
scripts/         Projektprüfungen
```

Lokale Entwicklung: `npm install`, Konfiguration aus `.env.example` anlegen und `npm start`. Vor Änderungen prüfen: `npm run check` und `npm test`. Details stehen in der [Entwicklungsanleitung](docs/DEVELOPMENT.md).
