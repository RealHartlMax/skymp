[Deutsch](../../de/docs/docs_server_configuration_reference.md) · [English](docs_server_configuration_reference.md) · [Русский](../../ru/docs/docs_server_configuration_reference.md)

# Server Configuration Reference

> **New:** mods now live in `data/mods/<mod>/`; `client-resources` is no longer read. Statements about it on this page are outdated. See [mods in data/mods](docs_mod_folders.md).

The recommended way to configure the server is setting up all required values in `server-settings.json`. It's standard JSON without C-style comments support. See also [Server Command Line API](docs_server_command_line_api.md).

Checked against the local checkout on **26 October 2026**. Examples labelled
`json5` below illustrate individual fields; the actual file requires quoted
keys and no comments. See [project status](docs_project_status.md) for validation
limits and [browser setup](docs_linux_vps.md) for the packaged first installation.

## restartSchedule (game-only restarts, r12)

Use **Settings → Game server** rather than editing JSON. The optional
`restartSchedule` object has `enabled` (default `false`), `timeZone` (an IANA
name such as `Europe/Berlin`), `times` (up to twelve daily `HH:mm` values) and
`warningMinutes` (up to five whole minutes from 1 to 60). It requires the bundled
supervisor, never starts stopped games and leaves the dashboard online. Claims
and skip-next are durable under `dataDir`; preserve these on update. See
[operation, DST behavior and API](docs_dashboard_operations.md).

## playerAccess (Steam authentication, r5)

Use browser setup or **CFG → Access & Discord**. For example:

```json
{
  "playerAccess": {
    "mode": "guest",
    "approvalRequired": true,
    "steamApiKey": "<private 32-character Steam Web API key>",
    "steamAppId": 489830
  }
}
```

`guest` needs no master account; `account` requires the configured in-game master
login after Steam verification. Steam is mandatory in both modes, including old
`offlineMode` configurations. `approvalRequired` applies to guests. `joinAccess`
rules apply to account mode. The `steam_webApiKey` alias is accepted if the new
key is absent. No valid key means no player login. App ID defaults to Skyrim SE/AE.
Keep the key server-side; a SteamID alone is not proof. Restart the game server
after changing access settings. See [login and API contract](docs_ingame_login.md)
for sessions, duplicate-login prevention and update requirements.

## name

Server's name that will be published on a master server.

```json5
{
  // ...
  name: 'My Server',
  // ...
}
```

## masterKey

Private key used by the server to authenticate its Master API heartbeat.
With SkyMP Worlds, players use the public `serverUid`; do not distribute the
private `masterKey` as client configuration. Older masters may use the same
routing key for both purposes. Preserve an existing identity when updating a server.

```json5
{
  // ...
    masterKey: '<private key from the owner dashboard>',
  // ...
}
```

## master, serverUid and publicHost

`master` is the HTTP(S) base URL for registration and online account/session
requests. `serverUid` is the public server identity used by players; `masterKey`
stays private. `publicHost` advertises the externally reachable game hostname/IP;
it does not bind a network socket. `externalHost` is also accepted by the server
as an advertised-host fallback. Bind addresses remain `listenHost` and `uiListenHost`.

The current local `Settings` default is `https://api.skymp-worlds.net`.
Explicit existing master settings still take precedence.

For the existing SkyMP Worlds PHP integration, merge these fields into the
existing configuration; retain the server's own IDs and data:

```json
{
  "master": "https://api.skymp-worlds.net",
  "serverUid": "<public dashboard ID>",
  "masterKey": "<private dashboard key>",
  "publicHost": "play.example.org",
  "offlineMode": false,
  "masterHeartbeatIntervalMs": 15000
}
```

The heartbeat uses `POST <master>/api/servers/<privateMasterKey>`.
Its interval is clamped to 10–30 seconds (default 15 seconds). Offline test mode
does not publish a heartbeat. Website upload and account setup are separate from
configuring the game server; see [SkyMP Worlds](docs_launcher_worlds.md).

