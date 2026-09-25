# HTTP-API

Die Weboberfläche und die ESP8266-Module verwenden dieselbe HTTP-API. Standardport ist `8181`.

Die API besitzt derzeit keine Benutzeranmeldung. Sie ist für ein vertrauenswürdiges lokales Netz gedacht und sollte nicht direkt aus dem Internet erreichbar sein.

## Allgemein

JSON wird für Request- und Response-Bodies verwendet. Fehlerantworten werden vom zentralen Error-Handler erzeugt und enthalten einen maschinenlesbaren Fehlercode.

## Status und Katalog

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/healthz` | einfacher Prozess-/Storage-Healthcheck |
| `GET` | `/api/status` | Gesamtstatus für die Weboberfläche |
| `GET` | `/api/track-catalog` | verfügbarer Märklin-M-Gleis-Katalog |

`/api/status` akzeptiert `layoutRevision` und `eventRevision` als Query-Parameter. Unveränderte Bereiche können dadurch als `null` zurückgegeben werden.

## Layout und Regeln

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/layout` | gespeichertes Layout lesen |
| `POST` | `/api/layout` | Layout validieren, normalisieren und speichern |
| `GET` | `/api/rules` | Regeln lesen |
| `POST` | `/api/rules` | Regeln ersetzen und speichern |

Beim Speichern des Layouts werden zusätzlich Relaiskonflikte ermittelt und als Warnungen zurückgegeben.

## Hardwarekonfiguration

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/hardware` | komplette Hardwarekonfiguration lesen |
| `POST` | `/api/hardware/relay-config` | Name/Rolle eines Relais ändern |
| `POST` | `/api/hardware/led-config` | LED-Kanal konfigurieren |
| `POST` | `/api/hardware/sensor-rename` | Sensor umbenennen |
| `GET` | `/api/light-buttons` | vier Lichtbuttons lesen |
| `POST` | `/api/light-buttons` | vier Lichtbuttons speichern |
| `POST` | `/api/control/settings` | gebündelte Hardwareeinstellungen speichern |
| `POST` | `/api/control/defaults/apply` | definierte Grundstellungen ausführen |

## Direkte Steuerung

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `POST` | `/api/relay` | Relais schalten |
| `POST` | `/api/control/relay` | Alias für `/api/relay` |
| `POST` | `/api/led` | LED setzen, dimmen oder blinken lassen |
| `POST` | `/api/switch/control` | Weiche stellen |
| `POST` | `/api/signal/control` | Relais-Signal stellen |
| `POST` | `/api/xtrack/control` | Kreuzungsweiche stellen |
| `POST` | `/api/esp-signal/control` | LED-Signal stellen |
| `POST` | `/api/track/control` | Gleisstrom oder Entkupplungsgleis schalten |
| `POST` | `/api/emergency-stop` | `NOT_AUS` an alle aktuell erreichbaren Module senden |

Beispiel für ein Relais:

```http
POST /api/relay
Content-Type: application/json

{
  "module": "GLEIS_01",
  "channel": 1,
  "state": true
}
```

Die Antwort bestätigt zunächst die Annahme des Befehls. Der tatsächliche Hardwarezustand wird erst nach ACK des ESP-Moduls übernommen.

Beispiel für eine LED mit PWM:

```http
POST /api/led
Content-Type: application/json

{
  "module": "LEDMOD_01",
  "channel": 1,
  "mode": "pwm",
  "brightness": 160
}
```

## ESP8266-Modulprotokoll

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `POST` | `/api/module/heartbeat` | Modul anmelden und Zustand melden |
| `GET` | `/api/module/next-command` | nächsten Queue-Befehl holen |
| `POST` | `/api/module/ack` | ausgeführten Befehl bestätigen |
| `POST` | `/api/module/sensor` | einzelnes Sensorereignis melden |
| `POST` | `/api/module/rename` | Anzeigenamen eines Moduls ändern |
| `POST` | `/api/module/delete` | Modul und seine Zuordnungen entfernen |

Ein Heartbeat enthält je nach Modultyp unter anderem:

```json
{
  "module": "...",
  "firmwareVersion": "...",
  "protocolVersion": 2,
  "hardwareType": "...",
  "relays": [],
  "sensors": [],
  "leds": []
}
```

Die Antwort kann zusätzlich bereits den nächsten ausstehenden Befehl enthalten. So kann ein Befehl auch über den Heartbeat zugestellt werden, falls separates Polling ausfällt.

Ein ACK benötigt mindestens die Befehls-ID. Wenn eine Modul-ID mitgesendet wird, prüft der Server, ob der Befehl tatsächlich diesem Modul gehört.

## Debug-Endpunkte

Nur aktiv, wenn `ENABLE_DEBUG_ENDPOINTS=true` gesetzt ist:

| Methode | Pfad |
| --- | --- |
| `GET` | `/api/debug/commands` |
| `GET` | `/api/debug/hardware` |

Im normalen Betrieb sollten diese Endpunkte deaktiviert bleiben.
