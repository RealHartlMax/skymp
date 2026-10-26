# Mod-Ladereihenfolge im Ressourcenbereich

## Deutsch

Im Server-Dashboard **Ressourcen → Spielmods** öffnen. Im benachbarten Reiter **Server-Plugins** werden die JavaScript-/Prozess-Erweiterungen verwaltet. Der Modbereich erkennt zusätzliche ESM-, ESP- und ESL-Dateien direkt im konfigurierten Spielserver-Datenordner sowie im Unterordner Data des konfigurierten Launcher-Downloadordners. Neue Dateien werden aufgelistet und zunächst nicht aktiviert. Nach weiteren Uploads **Dateien neu einlesen** wählen; die Suche filtert nach Dateinamen.

Die fünf benötigten Spieldateien `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm` und `Dragonborn.esm` sind keine auswählbaren Mods. Sie erscheinen weder als aktive noch als weitere Mods und zählen nicht zur angezeigten Modanzahl. Beim Speichern bleiben sie automatisch in dieser festen Reihenfolge vor allen zusätzlichen Mods erhalten. Auch direkte API-Anfragen können sie über diese Modverwaltung nicht entfernen oder verschieben; eine leere Modauswahl behält die fünf Basisdateien. Fehlende oder beschädigte Basisdateien verhindern das Speichern.

Gewünschte Mods per Kontrollkästchen aktivieren und mit den Pfeilen in Reihenfolge bringen. Masterdateien werden beim Aktivieren vor gewöhnlichen Plugins eingefügt; ihre genaue Reihenfolge kann danach geändert werden. **Ladereihenfolge speichern** aktualisiert ausschließlich loadOrder in der vorhandenen server-settings.json. Private Schlüssel und andere Einstellungen bleiben erhalten. Für Änderungen werden ein Administratorkonto und Konsolenberechtigung benötigt.

Skyrim.esm muss zuerst stehen. Benötigte Master werden aus dem TES4-Header gelesen und müssen vor ihren abhängigen Plugins aktiv sein. Fehlende, beschädigte, doppelte oder inzwischen geänderte Dateien werden berücksichtigt; falsche Reihenfolgen werden beim Speichern abgewiesen. Liegt ein Plugin nur im Downloadordner, dieselbe Datei zusätzlich im Spielserver-Datenordner ablegen. Der Gameserver benötigt die Datei selbst, und Downloadkopie und Serverdatei müssen übereinstimmen.

Anschließend den **Spielserver neu starten**. Erst damit erzeugt er das passende Spiel-/Launcher-Manifest. Das Dashboard kann beim unabhängigen Betrieb weiterlaufen. Der Launcher übernimmt die aktive loadOrder automatisch in plugins.txt und loadorder.txt und sichert die vorhandenen Spielerdateien. Hochgeladene, aber deaktivierte Plugins werden aus dem modernen Downloadmanifest ausgelassen.

Ab Serverrevision r11 wird die Änderung in beiden Backends (skymp5-server.js und skymp5-admin.js) und dem Dashboard-Frontend der Windows-/Linux-Voll- und Update-Pakete ausgeliefert. Für den Dateiaustausch den gesamten Serverdienst mit Dashboard stoppen und danach neu starten. Datei-/Browserprüfungen ersetzen keinen Spieltest; die Modkompatibilität bleibt Aufgabe des Serverbetreibers.

## English

Open **Resources → Game mods** in the server dashboard. The neighboring **Server plugins** tab manages JavaScript/process extensions. Additional ESM, ESP and ESL files are discovered directly in the configured game-server data directory and in Data inside the configured launcher download directory. New uploads remain disabled until selected. Use **Rescan files** after uploading; search filters file names.

The five required game files (`Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`, `Dragonborn.esm`) are excluded from the selectable mod lists and counts. Saves always keep them first in that fixed order, including when the custom selection is empty. Direct API requests cannot remove or reorder them through this mod manager. Missing or invalid required files prevent saving.

Enable mods with checkboxes and reorder them with the arrows. Masters are inserted before ordinary plugins when enabled. **Save load order** updates only loadOrder in the existing server-settings.json, preserving private keys and unrelated settings. Editing requires an administrator with console permission.

Skyrim.esm must come first. Masters read from TES4 headers must be enabled before their dependants. Missing, invalid, duplicate or changed files and invalid ordering are handled during validation. A plugin present only in the download directory must also be placed in the game-server data directory; both copies must match.

Restart the **game server** to generate the matching game/launcher manifest. An independent dashboard can stay running. The launcher applies the active order to plugins.txt and loadorder.txt and backs up the player's original files. Disabled uploaded plugins are omitted from the modern download manifest.

Server revision r11 includes both rebuilt backends and the dashboard frontend in Windows/Linux full and update packages. Stop the entire service, including the dashboard, before replacing program files, then restart it. File/browser checks are not gameplay validation; the operator remains responsible for mod compatibility.

## Русский

Откройте **Ресурсы → Игровые моды** в панели сервера. Соседняя вкладка **Плагины сервера** управляет расширениями JavaScript и отдельными процессами. Дополнительные файлы ESM, ESP и ESL автоматически находятся непосредственно в настроенной папке данных сервера и в Data настроенной папки загрузки лаунчера. Новые файлы изначально выключены. После загрузки нажмите **Перечитать файлы**; поиск фильтрует имена.

Пять обязательных игровых файлов (`Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`, `Dragonborn.esm`) не входят в выбираемые моды и их количество. При сохранении они всегда остаются первыми в указанном порядке, даже если дополнительные моды не выбраны. Через этот API нельзя удалить или переставить обязательные файлы. Если они отсутствуют или повреждены, сохранение отклоняется.

Включите моды флажками и задайте порядок стрелками. Мастер-файлы при включении добавляются перед обычными плагинами. **Сохранить порядок** изменяет только loadOrder в существующем server-settings.json, сохраняя ключи и остальные настройки. Нужен администратор с доступом к консоли.

Skyrim.esm должен быть первым. Зависимости читаются из заголовков TES4: нужный мастер должен быть включён до зависимого плагина. Проверяются отсутствующие, повреждённые, дублирующиеся и изменившиеся файлы, а также порядок. Если плагин есть только в папке загрузки, разместите такую же копию и в папке данных игрового сервера.

Перезапустите **игровой сервер**, чтобы создать соответствующий игровой манифест и манифест лаунчера. Независимая панель может продолжить работу. Лаунчер автоматически применит активный порядок к plugins.txt и loadorder.txt и сохранит исходные файлы игрока. Выключенные загруженные плагины исключаются из нового манифеста загрузки.

Изменения входят в оба серверных бэкенда и интерфейс панели в полных пакетах и обновлениях r11 для Windows/Linux. Перед заменой программных файлов остановите весь сервис вместе с панелью, затем запустите его снова. Проверки файлов и интерфейса не заменяют игровой тест; за совместимость модов отвечает владелец сервера.
