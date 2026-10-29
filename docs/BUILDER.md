# Gleisplan-Builder – Bedienung

## Einen Plan erstellen

1. **Builder** direkt in der linken Navigation öffnen. Auf kleinen Displays steht der Eintrag in der unteren Navigation.
2. In der bereits geöffneten **Artikelleiste** eine Kategorie wählen oder eine Artikelnummer suchen. Die Suche berücksichtigt alle Kategorien. Die Gleisfotos helfen bei der Auswahl.
3. Artikel anklicken und anschließend im Plan klicken oder tippen. Die Artikelleiste bleibt geöffnet. Freie Enden rasten automatisch ein. Alternativ einen Artikel mit der Maus direkt in den Plan ziehen.
4. Ein Element anklicken oder antippen, um es auszuwaehlen: Die Eigenschaften erscheinen rechts neben dem Plan. Der Knopf **Eigenschaften** bleibt zusaetzlich in der Werkzeugleiste verfuegbar.
5. Name, Position und Drehung direkt bearbeiten. Modul, Kanäle und weitere Funktionen liegen unter **Hardware & Funktionen**.
6. **Speichern** sichert den Plan auf der Station. Planprüfung, Import, Export, Druck und **Plan & Raster** liegen unter **Planoptionen**.

**Stellpult** zeigt klare Symbole, **Gleisplan** die detaillierten M-Gleis-Schienen. Beide Ansichten verwenden dieselben Positionen und Anschlussgeometrien. Mit **Verbinden** wählst du erst ein Gleis und dann ein zweites. Ein bereits angeschlossenes Gleis bleibt liegen; weitere freie Anschlüsse, etwa an einer Weiche, kannst du nacheinander verbinden. „Artikel“ blendet die Artikelleiste ein oder aus. Drehen, Kopieren und Löschen erscheinen mit einer Auswahl. **Betrieb** wechselt zur Steuerung. Escape beendet die Platzierung und schließt offene Editor-Panels und Menüs.

**Speichern** schreibt auf die Station. Ein lokaler Entwurf ist eine zusätzliche Wiederherstellungshilfe im selben Browser und kein Stations-Backup. Nach einem Reload wird ein vorhandener Entwurf wiederhergestellt und als ungespeichert markiert. Änderungen während einer laufenden Speicheranfrage bleiben ebenfalls ungespeichert. Bei Speicherfehlern wird kein erfolgreicher Speicherstatus angezeigt.

## Weniger Klicks

- Bildkarten starten die Platzierung direkt; Maus-Drag-and-drop platziert einen einzelnen Artikel.
- **Einpassen** passt Ausschnitt und Zoom an die Elemente an. **100 %** setzt die Ansicht auf die gesamte Platte zurück.
- Mausrad: Zoom am Mauszeiger. Freie Fläche ziehen: Ansicht verschieben.
- Ausgewählte Elemente lassen sich bis an alle vier Plattenränder ziehen. Wenn der Rasterfang den letzten Schritt zu grob macht, **Am Raster einrasten** unter **Plan & Raster** deaktivieren.
- **Duplizieren** kopiert die Geometrie, setzt aber Modul, Kanäle, Sensor, Stromkreis und Signalverknüpfung zurück. Dadurch erzeugt eine Kopie keine unbeabsichtigte Hardware-Doppelbelegung.
- **Trennen** entfernt die Verbindungen des ausgewählten Elements.
- Löschen über die Werkzeugleiste ist unmittelbar und lässt sich rückgängig machen. Das vollständige Leeren des Plans fragt weiterhin nach.
- Der Verlauf hält bis zu 50 Änderungen in der laufenden Sitzung vor.

## Tastenkürzel

Die Kürzel gelten ausschließlich im geöffneten Builder und nicht während einer Eingabe in einem Text- oder Auswahlfeld.

| Taste | Aktion |
| --- | --- |
| Strg/Cmd + S | Plan speichern |
| Strg/Cmd + Z | Rückgängig |
| Strg/Cmd + Shift + Z oder Strg/Cmd + Y | Wiederholen |
| Strg/Cmd + D | Element duplizieren |
| V / C | Auswählen / Verbinden |
| R / Shift + R | Rechts / links drehen |
| Escape | Platzierung beenden |
| Entf / Rücktaste | Auswahl löschen |
| Pfeiltasten | Auswahl schrittweise verschieben |
| + / − / 0 | Zoom hinein / heraus / zurücksetzen |

