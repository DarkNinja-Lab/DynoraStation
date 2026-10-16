"use strict";

import { getLanguage } from "./i18n.js?v=workspace-v21";

// German source text -> English. Whole strings are matched first, then phrases
// (longest first) so dynamic messages built from several fragments are covered.
const PHRASES = {
  // ---- Navigation / chrome
  "Übersicht": "Overview", "Betrieb": "Operations", "Builder": "Builder", "Einstellungen": "Settings", "Logbuch": "Logbook",
  "Hilfe & Anleitung": "Help & Guide", "Hilfe & Support": "Help & Support", "Hauptnavigation": "Main navigation",
  "Mobile Navigation": "Mobile navigation", "Mehr": "More", "System": "System", "SYSTEM": "SYSTEM", "Dynora Logo": "Dynora logo",
  "Gerätecenter": "Device center", "Gerätecenter öffnen": "Open device center", "Gerätecenter schließen": "Close device center",
  "Geräte": "Devices", "GERÄTE": "DEVICES", "Sprache ändern": "Change language", "NOT-AUS": "EMERGENCY STOP",
  "Neu starten": "Restart", "Betrieb öffnen": "Open operations", "Builder öffnen": "Open builder", "System öffnen": "Open system",
  "Logbuch öffnen": "Open logbook", "Übersicht öffnen": "Open overview", "Betrieb öffnen →": "Open operations →",
  "Logbuch öffnen →": "Open logbook →", "Module öffnen →": "Open modules →", "Automationen öffnen →": "Open automations →",
  "Firmware-Updates öffnen →": "Open firmware updates →", "Grundstellung öffnen →": "Open default state →",
  "Builder und Artikelliste öffnen →": "Open builder and article list →", "Geräte verwalten →": "Manage devices →",
  "Relais ansehen →": "View relays →", "← Alle Einstellungen": "← All settings", "Alle Einstellungen": "All settings",
  "ANALOG-STELLWERK · MÄRKLIN M-GLEIS": "ANALOG CONTROL PANEL · MÄRKLIN M-TRACK",
  "MÄRKLIN M-GLEIS · LIVE-STEUERUNG": "MÄRKLIN M-TRACK · LIVE CONTROL",
  "Analog-Stellwerk für Märklin M-Gleis · Betriebsbild, Systemzustand und letzte Aktivitäten": "Analog control panel for Märklin M-track · operations view, system status and recent activity",
  "DynoraStation • Märklin M-Gleis Steuerung": "DynoraStation • Märklin M-track control",
  "DynoraStation wird geladen": "Loading DynoraStation", "Märklin H0 · Metallgleis": "Märklin H0 · metal track", "M-Gleis": "M-track",
  "Deine Modellbahn": "Your model railway", "Meine Modellbahn": "My model railway", "Zentrale": "Control Center",
  "Anlage": "Layout", "Anlagen": "Layouts", "Anlage bedienen": "Operate layout", "Anlagenlicht": "Layout lighting",
  "Anlagenplatte": "Layout board", "Anlagenprofil": "Layout profile", "Anlagenplan": "Layout plan",
  "Stellwerk": "Control panel", "Stellpult": "Control desk", "Stationsplan": "Station plan", "Stationsplan laden": "Load station plan",
  "Lokale DynoraStation": "Local DynoraStation", "Live": "Live",
  // ---- Status
  "Online": "Online", "Offline": "Offline", "OFFLINE": "OFFLINE", "ONLINE": "ONLINE", "Aktiv": "Active", "AKTIV": "ACTIVE",
  "Aktiv / erkannt": "Active / detected", "Aktiv / ausgelöst": "Active / triggered", "Online / registriert": "Online / registered",
  "online / registriert": "online / registered", "Läuft": "Running", "Bereit": "Ready", "Fertig": "Done", "Fehler": "Error",
  "Fehlgeschlagen": "Failed", "Warnung": "Warning", "Gespeichert": "Saved", "Ungespeichert": "Unsaved",
  "DYNORASTATION OFFLINE": "DYNORASTATION OFFLINE", "DYNORASTATION ONLINE": "DYNORASTATION ONLINE",
  "DynoraStation offline": "DynoraStation offline", "DynoraStation online": "DynoraStation online",
  "DynoraStation ist wieder online": "DynoraStation is back online", "DynoraStation konnte nicht starten": "DynoraStation could not start",
  "Start fehlgeschlagen. Bitte Station prüfen und Seite neu laden.": "Start failed. Please check the station and reload the page.",
  "Hardwarestatus wird geprüft": "Checking hardware status", "Status wird synchronisiert": "Synchronizing status",
  "Synchronisierung läuft": "Synchronization in progress", "Systemstatus wird geladen …": "Loading system status …",
  "Systemstatus wird geprüft": "Checking system status", "Alle Module erreichbar und kompatibel": "All modules reachable and compatible",
  "Alle Systeme betriebsbereit": "All systems operational", "Modul(e) nicht erreichbar": "module(s) not reachable",
  "Modulen schaltbereit": "modules ready to switch", "Inkompatible Firmware": "Incompatible firmware",
  "Nicht gemeldet": "Not reported", "Noch nicht erkannt": "Not detected yet", "noch nicht erkannt": "not detected yet",
  "Typ wird erkannt": "Detecting type", "BME280 nicht gemeldet": "BME280 not reported", "BME280-Modul offline": "BME280 module offline",
  "MCP23017 nicht erreichbar": "MCP23017 not reachable", "keine aktuelle IP": "no current IP",
  "Kompatibilitätsdaten unvollständig": "Compatibility data incomplete", "verbunden": "connected",
  "ESP offline": "ESP offline", "ESP offline:": "ESP offline:", "ESP nicht schaltbereit": "ESP not ready to switch",
  "Noch kein ESP verbunden.": "No ESP connected yet.", "Noch kein Modul verbunden": "No module connected yet",
  "Noch keine Module registriert": "No modules registered yet", "Noch keine ESP-Module registriert.": "No ESP modules registered yet.",
  "Noch keine Steuerungsmodule registriert": "No control modules registered yet", "Kein unterstütztes ESP-Modul gefunden.": "No supported ESP module found.",
  "Verbundene Module": "Connected modules", "Verbindung unterbrochen": "Connection lost", "Verbindung wird kurz unterbrochen": "Connection will be briefly interrupted",
  "Schalte deinen ESP ein und verbinde ihn mit demselben Netzwerk. Erkannte Module erscheinen hier automatisch.": "Switch on your ESP and connect it to the same network. Detected modules appear here automatically.",
  "Noch keine Ereignisse vorhanden.": "No events yet.", "Keine schaltbaren Weichen, Signale oder Entkuppler im Plan": "No controllable turnouts, signals or uncouplers in the plan",
  "Hier findest du deine ESP-Module. Öffne ein Modul, um seinen Namen oder seine Anschlüsse zu bearbeiten.": "Your ESP modules are listed here. Open a module to edit its name or connections.",
  "Modul wählen…": "Choose module…", "Ein unterstütztes, online angezeigtes ESP-Modul auswählen.": "Select a supported ESP module that is shown as online.",
  "Wähle ein ESP-Modul aus.": "Select an ESP module.", "Wähle zuerst ein unterstütztes ESP-Modul.": "Select a supported ESP module first.",
  "ESP-Modul wurde nicht gefunden.": "ESP module not found.", "Der ESP muss für OTA online sein.": "The ESP must be online for OTA.",
  // ---- Dashboard / quick links
  "Betriebsbild": "Operations view", "Systemzustand": "System status", "Letzte Ereignisse": "Latest events", "Alle anzeigen": "Show all",
  "Schnellzugriff": "Quick access", "Erste Schritte": "Getting started", "Fahrwege, Rückmelder und Schaltzustände auf einen Blick.": "Routes, feedback sensors and switching states at a glance.",
  "Geräte prüfen": "Check devices", "Stromversorgung, WLAN und angezeigte IP-Adresse prüfen.": "Check power supply, Wi-Fi and the displayed IP address.",
  "Gleisplan bearbeiten": "Edit track plan", "Gleisbild bearbeiten": "Edit track plan", "Gleisbild bedienen, Weichen und Signale schalten, Anlagenlicht steuern.": "Operate the track plan, switch turnouts and signals, control layout lighting.",
  "Geräte konfigurieren": "Configure devices", "Wähle aus, was du einrichten möchtest.": "Choose what you want to set up.",
  "Verbindungen prüfen und Geräte benennen": "Check connections and name devices", "Wenn-Dann-Abläufe anlegen": "Create if-then sequences",
  "Automationen verwalten": "Manage automations", "Grundstellungen verwalten": "Manage default states", "Startzustände der Anlage festlegen": "Define the layout's start states",
  "Firmware-Updates": "Firmware updates", "Firmware-Update (OTA)": "Firmware update (OTA)", "Firmware-Update per OTA": "Firmware update via OTA",
  "Firmware per OTA aktualisieren": "Update firmware via OTA", "ESP-Firmware erstellen und per OTA installieren": "Build ESP firmware and install via OTA",
  "Firmware auf dem Server bauen und anschließend per OTA auf einen ESP übertragen.": "Build firmware on the server and then transfer it to an ESP via OTA.",
  "Firmware erstellen": "Build firmware", "Firmware-Fortschritt": "Firmware progress", "Auf ESP installieren": "Install on ESP",
  "ESP-Modul und Firmwaretyp": "ESP module and firmware type", "Firmware": "Firmware", "Server": "Server", "Server & Neustart": "Server & restart",
  "Station": "Station", "Station steuern": "Control station", "Station beenden": "Stop station", "Prozess": "Process", "Version": "Version",
  "Laufzeit": "Uptime", "Version, Laufzeit und Prozesssteuerung": "Version, uptime and process control", "Updates": "Updates",
  "Ablauf und Voraussetzungen": "Procedure and requirements", "Voraussetzung:": "Requirement:", "Schließen": "Close", "Öffnen": "Open",
  "Zurück": "Back", "Speichern": "Save", "Löschen": "Delete", "Suchen": "Search", "Suche": "Search", "Verwalten": "Manage",
  "Duplizieren": "Duplicate", "Bearbeiten": "Edit", "Wiederherstellen": "Restore", "Wiederholen": "Redo", "Rückgängig": "Undo",
  "Später": "Later", "Neu laden": "Reload", "Prüfen": "Check", "Trennen": "Disconnect", "Verbinden": "Connect",
  "Wirklich leeren?": "Really clear?", "Typ": "Type", "Name": "Name", "Quelle": "Source", "Ziel": "Target", "Zustand": "State",
  "Aktion": "Action", "Aktionen": "Actions", "Regel": "Rule", "Regeln": "Rules", "Auslöser": "Trigger", "Aktuelle": "Current",
  "Kategorie": "Category", "Inhalt": "Contents", "Inhalt der Hilfe": "Help contents", "Konfiguration": "Configuration", "Hinweise": "Notes",
  "Links": "Left", "Rechts": "Right", "links": "left", "rechts": "right", "Kein": "None", "Ein": "On", "Aus": "Off", "EIN": "ON", "AUS": "OFF",
  "Abschnitt antippen": "Tap a section", "Tippen zum Schalten": "Tap to switch", "Bereiche und typische Abläufe der Anlage.": "Areas and typical workflows of the layout.",
  "Anleitung": "Guide", "Fehlersuche & Support": "Troubleshooting & support", "Discord öffnen": "Open Discord", "Discord-Community": "Discord community",
  "E-Mail schreiben": "Send email", "DYNORASTATION · HILFE": "DYNORASTATION · HELP", "QUALITÄTSCHECK": "QUALITY CHECK",
  // ---- Help
  "Betrieb: Anlage schalten": "Operations: switch the layout", "Im Anlagenplan": "In the layout plan",
  "DynoraStation besteht aus dem Gleisplan, den verbundenen ESP-Modulen und den dafür eingerichteten Schaltfunktionen. Prüfe zuerst im Gerätecenter, ob die Module online sind. Danach kannst du im Betrieb testen oder im Builder den Plan und seine Hardware-Zuordnungen einrichten.": "DynoraStation consists of the track plan, the connected ESP modules and the switching functions set up for them. First check in the device center whether the modules are online. Then you can test in Operations or set up the plan and its hardware assignments in the Builder.",
  "Im Betriebsbild schaltest du Weichen, Märklin-Signale, ESP-Signale und zugeordnete Stromabschnitte. Ein Status im Gleisbild wird nach bestätigter Rückmeldung aktualisiert. Ein rotes oder offline Modul kann zugewiesene Funktionen blockieren. Das mobile Bedienfeld lässt sich über die Abschnittsüberschriften ein- und ausklappen.": "In the operations view you switch turnouts, Märklin signals, ESP signals and assigned track sections. A status in the track plan is updated after confirmed feedback. A red or offline module can block assigned functions. The mobile control panel can be expanded and collapsed via the section headings.",
  "Öffne den Builder über „Gleisbild bearbeiten“. Bauteile findest du links in der Artikelliste: Kategorie wählen, suchen und ein Element in die Fläche ziehen. Mit dem Mausrad kannst du die Artikelliste horizontal durchblättern. Ein Element auswählen, um es zu verschieben, zu drehen, zu verbinden oder seine Eigenschaften zu öffnen. Dort kannst du, sofern unterstützt, ESP-Modul und Relais zuweisen. Speichere den Plan, damit er auf der Station übernommen wird.": "Open the Builder via “Edit track plan”. You will find components in the article list on the left: choose a category, search and drag an element onto the canvas. Use the mouse wheel to scroll the article list horizontally. Select an element to move, rotate, connect it or open its properties. There you can assign an ESP module and relay, where supported. Save the plan so it is applied on the station.",
  "Unter Einstellungen findest du Module, Relais, Sensoren sowie LEDs und Signale. Benenne Kanäle eindeutig und ordne sie nur einem passenden Planelement zu. Sensoren liefern Rückmeldungen; Relais schalten angeschlossene Stromkreise oder Verbraucher. Das Gerätecenter zeigt den Verbindungsstatus der ESPs.": "Under Settings you will find modules, relays, sensors as well as LEDs and signals. Name channels clearly and assign them only to a suitable plan element. Sensors provide feedback; relays switch connected circuits or loads. The device center shows the connection status of the ESPs.",
  "Unter Einstellungen → Automationen erstellst du WENN-DANN-Regeln. Wähle einen Auslöser, etwa einen Sensor oder eine Weiche, und füge eine oder mehrere Aktionen hinzu. Regeln kannst du suchen und gesammelt auswählen. Ungespeicherte Änderungen mit „Änderungen speichern“ übernehmen.": "Under Settings → Automations you create IF-THEN rules. Choose a trigger, such as a sensor or a turnout, and add one or more actions. You can search for rules and select them in bulk. Apply unsaved changes with “Save changes”.",
  "Das Logbuch enthält System-, Sensor-, Schalt- und OTA-Meldungen. Suche, Typ, Quelle und Sortierung helfen beim Eingrenzen. Einträge bleiben nach Neustarts erhalten. „Logbuch löschen“ entfernt alle gespeicherten Einträge.": "The logbook contains system, sensor, switching and OTA messages. Search, type, source and sorting help narrow things down. Entries are kept after restarts. “Delete logbook” removes all stored entries.",
  "Modulzuordnung und Online-Status kontrollieren. Bei wiederholten ESP-Abstürzen helfen die seriellen Logs mit Resetgrund und freiem Speicher. Bei Problemen beschreibe Gerät, betroffenen Bereich und angezeigte Fehlermeldung.": "Check module assignment and online status. For repeated ESP crashes, the serial logs with reset reason and free memory help. When reporting problems, describe the device, the affected area and the displayed error message.",
  "Hier legst du Schaltzustände fest, die bei „Jetzt anwenden“ gesetzt werden sollen. Suche nach Einträgen und wähle einzelne oder sichtbare Einträge für das Löschen aus. Änderungen zuerst speichern; „Jetzt anwenden“ sendet die konfigurierten Zustände an die Anlage.": "Define the switching states that should be set when you press “Apply now”. Search for entries and select individual or visible entries for deletion. Save changes first; “Apply now” sends the configured states to the layout.",
  "Angelehnt an die Central Station: Auslöser, Bedingungen und Aktionen als nachvollziehbare Ereignisse verwalten.": "Inspired by the Central Station: manage triggers, conditions and actions as traceable events.",
  // ---- Firmware instructions
  "Wähle hier das online angezeigte ESP-Modul und klicke auf": "Choose the ESP module shown as online here and click",
  "„Firmware erstellen“ anklicken und warten, bis der Server die passende Firmware gebaut hat.": "Click “Build firmware” and wait until the server has built the matching firmware.",
  "„Auf ESP installieren“ anklicken. Der ESP lädt die Datei im Netzwerk, installiert sie und startet neu.": "Click “Install on ESP”. The ESP downloads the file over the network, installs it and restarts.",
  "Warten, bis „Erfolgreich installiert“ angezeigt wird. Den ESP währenddessen eingeschaltet und im Netzwerk lassen.": "Wait until “Successfully installed” is displayed. Keep the ESP powered on and on the network meanwhile.",
  ". DynoraStation kompiliert die passende Firmware auf dem Server.": ". DynoraStation compiles the matching firmware on the server.",
  ". Während des Updates den ESP eingeschaltet und im Netzwerk lassen.": ". Keep the ESP powered on and on the network during the update.",
  "Wenn der Build fertig ist, klicke auf": "When the build is finished, click",
  "und warte auf „Erfolgreich installiert“. Der ESP lädt das Update über das Netzwerk und startet danach neu.": "and wait for “Successfully installed”. The ESP downloads the update over the network and restarts afterwards.",
  "Lege einen langen gemeinsamen Schlüssel mit mindestens 24 Zeichen als": "Set a long shared key with at least 24 characters as",
  "-Datei den Platzhalter bei": "file, replace the placeholder at",
  "-Datei neben der Compose-Datei muss": "file next to the compose file must contain",
  "-Datei neben der Docker-Compose-Datei fest. Starte DynoraStation danach neu.": "file next to the Docker Compose file. Then restart DynoraStation.",
  "gesetzt sein. Der Schlüssel muss mindestens 24 Zeichen haben. Danach DynoraStation neu starten. Ein ESP, der noch keinen passenden OTA-Schlüssel hat, muss einmalig per USB mit diesem Schlüssel geflasht werden; bereits OTA-fähige ESPs brauchen das nicht erneut.": "set. The key must be at least 24 characters long. Then restart DynoraStation. An ESP that does not yet have a matching OTA key must be flashed once via USB with this key; ESPs that are already OTA-capable do not need this again.",
  "Für das erste OTA-Update muss die ESP-Firmware einmal per USB mit genau diesem Schlüssel eingerichtet und geflasht werden. In der passenden": "For the first OTA update, the ESP firmware must be set up and flashed once via USB with exactly this key. In the matching",
  "ersetzen. Bereits OTA-fähige ESPs brauchen diesen USB-Schritt nicht erneut.": "replace it. ESPs that are already OTA-capable do not need this USB step again.",
  "Die Vorlagen und angepassten Firmware-Dateien liegen im Appdata-Ordner unter": "The templates and customized firmware files are located in the appdata folder under",
  "Firmwarevorlagen und angepasste Quellen liegen im Appdata-Ordner unter": "Firmware templates and customized sources are located in the appdata folder under",
  "Befehl wird nicht ausgeführt:": "Command is not executed:", "In der": "In the", "in der": "in the",
  "Server kompiliert die ausgewählte Firmware …": "Server is compiling the selected firmware …",
  "Noch keine Firmware erstellt": "No firmware built yet", "Firmware-Quelle wird vorbereitet …": "Preparing firmware source …",
  "Firmware-Build fehlgeschlagen": "Firmware build failed", "Zeitüberschreitung beim Firmware-Build.": "Timeout during firmware build.",
  "Zeitüberschreitung: Der ESP hat das Update noch nicht bestätigt.": "Timeout: the ESP has not yet confirmed the update.",
  "Zeitüberschreitung: keine ESP-Bestätigung": "Timeout: no ESP confirmation", "Zeitüberschreitung nach": "Timeout after",
  "Erfolgreich installiert:": "Successfully installed:", "Erfolgreich bestätigt": "Successfully confirmed", "OTA erfolgreich:": "OTA successful:",
  "OTA fehlgeschlagen": "OTA failed", "OTA fehlgeschlagen:": "OTA failed:", "OTA-Status:": "OTA status:", "Firmwarestatus:": "Firmware status:",
  "Firmware konnte nicht erstellt werden:": "Firmware could not be built:", "wird zum ESP übertragen …": "is being transferred to the ESP …",
  // ---- Server / station controls
  "Server & Neustart ": "Server & restart ", "DynoraStation neu starten": "Restart DynoraStation", "DynoraStation herunterfahren": "Shut down DynoraStation",
  "DynoraStation beenden": "Stop DynoraStation", "DynoraStation wird beendet": "DynoraStation is stopping", "DynoraStation wird neu gestartet": "DynoraStation is restarting",
  "Beendet den laufenden Serverprozess sauber und startet DynoraStation anschließend erneut.": "Cleanly stops the running server process and then starts DynoraStation again.",
  "Beendet nur DynoraStation. Der Computer bzw. Raspberry Pi bleibt eingeschaltet.": "Stops only DynoraStation. The computer or Raspberry Pi stays powered on.",
  "Startet oder beendet ausschließlich die DynoraStation-Anwendung. Windows, Linux oder der Raspberry Pi selbst werden nicht heruntergefahren.": "Starts or stops only the DynoraStation application. Windows, Linux or the Raspberry Pi itself are not shut down.",
  "Nach „Station beenden“ ist die Weboberfläche nicht mehr erreichbar, bis DynoraStation extern wieder gestartet wird.": "After “Stop station” the web interface is unreachable until DynoraStation is started again externally.",
  "DynoraStation wird kurz getrennt und danach neu gestartet. Der Computer bleibt eingeschaltet.": "DynoraStation will be briefly disconnected and then restarted. The computer stays powered on.",
  "Nur DynoraStation wird beendet. Der Computer bleibt eingeschaltet und die Weboberfläche ist danach offline.": "Only DynoraStation will be stopped. The computer stays powered on and the web interface will be offline afterwards.",
  "Docker verwaltet den Prozess. Neustart startet den Container über die Docker-Richtlinie neu. Zum Beenden den Container in der Unraid Docker-UI stoppen.": "Docker manages the process. Restart restarts the container via the Docker policy. To stop it, stop the container in the Unraid Docker UI.",
  "Container in Unraid stoppen": "Stop container in Unraid", "Windows-Aufgabe": "Windows task", "Direktstart": "Direct start",
  "Weboberfläche geht anschließend offline": "Web interface will go offline afterwards", "Neustart …": "Restarting …", "Startet neu …": "Restarting …",
  "Wird beendet …": "Stopping …", "STOPP …": "STOPPING …", "neu starten": "restart", "DynoraStation wirklich": "Really",
  "Stationsaktion fehlgeschlagen:": "Station action failed:", "Status laden fehlgeschlagen:": "Loading status failed:",
  // ---- Settings tabs
  "Module": "Modules", "ESP-Module": "ESP modules", "ESP-Module und ihre Anschlüsse.": "ESP modules and their connections.", "ESP-Autofind": "ESP autofind",
  "Relais": "Relays", "Relay": "Relay", "Relais und LEDs": "Relays and LEDs", "Sensoren": "Sensors", "Sensor": "Sensor", "Sensoren erkannt": "sensors detected",
  "LEDs & Signale": "LEDs & signals", "LED-Ausgänge": "LED outputs", "LEDs": "LEDs", "LED-ESP": "LED ESP", "Lichttasten": "Light buttons", "Licht-Buttons": "Light buttons",
  "Licht": "Light", "Beleuchtung": "Lighting", "Weichen, Signale & Gleisstrom": "Turnouts, signals & track power", "Weichen & Signale": "Turnouts & signals",
  "Automationen": "Automations", "Automation": "Automation", "Grundstellung": "Default state", "Standardzustände": "Default states", "Standards speichern": "Save defaults",
  "Jetzt anwenden": "Apply now", "Ausgänge": "Outputs", "Eingänge": "Inputs", "Geräte & Anschlüsse": "Devices & connections", "I/O": "I/O",
  "Hardware": "Hardware", "Hardware & Funktionen": "Hardware & functions", "Steuerung": "Control", "Direktsteuerung": "Direct control", "Signale & Steuerung": "Signals & control",
  "Kanäle und Helligkeit einstellen": "Set channels and brightness", "LED-ESP auswählen, Kanäle benennen, Helligkeit festlegen und direkt testen.": "Choose the LED ESP, name channels, set brightness and test directly.",
  "Rückmelder prüfen und benennen": "Check and name feedback sensors", "Status prüfen + Namen setzen.": "Check status + set names.",
  "Schaltausgänge zuordnen und testen": "Assign and test switching outputs", "Schalten + Name/Rolle vergeben.": "Switch + assign name/role.",
  "Die vier Tasten im Betrieb konfigurieren": "Configure the four buttons in Operations", "Buttonname, Modul und Relay festlegen.": "Set button name, module and relay.",
  "Definiert die Grundstellung der Anlage.": "Defines the default state of the layout.", "Sensor-, Relais- und Systemmeldungen.": "Sensor, relay and system messages.",
  "Relais speichern": "Save relays", "Sensoren speichern": "Save sensors", "LEDs speichern": "Save LEDs", "Licht speichern": "Save light",
  "Licht 1": "Light 1", "Licht 2": "Light 2", "Licht 3": "Light 3", "Licht 4": "Light 4", "Schaltausgang": "Switching output",
  "Kein Modul": "No module", "Kein Relais": "No relay", "Kein Relay": "No relay", "Kein Sensor": "No sensor", "Keine LED": "No LED", "Kein LED-ESP": "No LED ESP",
  "Kein ESP-Modul gewählt": "No ESP module selected", "Kein LED-ESP gewählt": "No LED ESP selected", "Kein ESP-Modul zugewiesen": "No ESP module assigned",
  "Nicht zugewiesen": "Not assigned", "Keine Verknüpfung": "No link", "Zuweisungen": "Assignments", "zugewiesene Kanäle": "assigned channels",
  "Modul": "Module", "Modul-ID": "Module ID", "IP-Adresse": "IP address", "Anzeigename": "Display name", "Modul löschen": "Delete module", "Modul entfernen": "Remove module",
  "ESP-Modul": "ESP module", "ESP-Modul „": "ESP module “", "ESP heißt jetzt „": "ESP is now named “", "ESP konnte nicht umbenannt werden:": "ESP could not be renamed:",
  "Bitte einen ESP-Namen eingeben": "Please enter an ESP name", "Modul gelöscht ·": "Module deleted ·", "Modul konnte nicht gelöscht werden:": "Module could not be deleted:",
  "Keine Sensoren verfügbar.": "No sensors available.", "Keine Standardzustände konfiguriert.": "No default states configured.",
  "Standardaktionen für \"Jetzt anwenden\"": "Default actions for \"Apply now\"", "Standardzustände werden geschaltet …": "Switching default states …",
  "Standardzustände konnten nicht angewendet werden:": "Default states could not be applied:", "Licht-Button ist noch keinem Modul/Relay zugewiesen": "Light button is not yet assigned to a module/relay",
  "Licht schalten fehlgeschlagen:": "Switching light failed:", "Lichtschaltung fehlgeschlagen:": "Light switching failed:",
  "Relay konnte nicht geschaltet werden:": "Relay could not be switched:", "Element konnte nicht geschaltet werden": "Element could not be switched",
  "Element konnte nicht geschaltet werden:": "Element could not be switched:", "Gleisstrom konnte nicht geschaltet werden": "Track power could not be switched",
  "konnte nicht gesteuert werden:": "could not be controlled:", "konnten nicht gespeichert werden:": "could not be saved:",
  "Hier": "Here", "Keine passende Automation": "No matching automation", "Automationen suchen": "Search automations", "Noch keine Automation": "No automation yet",
  "Neue Automation": "New automation", "Automation anlegen": "Create automation", "Automation auswählen": "Select automation", "Automation löschen": "Delete automation",
  "Automationen gespeichert": "Automations saved", "Aktion hinzufügen": "Add action", "Aktion wählen…": "Choose action…", "Auslöser wählen…": "Choose trigger…",
  "Ziel wählen…": "Choose target…", "Typ wählen…": "Choose type…", "Zieltyp": "Target type", "Sperrzeit": "Cooldown", "Sekunden": "seconds", "Min": "min", "Std": "h",
  "WENN": "IF", "DANN": "THEN", "Lege eine Automation an und ergänze darunter beliebig mehrere WENN-DANN-Regeln.": "Create an automation and add any number of IF-THEN rules below it.",
  "Diese Regel reagiert auf ihren eigenen Auslöser.": "This rule reacts to its own trigger.", "Name, Auslöser oder Ziel": "Name, trigger or target",
  "Typ, Ziel oder Aktion": "Type, target or action", "Aktueller Zustand": "Current state", "Änderungen speichern": "Save changes",
  "Ungespeicherte Änderungen": "Unsaved changes", "Änderungen noch nicht gespeichert": "Changes not saved yet", "Änderungen übernommen": "Changes applied",
  "Änderung wiederhergestellt": "Change restored", "Weitere Änderungen ungespeichert": "Further changes unsaved",
  "löschen? Diese Änderung muss anschließend gespeichert werden.": "delete? This change must be saved afterwards.",
  "löschen? Änderungen müssen anschließend gespeichert werden.": "delete? Changes must be saved afterwards.",
  "Sichtbare auswählen": "Select visible", "Auswahl löschen": "Delete selection", "0 ausgewählt": "0 selected", "0 Einträge": "0 entries", "ausgewählt": "selected",
  "Einträgen": "entries", "Nichts ausgewählt": "Nothing selected",
  // ---- Logbook
  "Ereignisprotokoll": "Event log", "Alle Ereignisse": "All events", "Alle Quellen": "All sources", "Ereignistyp": "Event type", "Meldung, Quelle oder Typ": "Message, source or type",
  "Neueste zuerst": "Newest first", "Älteste zuerst": "Oldest first", "Sortierung": "Sorting", "Logbuch löschen": "Delete logbook", "Ereignisse": "Events",
  "Ereignisse deaktiviert": "Events disabled", "Das gesamte Logbuch dauerhaft löschen?": "Permanently delete the entire logbook?",
  "Logbuch konnte nicht gelöscht werden:": "Logbook could not be deleted:", "Quelle / Gerät": "Source / device", "System-Zusammenfassung": "System summary",
  "Wird gelöscht …": "Deleting …", "NOT-AUS gesendet ·": "Emergency stop sent ·", "NOT-AUS fehlgeschlagen:": "Emergency stop failed:",
  // ---- Builder UI
  "Gleisplan-Editor": "Track plan editor", "Bearbeitungsmodus": "Edit mode", "Bauteil platzieren": "Place component", "Alle Bauteile": "All components",
  "Bauteile suchen": "Search components", "Artikelnummer oder Bauteil …": "Article number or component …", "Bauteilauswahl schließen": "Close component selection",
  "Artikel": "Article", "Artikeleigenschaften": "Article properties", "Artikelnummer": "Article number", "Eigenschaften": "Properties", "Elemente": "Elements",
  "Elemente:": "Elements:", "Element": "Element", "Bauteil": "Component", "Bauteile": "Components", "Auswählen": "Select", "Legende": "Legend",
  "Artikel wählen → im Plan platzieren · Esc beendet · Mausrad zoomt": "Choose article → place in plan · Esc exits · Mouse wheel zooms",
  "Mausrad zoomt · freie Fläche verschiebt": "Mouse wheel zooms · free area pans", "Position anklicken · nahe Enden verbinden automatisch": "Click a position · nearby ends connect automatically",
  "Position anklicken · freie Gleisenden rasten präzise ein": "Click a position · free track ends snap precisely",
  "Element auswählen und verschieben": "Select and move element", "Element im Plan anklicken, um Position und Hardware zu konfigurieren.": "Click an element in the plan to configure position and hardware.",
  "Oben einen Artikel wählen und hier platzieren": "Choose an article above and place it here", "Im Editor wurden noch keine Elemente erstellt.": "No elements have been created in the editor yet.",
  "Noch kein Gleisbild erstellt": "No track plan created yet", "Plan ist noch leer": "Plan is still empty", "Plan ist bereit": "Plan is ready",
  "Lege zuerst im Planer deine Märklin M-Gleis-Anlage an.": "First create your Märklin M-track layout in the planner.",
  "Füge das erste Gleiselement aus der Bauteilbibliothek hinzu.": "Add the first track element from the component library.",
  "Versuche eine andere Artikelnummer oder Kategorie.": "Try a different article number or category.", "Kein Element ausgewählt": "No element selected",
  "Klicke ein Element an zum Bearbeiten.": "Click an element to edit it.", "Bitte zuerst Element auswählen!": "Please select an element first!",
  "Element gelöscht": "Element deleted", "Element gelöscht · mit Rückgängig wiederherstellbar": "Element deleted · can be restored with Undo",
  "Element wirklich löschen?": "Really delete element?", "Drehung": "Rotation", "Rotiert um": "Rotated by", "Links drehen": "Rotate left", "Rechts drehen": "Rotate right",
  "Vergrößern": "Zoom in", "Verkleinern": "Zoom out", "Einpassen": "Fit", "Am Raster einrasten": "Snap to grid", "Raster anzeigen": "Show grid", "Raster (mm)": "Grid (mm)",
  "Planungsraster": "Planning grid", "Plan & Raster": "Plan & grid", "Planoptionen": "Plan options", "Breite (mm)": "Width (mm)", "Tiefe (mm)": "Depth (mm)",
  "Maße speichern": "Save dimensions", "Name des Anlagenplans": "Layout plan name", "Beschriftungen": "Labels", "Darstellung des Gleisbilds": "Track plan display",
  "Vorschau des Gleisbilds": "Track plan preview", "Vorschau nach links drehen": "Rotate preview left", "Vorschau nach rechts drehen": "Rotate preview right",
  "Gleisbild maximieren": "Maximize track plan", "Maximiertes Gleisbild schließen": "Close maximized track plan", "Maximierung beenden": "Exit maximized view",
  "Plan importieren": "Import plan", "Plan herunterladen": "Download plan", "Plan vollständig leeren": "Clear entire plan", "Drucken / PDF": "Print / PDF",
  "Entwurf sichern": "Save draft", "Entwurf herunterladen": "Download draft", "Entwurf wiederherstellen": "Restore draft", "Lokaler Entwurf vorhanden": "Local draft available",
  "Planprüfung": "Plan check", "Planprüfung schließen": "Close plan check", "Planversionen": "Plan versions", "Planversionen schließen": "Close plan versions",
  "Planversionen werden geladen …": "Loading plan versions …", "Plan wird analysiert …": "Analyzing plan …", "alternative Lage": "alternative position",
  "gewählter Fahrweg": "selected route", "Ausgewählter Fahrweg": "Selected route", "Fahrweg": "Route", "Fahrt": "Go", "Halt": "Stop", "Fahrt (Grün)": "Go (green)",
  "Fahrt (Grün) markiert dieses Gleis im Plan als eingeschaltet.": "Go (green) marks this track as switched on in the plan.",
  "Dein Entwurf bleibt erhalten und wurde nicht über den neueren Plan gespeichert.": "Your draft is kept and was not saved over the newer plan.",
  "Der Stationsplan wurde inzwischen geändert.": "The station plan has changed in the meantime.",
  "Der gespeicherte Stationsplan wird angezeigt. Ein älterer Entwurf liegt noch in diesem Browser.": "The saved station plan is shown. An older draft is still stored in this browser.",
  "Der Gleisplan bleibt unabhängig vom Verbindungsstatus sichtbar.": "The track plan stays visible regardless of connection status.",
  "Die letzten 20 vorherigen Speicherstände. Wiederherstellen sichert zuerst den aktuellen Stationsplan und sendet keine Schaltbefehle.": "The last 20 previous saves. Restoring first backs up the current station plan and does not send any switching commands.",
  "So soll sich deine Anlage bedienen lassen.": "This is how your layout should be operated.",
  "Aktuellen Stationsplan laden? Dein bisheriger Entwurf wird lokal als Sicherung behalten.": "Load the current station plan? Your existing draft will be kept locally as a backup.",
  "Dein ungespeicherter Entwurf wird zusätzlich lokal gesichert.": "Your unsaved draft will also be backed up locally.",
  "Diese Version als Stationsplan wiederherstellen? Der aktuelle Stationsplan wird vorher gesichert.": "Restore this version as the station plan? The current station plan will be backed up first.",
  "Lokalen Entwurf zum Bearbeiten laden? Der Stationsplan bleibt bis zum Speichern unverändert. Aktuelle Änderungen lassen sich rückgängig machen.": "Load the local draft for editing? The station plan remains unchanged until you save. Current changes can be undone.",
  "Elementen laden? Der aktuelle Plan wird ersetzt. Rückgängig bleibt möglich.": "elements? The current plan will be replaced. Undo remains possible.",
  "Noch keine früheren Planversionen. Vor dem nächsten Speichern wird der bisherige Plan automatisch gesichert.": "No earlier plan versions yet. The existing plan is backed up automatically before the next save.",
  "(nicht mehr verfügbar)": "(no longer available)", "Plan gespeichert": "Plan saved", "Layout gespeichert": "Layout saved", "Layout gespeichert · Warnung:": "Layout saved · warning:",
  "Layout geleert": "Layout cleared", "Layout konnte nicht geladen werden": "Layout could not be loaded", "Katalog konnte nicht geladen werden": "Catalog could not be loaded",
  "Letzte Änderung rückgängig gemacht": "Last change undone", "Lokaler Entwurf wiederhergestellt · noch nicht auf der Station gespeichert": "Local draft restored · not yet saved on the station",
  "Entwurf geladen · zum Übernehmen auf der Station speichern": "Draft loaded · save to apply on the station", "Speicherkonflikt · Entwurf erhalten": "Save conflict · draft kept",
  "Speichern fehlgeschlagen:": "Saving failed:", "Import fehlgeschlagen:": "Import failed:", "Plan importiert · zum Übernehmen speichern": "Plan imported · save to apply",
  "Keine gültige DynoraStation-Plandatei": "Not a valid DynoraStation plan file", "Datei ist größer als 2 MB": "File is larger than 2 MB", "Der Plan ist zu groß": "The plan is too large",
  "Ungültige Planmetadaten": "Invalid plan metadata", "Ungültige Serverantwort: JSON erwartet": "Invalid server response: JSON expected",
  "Anlagenplatte konnte nicht gespeichert werden:": "Layout board could not be saved:", "Anlagenplatte und Raster gespeichert": "Layout board and grid saved",
  "Kopie erstellt · Hardware bitte neu zuweisen": "Copy created · please reassign hardware", "Gleis platziert und magnetisch verbunden": "Track placed and magnetically connected",
  "platziert ·": "placed ·", "· klicken zum Verbinden": "· click to connect", "Verbindungen getrennt": "Connections disconnected", "Zuweisungen getrennt ·": "Assignments disconnected ·",
  "Verbindungen": "Connections", "Verbindungen:": "Connections:", "Schaltvorgang läuft bereits": "Switching already in progress",
  "Ungültige Position oder Drehung": "Invalid position or rotation", "Ungültige Verbindung": "Invalid connection", "Ungültige Verbindung im Plan": "Invalid connection in plan",
  "Ungültiger Anschluss": "Invalid connection point", "Ungültige oder doppelte Element-ID / unbekannter Bauteiltyp": "Invalid or duplicate element ID / unknown component type",
  "Das Gleiselement besitzt noch keine Verbindung zu einem anderen Bauteil.": "The track element is not yet connected to another component.",
  "Die verbundenen Enden liegen nicht aufeinander. Trennen und erneut verbinden.": "The connected ends do not line up. Disconnect and reconnect.",
  "Quellgleis ist bereits mit anderen Bauteilen verbunden. Bitte zuerst trennen.": "Source track is already connected to other components. Please disconnect first.",
  "Verbindungen trennen und freie Anschlüsse verwenden.": "Disconnect connections and use free connection points.",
  "Position in den Eigenschaften anpassen oder Platte vergrößern.": "Adjust the position in the properties or enlarge the board.",
  "Freier Anschluss an": "Free connection at", "teilt einen Kanal mit": "shares a channel with",
  // ---- Validation
  "Keine Probleme erkannt": "No problems detected", "Keine fehlenden Hardware-Zuweisungen, Konflikte oder isolierten Gleise erkannt.": "No missing hardware assignments, conflicts or isolated tracks detected.",
  ": Anschluss mehrfach belegt": ": connection used multiple times", ": Ausgang fehlt": ": output missing", ": Außerhalb der Platte": ": outside the board",
  ": DANN-Ziel fehlt": ": THEN target missing", ": Gleislücke": ": track gap", ": Kein Modul": ": no module", ": LED-Kanal doppelt belegt": ": LED channel used twice",
  ": LED-Kanal fehlt": ": LED channel missing", ": Name fehlt": ": name missing", ": Nicht verbunden": ": not connected", ": WENN-Auslöser fehlt": ": IF trigger missing",
  ": mindestens eine DANN-Aktion hinzufügen": ": add at least one THEN action", ": mindestens eine Regel hinzufügen": ": add at least one rule",
  ": Wird geschaltet …": ": switching …", ", keine Schaltkanäle zugewiesen": ", no switching channels assigned", "Mehrfach belegt ·": "Used multiple times ·",
  "Relais-Konflikt:": "Relay conflict:", "ist keinem LED-Kanal zugewiesen.": "is not assigned to an LED channel.", "ist keinem Relais zugewiesen.": "is not assigned to a relay.",
  "Wird geschaltet …": "Switching …", "Wird gespeichert …": "Saving …", "Speichert …": "Saving …", "Zeitüberschreitung": "Timeout",
  "Stromabschnitt nicht schaltbereit": "Track section not ready to switch", "Stromabschnitt wird bereits geschaltet": "Track section is already being switched",
  "Keine schaltbaren Stromabschnitte. Im Bearbeiten-Modus einem Gleis oder einer Kurve ein Relais zuweisen.": "No switchable track sections. In edit mode, assign a relay to a track or curve.",
  "Stromabschnitte": "Track sections", "Stromabschnitt": "Track section", "Gleisstrom": "Track power", "Stromversorgung": "Power supply", "Versorgung": "Supply",
  // ---- Export / print
  "Bauplan-Vorschau": "Build plan preview", "Bauplan-Vorschau geöffnet": "Build plan preview opened", "Bau- und Montageplan": "Build and assembly plan", "Bauplan konnte nicht erstellt werden.": "Build plan could not be created.",
  "Gleis- und Anlagenplan": "Track and layout plan", "Stückliste": "Bill of materials", "Menge": "Quantity", "Montagepositionen": "Assembly positions", "Maßstab": "Scale",
  "Erstellt am": "Created on", "Technischer Export": "Technical export", "DynoraStation · Technischer Export": "DynoraStation · Technical export", "– Bauplan": "– Build plan",
  "Ohne Pop-up · direkt drucken oder als PDF speichern": "No pop-up · print directly or save as PDF", "Draufsicht · nicht direkt bemaßen": "Top view · do not measure directly",
  "Die Planansicht ist seitenfüllend skaliert. Für den Aufbau gelten die angegebenen X-/Y-Maße ab der linken oberen Plattenkante.": "The plan view is scaled to fill the page. For construction, the given X/Y dimensions from the top-left board edge apply.",
  // ---- Components
  "Gerade": "Straight", "Geraden": "Straights", "Gerades Gleis": "Straight track", "Gerade/Außenbogen": "Straight/outer curve", "Kurve": "Curve", "Kurven": "Curves", "Gleis": "Track",
  "Weiche": "Turnout", "Weichen": "Turnouts", "Kreuzungen": "Crossings", "Kreuzungsweiche": "Slip switch", "Kreuzungsweichen-Konfiguration": "Slip switch configuration",
  "Kurven-Konfiguration": "Curve configuration", "Prellbock": "Bumper", "Prellböcke": "Bumpers", "Entkuppler": "Uncoupler", "Entkupplungsgleis": "Uncoupling track", "Abzweig": "Branch",
  "Signal": "Signal", "Hauptsignal": "Main signal", "Hauptsignal-Konfiguration": "Main signal configuration", "Märklin-Hauptsignal": "Märklin main signal", "Märklin-Signal": "Märklin signal",
  "Märklin-Signal für Fahrstrom": "Märklin signal for track power", "ESP-Signal": "ESP signal", "ESP-Signalmast": "ESP signal mast", "ESP-Signal-Konfiguration": "ESP signal configuration",
  "Transformator": "Transformer", "Transformator-Konfiguration": "Transformer configuration", "Trafo": "Transformer", "Belegtsensor": "Occupancy sensor", "Einzelne LED": "Single LED",
  "Signaltyp": "Signal type", "Kanäle für Rot und Grün": "Channels for red and green", "Kanäle für Rot, Gelb und Grün": "Channels for red, yellow and green",
  "Rot": "Red", "Gelb": "Yellow", "Grün": "Green", "Blau": "Blue", "Weiß": "White", "Warmweiß": "Warm white", "Orange": "Orange", "Rot und Grün": "Red and green", "Rot, Gelb und Grün": "Red, yellow and green",
  "Grün / Fahrt": "Green / Go", "2-begriffig · Rot / Grün": "2-aspect · Red / Green", "3-begriffig · Rot / Gelb / Grün": "3-aspect · Red / Yellow / Green",
  "ESP-Signal · Rot / Gelb / Grün": "ESP signal · Red / Yellow / Green", "ESP-Signal · Rot / Grün": "ESP signal · Red / Green", "LED GRÜN Kanal": "LED GREEN channel", "LED ROT Kanal": "LED RED channel",
  "Relay GRÜN (Fahrt)": "Relay GREEN (go)", "Relay ABZWEIG": "Relay BRANCH", "Relay GERADE": "Relay STRAIGHT", "BELEGT": "OCCUPIED", "BLINKT": "BLINKING", "RUHE": "IDLE", "SCHALTET": "SWITCHING", "Schalten": "Switch",
  "Ausschalten": "Switch off", "Einschalten": "Switch on", "Impuls auslösen": "Trigger pulse", "+ Zustand": "+ state",
  "Kurve mit optionalem Relay und Sensor.": "Curve with optional relay and sensor.", "Passiver Gleisabschluss ohne Relais. Die Artikelnummer wird im Plan und Export ausgewiesen.": "Passive track end without relay. The article number is shown in the plan and export.",
  "Kreuzungsweiche 5128: reale 30°-Geometrie, getrennte Relais für beide Stellungen.": "Slip switch 5128: real 30° geometry, separate relays for both positions.",
  "Märklin Hauptsignal 7039: Je ein Relay für Rot (Halt) und Grün (Fahrt).": "Märklin main signal 7039: one relay each for red (stop) and green (go).",
  "Märklin Transformator 6631: Optional ein Relay zur Kontrolle der Stromversorgung.": "Märklin transformer 6631: optionally one relay for monitoring the power supply.",
  "Kontaktgleis": "Contact track", "Anschlussgleis": "Feed track", "Schaltgleis": "Switch track", "Ausgleichsstück": "Compensating piece", "Industriekreis": "Industrial circle",
  "Parallelkreis": "Parallel circle", "Normalkreis": "standard circle", "Ausgleichsbogen": "compensating curve", "Bogenweiche": "Curved turnout", "Doppelkreuzungsweiche": "Double slip switch",
  "Kreuzung": "Crossing", "Entstörung": "interference suppression", "Schranke": "crossing gate", "gebogen": "curved", "gerade": "straight", "halb": "half", "viertel": "quarter", "beleuchtet": "lit", "mit": "with", "Ende": "end",
  "10 · fein": "10 · fine", "25 · Standard": "25 · standard", "50 · grob": "50 · coarse", "90 · halbes 5106": "90 · half 5106", "180 · 5106-Länge": "180 · 5106 length", "Länge": "Length", "3,20 × 1,80 m": "3.20 × 1.80 m",
  "Kein Relay-Modul verfügbar": "No relay module available", "Kein LED-ESP verfügbar": "No LED ESP available", "Nicht verfügbar": "Not available", "Unbekannt": "Unknown",
  "meldet aktuell keine Relais.": "currently reports no relays.", "meldet keine LED-Kanäle.": "reports no LED channels.",
  "Es werden keine Kanäle erfunden. Prüfe den ESP-Code und den nächsten Heartbeat; sobald das Modul seine Relay-Anzahl meldet, erscheinen die Kanäle hier.": "No channels are made up. Check the ESP code and the next heartbeat; once the module reports its relay count, the channels appear here.",
  "Der ESP muss im Heartbeat das Feld „leds“ senden. Nach dem nächsten Heartbeat erscheinen die Kanäle automatisch.": "The ESP must send the “leds” field in its heartbeat. After the next heartbeat the channels appear automatically.",
  "Dieses Modul ist online und erscheint beim nächsten Heartbeat wieder. Schalte den ESP zuerst aus, wenn es dauerhaft wegbleiben soll.": "This module is online and will reappear on the next heartbeat. Switch the ESP off first if it should stay away permanently.",
  "Relais, LEDs und Sensoren dieses Moduls werden entfernt. Zugewiesene Elemente werden getrennt und betroffene Ereignisse deaktiviert.": "Relays, LEDs and sensors of this module will be removed. Assigned elements will be disconnected and affected events disabled.",
  "derzeit nicht verfügbar": "currently not available", "nicht verfügbar": "not available", "nicht mehr verfügbar": "no longer available", "online": "online", "offline": "offline",
  "Der Plan wurde inzwischen geändert. Öffne die Planversionen erneut; es wurde nichts überschrieben.": "The plan has changed in the meantime. Reopen the plan versions; nothing was overwritten.",
  "Diese Regel hat eine eigene Sperrzeit.": "This rule has its own cooldown.", "Keine Bauteile gefunden.": "No components found.",
  "ESP-Modul(e) warten auf Bestätigung": "ESP module(s) waiting for confirmation", "Ein verbundenes Element fehlt.": "A connected element is missing.",
  "Ein eingeschalteter ESP meldet sich erneut an. Zum dauerhaften Entfernen zuerst ausschalten.": "A powered-on ESP will register again. Switch it off first to remove it permanently.",
  "Hardware-Modul im Eigenschaftenbereich zuweisen.": "Assign a hardware module in the properties panel.", "Planelementen haben eine Hardwarezuweisung.": "plan elements have a hardware assignment.",
  "“ wirklich löschen?": "” really delete?", "„ wirklich löschen?": "” really delete?", "wirklich löschen?": "really delete?", "Abzweig/Innenbogen": "Branch/inner curve", "Stromabschnitt (optional)": "Track section (optional)",
  "Relay (Gleisstrom)": "Relay (track power)", "Relay (Stromversorgung)": "Relay (power supply)", "z. B. Beleuchtung": "e.g. Lighting", "Anschlussgleis mit Entstörung": "Feed track with interference suppression",
  "Quellen und Typen erscheinen, sobald Meldungen eintreffen.": "Sources and types appear as soon as messages arrive.", "Keine Ereignisse": "No events", "mit": "with",
  // ---- misc
  "Alle": "All", "Keine": "None", "Hilfe": "Help", "und": "and", "oder": "or", "Fehler ·": "Error ·", "Fehler:": "Error:", "Fehlgeschlagen:": "Failed:",
  "Ungültig": "Invalid", "Synchronisiert ·": "Synchronized ·", "· LED": "· LED", "· Protokoll": "· Protocol", "· Regel": "· Rule", "· Relay": "· Relay", "Relais ·": "Relays ·", "LEDs ·": "LEDs ·",
  "ausgewählt ": "selected ", "wurde erstellt.": "was created.", "Sensor-, Relais- und Systemmeldungen": "Sensor, relay and system messages",
  "Hier findest du": "Here you will find", "ESP-Autofind ": "ESP autofind ", "Verbindung": "Connection", "API-Verbindung": "API connection", "Systemverbindung": "System connection",
  "Lokal": "Local", "Seite neu laden": "Reload page"
};

