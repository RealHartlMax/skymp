[Deutsch](../../de/docs/docs_server_metrics.md) · [English](docs_server_metrics.md) · [Русский](../../ru/docs/docs_server_metrics.md)

<a id="serverleistung-im-admin-dashboard"></a>

# Server performance in the admin dashboard

As of 26 October 2026, **server revision r12**. Included in full/update packages for Windows x64/Linux x64.

Measurements are also directly on **Dashboard**, with disconnects from last six hours collected in permanent web process. Observed duration explicitly shown. See [dashboard/restart plan](docs_dashboard_operations.md).

<a id="deutsch"></a>

## Measurements

**Metrics → Server performance** has live process values, game-tick duration distribution and 1/6/24-hour history. Existing frontend/client diagnostics remain below. Requires admin `canViewLogs`; public player/Launcher APIs receive no metrics.

- **Process:** CPU, total RSS, JS heap, mean Node event-loop delay, separately for game/dashboard. CPU 100% is one full core; multicore may exceed 100%. RSS includes native core. `monitorEventLoopDelay` resolution is 20 ms; idle mean is approximately that resolution.
- **Game ticks:** only synchronous `server.tick()` is measured, excluding deliberate millisecond outer-loop sleep. Bars show shares of **tick count**, not CPU-time shares/client FPS. Rolling last 60 seconds live.
- **History:** time-weighted process minute means; tick mean/max from actual calls. Unmeasured minutes stay gaps. Select tick/CPU/RSS/players/event loop; click/arrows choose a historical minute, Home/End first/last, Esc/**Return to live** exits. Upper values/distribution follow selected minute.
- **Game process active:** observed-time share supervisor reported `running`. Observed minutes shown. No public reachability/gameplay guarantee; dashboard downtime is not retrospectively guessed as uptime/downtime.
- **Player median/peak:** rounded minute means from last 24 hours. Brief intra-minute peaks may appear lower. Counts connected game connections, including pending login.

Bundled starter's **persistent dashboard process** collects. Game stop/start/crash retains view, dashboard metrics/history. Missing/game telemetry older than five seconds shows `—`. After restart only current game-PID samples accepted. Direct startup without supervisor reports combined game/web process.

No extra ports/dependencies. `GET /api/admin/server-performance?minutes=1440` uses existing admin session, `canViewLogs`, `Cache-Control: no-store`. Browser has at most one pending request, refresh every five seconds. Existing protected Prometheus `/metrics` stays.

History: **`<dataDir>/.admin/server-performance.json`**, default `data/.admin/server-performance.json`. Saved atomically approximately every minute/orderly exit. Preserve whole own `data/`, including hidden directories, on updates. At most 24 hours plus partial boundary minute. Abrupt exit can lose unsaved minute. Corrupt files never overwritten; UI warns new values remain memory-only. Live histogram resets on dashboard restart, stored minutes remain selectable.









## Local validation

Run commands from `build/`. TypeScript checks/tests do not publish a release:

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

Lifecycle fixture uses known synthetic game measurements over real supervisor IPC/real dashboard process. No proof of production performance, actual Skyrim/CEF or multiplayer capacity.

Delayed-dashboard scenario also covers early owner login/touch/logout with game already ready. Supervisor forwards sessions immediately to both children, so dashboard completion needs no new login.

Local checks on 25 October 2026 passed: TypeScript, frontend units, all six dictionaries, history/IPC on Windows (Node 24.19.0)/Ubuntu 26.04 (Node 22.22.1), dashboard lifecycle/auth on both. Visible Chromium covered pointer/keyboard, all metrics/ranges, 360/390/768px, stopped game, empty history, auth loss and scoped automatic WCAG A/AA. Game/history values synthetic. Isolated production build passed with existing size warnings. r9 ZIPs stayed unchanged during source tests; r10 packaged separately. Disposable browser server removed. Production load/gameplay untested.
