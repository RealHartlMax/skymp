# Serverleistung im Admin-Dashboard

Stand: 25. Oktober 2026, **Serverrevision r10**. Diese Erweiterung wird in den
Voll- und Update-Paketen für Windows x64 und Linux x64 mitgeliefert.

## Deutsch

Unter **Metriken → Serverleistung** stehen Live-Prozesswerte, eine Verteilung
der Game-Tick-Laufzeiten und ein Verlauf für 1, 6 oder 24 Stunden. Die bisherige
Frontend- und Client-Diagnose bleibt darunter verfügbar. Ein Admin-Konto mit
`canViewLogs` ist erforderlich; öffentliche Spieler- und Launcher-APIs erhalten
diese Messdaten nicht.

- **Prozesswerte:** CPU, gesamter Prozessspeicher (RSS), JavaScript-Heap und
  mittlere Node-Event-Loop-Verzögerung, getrennt für Game-Server und Dashboard.
  CPU 100 % entspricht einem ausgelasteten Kern; auf mehreren Kernen sind
  Werte über 100 % möglich. RSS enthält auch Speicher des nativen Serverkerns.
  Die Event-Loop-Messung verwendet `monitorEventLoopDelay` mit 20 ms Auflösung;
  ihr Mittelwert liegt auch im Leerlauf ungefähr bei dieser Auflösung.
- **Game-Ticks:** Gemessen wird ausschließlich der synchrone Aufruf von
  `server.tick()`. Die absichtliche Wartemillisekunde der äußeren Schleife ist
  ausgeschlossen. Die Balken zeigen den Anteil der **Tick-Anzahl** pro
  Laufzeitklasse, keine CPU-Zeitanteile und keine Client-FPS. Live gilt ein
  rollendes Fenster der letzten 60 Sekunden.
- **Verlauf:** Prozesswerte sind zeitgewichtete Minutenmittel; Tick-Mittel und
  Tick-Maximum stammen aus den gemessenen Aufrufen. Minuten ohne Messung bleiben
  Lücken. Über die Messgrößenauswahl sind Tick, CPU, RSS, Spieler und Event Loop
  verfügbar. Ein Klick oder die Pfeiltasten wählen einen historischen Zeitpunkt;
  Home/End springen zum ersten/letzten Messpunkt, Esc oder **Zurück zu Live**
  beenden die Auswahl. Die Werte und die Verteilung oben folgen dieser Minute.
- **Game-Prozess aktiv:** Anteil der erfassten Zeit, in der der Supervisor den
  Prozess als `running` meldete. Erfasste Minuten werden angezeigt. Dies ist
  keine öffentliche Erreichbarkeits- oder Gameplay-Garantie. Ausfallzeiten des
  Dashboards werden nicht nachträglich als Betrieb oder Ausfall geschätzt.
- **Spieler-Median und -Spitze:** Berechnet aus den vorhandenen gerundeten
  Minutenmitteln der letzten 24 Stunden. Ein kurzzeitiger Spitzenwert innerhalb
  einer Minute kann dadurch niedriger erscheinen. Gemeint sind verbundene
  Game-Verbindungen einschließlich einer noch offenen Anmeldung.

Mit dem mitgelieferten Starter sammelt der **dauerhafte Dashboard-Prozess** die
Daten. Stoppen, Starten und Absturz des Game-Prozesses erhalten die Ansicht,
Dashboard-Messungen und den bisherigen Verlauf. Aktuelle Game-Werte erscheinen
bei fehlender oder über fünf Sekunden alter Telemetrie als `—`. Nach einem
Neustart werden nur Messungen der aktuellen Game-PID angenommen. Ein direkter
Start ohne Supervisor zeigt einen gemeinsamen Prozess für Game und Web.

Es gibt keine neue Portfreigabe und keine zusätzliche Abhängigkeit.
`GET /api/admin/server-performance?minutes=1440` verwendet die bestehende
Admin-Sitzung, `canViewLogs` und `Cache-Control: no-store`. Der Browser lädt
höchstens eine Anfrage gleichzeitig und aktualisiert nach jeweils fünf Sekunden.
Die vorhandene geschützte Prometheus-Schnittstelle `/metrics` bleibt bestehen.

Der Verlauf liegt unter **`<dataDir>/.admin/server-performance.json`**, standardmäßig
`data/.admin/server-performance.json`. Er wird ungefähr einmal pro Minute und
beim geregelten Beenden atomar gespeichert. Bei Updates das gesamte eigene
`data/` einschließlich versteckter Ordner erhalten. Es bleiben höchstens 24
Stunden mit einer zusätzlichen angeschnittenen Randminute gespeichert. Ein
abrupter Prozessabbruch kann die seit dem letzten Speichern erfasste Minute
verlieren. Beschädigte Dateien werden nicht überschrieben; die Oberfläche zeigt
dann an, dass neue Werte nur im Arbeitsspeicher bleiben. Die Live-Verteilung
beginnt nach einem Dashboard-Neustart neu; gespeicherte Minuten bleiben wählbar.

