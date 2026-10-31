[Deutsch](../../de/docs/docs_console_security.md) · [English](docs_console_security.md) · [Русский](../../ru/docs/docs_console_security.md)

# SkyMP Console Security

<a id="verifizierte-ausgangslage-und-eingriffspunkte"></a>

## Verified baseline and integration points

Analysis dated 29 October 2026, before implementation:

- Native console packets pass through `ConsoleCommandsService` → `MsgType.ConsoleCommand` → `ActionListener::OnConsoleCommand` → `ConsoleCommands::Execute`. The server already derives the actor from the connection; however, the old `enableConsoleCommandsForAll` switch bypasses `EnsureAdmin` entirely.
- The five existing server operations previously lacked complete preflight checks for argument counts, integer ranges and unknown `mp` subcommands. The existing server-side actor permission is `consoleCommandsAllowed`; only the trusted server API sets this flag.
- `MovementValidation::Validate` protects cell/world changes and position jumps of 4096 units or more. Time-based analysis and checks for nonfinite coordinates are missing. `OnUpdateMovement` currently forwards to neighbours before validation; this ordering must be corrected.
- `findConsoleCommand` resolves short and long names. If `execute` returns `false`, SkyrimPlatform does not run the original command. Existing callbacks can be chained through the current API; SkyrimPlatform removes hooks on script reload.
- `Settings` and native `ScampServer` receive the same `server-settings.json`. The dashboard already has authenticated routes, `canConsole`, settings navigation and game-server/dashboard IPC. Stored policies and policies actually active in the native process must be displayed separately.
- The separate `D:/GitHub/SkyMP-Chat` uses `skympChat:*` CustomPackets, a working `CommandRegistry` and a synchronous permission resolver. These paths are unrelated to the native ConsoleCommand packet. The Chat repository is read only for this feature; no second registry or chat dispatcher is introduced.
- Inventory, actor hosting, hit and attribute messages have their own native processing paths. Console security does not replace or disable those checks. Existing attribute regeneration and actor/host assignment remain intact.

<a id="umsetzungsgrenzen"></a>

## Implementation limits

The server decides privileged state changes. Client hooks are additional safeguards and are not a basis for trust. Complete noclip detection is impossible without geometry/collision queries. Movement heuristics initially serve observation; automatic bans are not planned. Targeted C++ test builds are authorised; release builds and ZIPs remain excluded.

<a id="konfiguration-und-migration"></a>

## Configuration and migration

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

These are also the defaults when configuration is absent. At startup, invalid values produce diagnostics and safe replacements; the dashboard rejects invalid values on save. Unknown fields inside `consoleSecurity` are diagnosed at startup or rejected by API writes. Other server settings are preserved.

`restricted` forces `blockVanillaCheats:true`. In `development` mode, the operator may explicitly disable this client protection. **Both modes still enforce server authorisation.** `blockUnauthorizedServerCommands:false` is not a supported way to disable it: startup ignores and diagnoses the value, and saving rejects it.

`enableConsoleCommandsForAll:true` and invalid legacy values produce `LEGACY_CONSOLE_BYPASS_IGNORED`. The new policy always takes precedence. The switch remains visible in existing files but grants no permissions. Operators who previously enabled admin commands for every player through it must deliberately grant permissions on the server:

```js
// Nur im vertrauenswürdigen Server-/Gamemode-Code, nach eigener Autorisierung:
mp.set(actorId, 'consoleCommandsAllowed', true);
```

The flag is not a client-supplied role claim. Dashboard administrators and character permissions are separate; development mode grants neither. Existing character and user data are neither deleted nor automatically rewritten. Policy changes take effect after a game-server restart. Initial rollout must also update the native server module, shared client JS runtime and corrected SkyrimPlatform console binding.

<a id="native-befehle-und-bestehende-handler"></a>

## Native commands and existing handlers

The standard client blocks supported commands for `tcl`, `tgm`, `tim`, `modav`, `setav`, `forceav`, `setlevel`, `coc`, `moveto`, `kill`, `resurrect`, `enable` and `unlock`. Short and long names are resolved against the actual command table. Reference/`player.` syntax reaches the same native command. Missing entries are reported as unsupported, not protected. Harmless commands such as `help` are left untouched.

Existing server operations `additem`, `equipitem`, `placeatme`, `disable` and alias `mp disable` remain separate, authorised server requests; their original local vanilla execution is never enabled. A connection-bound Core handshake gives the client the currently permitted self-targeted operations. The server revalidates every actual request, including its target. Client-side permission information is not authorisation.

Before execution, the server validates known names, exact argument counts, integer types, positive 32-bit form IDs and quantities from 1 to 1,000,000. Unknown subcommands, overflows and negative quantities are rejected. Missing base records are rejected before Papyrus calls. Identity comes exclusively from the connection/actor mapping. Unknown or unauthenticated connections receive no privileged side effects.

Existing native JS handlers are chained. Repeated lookups or aliases return the same internal command record in SkyrimPlatform without replacing the existing handler or original native function. This also prevents recursion caused by recording a trampoline entry point as the original function.

<a id="bewegungsanalyse-und-grenzen"></a>

## Movement analysis and limits