const ATTRS = ["title", "aria-label", "placeholder", "alt"];
const LETTERS = /\p{L}/u;
const entries = Object.entries(PHRASES).sort((a, b) => b[0].length - a[0].length);
const exact = new Map(Object.entries(PHRASES));
const WORD_ONLY = new Set(["Bauteile", "Elemente", "Module", "Weichen", "Kurven", "Geraden", "Regeln", "Aktionen", "Updates", "und", "oder", "mit", "Kein", "Keine", "Alle", "Hier", "Ende", "Lokal", "Ein", "Aus", "EIN", "AUS", "halb", "Hilfe", "gerade", "links", "rechts", "Links", "Rechts", "Name", "Typ", "Aktion", "Version", "Server", "Station", "Modul", "Module", "Fehler", "Aktiv", "Quelle", "Ziel", "Licht", "Relay", "Relais", "Sensor", "Signal", "Element", "Hardware", "Firmware", "Anlage", "Gleis", "Weiche", "Kurve", "Regel", "Zustand", "Verbindung", "Online", "Offline", "In der", "in der", "Gerade", "Prüfen", "Schalten", "Hinweise", "Inhalt", "Bauteil", "Min", "Std", "Fahrt", "Halt", "Rot", "Gelb", "Grün", "Blau", "Weiß", "Orange"]);
const matchers = entries
  .filter(([key]) => key.length >= 3 && LETTERS.test(key) && !WORD_ONLY.has(key))
  .map(([key, value]) => {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const left = /^\p{L}/u.test(key) ? "(?<![\\p{L}\\p{N}])" : "";
    const right = /\p{L}$/u.test(key) ? "(?![\\p{L}\\p{N}])" : "";
    return [new RegExp(left + escaped + right, "gu"), value];
  });

