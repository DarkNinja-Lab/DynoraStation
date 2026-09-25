# Sicherheit

DynoraStation ist für ein vertrauenswürdiges lokales Netz ausgelegt. Die HTTP-API besitzt derzeit keine Benutzeranmeldung und sollte deshalb nicht direkt ins Internet veröffentlicht werden.

## Netzwerkgrenze

Empfohlen:

- DynoraStation und ESP-Module nur im LAN betreiben
- keinen direkten Port-Forward auf `8181` einrichten
- Fernzugriff über VPN statt öffentlich erreichbarer API
- `TRUST_PROXY=false` lassen, solange kein kontrollierter Reverse Proxy vorgeschaltet ist
- Debug-Endpunkte im Produktivbetrieb deaktiviert lassen

## HTTP-Schutz

Bei `ENABLE_SECURITY_HEADERS=true` setzt der Server unter anderem:

```text
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: no-referrer
Cross-Origin-Resource-Policy: same-origin
```

Zusätzlich wird eine restriktive Permissions Policy gesetzt.

## Same-Origin und CORS

Standardmäßig ist CORS deaktiviert. Schreibende Browseranfragen mit einem fremden `Origin` werden blockiert. ESP- und CLI-Clients senden üblicherweise keinen `Origin` und bleiben funktionsfähig.

Wenn Cross-Origin-Zugriff benötigt wird:

```env
CORS_ENABLED=true
CORS_ALLOWED_ORIGINS=https://example.internal
```

Mehrere Origins werden kommasepariert angegeben. `*` sollte nur verwendet werden, wenn der offene Zugriff wirklich beabsichtigt ist.

## Rate Limits

Globale API-Anfragen und Modul-Endpunkte besitzen getrennte In-Memory-Limits. Modul-Limits werden anhand der Client-IP gebildet, damit eine frei gewählte Modul-ID nicht zur Umgehung des Limits verwendet werden kann.

## Eingabevalidierung

Layout, Hardwaredaten und Regeln werden vor der Verwendung normalisiert. Textwerte, Kanäle, Helligkeiten und IDs werden begrenzt. Dynamische Texte im Frontend werden vor HTML-String-Rendering escaped.

## Persistenz und Backups

`data/` und `.env` enthalten installationsspezifische Daten. Diese Dateien sollten nicht öffentlich veröffentlicht oder ungeprüft in Support-Tickets hochgeladen werden.

Backups der Installer enthalten die Programmversion, nicht standardmäßig `.env`, `data/` oder `node_modules/`. Für eine vollständige Datensicherung müssen `data/` und `.env` separat gesichert werden.

## Hardware

Der NOT-AUS in der Weboberfläche ist ein Softwarebefehl. Er ersetzt keine geeignete hardwareseitige Abschaltung der Anlage.
