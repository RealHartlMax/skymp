[Deutsch](../../de/docs/docs_project_status.md) · [English](docs_project_status.md) · [Русский](../../ru/docs/docs_project_status.md)

<a id="projektstand-und-offene-aufgaben"></a>

# Project status and open work

Source addendum **29 October 2026**: [v2.1.0 preparation/Plugin Runtime Loader](docs_plugin_runtime.md). Inventory snapshot, offline actions/release repository fixed; generic loaders/plugin/Launcher sources added. Source/no-emit checks separate from later full build/Skyrim/CEF/TeamSpeak acceptance. No builds/ZIPs/commits/pushes for this addendum. Older versions/builds below remain historical evidence.

Server build as of **26 October 2026**, separate Launcher documentation last reviewed **24 October**. Local `D:\GitHub\skymp`/`D:\GitHub\skymp-client-launcher`. Server baseline `4372c37e`, local profile/dashboard/navigation/restart-planning changes. No fresh Launcher source audit for this build. Local sources/evidence, no completed publication.

<a id="was-als-erledigt-zählt"></a>

## What counts as completed

r12 adds [dashboard operations](docs_dashboard_operations.md): direct shared settings, real process/tick overview, permanent six-hour disconnect statistics, daily timezoned restarts/warnings/persisted skip. Schedule never starts stopped games. txAdmin 8.1.1 comparison was read-only; RedM unchanged. Real Skyrim/CEF/Discord separate from browser/process tests.