export function translateText(text) {
  if (!text || !LETTERS.test(text)) return text;
  const lead = text.match(/^\s*/)[0];
  const trail = text.match(/\s*$/)[0];
  const core = text.trim();
  const direct = exact.get(core) ?? exact.get(core.replace(/\s+/g, " "));
  if (direct !== undefined) return lead + direct + trail;
  let out = core;
  for (const [regex, value] of matchers) {
    regex.lastIndex = 0;
    if (regex.test(out)) {
      regex.lastIndex = 0;
      out = out.replace(regex, value);
    }
  }
  return lead + out + trail;
}

export function maybeTranslate(text) {
  return getLanguage() === "en" ? translateText(text) : text;
}

const textRecords = new WeakMap();
const attrRecords = new WeakMap();
let observer = null;

function skipNode(node) {
  const parent = node.parentElement;
  if (!parent) return false;
  const tag = parent.tagName;
  return tag === "SCRIPT" || tag === "STYLE" || tag === "TEXTAREA" || parent.closest?.("[data-no-translate]") != null;
}

function applyText(node) {
  if (skipNode(node)) return;
  const current = node.nodeValue;
  const record = textRecords.get(node);
  if (record && current === record.tr) return;
  const tr = translateText(current);
  if (tr === current) { textRecords.delete(node); return; }
  textRecords.set(node, { orig: current, tr });
  node.nodeValue = tr;
}