## launcherResources

Public pre-game mod publication, separate from the admin inventory scanner.

```json
{
  "launcherResources": {
    "enabled": true,
    "directory": "./client-resources",
    "runtimeSource": "https://files.example.org/client-runtime/catalog.json"
  }
}
```

- Runtime defaults when the object is absent: enabled, directory `./client-resources`, no runtime source.
- The current CMake configuration generator supplies an external runtime catalog
  for newly missing values: `https://update.skymp-worlds.net/client-runtime/catalog.json`.
  It retains explicit existing values, including `runtimeSource: ""`.
  `-DSKYMP_RUNTIME_CATALOG_URL=""` disables that generated default offer;
  it does not change already stored explicit settings. A configured URL is not
  evidence that its contents have been uploaded or accepted in the game.
- Loose client files go under `directory/Data/`; custom server `loadOrder`
  plugins and matching BSA archives are also published from `dataDir`.
- `runtimeSource` is optional and accepts an absolute HTTP(S) URL without
  credentials, query or fragment. It can identify a runtime manifest or a
  version-selection catalog understood by the current desktop launcher.
- `GET /api/launcher/manifest` publishes sizes, SHA-256, paths, load order and
  local game requirements. Bethesda masters and private server files are excluded.
- Native DLLs/JS use the separate runtime package. A manual runtime source in
  the launcher takes precedence over the advertised source.

See [mod publication](docs_launcher_modpacks.md) and
[runtime catalog](docs_launcher_runtime_updates.md). A valid package/download
does not prove native game compatibility.

## joinAccess

Online game-join policy, evaluated by `systems/login.ts` after obtaining the
player's profile. It is separate from access to the admin dashboard.

```json
{
  "joinAccess": {
    "mode": "approvedLicense",
    "rejectionMessage": "Please ask the server team for access.",
    "approvedLicenses": ["<profile license identifier>"],
    "approvedDiscordIds": [],
    "discordRoleIds": []
  }
}
```

| Field/value | Behavior |
| --- | --- |
| `mode: "open"` | Default; no additional join policy |
| `mode: "adminOnly"` | Allows a matching `approvedLicenses` entry or `approvedDiscordIds` entry; dashboard role alone does not grant access |
| `mode: "approvedLicense"` | Requires a matching profile license identifier |
| `mode: "discordMember"` | Requires linked Discord identity and a successful guild-membership check |
| `mode: "discordRoles"` | Requires linked Discord identity, confirmed membership and at least one matching `discordRoleIds` entry |
| `rejectionMessage` | Base text for the login rejection; the server adds a specific reason |
| `approvedLicenses`, `approvedDiscordIds`, `discordRoleIds` | Arrays of identifiers; duplicates/empty entries are normalized |

Unknown modes fall back to `open`; use the dashboard Access form or validate
the spelling. Discord modes reject the login if Discord verification is
unavailable, the account is not linked, membership cannot be confirmed, or no
required roles are configured. `approvedLicense` does not treat the Discord-ID
allowlist as a license match. Offline test identities are a different login path,
not a substitute for verified public player accounts.

## discordAuth and discordBot

The online login integration reads `discordAuth.botToken` and
`discordAuth.guilds`. Each guild declares a `guildId` and can declare
`banRoleId`, `eventLogChannelId` and `hideIpRoleId`.

```json
{
  "discordAuth": {
    "botToken": "<operator token>",
    "guilds": [{ "guildId": "123456789012345678" }]
  },
  "discordBot": {
    "enabled": false,
    "token": "",
    "guildId": "",
    "statusChannelId": "",
    "warningsChannelId": ""
  }
}
```

