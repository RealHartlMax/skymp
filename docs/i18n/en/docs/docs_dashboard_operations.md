[Deutsch](../../de/docs/docs_dashboard_operations.md) · [English](docs_dashboard_operations.md) · [Русский](../../ru/docs/docs_dashboard_operations.md)

<a id="dashboard-und-gameserver-neustarts"></a>

# Dashboard and game-server restarts

As of 26 October 2026. The dashboard was compared read-only with the operator’s running txAdmin 8.1.1. Neither the RedM server nor its settings were changed. SkyMP uses its own interface components and the bundled server logo.


**Settings → Security** (`#settings/security`) manages the Core’s console and cheat protection. Administrator role and `canConsole` are required. Stored values and the active configuration confirmed by the native game server are displayed separately; changes require a game-server restart. Client reports of found console hooks are unverified self-reports. Protection works without Chat and does not change its `/` commands. Migration, development mode and movement-analysis limits are described in [Console Security](docs_console_security.md).

**Server Log** also receives new console and admin messages through the active WebSocket connection. The live console and HTTP log list remain available. JavaScript console messages are written once to the terminal and JavaScript log file; the additional copy through the native logger is removed. Regular successful master heartbeats are logged at most every five minutes. Startup, shutdown, errors and recovery are still reported; the heartbeat interval itself is unchanged.

**Send Announcement** in quick actions sends the message to every connected player as a banner at the top of the game screen. It remains visible for eight seconds; the existing client display limits text to 240 characters. The dashboard uses the existing `announcementToast` packet. Optional Chat adapters may additionally display the message in chat. This fix requires updating and restarting the server programs; no native client DLL change is needed. Local HTTP/browser checks do not replace Skyrim/CEF testing.

**Resources → Server Plugins** shows extensions detected under `Plugins/` at game-server startup. Each plugin offers **Enable** and **Disable**. **Enable all disabled** enables every detected plugin with a `plugin.json`, including plugins outside the search filter. Under **New plugins at game-server startup**, **Enable automatically** can replace the default dashboard approval. Newly discovered plugins then load immediately. Previously known disabled plugins remain disabled until enabled individually or together. Approval is persisted; no terminal command is needed on every startup. Runtime status and startup approval are displayed separately. A game-server restart is sufficient for these plugin changes. Distribution format, initial installation and limitations are described in the [plugin guide](../README-plugins.md).

**Resources → Game Mods** manages additional mods. The five required Skyrim game files are not selectable as mods and are automatically retained at the beginning of the load order when saving.

**Dashboard** now shows the same actual process and tick measurements as **Metrics**, including history and a selectable time. It also shows captured disconnects over the last six hours, separated into expected and unexpected disconnections. The observation start is displayed; missing hours are not presented as error-free operation. Measurement definitions, CPU percentages and gaps are explained in the [metrics guide](docs_server_metrics.md). Server details and your permissions can be expanded below.

**Settings** opens the shared **General**, **Game Server**, **Access**, **Discord**, **World Settings** and **Raw JSON** sections directly. The sidebar CFG editor opens JSON. Direct links use `/admin?devUi=1&admin=1#settings/general`, `#settings/server`, `#settings/access`, `#settings/discord`, `#settings/game` and `#settings/json`. The old `#discord` link remains valid. Discord retains masked credentials, separate saving and a validated preview; in-game login remains configurable under Access, including **Legacy (skymp.net)**.

<a id="neustartplan-über-das-formular"></a>

### Restart schedule through the form

1. Start the complete service through `launch_server.bat` or `launch_server.sh`. Open **Settings → Game Server**.
2. Enable the restart schedule, select an IANA time zone such as `Europe/Berlin`, and add up to twelve daily times. Server and browser time zones are shown as hints. The schedule explicitly uses the selected zone and follows its daylight-saving changes.
3. Select advance warnings and save. Changes apply immediately. The sidebar shows the next occurrence; **Skip Next** skips exactly that occurrence. Future days remain scheduled.

Only the **game server** restarts. The dashboard, sessions, Discord connection, logs, settings and launcher downloads remain available. An intentionally stopped, crashed or currently starting game process is not started by the schedule. Missed occurrences during downtime are not caught up. A process-control error does not automatically retry an already claimed occurrence.

Nonexistent local times during daylight-saving transitions are skipped that day. A repeated local time runs at most once. Advance warnings travel over private supervisor IPC to the existing game client (`announcementToast` and existing Chat adapters) and configured Discord warning channel. No additional ports are needed. Actual in-game display and delivery to a real Discord remain separate acceptance steps.

Configuration is stored as `restartSchedule` in `server-settings.json`. The form changes only this field and detects stale revisions. Executed/skipped occurrences are persisted atomically to `<dataDir>/restart-schedule-state.json` before process actions. If write access is missing or the file is damaged, automatic actions are blocked. Damaged files are not overwritten. Investigate the error and, after backing up, restore the file with the complete service stopped.

Disconnect statistics are stored in `<dataDir>/dashboard-activity.json`, containing at most 5,000 events from the last six hours with only time, type and the truncated game-reported reason. No IPs, SteamIDs or credentials are added. On write failure, this display continues in memory and reports the failure. Abrupt termination may lose the last two seconds. A game-server restart preserves this data in the web process.

**When updating:** stop the complete service, replace files from the Update ZIP matching the operating system, then restart. Preserve `server-settings.json` and your entire `data/`, including both files. Full ZIPs are for first installation. They contain neither a preset administrator nor an active restart schedule. See the [update guide](docs_packaged_server_update.md).

<a id="schnittstellen"></a>

### Interfaces

All endpoints require existing admin authentication. Reads require `canViewLogs`; writes require the admin role and `canConsole`.

| Method and path | Behaviour |
| --- | --- |
| `GET /api/admin/overview` | Aggregated six-hour disconnect statistics and observation start |
| `GET /api/admin/server/restart-schedule` | Configuration, revision, next occurrence, time zone and storage status |
| `POST /api/admin/server/restart-schedule` | Save only `restartSchedule`; expects `config` and current `revision` |
| `POST /api/admin/server/restart-schedule/skip` | Skip next occurrence; expects current `nextAt` |

Writes require JSON from the same Origin. A stale revision or changed occurrence returns HTTP 409; invalid times or time zones return HTTP 400. This setting is not a shell command and cannot launch arbitrary programs.