function applyAttrs(el) {
  let records = attrRecords.get(el);
  for (const name of ATTRS) {
    const current = el.getAttribute?.(name);
    if (current == null) continue;
    const record = records?.[name];
    if (record && current === record.tr) continue;
    const tr = translateText(current);
    if (tr === current) { if (records) delete records[name]; continue; }
    if (!records) { records = {}; attrRecords.set(el, records); }
    records[name] = { orig: current, tr };
    el.setAttribute(name, tr);
  }
}

function walk(root, fn) {
  if (root.nodeType === Node.TEXT_NODE) { applyText(root); return; }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
  if (root.nodeType === Node.ELEMENT_NODE) applyAttrs(root);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) applyText(node);
    else applyAttrs(node);
    node = walker.nextNode();
  }
}

function translateTitle() {
  if (!translateTitle.orig) translateTitle.orig = document.title;
  document.title = translateText(translateTitle.orig);
}

function restoreAll() {
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const record = textRecords.get(node);
      if (record && node.nodeValue === record.tr) node.nodeValue = record.orig;
      textRecords.delete(node);
    } else {
      const records = attrRecords.get(node);
      if (records) {
        for (const [name, record] of Object.entries(records)) {
          if (node.getAttribute(name) === record.tr) node.setAttribute(name, record.orig);
        }
        attrRecords.delete(node);
      }
    }
    node = walker.nextNode();
  }
  if (translateTitle.orig) document.title = translateTitle.orig;
}

function handleMutations(records) {
  observer.disconnect();
  try {
    for (const rec of records) {
      if (rec.type === "characterData") applyText(rec.target);
      else if (rec.type === "attributes") applyAttrs(rec.target);
      else rec.addedNodes.forEach((n) => walk(n));
    }
  } finally {
    observe();
  }
}

function observe() {
  observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

function start() {
  if (!observer) observer = new MutationObserver(handleMutations);
  observer.disconnect();
  walk(document.documentElement);
  translateTitle();
  observe();
}

function stop() {
  if (observer) observer.disconnect();
  restoreAll();
}

function sync() {
  if (typeof MutationObserver === "undefined" || typeof document.createTreeWalker !== "function") return;
  if (getLanguage() === "en") start(); else stop();
}

function wrapDialogs() {
  for (const name of ["alert", "confirm", "prompt"]) {
    const original = window[name];
    if (typeof original !== "function") continue;
    window[name] = (message, ...rest) => original.call(window, maybeTranslate(String(message ?? "")), ...rest);
  }
}

export function initTranslation() {
  wrapDialogs();
  document.addEventListener("dynora:language-changed", sync);
  sync();
}
