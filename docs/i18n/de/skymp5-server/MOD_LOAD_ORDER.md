# Mod-Ladereihenfolge im Ressourcenbereich

> Mods liegen jetzt in `data/mods/<Mod>/`, ein gesonderter Download-Ordner entfällt. [data/mods](../docs/docs_mod_folders.md)


Im Server-Dashboard **Ressourcen → Spielmods** öffnen. Im benachbarten Reiter **Server-Plugins** werden die JavaScript-/Prozess-Erweiterungen verwaltet. Der Modbereich erkennt zusätzliche ESM-, ESP- und ESL-Dateien direkt im konfigurierten Spielserver-Datenordner sowie im Unterordner Data des konfigurierten Launcher-Downloadordners. Neue Dateien werden aufgelistet und zunächst nicht aktiviert. Nach weiteren Uploads **Dateien neu einlesen** wählen; die Suche filtert nach Dateinamen.

Die fünf benötigten Spieldateien `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm` und `Dragonborn.esm` sind keine auswählbaren Mods. Sie erscheinen weder als aktive noch als weitere Mods und zählen nicht zur angezeigten Modanzahl. Beim Speichern bleiben sie automatisch in dieser festen Reihenfolge vor allen zusätzlichen Mods erhalten. Auch direkte API-Anfragen können sie über diese Modverwaltung nicht entfernen oder verschieben; eine leere Modauswahl behält die fünf Basisdateien. Fehlende oder beschädigte Basisdateien verhindern das Speichern.

Gewünschte Mods per Kontrollkästchen aktivieren und mit den Pfeilen in Reihenfolge bringen. Masterdateien werden beim Aktivieren vor gewöhnlichen Plugins eingefügt; ihre genaue Reihenfolge kann danach geändert werden. **Ladereihenfolge speichern** aktualisiert ausschließlich loadOrder in der vorhandenen server-settings.json. Private Schlüssel und andere Einstellungen bleiben erhalten. Für Änderungen werden ein Administratorkonto und Konsolenberechtigung benötigt.

Skyrim.esm muss zuerst stehen. Benötigte Master werden aus dem TES4-Header gelesen und müssen vor ihren abhängigen Plugins aktiv sein. Fehlende, beschädigte, doppelte oder inzwischen geänderte Dateien werden berücksichtigt; falsche Reihenfolgen werden beim Speichern abgewiesen. Liegt ein Plugin nur im Downloadordner, dieselbe Datei zusätzlich im Spielserver-Datenordner ablegen. Der Gameserver benötigt die Datei selbst, und Downloadkopie und Serverdatei müssen übereinstimmen.

Anschließend den **Spielserver neu starten**. Erst damit erzeugt er das passende Spiel-/Launcher-Manifest. Das Dashboard kann beim unabhängigen Betrieb weiterlaufen. Der Launcher übernimmt die aktive loadOrder automatisch in plugins.txt und loadorder.txt und sichert die vorhandenen Spielerdateien. Hochgeladene, aber deaktivierte Plugins werden aus dem modernen Downloadmanifest ausgelassen.

Ab Serverrevision r11 wird die Änderung in beiden Backends (skymp5-server.js und skymp5-admin.js) und dem Dashboard-Frontend der Windows-/Linux-Voll- und Update-Pakete ausgeliefert. Für den Dateiaustausch den gesamten Serverdienst mit Dashboard stoppen und danach neu starten. Datei-/Browserprüfungen ersetzen keinen Spieltest; die Modkompatibilität bleibt Aufgabe des Serverbetreibers.
