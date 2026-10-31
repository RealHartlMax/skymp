# SkyMP Worlds

Skyrim multiplayer with a global launcher, independent community servers and browser administration. This fork of [SkyMP](https://github.com/skyrim-multiplayer/skymp) contains the game server, native game client and admin dashboard.

The **[global SkyMP Worlds launcher](https://github.com/RealHartlMax/skymp-client-launcher)** is developed separately. Players use one launcher for different servers; it prepares their mods and matching client files before startup.

**Updated 26 October 2026 · Test version / WIP.** Source status and validation boundaries: [project status](docs/docs_project_status.md). Published releases/local builds have their own revisions and evidence.

The [admin dashboard](docs/docs_dashboard_operations.md) offers shared settings navigation, live metrics, interruption history and daily game restarts with timezone. Web management survives game stop. Full/Update ZIPs stay separate.

| Goal | Entry point |
| --- | --- |
| Join as a player | [Global launcher](https://github.com/RealHartlMax/skymp-client-launcher), [connection guide](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md) |
| Host a server | [Browser setup/Linux VPS](docs/docs_linux_vps.md), [fork releases](https://github.com/RealHartlMax/skymp/releases) |
| Update an existing server | [Preserving operator data](docs/docs_packaged_server_update.md) |
| Contribute | [Development](#development), [completed/open tasks](docs/docs_project_status.md) |

### Join a server

1. Have your own Skyrim SE/AE installation on Windows. Your exact `SkyrimSE.exe`
   version needs a matching client runtime.
2. Get the [global launcher](https://github.com/RealHartlMax/skymp-client-launcher)
   and select your Skyrim folder in settings.
3. Discover a server and choose **Connect**, or use a direct connection for a test server.
4. The launcher checks local game requirements, downloads missing or changed mods,
   verifies sizes and SHA-256, and applies the load order. A complete version catalog
   also supplies the matching SkyMP client, SKSE, Address Library and in-game UI.
   SKSE starts after preparation succeeds. Incomplete runtime packages require the
   missing matching components to be installed separately.
5. Run Steam and sign in. The updated launcher obtains a Steam ticket and the server
   verifies the Steam ID. Guest-open needs no in-game account; approval mode waits
   for an administrator. Account mode additionally uses the **in-game login**.
   See [Steam and login modes](docs/docs_ingame_login.md).

Operator-hosted downloads need no Nexus/Vortex account. Skyrim and required Bethesda/DLC
files must already be available locally. The launcher EXE contains no SkyMP/SKSE DLLs;
operators publish the runtime separately. Preparation without launching and restoration
of original files are also available. See the
[connection guide](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md).

### Host a server

1. Extract a complete **Linux x64 or Windows x64 server package from this fork** into a
   new directory. See [releases](https://github.com/RealHartlMax/skymp/releases) and
   [local build status](docs/docs_project_status.md). Launcher packages are separate.
2. Put your own `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`
   and `Dragonborn.esm` in `data/`.
3. Run `start-test-server.bat` on Windows or `sh ./start-test-server.sh` on Linux
   from the directory containing `server-settings.json`. The `launch_server` aliases use the same flow.
4. Allow **7777/UDP** for gameplay and **8080/TCP** for HTTP/WebSockets/downloads;
   use **443/TCP** through a TLS reverse proxy for HTTPS.
5. Open `http://<server>:8080/admin`, enter the random **four-digit terminal code**,
   and configure the server and your own admin account in the browser.
6. Configure Launcher integration in the dashboard. Public discovery requires a
   registered, active server and a valid heartbeat.

Starters can install a private Node 22 runtime and missing Ubuntu/Debian system packages
with suitable permissions and internet access. JavaScript dependencies are bundled.
No admin credentials or Skyrim masters are shipped. Game stop/restart/crash leaves the
full dashboard, logs, downloads and configured Discord bot running in the web process.
For updates, preserve configuration, accounts, world data, mods and custom gamemodes.

[Server setup](docs/docs_linux_vps.md) · [Safe updates](docs/docs_packaged_server_update.md) ·
[Server owner guide](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.en.md)

For server registration, Launcher integration stores master URL, public server ID, private key and public game address. Node startup checks version 22+, installing a private verified Node 22 when needed. No `npm install` is required; automatic missing-system-package setup needs internet/permissions and does not perform a full system upgrade. Use the supplied starter so login, settings, logs, launcher downloads and Discord continue in the webserver while the game stops.

## Components and responsibilities

| Component | Purpose | Source |
| --- | --- | --- |
| Game server | Native simulation, world, Papyrus, players and synchronization on Linux/Windows x64 | `skymp5-server/` |
| Webserver/admin dashboard | Browser setup, accounts, settings, moderation, console, logs and game control | `skymp5-server/`, `skymp5-front/`, `misc/deploy/test-server/` |
| Discord bot | Game status, warnings and configured role checks; runs in webserver | [Discord guide](docs/docs_discord_bot.md) |
| Native client/in-game UI | Skyrim integration, connection, login, interface | `skymp5-client/`, `skyrim-platform/`, `skymp5-front/` |
| Global Windows launcher | Discovery, profiles, downloads, activation, restore, SKSE startup; Tauri/React/Rust | [Launcher repository](https://github.com/RealHartlMax/skymp-client-launcher) |
| SkyMP Worlds web services | Central list, accounts, server management, client-package publication; PHP webroots | [Hosting](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/PHP_HOSTING.md) |

An independent server uses shared web services or equivalent operated infrastructure, maintained in the separate launcher repository. A server package contains no launcher EXE. Mod manifest/runtime catalog are separate interfaces so server mods/native client components can update independently.

### Publishing mods/client packages

- Put custom `.esp`/`.esm`/`.esl` in `data/`/`loadOrder`; associated BSA are published too.
- Place each mod in final Skyrim layout under `data/mods/<mod>/`, such as textures, meshes, `Scripts/*.pex` and `SKSE/`.
- Server `data/scripts/` is not installed automatically on players; publish needed client scripts additionally.
- `GET /api/launcher/manifest` supplies paths, sizes, SHA-256, local prerequisites, downloads and load order; launcher processes them before startup.
- Publish complete version-matching SkyMP/SKSE/Address Library/UI runtime catalog under **Launcher integration → Client package / version catalog**. Manifest determines targets including `Data/Platform/Plugins`, `Data/SKSE/Plugins`, game root.

Packages contain prepared files, not player-side FOMOD dialogs. Bethesda/DLC/Creation Club and private server data are excluded. [Mod packages](docs/docs_launcher_modpacks.md), [runtime catalogs](docs/docs_launcher_runtime_updates.md).

### Networking and independent management

| Connection | Default | Purpose |
| --- | --- | --- |
| Game | `7777/UDP` | Public gameplay/synchronization |
| Direct web | `8080/TCP` | Setup, dashboard, downloads, WebSockets |
| TLS proxy | Public `443/TCP`, internal `127.0.0.1:8080/TCP` | HTTPS/WSS; public 8080 unnecessary after correct proxy setup |
| Discord | Outbound `443/TCP` | HTTPS/WSS, no extra inbound bot port |
| Internal control | Loopback/private Node IPC | No public port |

Values are configurable. Game/download addresses must reach players; admin-only reachability is insufficient for downloads. WebSockets share HTTP port. The starter separately manages web/game; direct game-bundle startup bypasses it. [Ports/process control](docs/docs_vps_ports_and_process_control.md).

Configured Discord reports start/stop/restart/readiness/start errors/unexpected exit and survives game stop. It cannot report loss of the entire webserver/VPS. Automatic game restart after crashes is not included.

## Documentation

| Topic | Guide |
| --- | --- |
| Evidence, limits, completed/open work | [Status](docs/docs_project_status.md), [frontend roadmap](../../../ROADMAP_FRONTEND.md) |
| First setup/Ubuntu VPS | [Linux/browser setup](docs/docs_linux_vps.md) |
| Existing updates | [Package updates](docs/docs_packaged_server_update.md) |
| Firewall, addresses, processes | [VPS ports](docs/docs_vps_ports_and_process_control.md) |
| Player mods | [Launcher mods](docs/docs_launcher_modpacks.md) |
| Native files/updates | [Runtime catalogs](docs/docs_launcher_runtime_updates.md) |
| Global list/master/online | [SkyMP Worlds](docs/docs_launcher_worlds.md) |
| Steam/guests/legacy | [Player access](docs/docs_ingame_login.md) |
| Discord/game monitoring | [Discord](docs/docs_discord_bot.md) |
| Configuration/admin console | [Configuration](docs/docs_server_configuration_reference.md), [commands](docs/docs_admin_console_commands.md) |
| Client/manual development | [Installation](docs/docs_client_installation.md) |
| Launcher/server management | [Connection](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md), [DE](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.de.md)/[EN](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.en.md)/[RU](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.ru.md) |
| PHP services | [Hosting](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/PHP_HOSTING.md) |
| Source structure | [Repository](docs/docs_repository_structure.md) |

## Development

Clone the fork with submodules:

```sh
git clone --recurse-submodules https://github.com/RealHartlMax/skymp.git
cd skymp
```

[CONTRIBUTING.md](../../../CONTRIBUTING.md) covers toolchain/configuration/contributions. Validated Linux environment/build steps: [building your fork](docs/docs_linux_vps.md#eigenen-fork-bauen). After CMake configuration run build/tests **inside `build/`**:

```sh
cmake --build .
ctest --verbose
```

Output: `build/dist/server/`, `build/dist/client/`. Local test packages/evidence separately in `build/releases/`. Launcher, runtime publication and PHP packages are built in the [launcher repository](https://github.com/RealHartlMax/skymp-client-launcher).

### Validation and compatibility

Packages were checked on Windows x64/Ubuntu 26.04.1 x64: browser PIN setup, admin login, native readiness, downloads, UDP binding, independent dashboard/game. Discord SDK cases were local; actual Discord delivery remains separate.

A download or Skyrim process does not prove a full session. Real Skyrim/SKSE/CEF login, multiplayer, VPS operation/load remain separate. Windows native suite still has an open `Activate torch` failure. No blanket compatibility with all SE/AE versions/mods is promised. Package-specific versions/evidence govern; see [status](docs/docs_project_status.md).

## Origins and licenses

Based on [skyrim-multiplayer/skymp](https://github.com/skyrim-multiplayer/skymp). Global launcher/web services are separately developed in [RealHartlMax/skymp-client-launcher](https://github.com/RealHartlMax/skymp-client-launcher).

Components have separate licenses: [server](../../../skymp5-server/LICENSE), [client](../../../skymp5-client/LICENSE), [frontend](../../../skymp5-front/LICENSE), [Skyrim Platform](../../../skyrim-platform/LICENSE). See [TERMS.md](../../../TERMS.md), [THIRD_PARTY_LICENSES](../../../THIRD_PARTY_LICENSES). Skyrim/Bethesda game files are not included.
