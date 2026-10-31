[Deutsch](../../de/docs/docs_running_a_server.md) · [English](docs_running_a_server.md) · [Русский](../../ru/docs/docs_running_a_server.md)

# Running a Server

Skyrim Multiplayer publishes ready-to-use pre-built server packages on GitHub Releases. **You do not need to download or build the repository to run your own server.**

## Current fork test packages and browser setup

Checked against the local checkout on **22 October 2026**. The fork's paired
Linux/Windows test archives are in `build/releases/2026-10-21-modsync/`.
They include mod API v2 and browser first-run setup with a random four-digit
terminal PIN and a self-chosen admin account. They contain no pre-created login
and no Bethesda master files. Install Node.js 22+ separately and use
`start-test-server.sh` / `start-test-server.cmd` from those packages.

See [Linux/VPS and browser setup](docs_linux_vps.md),
[current status](docs_project_status.md) and [mod publication](docs_launcher_modpacks.md).
For an existing installation, preserve `server-settings.json`, `data/`, `world/`
and custom published files; the release's `UPDATE-VPS.md` describes the backend-only
update. The later SkyMP Worlds heartbeat update has its own guide:
[launcher and online master](docs_launcher_worlds.md).

The source-build/release launchers below (`launch_server.*`) use a different
bootstrap path. Do not assume that an upstream download contains this fork's
local browser-setup and launcher integration changes.

## Source-build and upstream release package conventions

Pre-built packages are published at:

**<https://github.com/skyrim-multiplayer/skymp/releases>**

### Windows (pre-built)

