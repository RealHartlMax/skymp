# SkyMP server plugin system

This guide describes setup, operation and migration of the plugin system.

New in the source revision for v2.1.0: [Plugin Runtime Loader](docs/docs_plugin_runtime.md). Plugins can declare signed client/CEF packages through `Runtime/manifest.json`. The launcher downloads them from the game server. After the initial generic bootstrap, compatible plugin updates need no shared-runtime rebuild. Signing and installation contract: [misc/plugin-runtime](../../../misc/plugin-runtime/README.md).

## Purpose

The system splits the monolithic gamemode into smaller add-ons.

- Plugins are discovered in `Plugins/` at startup.
- Discovery uses `plugin.json`, not folder names.
- New plugins default to disabled.
- Enable through dashboard, prompt or optional automatic mode.

## Paths on Windows/Linux

Paths are relative to the server working directory, `process.cwd()`.

- Windows example: `Server\\Plugins\\ChatServer\\plugin.json`.
- Linux example: `Server/Plugins/ChatServer/plugin.json`.
- Directory name is exactly `Plugins`, preserving case.
- Only its direct subdirectories are scanned.

## Ready-to-use format and dependencies

A plugin ships as an extracted directory, for example:

```text
Server/
  Plugins/
    HelloPlugin/
      plugin.json
      index.cjs
      README.md
```

The loader does not extract ZIPs. It discovers `plugin.json`; its `name` must be unique. An ordinary server plugin requires no separate `.dll`, `.esp` or `.esm`.

- `kind: gamemode`: executable CommonJS JavaScript entry, preferably `index.cjs`. Compile TypeScript first. The current loader copies only the entry to a temporary directory and loads it as `.js`. Bundle local modules/npm dependencies into that entry, for example using esbuild with `--bundle --platform=node --format=cjs`. A neighboring `node_modules/` or `require('./helper.cjs')` is insufficient. `__dirname` also does not identify the installed plugin directory; explicitly select persistent-data paths.
- `kind: process`: ready program/Node script with `command`/`args`. It starts in the plugin directory, so local files and ordinary Node resolution work. Dependencies must ship or be installed beforehand. The loader runs neither `npm install` nor builds. Command, runtime and native dependencies must fit each operating system.

For process plugins, only `command`/`args` determine startup; `main` is not automatically run.

## Dashboard and required restarts

Manage plugins under **Resources → Server plugins**. The dashboard shows version, path, current runtime status and approval for the next game-server start. It refreshes every five seconds; **Refresh status** reads immediately. That does not rescan disk.

Each plugin has **Enable/Disable**. **Enable all disabled** approves every discovered plugin whose `plugin.json` exists, regardless of search filter. **New plugins at game-server start → Enable automatically** saves `pluginDiscovery.mode: "auto"` in `server-settings.json`. First-discovered plugins then load at the next start. Already known disabled plugins stay disabled; use individual/bulk enabling.

Reading requires `canViewLogs`; changes require `canConsole`. Buttons save `startupEnabled` in `Plugins/.discovery-state.json`, without loading/unloading live code. Approval persists; no terminal helper is required on every start.

| Change | Required restart |
| --- | --- |
| Update/enable/disable a known plugin | Restart game server |
| Install new plugin in `safe` | Start/restart to discover; approve in dashboard; start/restart again |
| Install new plugin with `auto` already selected | Start/restart; discovery and activation occur together |
| Update `process` plugin | Restart game server and therefore plugin process |
| Update dashboard/server package | Also restart starter/dashboard according to [update guide](docs/docs_packaged_server_update.md) |
| Change Skyrim mods or SKSE/client files | Distribute separately through mod/runtime packages; restart affected clients with matching files |

With separate dashboard/game processes, game restarts preserve dashboard access. Server plugins need no PC/VPS reboot. Connected players disconnect when the game server restarts.

New plugins default disabled. `prompt` permits approval during an interactive first start; services normally have no terminal prompt. `auto` needs no terminal. Known approvals survive updates with the same `name` and discovery-mode changes.

There is currently no live upload, marketplace, individual plugin start/stop or hot reload. The main-gamemode watcher does not reload plugins after `mp.clear()`. Use a complete game-server restart with installed plugins.

## Initial discovery state

The first start creates `Plugins/.discovery-state.json`. Per-plugin fields:

- `pluginPath`: relative directory.
- `fingerprint`: manifest/relevant-entry hash.
- `version`: manifest version.
- `startupEnabled`: load/start on boot.
- `discoveredAt`, `updatedAt`: timestamps.

State distinguishes known, new, updated and removed plugins.

## Minimum plugin.json schema

Required:

- `name`: unique key, 1–64 characters from `a-z`, `A-Z`, `0-9`, `_`, `-`.
- `version`: string starting with a digit; SemVer recommended.
- `kind`: `gamemode` or `process`.
- `displayName`: operator-facing name.
- `description`: short description for decisions/review.

Optional:

- `main`: relative entry, default `index.cjs`.
- `optional`: failure is not a critical startup failure.
- `startupDefault`: documentation hint deliberately ignored for new plugins.
- `command`: required executable for `kind: process`.
- `args`: process-only argument list.

