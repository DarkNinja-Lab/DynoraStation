# HTTP-API

Die Weboberfläche und die ESP8266-Module verwenden dieselbe HTTP-API. Standardport ist `8181`.

Die API besitzt derzeit keine Benutzeranmeldung. Sie ist für ein vertrauenswürdiges lokales Netz gedacht und sollte nicht direkt aus dem Internet erreichbar sein.

## Allgemein

JSON wird für Request- und Response-Bodies verwendet, sofern ein Endpunkt nicht ausdrücklich Firmware als `application/octet-stream` überträgt. Fehlerantworten werden vom zentralen Error-Handler erzeugt und enthalten einen maschinenlesbaren Fehlercode.

## Status und Katalog

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/healthz` | einfacher Prozess-/Storage-Healthcheck |
| `GET` | `/api/status` | Gesamtstatus für die Weboberfläche |
| `DELETE` | `/api/events` | Ereignislog leeren |
| `GET` | `/api/track-catalog` | verfügbarer Märklin-M-Gleis-Katalog |

`/api/status` akzeptiert `layoutRevision` und `eventRevision` als Query-Parameter. Unveränderte Bereiche können dadurch als `null` zurückgegeben werden.

## Layout und Regeln

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/layout` | gespeichertes Layout lesen |
| `POST` | `/api/layout` | Layout validieren, normalisieren und speichern |
| `GET` | `/api/layout/history` | frühere Planstände auflisten |
| `POST` | `/api/layout/history/:id/restore` | Planstand mit Versionsschutz wiederherstellen |
| `GET` | `/api/rules` | Regeln lesen |
| `POST` | `/api/rules` | Regeln ersetzen und speichern |

Beim Speichern des Layouts werden zusätzlich Relaiskonflikte ermittelt und als Warnungen zurückgegeben.

### Automationen und Abläufe

`POST /api/rules` erwartet `{ "rules": [...] }`. Eine Regel enthält `id`, `name`, `enabled`, `cooldownMs`, `condition` und `steps`. `groupId` und `groupName` fassen mehrere Regeln zu einer Automation zusammen.

Ein Schritt ist entweder `{ "type": "actions", "actions": [...] }` oder `{ "type": "delay", "durationMs": 5000 }`. Wartezeiten können vor der ersten Aktion oder zwischen Aktionen stehen. Mehrere Ziele werden als einzelne Aktionen innerhalb desselben Aktionsschritts übertragen.

Die Normalisierung begrenzt die Liste auf 32 Schritte, 24 Aktionen pro Schritt und 24 Stunden pro Warte- oder Sperrzeit. Die zusätzliche flache `actions`-Liste enthält höchstens 96 Aktionen für ältere Integrationen. Diese Liste enthält keine Wartezeiten; für die Ausführungsreihenfolge ist `steps` maßgeblich. Regeln ohne Aktionen und doppelte Regel-IDs werden verworfen.

Alte Regeln mit ausschließlich `actions` werden weiterhin angenommen. Bei den Typen werden `crossing` zu `xtrack` und `espSignal` zu `ledsignal` normalisiert. Die Sperrzeit beginnt beim Start eines Ablaufs. Nach einer Wartezeit prüft der Server, ob die ursprüngliche Regel noch aktiv und unverändert im Laufzeitzustand vorhanden ist.

