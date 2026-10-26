# Dashboard und Gameserver-Neustarts

Stand: 26. Oktober 2026. Das Dashboard wurde am laufenden txAdmin 8.1.1 des
Betreibers lesend verglichen. Der RedM-Server und seine Einstellungen wurden
dabei nicht verändert. Die SkyMP-Oberfläche verwendet eigene Komponenten und
das mitgelieferte Serverlogo.

## Deutsch

**Dashboard** zeigt jetzt dieselben echten Prozess- und Tickmessungen wie
**Metriken**, einschließlich Zeitverlauf und wählbarem Zeitpunkt. Dazu kommen
erfasste Verbindungsabbrüche der letzten sechs Stunden, getrennt nach erwarteten
und unerwarteten Trennungen. Der Beobachtungsbeginn wird angezeigt; fehlende
Stunden werden nicht als fehlerfreier Betrieb ausgegeben. Details zu Messgrößen,
CPU-Prozenten und Messlücken stehen im [Metrikleitfaden](docs_server_metrics.md).
Serverdetails und eigene Berechtigungen lassen sich darunter aufklappen.

**Einstellungen** öffnet direkt die gemeinsamen Bereiche **Allgemein**,
**Gameserver**, **Zugang**, **Discord**, **Welteinstellungen** und **Rohes JSON**.
Der seitliche CFG-Editor führt direkt zum JSON-Bereich. Direkte Links verwenden
`/admin?devUi=1&admin=1#settings/general`, `#settings/server`, `#settings/access`,
`#settings/discord`, `#settings/game` und `#settings/json`. Der bisherige Link
`#discord` funktioniert weiterhin. Discord behält seine maskierten Zugangsdaten,
separate Speicherung und validierte Vorschau; die Anmeldung im Spiel bleibt
unter Zugang einschließlich **Legacy (skymp.net)** konfigurierbar.

### Neustartplan über das Formular

1. Den vollständigen Dienst über `launch_server.bat` oder `launch_server.sh`
   starten. **Einstellungen → Gameserver** öffnen.
2. Den Neustartplan aktivieren, eine IANA-Zeitzone wählen, beispielsweise
   `Europe/Berlin`, und bis zu zwölf tägliche Uhrzeiten hinzufügen. Die
   Zeitzonen von Server und Browser erscheinen als Hinweis. Der Zeitplan gilt
   ausdrücklich in der gewählten Zeitzone und folgt deren Sommer-/Winterzeit.
3. Vorwarnungen auswählen und speichern. Änderungen gelten sofort. Die
   Seitenleiste zeigt den nächsten Termin; **Nächsten überspringen** überspringt
   genau diesen Termin. Künftige Tage bleiben eingeplant.

Es wird ausschließlich der **Gameserver** neu gestartet. Dashboard, Sitzungen,
Discord-Verbindung, Logs, Einstellungen und Launcher-Downloads bleiben bestehen.
Ein absichtlich gestoppter, abgestürzter oder gerade startender Game-Prozess
wird durch den Zeitplan nicht gestartet. Ein während einer Downtime verpasster
Termin wird nicht nachgeholt. Bei einem Fehler der Prozesssteuerung gibt es
keine automatische Wiederholung des bereits beanspruchten Termins.

Nicht vorhandene lokale Zeiten bei der Zeitumstellung entfallen an diesem Tag.
Eine doppelt vorkommende lokale Uhrzeit wird höchstens einmal ausgeführt.
Vorwarnungen gehen über private Supervisor-IPC an den vorhandenen Spielclient
(`announcementToast` und vorhandene Chat-Adapter) sowie an den konfigurierten
Discord-Warnkanal. Es werden keine zusätzlichen Ports benötigt. Die reale
Anzeige im Spiel und die Zustellung in einem echten Discord bleiben eigene
Abnahmeschritte.

