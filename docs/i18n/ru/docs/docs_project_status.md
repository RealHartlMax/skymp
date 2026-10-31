[Deutsch](../../de/docs/docs_project_status.md) · [English](../../en/docs/docs_project_status.md) · [Русский](docs_project_status.md)

<a id="projektstand-und-offene-aufgaben"></a>

# Статус проекта и открытые задачи

Дополнение исходников **29.10.2026**: [подготовка v2.1.0/Plugin Runtime Loader](docs_plugin_runtime.md). Исправлены inventory-snapshot/offline-actions/release-repo, добавлены общие loader/plugin/Launcher-sources. Source/no-emit отдельно от будущего full-build/Skyrim/CEF/TeamSpeak. Для дополнения builds/ZIP/commit/push нет; старые сведения ниже исторические.

Server-build на **26.10.2026**, Launcher-docs последний раз **24.10**. Локальные `D:\GitHub\skymp`, `D:\GitHub\skymp-client-launcher`. База server `4372c37e`, local player-profile/dashboard/navigation/restart. Новый аудит Launcher-source для этого build не проводился. Описаны локальные sources/evidence, не публикация.

<a id="was-als-erledigt-zählt"></a>

## Что считается завершённым

r12 [dashboard-operations](docs_dashboard_operations.md): общий settings-доступ, реальные process/tick, постоянные шесть часов disconnect-статистики, daily-timezone-restart/warnings/saved-skip. Остановленную игру расписание не запускает. txAdmin 8.1.1 read-only, RedM не менялся. Реальные Skyrim/CEF/Discord отдельно от local browser/process.