`displayName` is at most 100 characters, `description` 512. `main` must stay inside the plugin directory; absolute paths and leading `..` are rejected. Manifests are limited to 64 KiB text and `args` to 128 strings.

### Complete gamemode example

```json
{
  "name": "emotewheel",
  "version": "1.2.0",
  "kind": "gamemode",
  "displayName": "Emote Wheel",
  "description": "Adds chat-driven emote wheel bindings",
  "main": "index.cjs",
  "optional": false
}
```

### Complete process example

```json
{
  "name": "chat-server",
  "version": "0.4.1",
  "kind": "process",
  "displayName": "Chat Server",
  "description": "Standalone chat bridge process",
  "main": "server.mjs",
  "command": "node",
  "args": ["server.mjs"],
  "optional": true
}
```

## Boot sequence

1. Load the main `gamemodePath`.
2. Scan direct `Plugins/` subdirectories.
3. Include only directories with `plugin.json`.
4. Validate manifests/calculate fingerprints.
5. Compare discovery state.
6. Order by configured `pluginsLoadOrder`, then alphabetically by `name`.
7. Start only `startupEnabled=true` plugins.
8. Update state.

Gamemode entries load through `require`. Process plugins use `spawn` with their directory as `cwd`; logs have `[plugin:<name>]` prefix. Server exit terminates children using Windows `taskkill /t /f` or Linux `SIGTERM`.

## Enabling new plugins

New entries default to `startupEnabled=false`. In `server-settings.json`:

```json
{
  "pluginDiscovery": {
    "mode": "safe",
    "processCommandAllowlist": ["node", "node.exe"],
    "abortOnPluginError": true
  },
  "pluginsLoadOrder": ["core", "chat-server", "emotewheel"]
}
```

`pluginDiscovery.mode`:

- `safe`: no prompt; new plugins remain disabled.
- `prompt`: interactive yes/no prompt for newly discovered plugins.
- `auto`: enable on first discovery; known plugins retain stored approval.

Missing/invalid configuration means `safe`. Use `auto` when only reviewed plugins are placed in `Plugins/`.

`pluginDiscovery.processCommandAllowlist` is an optional string array for process plugins. When set, only listed commands run. Comparison accepts the entire `command` or its filename, such as `node`. Unset means no additional restriction for backward compatibility.

`pluginDiscovery.abortOnPluginError`, default `false`:

- `true`: abort startup when a non-optional plugin throws; recommended for production.
- `false`: log errors but continue server startup.

The source guide records a limitation: the shared temporary JavaScript loader catches/logs execution errors internally, so plugin boot may report successful load; asynchronous process failures also arrive later. `running` and this option alone do not establish that every function works. Check logs and actual behavior too.

For daemon operation, use `safe` with panel/state approval or choose `auto` for startup without terminal questions.

## Minimal examples

### Gamemode

Files: `Plugins/HelloPlugin/plugin.json`, `Plugins/HelloPlugin/index.cjs`.

`index.cjs`:

```js
// Die Entry-Datei wird beim Gameserver-Start einmal ausgefuehrt.
console.log("[HelloPlugin] loaded");

// Persistente Eigenschaft fuer einen moeglichen spaeteren RP-Gamemode.
mp.makeProperty("helloPluginRank", {
  isVisibleByOwner: false,
  isVisibleByNeighbors: false,
  updateOwner: "",
  updateNeighbor: ""
});
```

### Process

Files: `Plugins/ChatServer/plugin.json`, `Plugins/ChatServer/server.mjs`.

`server.mjs`:

```js
setInterval(() => {
  console.log("[ChatServer] heartbeat");
}, 10000);
```

## Security

Everything under `Plugins/` can execute host code. Never blindly enable unknown plugins. Review before setting `startupEnabled=true`; treat manifests/entries as trusted code. In production, configure process command allowlists, for example only `node`/`node.exe`.

## Troubleshooting

- Undiscovered: is `plugin.json` directly in `Plugins/<Name>/`, with required fields?
- Not starting: check gamemode `main` or process `command`/`args`; inspect `[plugins]`/`[plugin:<name>]` logs.
- Missing prompt: is mode `prompt` and startup interactive/TTY?
- Hanging process: Windows uses `taskkill /t /f`; Linux uses `SIGTERM`, potentially requiring a plugin handler.

## Admin API runtime status

`PATCH /api/admin/plugins/:name`, JSON `{"startupEnabled": true}` or `false`, saves next-start approval and returns `restartRequired: true`. Undiscovered plugins receive 404; the API neither rescans nor starts live code.

`POST /api/admin/plugins/enable-all`, JSON `{}`, approves discovered disabled plugins whose manifest exists. Response: `names`, `count`, `restartRequired`, true if anything changed. Missing manifests are skipped. Repeating without new disabled plugins returns `count: 0` and does not change state.

`GET /api/admin/plugins/settings` returns mode `safe`, `prompt` or `auto`. `PUT` with, for example, `{ "mode": "auto" }` saves next-start mode while preserving other settings, including other `pluginDiscovery` keys. Writes require `canConsole`.