`discordBot` is the configuration surface used by the Admin CFG Discord form:
`enabled`, `token`, `guildId`, `statusChannelId`, `warningsChannelId`. New packages
default to disabled. Since r4 the bot runs exclusively in the independent
dashboard process, including offline game mode. Status messages cover game
start, ready, stop, restart, startup failure and crash. Dashboard warnings and
existing configured login logs are sent through that same bot. Game controls
retain its Discord connection. Saving applies bot configuration immediately;
`GET /api/admin/status` includes its connection/error/delivery state without tokens.

Source after r9 adds **CFG → Discord**, also linked from Settings, and a
separate owner-only `/api/admin/discord/settings` GET/POST API. Its save operation
preserves unrelated settings and applies live. `statusEmbedEnabled` defaults to
`false`; `statusEmbed` defines title/description/fields/footer/URL/timestamp, while
`statusConfig` defines online/partial/offline labels, `#RRGGBB` colors and up to five
HTTP(S) link buttons. Defaults follow the server language. The browser preview and
transport share validation and placeholder rendering. See the
[template guide](docs_discord_bot.md#status-embed-und-json-vorlagen). These source
changes have not been added to a new release package yet.

Saving a Discord-based `joinAccess` mode adds the selected primary guild to
`discordAuth.guilds`, preserving existing guilds and their moderation/log settings.
Monitoring alone does not create a login restriction. Legacy `discordAuth`-only
bots remain enabled until explicitly disabled through `discordBot.enabled`.
Disabling the bot stops Gateway/notifications; configured online login checks
and admin OAuth remain separate. Tokens are normalized with or without `Bot `.

The full administrator CFG response and private configuration/backup files contain
the token; treat them as secrets. Only administrators can read the full CFG.
See [Discord bot operation](docs_discord_bot.md) for setup, channel permissions,
privileged member intent, lifecycle limits and the distinction between simulated
integration checks and real Discord delivery.
Admin Discord OAuth is a separate mechanism described in
[Admin Discord OAuth](docs_admin_discord_oauth.md).

## showCharacterNicknames

Boolean, default `true`. Controls display of character names above remote
actors. The server sends the choice on connect and broadcasts a change saved
through the Admin CFG General form. An explicit server choice takes precedence
over the client's local F1 toggle.

```json
{ "showCharacterNicknames": false }
```

## listenHost

Specifies the IP address to bind to. Applies to the main UDP traffic (RakNet). Binds to `0.0.0.0` if unspecified.

```json5
{
  // ...
  listenHost: '127.0.0.1',
  // ...
}
```

## uiListenHost

Specifies the IP address to bind to. Applies to the `uiPort` (http). Binds to `0.0.0.0` if unspecified.

```json5
{
  // ...
  uiListenHost: '127.0.0.1',
  // ...
}
```

## adminApi

Admin API and dashboard URL behavior.

- `enabled` controls whether admin API routes are available.
- `externalUrl` can be left empty (`""`) so runtime auto-detect uses incoming `Host` and `X-Forwarded-Proto` headers.
- If `externalUrl` is set, that explicit value is used for dashboard URL generation.

```json5
{
  // ...
  adminApi: {
    enabled: true,
    externalUrl: '',
  },
  // ...
}
```

## metricsAuth

HTTP Basic authentication for the `/metrics` endpoint.

If omitted, `/metrics` is not available.

```json5
{
  // ...
  metricsAuth: {
    user: 'prometheus',
    password: 'secret',
  },
  // ...
}
```

## adminUiAuth

Credentials for the web admin dashboard (`/admin`).

Legacy bootstrap credentials. Current setup creates a scrypt credential store
at `<dataDir>/admin-auth.json`; that store takes precedence. Legacy
`adminUiAuth`/`metricsAuth` credentials may be migrated and the plaintext key
removed from `server-settings.json`. Browser first-run packages contain no
pre-created account: use their terminal PIN and create an owner in the browser.
See [admin session endpoints](docs_running_a_server.md#admin-session-api).

```json5
{
  // ...
  adminUiAuth: {
    user: '<legacy owner>',
    password: '<legacy password to migrate>',
  },
  // ...
}
```

## uiPort

HTTP port used for server resources and admin dashboard routes (for example `/admin`, `/api/admin/*`, `/metrics`).

If omitted, the server uses `port`.

```json5
{
  // ...
  uiPort: 8080,
  // ...
}
```

## port

This port would be used by player clients to connect to your server. At the current version of Skyrim Multiplayer servers use multiple ports and different protocols to manage different sorts of packets. See [Server Ports Usage](docs_server_ports_usage.md) page to learn more.

```json5
{
  // ...
  port: 7777,
  // ...
}
```

## maxPlayers

Sets player limit of the server. Visible in launcher and on skymp.io.

```json5
{
  // ...
  maxPlayers: 108,
  // ...
}
```

## dataDir

Contains relative or absolute path to a "data" directory which contains:

- vanilla Skyrim master files (Skyrim.esm, Update.esm, etc)
- plugin files (mods in .esp format)
- compiled Papyrus scripts in .pex format

This directory is exposed to `uiPort` and available via http.

At this moment, the server uses this directory for non-vanilla needs too:

- storing web-based GUI in `${dataDir}/ui`
- storing auto-generated manifest describing .esm/.esp files used and CRC32 of them

```json5
{
  // ...
  dataDir: 'data',
  // ...
}
```

## loadOrder

A list of relative or absolute paths to .esp/.esm files which would be loaded by the server during startup in the same order as Skyrim SE loads them.

Relative paths are searched in `${dataDir}` directory.

Absolute paths work but aren't accessible via `uiPort`. External tooling wouldn't be able to download them from the server.

```json5
{
  // ...
  loadOrder: [
    'Skyrim.esm',
    'Update.esm',
    'Dawnguard.esm',
    'HearthFires.esm',
    'Dragonborn.esm',
  ],
  // ...
}
```

## archives

Specify BSA archives that will be loaded by the server.

At this moment, used only for compiled Papyrus scripts.

Relative/absolute paths work similar to esp/esm.

```json5
{
  // ...
  archives: ['Skyrim - Misc.bsa'],
  // ...
}
```

## lang

The language, the translation of which will be obtained from the string files located in Data/strings

```json5
{
  // ...
  lang: 'english',
  // ...
}
```

## offlineMode

Legacy configuration switch. In r5, `true` selects Steam guest access and disables
the old master-account login; it does not allow arbitrary client-selected profile
IDs. The launcher must obtain a verified Steam session. New configurations use
`playerAccess.mode: "guest"` with `offlineMode: false` instead. See
[Steam and login modes](docs_ingame_login.md).

```json5
{
  // ...
  offlineMode: true,
  // ...
}
```

## databaseDriver

Name of a database driver which would be used to store server data. `file` by default. There are also related options like `"databaseName"`. See [Database Drivers](docs_database_drivers.md) page to learn more.

```json5
{
  // ...
  databaseDriver: 'file',
  // ...
}
```

## reloot

A time before a game object restores its original state in milliseconds. Unlike Skyrim SE, Skyrim Multiplayer doesn't have a built-in Cell Reset mechanism. The server resets every object in the world every hour instead. With this option, you can change this time interval for every kind of game object. `"CONT"`, for example, means "Container" - chests, barrels, etc. See "record types" on [UESP](https://en.uesp.net/wiki/Skyrim_Mod:Mod_File_Format).

```json5
{
  // ...
  reloot: {
    FLOR: 86400000,
    TREE: 86400000,
    AMMO: 86400000,
    ARMO: 86400000,
    BOOK: 86400000,
    INGR: 86400000,
    ALCH: 86400000,
    SCRL: 86400000,
    CONT: 86400000,
    SLGM: 86400000,
    WEAP: 86400000,
    MISC: 86400000,
  },
  // ...
}
```

## forbiddenReloot

The option that allows you to forbid reloot for a specific item or a group of items based on its/their espm record type. Take a look at [UESP](https://en.uesp.net/wiki/Skyrim_Mod:Mod_File_Format).

```json5
{
  // ...
  // here your record types go
  "forbiddenReloot": ["FLOR", "TREE", "BOOK", ... ]
  // ...
}
```

## itemPickupMode

Controls how world-item pickup works when players activate loose objects, flora or trees.

- `"allow"` (default): keeps current behavior, item is picked up immediately.
- `"minigame"`: calls gamemode hook `mp.onItemPickupAttempt(...)` before pickup. If any listener blocks the event, pickup is denied.
- `"block-all"`: disables world-item pickup entirely.

```json5
{
  // ...
  itemPickupMode: 'minigame',
  // ...
}
```

When `itemPickupMode` is set to `"minigame"`, the server fires this hook:

```ts
mp.onItemPickupAttempt = (
  sourceRefrId: number,
  actorRefrId: number,
  itemBaseId: number,
  itemCount: number,
  isOwned: boolean,
  isQuestItem: boolean,
) => {
  // return false to block pickup
  return !isOwned && !isQuestItem;
};
```

## timeScale

Controls the speed of in-game time relative to real time. Default is `20` (Skyrim's own default).

The formula is: **1 real second = `timeScale` in-game seconds**.

| `timeScale` | 1 real second = … in-game | 1 real minute = … in-game | Notes |
|-------------|---------------------------|---------------------------|-------|
| `1`         | 1 s                       | 1 min                     | Real time — clock matches the real world |
| `20`        | 20 s                      | 20 min                    | **Skyrim default** — one in-game day ≈ 72 real minutes |
| `60`        | 1 min                     | 1 h                       | One in-game day ≈ 24 real minutes |
| `3600`      | 1 h                       | 1 day                     | Extreme — one in-game day ≈ 24 real seconds |
| `0`         | 0 s                       | 0 min                     | Freeze time |

```json5
{
  // ...
  timeScale: 20,
  // ...
}
```

## itemsEnabled

When set to `false`, world-item references are never instantiated. No loose items will appear in the game world. Default is `true`.

Useful for PvP-focused servers that don't need dungeon loot.

```json5
{
  // ...
  itemsEnabled: false,
  // ...
}
```

## itemLoadFilter

Granular per-ownership filter applied when `itemsEnabled` is `true`. Based on the `XOWN` field in the ESP/ESM record.

- `skipOwned` (default `false`): skip items that belong to an NPC or faction (`XOWN != 0`), i.e. shop inventory and theft items.
- `skipUnowned` (default `false`): skip free-loot items (`XOWN == 0`), i.e. dungeon loot with no owner.

Both flags may be set simultaneously, in which case no items will be instantiated (equivalent to `itemsEnabled: false`).

```json5
{
  // ...
  itemLoadFilter: {
    skipOwned: true,   // no shop/NPC items
    skipUnowned: false, // keep free dungeon loot
  },
  // ...
}
```

## pluginDiscovery

Controls how the server handles newly discovered plugins at startup.

- `mode: "safe"` (recommended for daemon/production): new plugins are left disabled (`startupEnabled: false`) and require manual activation.
- `mode: "prompt"`: an interactive yes/no prompt is shown for each newly discovered plugin when the server starts on a TTY.
- `mode: "auto"`: newly discovered plugins are enabled and started during that same startup, without a terminal prompt.

If omitted or invalid, defaults to `"safe"` mode. All modes preserve the saved
startup setting of known plugins, including plugins explicitly disabled earlier.
The dashboard at **Resources → Server plugins** can save this mode, enable or
disable individual plugins, or enable all discovered disabled plugins whose
manifest still exists. Changes take effect at the next game-server start.
Use `auto` when the plugin directory contains only reviewed code.

```json5
{
  // ...
  pluginDiscovery: {
    mode: 'safe',
  },
  // ...
}
```

See also `pluginsLoadOrder` and the Plugin System documentation.

Optional nested key:

- `processCommandAllowlist`: string array that restricts which commands may be started by `kind: process` plugins.
- Matching is done against either the full command string or its basename.
- If omitted, no additional command restriction is applied (backward compatible).

```json5
{
  // ...
  pluginDiscovery: {
    mode: 'safe',
    processCommandAllowlist: ['node', 'node.exe'],
  },
  // ...
}
```

## pluginsLoadOrder

Explicit load order for plugins. Plugins listed here are started first (in the given order), followed by any remaining enabled plugins in alphabetical order.

```json5
{
  // ...
  pluginsLoadOrder: ['core', 'chat-server', 'emotewheel'],
  // ...
}
```

## pluginDiscovery.abortOnPluginError

When `true`, a synchronous startup error propagated to the plugin bootstrap by a non-`optional` plugin aborts server startup. Default is `false`. This option belongs inside `pluginDiscovery`; a top-level `abortOnPluginError` is not read by the loader.

The current temporary JavaScript loader logs execution errors internally, so those errors may not reach the bootstrap. Asynchronous process errors also arrive after startup. Check logs and actual plugin behavior in addition to the reported runtime status. See the [Plugin System guide](../README-plugins.md).

```json5
{
  // ...
  pluginDiscovery: {
    mode: 'safe',
    abortOnPluginError: true,
  },
  // ...
}
```

## gamemodePath

Contains a relative or an absolute path to a file or directory with a gamemode.
Searches for `index.js` if a directory specified.

```json5
{
  // ...
  gamemodePath: 'gamemode.js',
  // ...
}
```

## startPoints

Contains a list of spawn points, one of which will be chosen at random.

```json5
{
  // ...
  startPoints: [
    {
      pos: [22659, -8697, -3594],
      worldOrCell: '0x1a26f',
      angleZ: 268,
    },
  ],
  // ...
}
```

## startSpawn

Contains a single spawn point for newly created characters.
If `startSpawn` is present, the server uses it as the only initial spawn point.

```json5
{
  // ...
  startSpawn: {
    pos: [22659, -8697, -3594],
    worldOrCell: '0x1a26f',
    angleZ: 268,
  },
  // ...
}
```

This is only used when a character is created for the first time.
Afterwards the actor respawns at its saved `spawnPoint`.

## starterInventory

Contains the inventory that is assigned once to newly created characters.

```json5
{
  // ...
  starterInventory: {
    entries: [
      {
        baseId: 0x1397e,
        count: 1,
        worn: true,
      },
      {
        baseId: 0x12eb7,
        count: 1,
        worn: true,
      },
      {
        baseId: 0x3eada,
        count: 10,
      },
    ],
  },
  // ...
}
```

Supported entry fields include:

- `baseId`
- `count`
- `worn`
- `wornLeft`
- `health`
- `enchantmentId`
- `maxCharge`
- `removeEnchantmentOnUnequip`
- `chargePercent`
- `name`
- `soul`
- `poisonId`
- `poisonCount`

## isPapyrusHotReloadEnabled

A boolean setting that enables to turn on or turn off hot reload for compiled Papyrus scripts (.pex)

```json5
{
  // ...
  isPapyrusHotReloadEnabled: false,
  // ...
}
```

## locale

The name of a localization file in `data/localization` that would be used by `M.GetText` Papyrus function (without extension).

```json5
{
  // ...
  locale: 'ru-RU',
  // ...
}
```

## localeRouting

Controls frontend language routing based on country code (used by admin/client locale resolution routes).

- `defaultLanguage`: fallback language when no mapping matches.
- `countryCodeToLanguage`: map of ISO country codes to language codes.

If omitted or invalid, safe defaults are applied (`defaultLanguage: "en"` and built-in mappings for `de`, `en`, `es`, `ru`).

```json5
{
  // ...
  localeRouting: {
    defaultLanguage: 'en',
    countryCodeToLanguage: {
      DE: 'de',
      AT: 'de',
      CH: 'de',
      US: 'en',
      GB: 'en',
      ES: 'es',
      MX: 'es',
      RU: 'ru',
    },
  },
  // ...
}
```

## enableConsoleCommandsForAll

Deprecated. `true` is ignored and produces `LEGACY_CONSOLE_BYPASS_IGNORED`.
It never grants permission to execute server console commands. Remove this
setting and configure `consoleSecurity` explicitly. Existing per-actor
`consoleCommandsAllowed` permissions remain available to trusted server code.

## consoleSecurity

The Core owns console protection independently of any Chat plugin. Defaults:

```json
{
  "consoleSecurity": {
    "mode": "restricted",
    "blockVanillaCheats": true,
    "blockUnauthorizedServerCommands": true,
    "monitorMovement": true,
    "movementEnforcement": "monitor",
    "logViolations": true,
    "logAllowedAdminCommands": true
  }
}
```

`restricted` always blocks the supported local cheat commands. Only an explicit
`development` policy may set `blockVanillaCheats:false`; server authorization
remains mandatory in both modes. Invalid startup values fall back safely and
produce diagnostics; invalid dashboard writes are rejected.

`movementEnforcement` accepts `off` or `monitor`. The former value `enforce` was
never stricter and is read as `monitor`. The existing hard movement checks remain
active in all modes. Speed and upward-motion heuristics only produce observations;
they do not ban players or prove noclip. `monitorMovement:false` disables these additional observations.

Configure **Settings → Security** (`#settings/security`) with administrator role
and `canConsole`. Saved changes take effect after a gameserver restart. The
dashboard compares saved values with the actual native process, and labels
client hook reports as unverified. Updating the Core, client bootstrap and
dashboard is required before claiming the new protection is available.

See [Console Security](docs_console_security.md) for supported hooks, native
request validation, migration, the optional permission resolver, and limitations.

## sweetPieMinimumPlayersToStart

The minimal amount of players to begin deathmatch. This setting is sweetpie only and does not affect vanilla server. Default is 5.

```json5
{
  // ...
  sweetPieMinimumPlayersToStart: 5,
  // ...
}
```

## sweetPieAllowCheats

Prevents the gamemode from disabling cheats. This setting is sweetpie only and does not affect vanilla server. Default is false.

```json5
{
  // ...
  sweetPieAllowCheats: true,
  // ...
}
```

## sweetPieChatSettings

Allows tuning settings related to in-game chat, such as message visibility radius.

```json5
{
  // ...
  sweetPieChatSettings: {
    // Hearing distance in units. If player A says something and player B is farther away, they won't see that message.
    hearingRadiusNormal: 123,
  },
  // ...
}
```

## sweetPieCommandEnabled

Enables or disables `/new2024` command that teleports player to SweetPie hall.

```json5
  // ...
  "sweetPieCommandEnabled": true
  // ...
```

## npcEnabled

Enables npc loading. Default is false.

```json5
{
  // ...
  npcEnabled: false,
  // ...
}
```

## npcSettings

Optional npcs configuration. May not be present or can be an empty object which means all npcs are allowed to be loaded, provided `"npcEnabled"` is set to `true`.
`"NpcSettings"` consists of fields, each of which describes from what game file it is permitted to load an npc and additional restrictions of
how they should be spawned: in interior or exterior. By default all the npcs are allowed (`"npcSettings": {}`).
`"default":{}` field specifies `"spawnInInterior"` and `"spawnInExterior"` for all non-mentioned game files.
Optional class filters are also supported:

- `allowHumanoid` (default `true`) - allow/disallow humanoid NPCs (keyword `ActorTypeNPC`).
- `allowCreature` (default `true`) - allow/disallow creatures, beasts, monsters.

```json5
{
  // ...
  npcSettings: {
    default: {
      spawnInInterior: true,
      spawnInExterior: false,
      allowHumanoid: true,
      allowCreature: true,
    },
    'Skyrim.esm': {
      spawnInInterior: true,
      spawnInExterior: false,
    },
    'Dawnguard.esm': {
      spawnInInterior: false,
      spawnInExterior: true,
    },
    'DragonBorn.esm': {
      spawnInInterior: true,
      spawnInExterior: true,
    },
  },
  // ...
}
```

Example: make cities mostly empty, but keep wildlife/monsters spawnable.

```json5
{
  npcEnabled: true,
  npcSettings: {
    default: {
      spawnInInterior: true,
      spawnInExterior: true,
      allowHumanoid: false,
      allowCreature: true,
    },
  },
}
```

## weaponStaminaModifiers

This setting is only available with game mod file "SweetPie.esp".
This option allows you to flexibly adjust stamina forfeits of players' attacks using keywords set in the Creation Kit.
In case this field is not provided, some default, yet hardcoded, values are in use.

```json5
{
  // ...
  weaponStaminaModifiers: {
    WeapTypeDagger: 4.0,
    WeapTypeShortSword: 5.0,
    WeapTypeSword: 6.0,
    // ...
  },
  // ...
}
```

## additionalServerSettings

To automate the fetching of the latest server settings from GitHub, configure the additionalServerSettings in your server's startup script or configuration file as follows:

```json5
{
  // ...
  additionalServerSettings: [
    {
      type: 'github',
      repo: 'your-org/server-settings-repo',
      ref: 'main', // Specify the branch, tag, or commit hash here
      pathRegex: '^(common|indev)/.*', // No need to check for .json extension
      token: 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN',
    },
  ],
  // ...
}
```

## damageMultFormulaSettings

This setting allows you to control server damage mult formula through its variables.
If "damageMultFormulaSettings" is not present, the server will use some default values.

```json5
{
  // ...
  damageMultFormulaSettings: {
    multiplier: 1.0,
  },
  // ...
}
```

## enableGamemodeDataUpdatesBroadcast

A boolean setting that controls hot-reloading behavior for connected clients.

- `false` (Default): Updates to gamemode scripts are applied to the server state but **not** broadcast to currently connected players. Existing players must re-login to receive the update. This ensures client stability if scripts do not support hot-reloading.
- `true`: Updates are immediately broadcast to all connected clients. Useful for local development, but may cause desync or client errors if the scripts are not designed to be re-applied at runtime.

```json5
{
  // ...
  enableGamemodeDataUpdatesBroadcast: false,
  // ...
}
```

## supervisor

The packaged `start-test-server`/`launch_server` starters provide process control
automatically; no shell commands are needed. From r3 the full dashboard has its
own process. Game stop/start/restart and crashes retain its settings, logs,
session and WebSocket connections. `GET /api/admin/status` includes `gameState`,
`gamePid` and `dashboardPid`. Authenticated same-origin
`POST /api/admin/server/control` accepts `start`, `stop` or `restart` in packaged
mode and requires `canConsole`. See [VPS ports and process control](docs_vps_ports_and_process_control.md).

The following settings apply to the **legacy direct backend/external supervisor**
mode. A command that stops the whole hosting service also stops that service's
web backend; use the packaged starter for an independent dashboard.

- `enabled`: turns supervisor control on/off.
- `stopCommand`: command executed for stop action.
- `restartCommand`: command executed for restart action.

In legacy mode stop/restart buttons require a configured supervisor. Packaged
mode also offers Start while the game is stopped; runtime player actions require
a running game server. No additional public control port is needed.

```json5
{
  // ...
  supervisor: {
    enabled: true,
    stopCommand: '/opt/skymp/misc/systemd/skymp-supervisorctl.sh stop',
    restartCommand: '/opt/skymp/misc/systemd/skymp-supervisorctl.sh restart',
  },
  // ...
}
```

For Ubuntu 24.04 deployment examples, see [docs_running_a_server.md](docs_running_a_server.md).