| Task | Status/limit | Evidence |
| --- | --- | --- |
| Public mod API | Done: v2 targets/sizes/SHA-256/total/order/local requirements, HEAD/Range/ETag | `skymp5-server/ts/launcherResources.ts`, `misc/tests/test_launcher_resources.cjs` |
| Desktop mod preparation | Done: before SKSE check/download/cache/activate, preserve subdirectories, fail stops game | Launcher `connection.rs`, server/Rust contract |
| Restore originals/server switch | Managed files/order done, external modifications detected | Cache/repair/switch/restore tests |
| Version-bound clients | Done: actual EXE version chooses `catalog.json`; SKSE/Address Library supplied | `runtime_version.rs`, `create-runtime-manifest.mjs`, `create-runtime-catalog.mjs` |
| Test packages/browser setup | r11 25 October, Windows/Linux Full/Update, PIN/own admin, separate backend/dashboard | `build/releases/2026-10-25-server-r11/VALIDIERUNG.json`; historical native separately |
| Separate Full/Update ZIP | Fixed program allowlist, Update excludes operator files/scripts/data, Linux executable bits | `package_server_distributions.cjs`, `test_server_distributions.cjs`, release ZIP/upgrade evidence |
| Steam-required/flexible access | r5 native ticket without DLL replacement, Valve server validation, guest/approval/Worlds/Legacy, Steam list/account binding/concurrency protection; real Key/Skyrim open | [Login](docs_ingame_login.md), `playerAccess.integration.mjs`, native Launcher probe |
| Dashboard access/save | Cards/larger forms/simple toolbar/direct JSON-save, six UI languages | `AccessSettingsPanel.tsx`, `loginProviders.ts`, r5 browser |
| Launcher connection settings | Online/offline/master/ID/private key/address/modpath/catalog, setup/protected API implemented/tested | `misc/deploy/test-server/launcher-connection.cjs`, `misc/tests/test_launcher_connection.cjs`, package test |
| Runtime/bootstrap/quick actions | r2 private Node 22 LTS/SHA-256, targeted system packages, own control; Stop retains admin, Start/Restart own children | `misc/deploy/test-server/bootstrap-runtime.*`, `server-supervisor.cjs`, `misc/tests/test_server_supervisor.cjs`, r2 evidence |
| Dashboard independent of game | r3 settings/logs/auth/downloads while stopped; stop/start/restart/crash preserve PID/session/two WebSockets | `skymp5-server/ts/dashboard.ts`, `misc/tests/test_dashboard_runtime.cjs`, [process control](docs_vps_ports_and_process_control.md) |
| Performance metrics | r10 game/dashboard/tick/histories/selection/private persistence, both platforms Full/Update | [Metrics/limits](docs_server_metrics.md), `serverPerformance.integration.mjs`, lifecycle test |
| Independent Discord/status | r4 web bot, lifecycle/warnings/live config/ban-role IPC; monitoring alone never changes access | [Bot](docs_discord_bot.md), `discordBot.integration.mjs`, `--discord-fixture`; real Discord open |
| Discord settings tab | r10 `#discord`, masked token/channel help/JSON/discard/default/preview, optional status embed/link, targeted live save preserves other config, both Full/Update | [Templates](docs_discord_bot.md#status-embed-und-json-vorlagen), shared renderer/bot/dashboard tests |
| Mod order/publication | r11 ESM/ESP/ESL discovery/activation/order/master checks/targeted save/active filter; verified Steam display names | [Mod guide](../skymp5-server/MOD_LOAD_ORDER.md), mod/Launcher/Steam tests, r11 |
| GitHub full packaging | Same setup/supervisor templates/platform sources/version/hash | `package_ci_server.cjs`, `test_ci_server_package.cjs`; real Actions after future push |
| Launcher browser/details | Search/favorites/history/direct connect/metadata implemented locally tested | `ServerBrowser.tsx`, `ConnectionPanel.tsx`, UI evidence |
| PHP master/account flow | Implemented/isolated tests: dashboard accounts/game approval/heartbeat/public ID | `web/manage.skymp-worlds.net/native-master.php`, `web/api.skymp-worlds.net/native.php`, PHP tests |
| DE/EN/RU owner manual | Existing docs/static webroot done, publication separate | `docs/SERVER_OWNER_GUIDE.*.md`, `web/docs.skymp-worlds.net/`, docs UI |
| Automated accessibility | Test infrastructure axe/keyboard/dialog/forms done | `scripts/accessibility-checks.js`, `admin-form-checks.js`, `admin-auth-checks.js` |
| Config/admin-session docs | `joinAccess`, Discord/names/Launcher/master/session documented | [Config](docs_server_configuration_reference.md), [server](docs_running_a_server.md) |

“Done” applies only to stated scope. A download pass does not prove working gameplay.

<a id="was-teilweise-fertig-ist-oder-offen-bleibt"></a>

## Partial or outstanding

| Task | Current state | Required |
| --- | --- | --- |
| Skyrim 1.7.104/CEF/multiplayer | Active CommonLib port, Release DLLs/address probes 1/2/5 | Actual SKSE/CEF/login/multiple players |
| Full native server approval | Historical Linux 264/264, Windows 263/264 `Activate torch`, no latest-client full rerun | Fix/requalify, never relax timing just to turn green |
| Production/public rollout | Local packages/web ZIPs, `liveDeployed: false` | Real VPS/web versions/HTTPS/registration/login/load |
| Discord delivery | SDK simulation, no real token | Invite/rights/intents/status/warning acceptance |
| Interrupted downloads | Complete cache reused, server ranges | Launcher partial resume/configurable retry/backoff |
| Version cache | Server/content namespaces | Safe eviction/disk limits |
| Mod dependencies | `loadOrder`, hashes/base-game requirements | `dependsOn`, version constraints/graph resolver |
| Resource diagnosis/control | Inventory, r2 game-process control | Publication errors/full hashes/individual resource lifecycle |
| Plugin hardening | Discovery/basic errors | Process allowlist/health-restart contract/proven repair |
| A11y/responsive | Core/multiple widths automated | Other forms/devices/manual screen reader/CEF |
| Frontend optimization | Production/size/budget | Splitting/500 KiB gzip, old baseline 813,004 bytes |
| Launcher EXE updates | Metadata; runtime updates separate | Full signed EXE update/platform signatures |
| Voice lipsync, 27 October audit | VAD/relay/animation attempt; local YACA not automatic | Bridge/actor IDs/meters/stop-failsafe/two players; [findings](docs_voice_lipsync_status.md) |
| Gameplay/scaling | Partial | Remaining gameplay/scheduler/state bags/zone handover |

<a id="nachweise-und-ihre-gültigkeit"></a>

## Evidence and validity

- r11 adds resource UI/mod-Launcher API/Steam names since r10. Backends/frontend rebuilt together; Windows/Linux Full/Update use unchanged native core. Own settings/data/mods/images preserved. Separate r10 client runtime remains.

- r10 rebuilds both backends/frontend: metrics/Discord templates/new access forms/Steam view/six languages. Four Full/Update ZIPs separately; contents/executable permissions/upgrade tested, preserving config/admin/Steam/world/mods/gamemode. Launcher not rebuilt. Native threadpool fix delivered separately as new Windows runtime/catalog; Skyrim/CEF open. `build/releases/2026-10-25-server-r10/VALIDIERUNG.json`.

- r8 policy v2 compact server-ticket identity, stale HTTP 409, Valve 105 classification. Tests long different IDs/server authority/legacy no echo. Backends/dashboard/frontend rebuilt, native unchanged r7. `build/releases/2026-10-24-server-r8/VALIDIERUNG.json`.

- r7 rebuilds backend/dashboard/frontend. Valve explanation only operator log, sanitized/160 chars; public fixed codes. Tests remove keys/tickets/SteamID/URL/control chars. Launcher/native not rebuilt. `build/releases/2026-10-24-server-r7/VALIDIERUNG.json`.

- r6 rebuilds current source/Steam classification from Launcher finding: key/ticket/limits/network/invalid response/storage fixed codes, numeric nonprivate diagnostics. Patch hash/both source maps compared. Restart dashboard too. Real VPS login separate; Launcher/runtime not rebuilt.

- r5 evidence at current `build/releases/2026-10-24-server-r6/VALIDIERUNG.json`. Native Launcher got/released real ticket with Steam, no Skyrim/DLL replacement. Server simulated Valve; without operator key no full Steam game-server login proof. Access changes need game restart/updated Launcher-client.

- 23 October backend/dashboard/frontend pass; setup/HTTP/Launcher/mod tests Windows/Linux, isolated heartbeat. Real packages start five masters Windows, Ubuntu 24.04 Node 24, Ubuntu 26.04.1 Node 22.22.1. Native unchanged, Skyrim not started/VPS unchanged. Notes/tests after frozen snapshot.
- 22 October **25/25 Rust**, **6/6 runtime package**, five-group heartbeat, server TS pass; no Skyrim.
- Launcher `D:\GitHub\skymp-client-launcher\local-builds\current\VALIDATION.json`, 22 October: frontend/Release, 12 PHP groups, UI/manual, real downloads/standalone native probes. Explicit `gameplayValidated: false`, `realGameStarted: false`, `liveDeployed: false`; older checks read, not all rerun today.
- Old builds removed after r5, native baseline retained as JSON. 21 October modsync historical; 18-test old EXE lacks later catalog/client. Current Launcher `local-builds/current/` authoritative.
- After changes evidence applies only to listed files/hashes. Scoped `ok: true` never cancels explicitly omitted game testing.

<a id="dokumentationsabgleich"></a>

## Documentation review

Inventory before update: **109 server documents/27 Launcher documents**. Relative links checked, roadmaps/install/operation/config/Launcher contracts compared with code/evidence.

Release notes/older WebSocket/dated tests remain historical, not new measurements. Developer/API references retained; not full runtime testing of every Papyrus/SkyrimPlatform function or verification of external sites/services.

Active lists: [project](../ROADMAP.md), [frontend](../../../../ROADMAP_FRONTEND.md), [FiveM](../../../../ROADMAP_FIVEM_IDEAS.md). Start: [VPS](docs_linux_vps.md), [mods](docs_launcher_modpacks.md), [client catalog](docs_launcher_runtime_updates.md), [Worlds](docs_launcher_worlds.md).