`GET /api/admin/plugins` includes `runtimeStatus` per plugin:

- `starting`: startup initiated.
- `running`: running.
- `failed`: detected startup/runtime error.
- `stopped`: disabled or cleanly exited.

It may be `null` before runtime reporting. Startup approval and runtime status are independent; a running plugin continues until restart after approval is disabled.

Example:

```json
{
  "name": "chat-server",
  "startupEnabled": true,
  "runtimeStatus": {
    "name": "chat-server",
    "status": "running",
    "pid": 12345,
    "updatedAt": 1760000000000
  }
}
```

## Migration from a monolithic gamemode

1. Move modules into separate plugin directories.
2. Create each manifest.
3. Keep `gamemodePath` as bootstrap/main gamemode.
4. Start with `pluginDiscovery.mode = safe`.
5. Approve plugins individually with `startupEnabled=true`.
6. Optionally configure `pluginsLoadOrder`.

## Possible plugin systems

Gamemode plugins share global `mp` and existing APIs. They can implement roles, factions, professions, currencies/progression with persistent properties (`mp.makeProperty`, `mp.get`, `mp.set`); inventory/loot, teleports, spawning, actor values and revival/respawn within available hooks; custom events/client reactions through `mp.makeEventSource`/properties/SkyrimPlatform; logs and external integrations using their own connections.

Process plugins suit bots, webhooks, chat bridges and background services. They receive **no** shared `mp` or automatic gamemode RPC/IPC. Game-state access needs an explicitly implemented authenticated interface.

The system adds no engine features, automatic per-plugin dashboard or arbitrary client-file publication. Models, worlds, native functions and client modules need appropriate Skyrim mods/client packages; distinguish code already transportable through property/event APIs.

Gamemode plugins share process/global handlers and have no sandbox. Overridden handlers or blocking code may affect other plugins/server. There is no declarative dependency/version check or automatic process-plugin restart. Load order alone proves neither dependencies nor external readiness.

References: [server scripting](docs/docs_serverside_scripting_reference.md), [properties](docs/docs_properties_system.md), [events](docs/docs_events_system.md), [respawn](docs/docs_respawn_control_system.md).

## Voice activity adapters for lipsync/proximity chat

**Status 27 October 2026: partially implemented.** VAD contract, server distribution and client animation attempt exist; in-game end-to-end lipsync is unproven. The new local YACA bridge does not activate this path automatically in its ordinary entry.

[Lipsync findings and test](docs/docs_voice_lipsync_status.md) cover missing integration, actor IDs, unit conversion, timeouts and animation reset.

### Contract and current YACA bridge

An adapter translates real provider speaking events to `VoiceActivityState` and invokes callbacks registered with `VoiceActivityManager`. A file in `Plugins/` does not register one automatically.

Server [YacaTeamSpeakAdapter.ts](../../../skymp5-server/ts/adapters/YacaTeamSpeakAdapter.ts) exposes `handleYacaVoiceEvent(...)`, but `initialize()` opens no TeamSpeak connection. The separate `SkyMP-YACA-TS` bridge uses CEF, `TALK_STATE`/`SOUND_STATE` and `_yacaClient`, needing no Papyrus quest. Its optional `onVoiceActivity` callback is unconnected in ordinary plugin startup.

`voiceActivity.enabled: true` starts the manager without closing that gap. Existing `voiceActivity`/`yaca:voiceActivity` custom packets broadcast directly, bypassing registry/inactivity timers. Sender association/state tracking must be unified before complete integration.

### Diagnostics and limits

- `GET /api/admin/voice/status` and `/speakers` exist with `canViewLogs`.
- Dedicated dashboard diagnostics and `POST /api/admin/voice/range` do not.
- Adapter health/parser tests do not prove visible mouth movement. Existing speaker counts have limited meaning.
- The client transmits speaking/not-speaking and attempts a dialogue animation; it has no level/phoneme control.

See [voice API](docs/docs_voice_api.md) and [backlog](ROADMAP.md#voice--proximity-chat-sync-backlog-proposed).

## Dashboard plugin load order

**Resources → Server plugins** shows next-start positions. Move with arrows and **Save load order**. Activation remains separate. Unsaved changes can be discarded; filtering removes nothing from the stored list. Concurrent edits are rejected as conflicts.

IDs are stored as `pluginsLoadOrder` in `server-settings.json`, preserving private settings, mod order and discovery state. Services precede consumers, such as skymp-ui-core before example-ui-consumer/second-ui-consumer. Without explicit order, existing alphabetical order applies. Unlisted new plugins follow alphabetically; configured temporarily absent IDs persist. There is no dependency resolution or individual hot reload.

`GET /api/admin/plugins/load-order` returns order/revision with `canViewLogs`. `PUT {revision, pluginsLoadOrder}` saves the entire list with `canConsole`. Stale revision: 409; invalid/incomplete list: 400. Changes apply next game startup. Installing this dashboard/backend revision requires one starter/dashboard restart; later reordering needs only a game restart.