Während der Platzierung dreht R in 7,5°-Schritten; ausgewählte Elemente werden mit den Drehwerkzeugen in 15°-Schritten gedreht. Exakte Werte stehen in den Eigenschaften.

## Import, Backup und Druck

**Planoptionen → Plan herunterladen** exportiert den aktuellen Plan einschließlich ungespeicherter Änderungen. **Plan importieren** prüft die Datei und ersetzt den Arbeitsstand erst nach Bestätigung. Der Import ist rückgängig machbar und muss anschließend gespeichert werden. Maximal 2 MB, 10.000 Elemente und 20.000 Verbindungen.

**Drucken / PDF** öffnet die Druckvorschau inklusive Stückliste und Montagepositionen. Platzierungsvorschauen werden nicht mitgedruckt.

## Planprüfung

Geprüft werden fehlende Zuweisungen, unabhängige Relais-Doppelbelegungen, doppelte LED-Kanäle, isolierte Gleise, mehrfach belegte Anschlüsse, Gleislücken und Elementmittelpunkte außerhalb der Anlagenplatte. Eine gemeinsame Relaisbelegung über denselben ausdrücklich benannten Stromkreis ist zulässig.

Die Prüfung ist eine Planungshilfe. Sie prüft weder die elektrische Verdrahtung noch sämtliche physischen Kollisionen und ersetzt keinen Test an der Anlage. Beim Verkleinern der Platte bleiben bestehende Positionen erhalten; außerhalb liegende Elemente werden gemeldet und nicht beim Zeichnen still verschoben.


## Gleisfotos und Katalogbilder

Die Gleisfotos werden aus einem gemeinsam versionierten Bildmodul geladen.


## Eigenes Foto für das Märklin-Hauptsignal 7039 (ab 3.5.1)

Speichere ein echtes JPEG-Foto als `public/assets/track/7039.jpg` (Dateiname kleingeschrieben). Danach die Seite neu laden. Im Builder unter **Signale & Steuerung** oder über die Suche **7039** erscheint das Bild automatisch. Das Foto wird vollständig eingepasst; Querformat mit etwas Freiraum um das Signal passt gut zu den Artikelkarten.

Das Foto muss nicht in das gebündelte Gleisbildmodul aufgenommen werden. Beim Neuladen erhält die Bildadresse eine neue Cachekennung, damit auch ein später ergänztes oder ersetztes Foto geladen wird. Solange das Foto fehlt oder nicht geladen werden kann, bleibt das Ersatzsymbol sichtbar. Die Darstellung und Schaltfunktion im Anlagenplan bleiben gleich. Das Paket enthält noch kein Foto von 7039.


## Planversionen und Speicherkonflikte

Unter **Planoptionen → Planversionen** lassen sich die letzten 20 vorherigen Stationspläne wiederherstellen. Dabei wird der aktuelle Plan zuerst gesichert. Bei einem Speicherkonflikt bleibt dein Entwurf erhalten: lade ihn herunter und hole anschließend über **Stationsplan laden** den neuen Stand.

## Auswahl, Signale und Artikelgeometrie

Im Auswahlmodus oeffnet ein Klick auf ein Bauteil dessen Eigenschaften rechts neben dem Plan. Der Knopf **Eigenschaften** bleibt zusaetzlich in der Werkzeugleiste verfuegbar. Signale und ESP-Ampeln sind kompakt gezeichnet. Ihre Fahrtrichtung l?sst sich in den Eigenschaften einstellen.

Die im Katalog gefuehrten M-Gleis-Teile verwenden ihre Artikelmasse und Winkel. Kontrollierte Korrekturen: 5109 = 33,8 mm; 5114 = 192 mm / 30 Grad; 5128 = 180 mm / 30 Grad; 5141/5142 = R1 / 30 Grad mit 77,4 mm geradem Zulauf; 5138/5139 = R1 / 22,5 Grad; einzelne R2-Weichen = 5203 links und 5204 rechts (5202 bezeichnet das Paar). Die Artikelliste enthaelt nicht jede historische M-Gleis-Sonderform; nicht aufgefuehrte Artikel gelten dadurch nicht als geometrisch geprueft.