Existing cell/world and 4096-unit step checks remain in place. Nonfinite position/rotation data is rejected. Movement reaches neighbours only after validation succeeds. Nonfinite attribute percentages or values outside 0–1 must likewise never modify the server-side actor state.

- `off` or `monitorMovement:false`: no additional time-based observation; basic state checks remain active.
- `monitor`: log conservative speed/upward observations based on server receive time, without heuristic movement correction.
- `enforce` (deprecated): treated as `monitor` on load and no longer offered in the dashboard, because this mode was never stricter. Speed/upward heuristics cause neither rejection nor bans. Status reports `heuristicEnforcement:false`.

Observation windows shorter than 100 ms or longer than three seconds are skipped; position samples are refreshed no more than once every 250 ms. Client claims about speed, jumping or mounts cannot bypass checks. Large jumps, knockback, scripted movement and delays may still trigger observations. Server teleports retain the existing correction/resynchronisation and are not logged as cheat violations.

Trusted server code can exempt an actor from additional heuristic observations for up to 30 seconds. This does not permit cell changes, nonfinite coordinates or a prohibited position jump. Deleting an actor clears its samples and exemption. No new noclip mode or geometry-based collision checks are implemented.

<a id="dashboard-und-status"></a>

## Dashboard and status

**Settings → Security → Console & cheat protection**, direct link `#settings/security`. Existing admin login, administrator role and `canConsole` are required. The interface compares stored values with active values confirmed by the native process. Differences require a game-server restart. A stopped or outdated native process is never presented as providing active protection.

`GET /api/admin/console-security` reads this state. `PUT` accepts only `{revision, consoleSecurity}` as JSON with a matching Origin. A stale revision returns HTTP 409, missing permissions or incorrect Origin HTTP 403, and invalid values HTTP 400. Only the security object is replaced in the latest settings file. Existing configuration storage, change logging and game-server/dashboard IPC are reused.

Client reports list found and unsupported hooks and their timestamps. They are explicitly displayed as **unverified self-reports**. A modified client can forge them. Even `supported` proves neither that another mod has not subsequently replaced the hook nor that complete noclip prevention exists.

<a id="optionale-plugin-berechtigungen"></a>

## Optional plugin permissions

The server-side Core interface `globalThis.skympConsoleSecurity` uses API version 1. It is independent of Chat and provides no command registry:

```ts
interface PermissionContext {
  userId: number;
  actorId: number;
  profileId: number;
  targetId: number;
  permission: string;
  source: 'native_console' | 'plugin';
}
```

`setPermissionResolver(owner, resolver)` accepts exactly one synchronous, owner-bound resolver. `true` allows, `false` denies, and `null`/`undefined` falls back to the existing actor flag for native commands. Exceptions, Promises and recursive calls deny access. Another owner cannot replace the resolver; the current owner removes it with `null`. Registration resets on gamemode reload.

`hasPermission(userId, permission)` derives the actor and profile server-side for future plugin adapters. Without a resolver, only known `console.additem`, `console.equipitem`, `console.placeatme` and `console.disable` permissions can be authorised through the server-side actor flag. Other permissions default to denied. `grantMovementAllowance(actorId, milliseconds)` sets or revokes the exemption described above using 0–30,000 ms. `getStatus()` returns Core state.

A future roles plugin can explicitly connect the **already existing** Chat resolver:

```js
// Optional im eigenen serverseitigen Rollen-Plugin; Core setzt dies nicht voraus.
const core = globalThis.skympConsoleSecurity;
const chat = globalThis.skympChat;
if (core && chat) {
  chat.setPermissionResolver('roles', (userId, permission) =>
    core.hasPermission(userId, permission));
}
```

The existing Chat continues to register and dispatch `/` commands itself. Its resolver is not coupled automatically and Console Security makes no changes to its source code. Core protection works fully without Chat.

<a id="logs-und-abnahme"></a>

## Logs and acceptance

The existing server log contains `[security]` followed by structured JSON events with timestamp, internal actor, canonical command, reason, source and `blocked`. Matching events are limited per five-second window, and suppressed repetitions are counted in the next entry. Raw arguments, access tokens and IP addresses are not included. `movement_observation` means observation; `movement_rejected` means actual rejection. Client reports log `source:client_report`, `reportedBlocked:true` and **`blocked:false`** to avoid claiming a server-proven block.

Automated checks are in `unit/ConsoleSecurityTest.cpp` and `misc/console-security/tests/`. Existing console, movement, attribute and Chat tests are part of regression testing. Source tests: `npm --prefix skymp5-client run test:console-security`.

Manual checks remain: original console commands and aliases in Skyrim, `player.`/selected references, permitted admin requests, development mode, switching/restarting/reconnecting, internal SkyMP teleports and movement involving jumping, falling, swimming, riding, knockback and latency. Client hooks do not stop direct memory changes, alternative SKSE hooks or already active local cheat states. Source and unit tests cannot replace full Steam/Skyrim/two-player acceptance.

## Known limit of the role interface

For each command the client only learns whether the player may run it **on themselves** (`allowedServerCommands`), and it only forwards the command in that case. A resolver that allows a command solely for other targets must therefore also allow it for the player's own actor. This limit is on the safe side: a command can be blocked wrongly but never run wrongly, because the server checks every request itself.
