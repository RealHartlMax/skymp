[Deutsch](../../de/docs/docs_server_metrics.md) · [English](../../en/docs/docs_server_metrics.md) · [Русский](docs_server_metrics.md)

<a id="serverleistung-im-admin-dashboard"></a>

# Производительность сервера в административной панели

На 26.10.2026, **server-revision r12**. Входит в Full/Update Windows x64/Linux x64.

Измерения доступны прямо на **Dashboard**, дополнены обрывами соединений за шесть часов, собираемыми постоянным web-процессом. Наблюдаемое время явно указано. См. [панель/план restart](docs_dashboard_operations.md).

<a id="deutsch"></a>

## Представление измерений

**Метрики → Производительность сервера**: live-процесс, распределение game-tick и история 1/6/24 часа. Прежняя frontend/client-диагностика ниже. Нужен admin `canViewLogs`; публичные player/Launcher-API этих данных не получают.

- **Процесс:** CPU, общий RSS, JS-heap, средняя задержка event-loop отдельно game/dashboard. 100% — одно полное ядро, multicore может выше. RSS включает native-core. `monitorEventLoopDelay` имеет resolution 20 мс; среднее в простое примерно такое.
- **Game ticks:** только синхронный `server.tick()`, без намеренной миллисекунды внешнего sleep. Столбцы — доли **числа тиков**, не CPU-time/FPS. Live-окно 60 секунд.
- **История:** взвешенные по времени минутные process-means, tick-mean/max по вызовам. Нет измерения — разрыв. Выбор tick/CPU/RSS/players/event-loop; click/стрелки выбирают минуту, Home/End первую/последнюю, Esc/**Вернуться к live** выходит. Верхние значения/распределение следуют минуте.
- **Game-process active:** доля наблюдаемого времени supervisor `running`, минуты показаны. Не гарантия доступности/игры. Простой dashboard задним числом не объявляется uptime/down.
- **Медиана/пик игроков:** округлённые minute-means последних 24 часов. Краткий внутриминутный пик может ниже. Считаются game-соединения, включая ожидающих login.

В поставляемом starter собирает **постоянный dashboard-процесс**. Stop/start/crash игры сохраняют представление, dashboard-метрики, историю. Нет game-телеметрии либо старше пяти секунд — `—`. После restart принимаются лишь данные текущей PID. Direct-start без supervisor даёт объединённый game/web-процесс.

Новых портов/зависимостей нет. `GET /api/admin/server-performance?minutes=1440`: прежняя admin-session, `canViewLogs`, `Cache-Control: no-store`. Browser максимум один запрос, обновление каждые пять секунд. Защищённый Prometheus `/metrics` остаётся.

История: **`<dataDir>/.admin/server-performance.json`**, default `data/.admin/server-performance.json`. Атомарно примерно раз в минуту/при штатном exit. Сохранять весь свой `data/`, включая скрытые каталоги. Максимум 24 часа и частичная крайняя минута. Crash может потерять несохранённую минуту. Corrupt-файл не перезаписывается; UI предупреждает о новых данных только в памяти. Live-histogram после restart начинается заново, сохранённые минуты доступны.









<a id="local-validation"></a>

## Локальная проверка

Команды из `build/`. TS-проверки/тесты не публикуют релиз:

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

Lifecycle-fixture использует известные synthetic-game-измерения через настоящий supervisor-IPC/dashboard. Это не production-performance, не настоящая Skyrim/CEF/multiplayer-capacity.

Delayed-dashboard проверяет ранние owner login/touch/logout при уже готовой игре. Supervisor сразу передаёт sessions обоим детям, завершение dashboard не требует нового входа.

25.10.2026 локально успешны TS, frontend-units, шесть словарей, history/IPC на Windows (Node 24.19.0)/Ubuntu 26.04 (Node 22.22.1), lifecycle/auth обеих платформ. Видимый Chromium: pointer/keyboard, все метрики/диапазоны, 360/390/768px, stopped-game, empty-history, auth-loss, ограниченные WCAG A/AA. Game/history synthetic. Изолированный production-build успешен с прежними size-warnings. r9 ZIP не менялись во время source-тестов; r10 упаковывается отдельно. Временный browser-server удалён. Production-load/gameplay не проверены.