## English

**Metrics → Server performance** adds separate game/dashboard CPU, RSS, JS heap
and mean Node event-loop delay, a rolling 60-second native tick histogram and
1/6/24-hour minute charts. Existing frontend diagnostics remain below it.
CPU 100% means one fully used core. Event-loop monitoring has 20 ms resolution,
which is also approximately the idle baseline. Tick durations measure only
`server.tick()`, excluding the deliberate outer-loop sleep. Histogram bars
represent tick counts, rather than shares of total CPU time.

Click the chart or use arrow keys/Home/End to inspect a minute; Esc or **Return
to live** restores live measurements. Missing telemetry creates gaps. Process
availability covers observed supervisor `running` time only. Player median/peak
use rounded minute means of connected game connections, including pending login.
The persistent dashboard keeps collecting while the game is stopped or crashes.
Stale game telemetry is unavailable after five seconds; standalone mode reports
the combined process.

The API requires an authenticated admin with `canViewLogs`. No extra port is
needed. History is saved atomically to `<dataDir>/.admin/server-performance.json`
every minute and at orderly shutdown. Preserve hidden directories during updates.
A crash may lose the unsaved minute. Corrupt files remain untouched and trigger
a memory-only warning. The last-minute live histogram starts fresh after a
dashboard restart. This is included in r10 full/update packages for both platforms.

## Русский

Раздел **Метрики → Производительность сервера** показывает CPU, RSS, JS heap и
среднюю задержку Node event loop отдельно для игрового сервера и панели, а также
распределение длительности тиков за 60 секунд и поминутные графики за 1/6/24 часа.
CPU 100% соответствует одному полностью занятому ядру. Разрешение измерения event
loop — 20 мс; примерно такое значение нормально и в простое. Измеряется только
вызов `server.tick()`, без намеренной паузы внешнего цикла. Столбцы отражают доли
количества тиков, а не процессорного времени.

Щелчок по графику, стрелки и Home/End выбирают минуту; Esc или **Вернуться к
прямому эфиру** возвращают текущие данные. Пропуски измерений остаются разрывами.
Доля работы учитывает только наблюдаемое состояние `running`, а показатели
игроков — округлённые средние по минутам для подключений, включая ожидающих входа.
Панель продолжает сбор при остановке или падении игрового процесса. Игровые
данные старше пяти секунд не показываются как текущие. В standalone-режиме
игровой сервер и веб-панель имеют общий процесс.

API доступен только администратору с `canViewLogs`; новый порт не требуется.
История атомарно сохраняется в `<dataDir>/.admin/server-performance.json` раз в
минуту и при штатном завершении. При обновлении сохраняйте скрытые каталоги.
Аварийное завершение может потерять несохранённую минуту. Повреждённый файл не
перезаписывается: панель предупреждает о хранении новых данных только в памяти.
После перезапуска панели живая гистограмма начинает сбор заново. Изменение
входит в полные пакеты и обновления r10 для обеих платформ.

## Local validation

Run commands from `build/`. TypeScript checks and tests do not publish a release:

```powershell
node ../skymp5-server/node_modules/typescript/bin/tsc --project ../skymp5-server/tsconfig.json --noEmit
node ../skymp5-front/node_modules/typescript/bin/tsc --project ../skymp5-front/tsconfig.json --noEmit
node ../skymp5-server/tests/serverPerformance.integration.mjs
node ../skymp5-front/scripts/test-unit.js
node ../skymp5-front/scripts/test-locales.js
# Point this at an isolated compilation of the current dashboard source:
$env:SKYMP_DASHBOARD_TEST_BUNDLE = '<test-directory>/skymp5-admin.js'
node ../misc/tests/test_dashboard_runtime.cjs
node ../misc/tests/test_dashboard_runtime.cjs --delayed-dashboard
```

The lifecycle fixture uses known synthetic game measurements over the real
supervisor IPC and a real dashboard process. These checks do not establish
production performance, real Skyrim/CEF behavior or multiplayer capacity.

The delayed-dashboard scenario also covers early owner login/touch/logout while
the game is already ready. The supervisor forwards these sessions immediately
to both children, so finishing dashboard startup does not require another login.

Local checks on 25 October 2026 passed for TypeScript, frontend units, all six
locale dictionaries, history/IPC validation on Windows (Node 24.19.0) and Ubuntu
26.04 (Node 22.22.1), and dashboard lifecycle/authentication on both platforms.
Visible Chromium checks covered pointer/keyboard selection, all metrics/ranges,
360/390/768px layouts, stopped game, empty history, authorization loss and scoped
automated WCAG A/AA checks. Browser game/history values were synthetic. Isolated
production compilation passed with the existing bundle-size warnings. The r9
ZIPs remained unchanged during those source tests; r10 is packaged separately.
The disposable browser server was removed. Production load and actual gameplay
remain untested here.
