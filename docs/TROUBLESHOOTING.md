# Fehlersuche

## Weboberfläche nicht erreichbar

Linux:

```bash
sudo systemctl status dynorastation
sudo journalctl -u dynorastation -n 100 --no-pager
curl http://127.0.0.1:8181/healthz
```

Dann `.env`, `SERVER_PORT`, Firewall und gegebenenfalls nginx prüfen.

Windows: Logdatei unter

```text
%ProgramData%\DynoraStation\data\dynorastation.log
```

Außerdem prüfen, ob der Task `DynoraStation` in der Aufgabenplanung läuft.

## `/healthz` funktioniert, Browser aber nicht

Prüfen:

1. richtige LAN-IP des Servers
2. TCP-Port in der Firewall
3. nginx-Konfiguration, falls aktiviert
4. Browser-Cache beziehungsweise einen privaten Tab

## ESP-Modul bleibt offline

1. Versorgung und WLAN-Verbindung des ESP prüfen.
2. Seriellen Monitor öffnen.
3. Server und ESP müssen sich gegenseitig im Netz erreichen können.
4. `DISCOVERY_PORT` und Firewall prüfen.
5. `PROTOCOL_VERSION` zwischen Firmware und Server vergleichen.
6. Fallback-Adresse `SERVER_HOST` in der Firmware prüfen.

Die Firmware versucht UDP-Discovery und fällt bei Bedarf auf `SERVER_HOST` zurück.

## MCP23017 wird nicht gefunden

Beim Relaismodul erwartet die Firmware den MCP23017 auf `0x20`.

Prüfen:

- 3,3 V an `VDD`
- gemeinsame Masse
- SDA an D2/GPIO4
- SCL an D1/GPIO5
- RESET auf 3,3 V, empfohlen über 10 kΩ
- A0, A1, A2 auf GND
- Pull-ups auf SDA/SCL vorhanden

Weitere Details: [`../esp8266_code/MCP23017_ANSCHLUSS.md`](../esp8266_code/MCP23017_ANSCHLUSS.md)

## Relais schaltet nicht

Bei dem dokumentierten 16-Kanal-Board sind die Eingänge LOW-triggered. Der MCP23017 wird deshalb nicht normal HIGH/LOW betrieben, sondern schaltet den jeweiligen Pin für EIN auf `OUTPUT LOW` und für AUS auf `INPUT`.

Wenn das verwendete Relaisboard elektrisch anders aufgebaut ist, darf diese Ansteuerung nicht ungeprüft übernommen werden.

## Update schlägt fehl

Linux:

```bash
sudo dynora-update --check
sudo journalctl -u dynorastation -n 100 --no-pager
```

Prüfen, ob GitHub erreichbar ist, Node/npm verfügbar sind und ausreichend freier Speicher vorhanden ist.

Der Linux-Updater versucht bei einem Fehler ein Rollback aus `/var/backups/dynorastation`.

Windows-Backups liegen unter `%ProgramData%\DynoraStation-backups`.

## Daten werden nach einem Neustart zurückgesetzt

Prüfen, ob der Prozess Schreibrechte auf `data/` besitzt. Der Healthcheck zeigt Storage-Fehler unter `writeErrors` an.

```bash
curl http://127.0.0.1:8181/healthz
```

## Modul ist online, Schalten liefert trotzdem Fehler

Mögliche Gründe:

- Protokollversion nicht kompatibel
- Modul meldet den Relais-Treiber als nicht bereit
- für denselben Kanal ist bereits ein Befehl ausstehend
- Layout enthält keine gültige Modul-/Kanalzuordnung
- Modul ist seit `MODULE_TIMEOUT` nicht mehr aktuell