1. Download `running_server_files_windows_server_dist.zip` from the latest release.
2. Extract the archive to a dedicated folder, e.g. `C:\skymp-server`.
3. Run `launch_server.bat`. It will automatically install Node.js (via `winget`) and npm dependencies on first start.
4. Edit `server-settings.json` to configure your server name, ports, and load order (see [Configuration](#configuration) below).
5. Open the admin dashboard at `http://localhost:8080/admin` (default `uiPort`).

### Linux (pre-built)

1. Download `running_server_files_linux_server_dist.tar.gz` from the latest release.
2. Extract: `tar -xzf running_server_files_linux_server_dist.tar.gz -C /opt/skymp`
3. Run `./launch_server.sh`. It will install Node.js via your package manager and npm dependencies on first start.
4. Edit `server-settings.json` to configure your server.
5. Open the admin dashboard at `http://localhost:8080/admin`.

### Required Skyrim master files (`*.esm`)

Release server archives intentionally do **not** contain Bethesda game master files (`Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`, `Dragonborn.esm`).

Copy these files from your own legal Skyrim installation into the server data directory root (`data/` by default), then keep the same names in `loadOrder`.

- Typical Windows location: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\`
- Typical Linux/Proton location: `~/.steam/steam/steamapps/common/Skyrim Special Edition/Data/`

Example target layout in server folder:

```text
data/Skyrim.esm
data/Update.esm
data/Dawnguard.esm
data/HearthFires.esm
data/Dragonborn.esm
```

### Updating an existing installation

Place the downloaded archive in the server package root, then run the update helper (preserves `data/` and `server-settings.json`):

**Windows:**
```powershell
.\update_server.ps1 -PackagePath C:\Downloads\running_server_files_windows_server_dist.zip
```

**Linux:**
```sh
./update_server.sh --package /path/to/running_server_files_linux_server_dist.tar.gz
```

Add `-StartAfter` (Windows) or `--start-after` (Linux) to restart the server automatically after the update.

See [Server Update Playbook](docs_server_update_playbook.md) for the full safe-update procedure with backup steps.

---

## Building from Source (advanced / contributors)

If you want to contribute code or need a custom build, follow [docs_cmake_workflow.md](docs_cmake_workflow.md) and [CONTRIBUTING.md](../../../../CONTRIBUTING.md). The compiled server will appear under `build/dist/server` and a convenience launcher is generated as `build/launch_server.bat` / `build/launch_server.sh`.

---

## Installation

### Windows

Use 64-bit Windows with support for the Node.js version required by your
package. The current fork test archives require Node.js 22 or newer. The local
Windows startup checks do not establish support for older Windows releases.

You obviously need to have 64-bit Windows version since the server is 64-bit program.

You are able to build whole project from sources. Server build would be in `build/dist/server`. Use `launch_server.bat` to launch. A convenience launcher is also generated as `build/launch_server.bat`.

Downloaded server builds should be unpacked into a dedicated server folder. Future updates can be applied with `update_server.ps1` from the server package root while preserving `data` and `server-settings.json`.

If you use `update_server.ps1 -StartAfter`, the script starts the packaged `launch_server.bat`, so the same restart protection and runtime dependency bootstrap are reused after the update.

`launch_server.bat` now includes restart protection: before starting a new server process it checks for an already running `dist_back/skymp5-server.js` process and terminates it automatically.

`launch_server.bat` also validates runtime dependencies on startup: if `node` is missing it attempts automatic installation (via `winget` when available), and if `node_modules` is missing it installs runtime packages automatically.

### Linux

For a Linux VPS also see [Linux VPS: build and operation](docs_linux_vps.md), including native Linux builds, frontend packaging and a systemd example for 12 vCores / 24 GB RAM.

Linux server support includes native source builds. The paired local test packages
targeting Ubuntu 26.04 x86_64 and Windows x64, with browser-created owner accounts,
are described in [Linux VPS build and operation](docs_linux_vps.md).

If your build completed successfully, the server launcher will be generated as `build/dist/server/launch_server.sh`. A convenience launcher is also generated as `build/launch_server.sh`.

Downloaded server builds can be updated in place with `update_server.sh --package /path/to/release.tar.gz` from the server package root. The script backs up and preserves `data` and `server-settings.json`.

If you add `--start-after`, the update script starts the packaged `launch_server.sh`, so the same runtime dependency bootstrap path is reused after file replacement.

`launch_server.sh` validates runtime dependencies on startup: if `node` is missing it attempts package-manager based installation, and if `node_modules` is missing it installs runtime packages automatically.

Client support remains Windows-first. The dedicated server is built separately
for Linux. The local test target is Ubuntu 26.04 x86_64; see the
[native validation report](docs_native_validation_2026_10_19.md) for the precise
build/runtime environments and remaining checks.

## Admin Dashboard

The admin dashboard is available at `http://<host>:<uiPort>/admin`.

The secure owner credential store is `<dataDir>/admin-auth.json`. Browser-setup
packages create it through the PIN wizard. Dashboard permissions and user/Discord
assignments use `adminUiUsers`; game access is separately controlled by
[`joinAccess`](docs_server_configuration_reference.md#joinaccess).

### Admin session API

| Endpoint | Behavior |
| --- | --- |
| `POST /api/admin/session/login` | JSON `{ "user": "owner", "password": "..." }`; success sets the session cookie; invalid credentials return 401 |
| `GET /api/admin/session` | Current `authenticated`, `user`, `idleTimeoutMs`, `remainingMs`; absent/expired session returns 401 |
| `POST /api/admin/session/touch` | Renews an authenticated session after dashboard interaction; expired sessions return 401 |
| `POST /api/admin/session/logout` | Removes the server-side session and clears its cookie |

Sessions use the `skymp_admin_session` cookie (`HttpOnly`, `SameSite=Lax`, path `/`)
and expire after **10 minutes of inactivity**. The dashboard sends activity
updates; unattended monitoring/polling should not be treated as a user interaction.
Session state is in memory, so restarting the server requires a new login while
the owner's stored password survives. Legacy plaintext bootstrap settings may be
migrated into the scrypt store; a configured owner is not overwritten by first-run setup.

Behind a reverse proxy, forward `Host`, `X-Forwarded-Proto` and the relevant
cookie headers consistently and use the externally configured HTTPS origin.
`uiListenHost` controls binding; `adminApi.externalUrl` only controls generated URLs.
See [Discord OAuth](docs_admin_discord_oauth.md) for the optional separate admin
OAuth flow; its live callback acceptance is not implied by a local password-login test.

The October 23 r2 test packages include a process manager in
`start-test-server.sh` / `start-test-server.bat` (also `launch_server.sh` /
`launch_server.bat`). These starters bootstrap a missing/old Node runtime and
enable Stop/Restart without external commands. Stopping the game retains an
owner management page at `/admin`, where it can be started again. The stopped
management page uses the existing owner account; it does not create credentials.
The private Node 22 LTS download is SHA-256 checked, checked for updates daily,
and retained if an update fails. The bundled backend requires no npm install.
See [Linux VPS](docs_linux_vps.md) and the package's `README-TEST.md`.

Directly invoking the backend bypasses the included manager. In that mode,
Stop/Restart require an explicitly configured external supervisor. The legacy
generic CMake launchers described above remain separate from the r2 test-package
starters. Changing the HTTP listen address or port requires restarting the whole
starter, rather than only the game process. Server-control POST requests require
an authorized session and same-origin JSON.

## Server Logs

Server output is written both to console and to rotating log files in `logs/` next to the server process.

- File name pattern: `server-<ISO timestamp>.log`
- Retention: files older than 14 days are removed at startup
- Safety cap: only the newest 30 log files are kept at startup

When client-side movement telemetry is enabled, the server also writes periodic structured records as lines starting with `[MovementDebug]` containing JSON payloads (`profileId`, movement interval, extrapolation, correction counters, etc.).

### Runtime Readiness API (international support)

For troubleshooting fresh installations, the admin API exposes a runtime readiness report at:

- `GET /api/admin/runtime-readiness`

The response contains language-neutral `code` values and an `overall` state (`ok`, `warn`, `error`) so operators can automate checks regardless of UI language.

It validates common first-start requirements such as:

- Launcher script presence (`launch_server.bat` / `launch_server.sh`)
- `package.json` and server entrypoint availability (`dist_back/skymp5-server.js`)
- `node` and `npm` availability
- `node_modules` bootstrap state
- `release-info.json` parse validity

## Configuration

Default configuration is a starting point for a local test. Public visibility
depends on `offlineMode`, the configured master, the registered server identity
and accepted heartbeats. See [SkyMP Worlds](docs_launcher_worlds.md) for the
current PHP master integration; starting an offline package does not register it.

To make your server reachable from outside your local machine/network, configure bind/listen settings and open required ports in your firewall/router.

```json5
{
  dataDir: 'data',
  loadOrder: [
    'Skyrim.esm',
    'Update.esm',
    'Dawnguard.esm',
    'HearthFires.esm',
    'Dragonborn.esm',
  ],
  listenHost: '0.0.0.0',
  uiListenHost: '0.0.0.0',
  port: 7777,
  uiPort: 8080,
  name: 'My Server',
  adminApi: {
    enabled: true,
    externalUrl: '',
  },
  supervisor: {
    enabled: false,
    stopCommand: '',
    restartCommand: '',
  },
}
```

- You may find out your public IP here http://api.ipify.org
- You need to have ports open. Talk to your Internet provider support if you want to open ports. Status of each port can be checked here https://www.yougetsignal.com/tools/open-ports/. See [Server Ports Usage](docs_server_ports_usage.md) and [Server Configuration Reference](docs_server_configuration_reference.md).
- If you use `LogMeIn Hamachi` or similar software then just type an IP address you got assigned from it. Your friends who share a "local" network with you will be able to connect, players from the Internet will not.

## Ubuntu 24.04 Production Setup

Recommended production pattern on Ubuntu 24.04:

1. Build the server and place it in a stable deployment path such as `/opt/skymp`.
2. Install the systemd service template from [misc/systemd/skymp.service](../../../../misc/systemd/skymp.service).
3. Create a dedicated service user such as `skymp`.
4. Enable and start the service with `systemctl enable --now skymp.service`.
5. Open your game and admin ports in `ufw` or your provider firewall.

Example supervisor configuration for the admin dashboard:

```json5
{
  supervisor: {
    enabled: true,
    stopCommand: '/opt/skymp/misc/systemd/skymp-supervisorctl.sh stop',
    restartCommand: '/opt/skymp/misc/systemd/skymp-supervisorctl.sh restart',
  },
}
```

The helper script template is available at [misc/systemd/skymp-supervisorctl.sh](../../../../misc/systemd/skymp-supervisorctl.sh). For Ubuntu 24.04 you will typically allow the service user to run `systemctl stop skymp.service` and `systemctl restart skymp.service` via `sudoers` without a password prompt.

If you place the admin dashboard behind Nginx or another reverse proxy, make sure it forwards `Host` and `X-Forwarded-Proto` so the server can generate correct external admin URLs automatically.
