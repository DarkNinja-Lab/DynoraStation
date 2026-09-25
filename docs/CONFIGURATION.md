# Konfiguration

DynoraStation liest seine Laufzeitkonfiguration aus `.env`. Die vollständige Vorlage liegt in [`.env.example`](../.env.example).

Nach Änderungen an `.env` muss der Server neu gestartet werden.

## Server und Netzwerk

| Variable | Standard | Bedeutung |
| --- | ---: | --- |
| `SERVER_IP` | `127.0.0.1` im Code | Adresse für Anzeige/Fallback; der HTTP-Server bindet auf `0.0.0.0` |
| `SERVER_PORT` | `8181` | HTTP-Port der Weboberfläche und API |
| `DISCOVERY_PORT` | `8182` | UDP-Port für ESP-Autofind |
| `ENABLE_UDP_DISCOVERY` | `true` | UDP-Discovery aktivieren |
| `PROTOCOL_VERSION` | `2` | erwartete Protokollversion der ESP-Module |
| `JSON_LIMIT` | `2mb` | maximales JSON-Request-Body-Limit |
| `TRUST_PROXY` | `false` | Proxy-Header nur hinter einem kontrollierten Reverse Proxy vertrauen |

Die `.env.example` enthält bei `SERVER_IP` absichtlich eine LAN-Beispieladresse. Für eine produktive Installation wird dieser Wert vom Installer auf die erkannte LAN-Adresse gesetzt.

## Module und Command Queue

| Variable | Standard | Bedeutung |
| --- | ---: | --- |
| `MODULE_TIMEOUT` | `10000` | Zeit in ms, nach der ein Modul als offline gilt |
| `MAX_COMMANDS` | `500` | maximale Größe der Command-Historie |
| `MAX_EVENTS` | `800` | maximale Größe der Event-Historie |
| `COMMAND_MAX_AGE_MS` | `15000` | maximale Lebensdauer eines ausstehenden Befehls |
| `COMMAND_MAX_ATTEMPTS` | `40` | maximale Zustellversuche eines Befehls |
| `UI_STATUS_INTERVAL_MS` | `400` | Status-Polling der Oberfläche; Minimum im Code: 250 ms |

## Rate Limits

| Variable | Standard |
| --- | ---: |
| `RL_GLOBAL_WINDOW_MS` | `10000` |
| `RL_GLOBAL_MAX` | `160` |
| `RL_MODULE_WINDOW_MS` | `5000` |
| `RL_MODULE_MAX` | `80` |

Modul-Endpunkte besitzen ein separates Limit pro Client-IP. Die vom ESP gemeldete Modul-ID wird nicht als Rate-Limit-Schlüssel verwendet.

## Sicherheit und Debug

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `ENABLE_SECURITY_HEADERS` | `true` | setzt zusätzliche HTTP-Sicherheitsheader |
| `ENABLE_DEBUG_ENDPOINTS` | `false` | aktiviert `/api/debug/*` |
| `REQUEST_LOGGING` | `true` | Request-Logging im Backend |
| `CORS_ENABLED` | `false` | Cross-Origin-Zugriffe aktivieren |
| `CORS_ALLOWED_ORIGINS` | leer | kommaseparierte erlaubte Origins; `*` erlaubt alle |

Bei deaktiviertem CORS werden schreibende Browser-Anfragen mit fremdem `Origin` abgewiesen. Geräte und CLI-Clients ohne `Origin` sind davon nicht betroffen.

## Datenverzeichnis

DynoraStation speichert Laufzeitdaten relativ zum Projekt unter `data/`:

```text
data/layout.json
data/hardware.json
data/rules.json
```

Die Dateien werden beim Laden normalisiert. Beschädigte oder nicht lesbare Dateien führen nicht zum Startabbruch; für den betroffenen Bereich werden Defaultdaten geladen und der Fehler wird geloggt.