Die Konfiguration liegt als `restartSchedule` in `server-settings.json`.
Das Formular ändert nur dieses Feld und erkennt veraltete Speicherstände.
Bereits ausgeführte/übersprungene Termine werden vor einer Prozessaktion
atomar in `<dataDir>/restart-schedule-state.json` gespeichert. Fehlt die
Schreibberechtigung oder ist die Datei beschädigt, werden automatische Aktionen
unterbunden. Beschädigte Dateien werden nicht überschrieben. Den Fehler prüfen
und die Datei nach Sicherung bei gestopptem Gesamtdienst wiederherstellen.

Die Abbruchstatistik liegt in `<dataDir>/dashboard-activity.json`, umfasst
höchstens 5.000 Ereignisse der letzten sechs Stunden und speichert nur Zeitpunkt,
Art und den gekürzten, vom Spiel gemeldeten Grund. Sie ergänzt keine IPs,
SteamIDs oder Anmeldedaten. Bei Schreibfehlern arbeitet diese Anzeige im
Arbeitsspeicher weiter und meldet dies. Abruptes Beenden kann die letzten zwei
Sekunden verlieren. Ein Gameserver-Neustart erhält die Daten im Webprozess.

**Beim Update:** den gesamten Dienst beenden, das zum Betriebssystem passende
Update-ZIP ersetzen und neu starten. `server-settings.json` und das komplette
eigene `data/` einschließlich beider Dateien erhalten. Full-ZIPs dienen der
Ersteinrichtung. Sie enthalten weder einen voreingestellten Admin noch einen
aktiven Neustartplan. Siehe [Updateanleitung](docs_packaged_server_update.md).

### Schnittstellen

Alle Endpunkte erfordern die vorhandene Admin-Anmeldung. Lesen benötigt
`canViewLogs`; Änderungen benötigen die Admin-Rolle und `canConsole`.

| Methode und Pfad | Verhalten |
| --- | --- |
| `GET /api/admin/overview` | Aggregierte Sechs-Stunden-Abbruchstatistik und Beobachtungsbeginn |
| `GET /api/admin/server/restart-schedule` | Konfiguration, Revision, nächster Termin, Zeitzone und Speicherstatus |
| `POST /api/admin/server/restart-schedule` | Nur `restartSchedule` speichern; erwartet `config` und aktuelle `revision` |
| `POST /api/admin/server/restart-schedule/skip` | Nächsten Termin überspringen; erwartet den aktuellen `nextAt` |

Schreibzugriffe erfordern JSON vom gleichen Origin. Eine veraltete Revision
oder ein inzwischen geänderter Termin liefert HTTP 409; ungültige Zeiten oder
Zeitzonen HTTP 400. Die Einstellung ist kein Shell-Befehl und kann keine
beliebigen Programme starten.

## English

The overview combines existing native tick/process metrics with six-hour
disconnect aggregates and their actual observation start. Settings now opens
the shared form tabs directly; CFG opens raw JSON. `#settings/server` manages
daily game-only restarts with an explicit IANA time zone, advance warnings and
durable skip-next. The legacy `#discord` link remains supported.

Use the bundled process manager. Stopped games stay stopped; missed schedules
are not caught up. Missing DST times are skipped and repeated wall-clock times
run at most once. Dashboard authentication, downloads and Discord remain online.
Updates must preserve `server-settings.json` and all of `data/`. No active
schedule or credentials ship in first-run packages. Actual in-game notifications,
live Discord delivery and multiplayer remain separate acceptance checks.

## Русский

Обзор объединяет существующие метрики игрового и веб-процессов с агрегированной
статистикой отключений за шесть часов и временем начала наблюдения. Настройки
сразу открывают вкладки форм; CFG открывает JSON. В `#settings/server`
настраиваются ежедневные перезапуски только игрового процесса: часовой пояс
IANA, предупреждения и сохранённый пропуск ближайшего перезапуска. Старый адрес
`#discord` продолжает работать.

Нужен комплектный диспетчер процессов. Остановленная игра не запускается;
пропущенные перезапуски не выполняются позже. При переводе часов отсутствующее
время пропускается, повторяющееся выполняется один раз. Панель, вход, загрузки
и Discord продолжают работать. При обновлении сохраняйте `server-settings.json`
и весь каталог `data/`. Реальная доставка предупреждений в игре и Discord,
а также многопользовательская игра требуют отдельной проверки.
