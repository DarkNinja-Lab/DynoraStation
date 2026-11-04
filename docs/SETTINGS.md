# Einstellungen

Unter **Einstellungen** sind Geräte, Anlage und Station getrennt angeordnet. Eine Kachel öffnet den jeweiligen Bereich; **Zurück** führt zur Übersicht. Auf dem Handy erreichst du die Einstellungen über **Mehr**.

## Geräte einrichten

1. Unter **Module** prüfen, ob das ESP erkannt und erreichbar ist.
2. Module und Kanäle eindeutig benennen, etwa „Bahnhof West“ oder „Einfahrsignal“.
3. Unter **Relais**, **Sensoren** oder **LEDs & Signale** die Anschlüsse konfigurieren.
4. Die Änderungen im jeweiligen Bereich speichern.

Ein offline oder inkompatibles Modul kann angezeigt und zugeordnet werden. Zum Schalten muss es erreichbar sein und den angeforderten Kanal unterstützen. Ein angenommener Befehl ist erst nach Bestätigung durch das ESP ausgeführt.

**Lichttasten** konfiguriert die vier Schnellzugriffe im Betrieb. Zeitgesteuerte Lichtgruppen werden im eigenen Bereich **Lichtsystem** eingerichtet.

## Automationen

Eine Automation bündelt benannte Regeln. Jede Regel besitzt einen **WENN-Auslöser** und einen geordneten **DANN-Ablauf**.

Die Übersicht zeigt Name und Regelanzahl. **Bearbeiten** öffnet eine Automation; die einzelnen Regeln lassen sich separat aufklappen. Die Zielauswahl zeigt zunächst die zugeordneten Ziele und öffnet auf Wunsch alle Checkboxen. Die Sperrzeit steht unter **Weitere Optionen**, die Sammelauswahl unter **Auswahl verwalten**.

1. **Neue Automation** wählen und einen eindeutigen Namen vergeben.
2. Die Regel benennen und Typ, Quelle und Zustand des Auslösers auswählen.
3. Eine Aktion hinzufügen: Zieltyp, ein oder mehrere Ziele und die gewünschte Aktion wählen.
4. Bei Bedarf eine **Wartezeit** vor oder zwischen Aktionen einfügen.
5. Die Sperrzeit prüfen und **Automationen speichern**.

Beispiel: Sensor S1 wird aktiv → Einfahrsignal auf Halt → fünf Sekunden warten → Bahnhofslicht einschalten.

Die Schritte laufen in der angezeigten Reihenfolge. Mehrere Ziele derselben Aktion erhalten denselben Schaltzustand. Die Sperrzeit beginnt beim Start des Ablaufs und verhindert ein erneutes Auslösen innerhalb dieses Zeitraums.

Eine pausierte Regel löst nicht aus. Wird eine wartende Regel geändert, gelöscht oder pausiert, führt der Server ihre bereits geplanten Folgeschritte nicht weiter aus. Unvollständige Regeln müssen vor dem Speichern ergänzt werden.

Suche und Sammelauswahl beziehen sich auf die sichtbaren Automationen. Löschen wird erst durch anschließendes Speichern dauerhaft übernommen.

## Grundstellungen

Grundstellungen definieren die Startzustände für Weichen, Kreuzungsweichen, Märklin-Signale, ESP-Signale und Relais.

1. Einen **Zustand hinzufügen** oder eine benannte **Gruppe anlegen**.
2. Typ, konkretes Ziel und Startzustand auswählen.
3. **Standards speichern**.

Beim nächsten Start oder Wiederverbinden des zuständigen ESP sendet DynoraStation die für dieses Modul passenden Zustände. Eine Gruppe dient der Übersicht; sie löst keinen eigenen Ablauf aus. Leere Gruppen werden nicht separat gespeichert, sondern ergeben sich aus den zugeordneten Zuständen.

Eine Änderung in der Liste schaltet die Anlage nicht sofort. Suche, Gruppierung und Sammelauswahl helfen, größere Anlagen zu verwalten. Entfernte Einträge werden erst mit dem Speichern aus der Stationskonfiguration gelöscht.

## Firmware und Station

**ESP-Firmware** enthält Erstinstallation, Firmware-Build und OTA-Installation für die Module. Voraussetzungen und Anschlussdetails stehen in der [Firmwareanleitung](ESP_README.md) und unter [Sicherheit](SECURITY.md).

**DynoraStation-Updates** betrifft die Serversoftware. **Server & Neustart** zeigt den Prozessstatus. Die Schritte für die jeweilige Installationsart stehen unter [Betrieb und Updates](OPERATIONS.md).