## Hardwarekonfiguration

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/hardware` | komplette Hardwarekonfiguration lesen |
| `POST` | `/api/hardware/relay-config` | Name/Rolle eines Relais ändern |
| `POST` | `/api/hardware/led-config` | LED-Kanal konfigurieren |
| `POST` | `/api/hardware/sensor-rename` | Sensor umbenennen |
| `GET` | `/api/light-buttons` | vier Lichtbuttons lesen |
| `POST` | `/api/light-buttons` | vier Lichtbuttons speichern |
| `GET` | `/api/light-system` | Lichtgruppen und Laufzeitstatus lesen |
| `POST` | `/api/light-system` | Lichtgruppen speichern |
| `POST` | `/api/light-system/groups/:id/control` | manuelle Lichtgruppe schalten |
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

Ein ACK benötigt Befehls-ID und Modul-ID. Der Server prüft die Zuordnung auch bei bereits erledigten Befehlen; ein anderes Modul kann keinen fremden Befehl bestätigen.

Der Server liefert Steuerbefehle nur an online gemeldete Module mit kompatibler Protokollversion aus. Bei inkompatibler Firmware bleibt ein wartender Befehl in der Queue und kann nach einem erfolgreichen Firmware-Update erneut abgeholt werden. Ein Sensorzustand, der wegen eines verlorenen HTTP-ACKs identisch erneut gemeldet wird, löst keine zweite Automation aus.

## OTA-Firmware

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/ota/config-status` | OTA-Konfiguration und unterstützte Hardwaretypen prüfen |
| `GET` | `/api/ota/sketch-template` | Firmwarevorlage für einen Hardwaretyp laden |
| `POST` | `/api/ota/build` | konfigurierte Firmware im Server bauen |
| `POST` | `/api/ota/manual-firmware` | kompatible BIN-Datei bereitstellen |
| `GET` | `/api/ota/build-status` | Status eines Firmware-Builds abfragen |
| `POST` | `/api/ota/:moduleId` | fertige Firmware für ein Modul vormerken |
| `GET` | `/api/ota/status` | OTA-Status eines Moduls abfragen |
| `GET` | `/api/module/ota-firmware` | vom ESP abgerufene Firmware ausliefern |
| `POST` | `/api/module/ota-result` | OTA-Ergebnis des ESP entgegennehmen |

Die letzten beiden Endpunkte sind ausschließlich für die Firmware. Sie erwarten den Header `X-Dynora-OTA-Token` mit `OTA_SHARED_SECRET`; ohne mindestens 24 Zeichen langen Schlüssel bleibt OTA deaktiviert.

## Debug-Endpunkte

Nur aktiv, wenn `ENABLE_DEBUG_ENDPOINTS=true` gesetzt ist:

| Methode | Pfad |
| --- | --- |
| `GET` | `/api/debug/commands` |
| `GET` | `/api/debug/hardware` |

Im normalen Betrieb sollten diese Endpunkte deaktiviert bleiben.

## Stationsupdates

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/update/status` | lokalen `version.txt`-Marker mit `main` auf GitHub vergleichen |

## DynoraStation-Prozess

| Methode | Pfad | Zweck |
| --- | --- | --- |
| `GET` | `/api/station` | Laufstatus des DynoraStation-Prozesses |
| `POST` | `/api/station/restart` | Nur DynoraStation neu starten |
| `POST` | `/api/station/shutdown` | Nur DynoraStation beenden |

Die beiden schreibenden Endpunkte erwarten den Header `X-Dynora-Action: station-control` sowie im JSON-Body `{"confirm":"restart"}` bzw. `{"confirm":"shutdown"}`. Sie führen keinen Betriebssystem-Neustart und kein Betriebssystem-Herunterfahren aus.

## Planspeicherung mit Versionsschutz (ab 3.6)

`GET /api/layout` liefert den Plan mit `_editVersion`. `GET /api/status` enthält `layoutVersion`; sie gehört zum gleichzeitig gelieferten Plan. Clients dürfen die Basisversion eines noch bearbeiteten Plans nicht durch bloßes Statuspolling ersetzen.

`POST /api/layout` benötigt den unverändert übernommenen Versionswert im Header `If-Match`. Body bleibt das Layout-JSON. Erfolg liefert `layout`, `layoutVersion` und `warnings`. HTTP **409 / LAYOUT_CONFLICT**: neueren Stationsplan explizit laden oder Änderungen bewusst zusammenführen; nicht blind erneut senden. HTTP **428 / LAYOUT_VERSION_REQUIRED**: Client aktualisieren und Plan laden. HTTP **500 / SAVE_FAILED**: keine erfolgreiche Speicherung melden.

`GET /api/layout/history` liefert `versions` mit `id`, `savedAt`, `name`, `elements` sowie die aktuelle `layoutVersion`. `POST /api/layout/history/:id/restore` benötigt `If-Match` mit dieser Version und stellt den ausgewählten Plan wieder her. Keine ungeschützte Schreib- oder Wiederherstellungsvariante. Der aktuelle Plan wird vorher archiviert; 20 frühere Stände werden aufbewahrt.