| Задача | Статус/предел | Доказательство |
| --- | --- | --- |
| Public mod-API | Готово: v2 paths/size/SHA-256/total/order/local-requirements, HEAD/Range/ETag | `skymp5-server/ts/launcherResources.ts`, `misc/tests/test_launcher_resources.cjs` |
| Desktop-mods | Проверка/download/cache/activate до SKSE, subdirs сохранены, error блокирует игру | `connection.rs`, server/Rust-contract |
| Restore/server-switch | Managed-файлы/order, обнаружение внешних правок | Cache/repair/switch/restore |
| Versioned-client | EXE-version выбирает `catalog.json`, SKSE/Address Library возможны | `runtime_version.rs`, `create-runtime-manifest.mjs`, `create-runtime-catalog.mjs` |
| Server-test/setup | r11 25 октября, Win/Linux Full/Update, PIN/свой admin, раздельные процессы | `build/releases/2026-10-25-server-r11/VALIDIERUNG.json`, native отдельно |
| Full/Update ZIP | Program-allowlist, Update без operator/scripts/data, Linux executable-bits | `package_server_distributions.cjs`, `test_server_distributions.cjs`, release-проверки |
| Steam/flexible-login | r5 native-ticket без DLL-замены, Valve-server, guest/approval/Worlds/Legacy, список/связи/concurrency; real-Key/Skyrim открыты | [Login](docs_ingame_login.md), `playerAccess.integration.mjs`, native-probe |
| Access-dashboard/save | Cards/большие формы/toolbar/direct JSON, шесть языков | `AccessSettingsPanel.tsx`, `loginProviders.ts`, r5 browser |
| Launcher-settings | Online/offline/master/ID/key/address/modpath/catalog, browser/protected-API проверены | `misc/deploy/test-server/launcher-connection.cjs`, `misc/tests/test_launcher_connection.cjs`, package |
| Runtime/quick-actions | r2 private Node 22 LTS/SHA-256/system packages/own-child control, Stop сохраняет admin | `misc/deploy/test-server/bootstrap-runtime.*`, `server-supervisor.cjs`, `misc/tests/test_server_supervisor.cjs`, r2 |
| Dashboard независимо | r3 config/log/auth/downloads при stop/crash, PID/session/два WebSockets сохранены | `skymp5-server/ts/dashboard.ts`, `misc/tests/test_dashboard_runtime.cjs`, [процессы](docs_vps_ports_and_process_control.md) |
| Performance | r10 отдельные game/dashboard/tick/history/selection/private persistence, Full/Update обоих | [Метрики](docs_server_metrics.md), `serverPerformance.integration.mjs`, lifecycle |
| Discord независимо | r4 web-bot/lifecycle/warnings/live-config/ban-role-IPC; monitoring не меняет access | [Discord](docs_discord_bot.md), `discordBot.integration.mjs`, `--discord-fixture`; реальный открыт |
| Discord-tab | r10 `#discord`, masked-token/channel-help/JSON/discard/default/preview, optional embeds/links, targeted-save, обе платформы | [Templates](docs_discord_bot.md#status-embed-und-json-vorlagen), renderer/bot/dashboard |
| Mod-order/publication | r11 ESM/ESP/ESL detection/activation/order/master-check/save/filter, Steam-display-names | [Mods](../skymp5-server/MOD_LOAD_ORDER.md), mod/Launcher/Steam tests, r11 |
| GitHub full-package | Общие setup/supervisor/platform/version/hash | `package_ci_server.cjs`, `test_ci_server_package.cjs`; real Actions после push |
| Desktop-browser/details | Поиск/favorites/history/direct/metadata локально | `ServerBrowser.tsx`, `ConnectionPanel.tsx`, UI |
| PHP-master/account | Dashboard-accounts/game-approval/heartbeat/public-ID, isolated tests | `web/manage.skymp-worlds.net/native-master.php`, `web/api.skymp-worlds.net/native.php`, PHP |
| Owner-manual DE/EN/RU | Docs/static-webroot готовы, публикация отдельно | `docs/SERVER_OWNER_GUIDE.*.md`, `web/docs.skymp-worlds.net/`, UI |
| Accessibility | Axe/keyboard/dialog/forms инфраструктура | `scripts/accessibility-checks.js`, `admin-form-checks.js`, `admin-auth-checks.js` |
| Config/admin-session docs | `joinAccess`, Discord/names/Launcher/master/session описаны | [Config](docs_server_configuration_reference.md), [server](docs_running_a_server.md) |

«Готово» лишь в указанном scope. Download-pass не доказывает игру.

<a id="was-teilweise-fertig-ist-oder-offen-bleibt"></a>

## Частично/открыто

| Задача | Сейчас | Нужно |
| --- | --- | --- |
| Skyrim 1.7.104/CEF/multiplayer | CommonLib active, Release-DLL/address 1/2/5 | Настоящие SKSE/CEF/login/игроки |
| Full-native approval | Linux 264/264, Windows 263/264 `Activate torch`, новая full-suite не повторена | Исправить/requalify, не менять timing ради зелёного |
| Production/rollout | Local ZIP/web, `liveDeployed: false` | Реальные VPS/web/HTTPS/registration/login/load |
| Discord delivery | SDK-simulation, без real-token | Invite/rights/intents/status/warnings |
| Interrupted-download | Полный cache reused, server-range | Partial-resume/config-retry/backoff |
| Version-cache | Server/content namespaces | Safe-eviction/disk-limit |
| Mod-dependencies | `loadOrder`/hash/base-game | `dependsOn`/version/graph |
| Resource-control | Inventory/r2 game-control | Publication-errors/full-hashes/отдельные ресурсы |
| Plugin-hardening | Discovery/basic-errors | Process-allowlist/health-restart/repair |
| A11y/responsive | Core/ширины автоматизированы | Другие формы/devices/screenreader/CEF |
| Frontend | Production/size/budget | Splitting/500 KiB gzip, старая база 813 004 байта |
| Launcher EXE-update | Metadata, separate runtime-update | Полный signed-EXE/platform-signatures |
| Voice-lipsync 27 октября | VAD/relay/animation-attempt, YACA не auto | Bridge/actor-map/meters/stop/failsafe/two-player; [выводы](docs_voice_lipsync_status.md) |
| Gameplay/scaling | Частично | TODO/scheduler/state-bags/zone-handover |

<a id="nachweise-und-ihre-gültigkeit"></a>

## Доказательства/срок действия

- r11 после r10 добавляет resources/mod-Launcher API/Steam names. Backend/frontend вместе, Full/Update Win/Linux с неизменным native. Config/data/mods/images сохранены, r10-client-runtime остаётся.

- r10 пересобирает backend/frontend: metrics/Discord/access/Steam/six-languages. Четыре ZIP отдельно, content/permissions/upgrade проверяются, private config/admin/Steam/world/mod/gamemode сохраняются. Launcher без rebuild. Threadpool-fix отдельно новым Win-runtime/catalog, game открыт. `build/releases/2026-10-25-server-r10/VALIDIERUNG.json`.

- r8 policy v2/compact server-ticket, stale-409/Valve-105. Tests long IDs/server-authority/legacy-no-echo. Backend/dashboard/frontend новые, native как r7. `build/releases/2026-10-24-server-r8/VALIDIERUNG.json`.

- r7 backend/dashboard/frontend: Valve-explanation лишь log, sanitized/160; public fixed-codes. Secrets/tickets/SteamIDs/URL/control удаляются. Launcher/native без build. `build/releases/2026-10-24-server-r7/VALIDIERUNG.json`.

- r6 Steam-classification: key/ticket/limit/network/invalid/storage — fixed-code, numeric/private-free. Сверены patch-hash/две source-map. Restart dashboard тоже. VPS-login отдельно; Launcher/runtime не rebuild.

- r5 evidence `build/releases/2026-10-24-server-r6/VALIDIERUNG.json`. Настоящий Launcher-ticket получен/освобождён при Steam без Skyrim/DLL-замены. Server-Valve simulated; без operator-key полного входа не доказано. Access-change требует game-restart/new Launcher-client.

- 23 октября backend/dashboard/frontend успешны; setup/HTTP/Launcher/mod Win/Linux, heartbeat изолирован. Пять masters/start Windows, Ubuntu 24.04 Node 24, Ubuntu 26.04.1 Node 22.22.1. Native неизменён, Skyrim/VPS не затронуты, docs после snapshot.
- 22 октября **25/25 Rust**, **6/6 package**, пять heartbeat-групп, server-TS успешны, Skyrim нет.
- Launcher `D:\GitHub\skymp-client-launcher\local-builds\current\VALIDATION.json` 22 октября: frontend/Release/12 PHP/UI/manual/real-download/native probes. Явные `gameplayValidated: false`, `realGameStarted: false`, `liveDeployed: false`. Старые проверки прочитаны, не все повторены сегодня.
- Старые builds удалены после r5, baseline JSON сохранён. 21 октября modsync историчен, EXE с 18 тестами не содержит поздние catalog/client. Current `local-builds/current/` приоритетен.
- Доказательства лишь для указанных files/hashes; scoped `ok: true` не отменяет пропущенную игру.

<a id="dokumentationsabgleich"></a>

## Сверка документации

До обновления **109 server-docs/27 Launcher-docs**. Relative-links проверены; roadmaps/install/operation/config/Launcher сопоставлены с code/evidence.

Release-notes/старые WebSocket/датированные отчёты историчны, не новые измерения. Dev/API-reference сохранены; не полный runtime-test всех Papyrus/SkyrimPlatform и не проверка внешних сайтов.

Списки: [project](../ROADMAP.md), [frontend](../../../../ROADMAP_FRONTEND.md), [FiveM](../ROADMAP_FIVEM_IDEAS.md). Начало: [VPS](docs_linux_vps.md), [mods](docs_launcher_modpacks.md), [client/catalog](docs_launcher_runtime_updates.md), [Worlds](docs_launcher_worlds.md).
