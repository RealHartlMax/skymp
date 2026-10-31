[Deutsch](../../de/docs/docs_linux_vps.md) · [English](docs_linux_vps.md) · [Русский](../../ru/docs/docs_linux_vps.md)

<a id="linux-vps-build-und-betrieb"></a>

# Linux VPS: build and operation

> **New:** mods now live in `data/mods/<mod>/`; `client-resources` is no longer read. Statements about it on this page are outdated. See [mods in data/mods](docs_mod_folders.md).

Supplements [server operation](docs_running_a_server.md) for **Ubuntu 26.04 VPS, 12 vCores/24 GB RAM**. Starting point for build/load tests, not measured player capacity; that depends on gamemode/plugins/actual CPU.

Ports/protocols: [VPS ports/process control](docs_vps_ports_and_process_control.md). Direct **7777/UDP**, **8080/TCP**; permanent web access preferably **443/TCP** TLS proxy. Also explains management surviving game stop.

<a id="aktueller-server-testbuild-vom-25-oktober-2026"></a>

## Current server test build, 25 October 2026

r9 at `build/releases/2026-10-25-server-r9/`: `skymp-server-2026-10-25-r9-linux-x64-full.zip` for fresh installation; `skymp-server-2026-10-25-r9-linux-x64-update.zip` replaces existing program files. Update omits config/accounts/`data/` including PEX/world/mods/client resources/own gamemode. [Update guide](docs_packaged_server_update.md) has extraction command. Both contain same backends/dashboard.

r8 adds policy v2 compact server-bound ticket identity, HTTP 409/`STEAM_POLICY_CHANGED` for stale identity, `STEAM_TICKET_AUDIENCE_MISMATCH`. After service restart reconnect with current Launcher/fresh ticket. Includes fixed Steam diagnostics and sanitized shortened Valve ticket-rejection explanation in log. Restart whole starter/dashboard because HTTP login is web-side. Existing VPS rejection cause remains unconfirmed. Launcher comes from its own repository.

From r5 Steam required for every player. Enter Web API Key in wizard/CFG Access & Discord, choose mode, restart game. Guests need no Worlds account. Update EXE/runtime too: [Steam/legacy login](docs_ingame_login.md). Backend/dashboard built separately; browser PIN setup, mod API v2, heartbeat, Launcher setup/dashboard integration included. From r4 [Discord bot](docs_discord_bot.md) is web-side independent of game. Native modules unchanged from checked baseline, origin distinguished in manifest from new backend/frontend.

Both archives extracted/tested with real masters: PIN/admin/dashboard/Launcher settings/mod download/UDP. New Linux also starts on Ubuntu 26.04.1 Node 22.22.1. Local container test, no new VPS/game acceptance. `VALIDIERUNG.json` describes scope/open historical Windows native-suite issue.

Existing server: back up/stop, deploy backend/dashboard/setup helper per adjacent `UPDATE-VPS.md`. **Preserve configuration, admins, data, mods, own gamemode.** Replacing only `dist_back/` does not update dashboard.

r2 startup checks install missing/old Node privately under `.runtime/`, SHA-256-verified Node 22 LTS. Missing Ubuntu/Debian packages installed specifically with root/noninteractive sudo; no full OS upgrade/global Node change. Private runtime checks same-LTS updates daily. From r3 dashboard remains separate through game stop/restart/crash: login/config/logs/downloads/PID/WebSockets remain, game PID changes, stopped UI offers Start. Use `start-test-server.sh` or `launch_server.sh` alias.

Separate Launcher repository remains authoritative: `local-builds/current/` contains Launcher/versioned runtime/webroot ZIPs. Server release has no Launcher EXE and does not automatically change those outputs. Steam Launcher/runtime supplied separately for r5.

Initial Launcher setup needs installed game; complete catalog can supply SKSE/Address Library. New client DLLs/standalone address probes exist, real Skyrim/CEF remains open. [Status](docs_project_status.md), [catalog](docs_launcher_runtime_updates.md), [Worlds](docs_launcher_worlds.md) state limits.

<a id="browser-ersteinrichtung-und-modpakete"></a>

## Browser setup and mods

PIN setup introduced 20 October, mod API 21 October. Older local builds removed after r5 validation. Following steps target current full r9 packages. Existing servers use [update guide](docs_packaged_server_update.md), not isolated backend replacements. Additional files `client-resources/Data/`, own plugins `data/`/`loadOrder`; [mods](docs_launcher_modpacks.md).

**No predefined admin.** Extract new directory, copy five own masters into `data/`, run `sh ./start-test-server.sh`/`start-test-server.cmd`. Terminal prints URL/random **four-digit code**. Open VPS `http://87.106.58.116:8080/admin`, enter code, configure name/ports/slots/access/public IPv4/domain/own admin entirely in browser. Password scrypt-hashed, later starts retain setup. Never overwrite existing config/world with archive defaults.

Three access modes:

| Choice | UDP bind | HTTP bind |
| --- | --- | --- |
| Local | `127.0.0.1` | `127.0.0.1` |
| VPS/SSH tunnel | `0.0.0.0` | `127.0.0.1` |
| VPS/public dashboard | `0.0.0.0` | `0.0.0.0` |

For Internet dashboard choose **VPS · Dashboard/game publicly reachable**, enter `87.106.58.116`. Set firewall yourself. `VERBINDUNG.txt` lists addresses/ports, `skymp5-client-settings.example.txt` test-client template. No plaintext passwords. Existing admins never reset. During setup only wizard listens on all IPv4, default TCP 8080; open provider firewall before access. Game starts after completion/valid masters; missing files shown, copy then “Check files again”. Code single-use/10 min; five failures cause global one-minute pause/new terminal code. Browser authorization 30 min. No interactive terminal input, including service start; code in service log. Setup only: `node setup-server.cjs`. HTTPS/SSH protects setup too.

Older local build directories removed after r5 success at user request. Baseline evidence retained as `native-baseline-evidence.json`, cleanup in `cleanup.json`. Existing VPS keeps settings/accounts; never extract defaults over them.

<a id="neuinstallation-auf-ubuntu"></a>

## Fresh Ubuntu installation

Check `uname -m`: package requires `x86_64`. Starters install missing Node.js 22+ automatically; own five masters required, not archived. Ubuntu 26.04:

```sh
mkdir ~/skymp-browser-test
unzip skymp-server-2026-10-25-r9-linux-x64-full.zip -d ~/skymp-browser-test
cd ~/skymp-browser-test
# Skyrim.esm, Update.esm, Dawnguard.esm, HearthFires.esm und Dragonborn.esm nach data/ kopieren.
sh ./start-test-server.sh
```

Stop previous server/service before start, freeing TCP 8080/UDP 7777. Parallel tests first set free `uiPort` in new `server-settings.json`, choose different UDP in browser. Keep old installation/config/world separate.

Open `http://87.106.58.116:8080/admin`, enter code, finish four steps. Defaults UDP 7777/TCP 8080/offline/16 slots, no capacity measurement. Runtime deps bundled, no `npm install`. No Skyrim/CEF client or predefined admin.

Environments/results: [acceptance](docs_native_validation_2026_10_19.md). User's 20 October VPS log confirms native Linux x64/five masters/admin store. Later `/admin` HTTP 200/real login, `/api/admin/setup/status` configured. Remote game/load remain open; VPS config unchanged locally.

<a id="vorhandene-vps-installation-im-internet-erreichbar-machen"></a>

## Expose existing VPS installation

Use **`server-settings.json` in unpacked server directory**, merge values while preserving others:

```json
{
  "listenHost": "0.0.0.0",
  "port": 7777,
  "uiListenHost": "0.0.0.0",
  "uiPort": 8080
}
```

Stop/restart with existing Launcher/systemd. Then `http://DEINE_VPS_IP:8080/admin` works if firewalls allow. `0.0.0.0` is bind, browser uses public IP. `adminApi.externalUrl` is not bind, may stay unset for direct IP. Existing `data/admin-auth.json` credentials remain.

With active UFW:

```sh
sudo ufw allow 7777/udp
sudo ufw allow 8080/tcp
sudo ufw status verbose
ss -lnup
ss -lntp
```

Provider firewall also needs UDP 7777/TCP 8080. Never blindly enable UFW; preserve actual SSH first. [Ubuntu firewall guide](https://ubuntu.com/server/docs/how-to/security/firewalls/). HTTP login unencrypted; permanent access via domain/HTTPS or SSH tunnel.

Direct game test: edit existing client JSON `Data/Platform/Plugins/skymp5-client-settings.txt`:

```json
{
  "gameData": { "profileId": 1 },
  "master": "",
  "server-info-ignore": true,
  "server-ip": "DEINE_VPS_IP",
  "server-port": 7777,
  "server-master-key": "MASTERKEY_AUS_SERVER_SETTINGS"
}
```

Assign own positive `profileId`, e.g. 1/2/3. `offlineMode: true` is local test login, not no Internet. Trusted-group test only; profiles are not verified public accounts. Direct UDP needs no master listing. Client modlist still uses gateway, HTTP panel is not replacement. Preserve other settings. Matching Windows client/game data required; server package does not solve deferred Skyrim 1.7/CEF compatibility.

<a id="plattform-und-eigene-builds"></a>

## Platform and custom builds

Need **Linux `scam_native.node`**; Windows file cannot run on VPS. Build target system/compatible Linux environment, matching architecture/libs. `uname -m` checks architecture.

Compiler/CMake/Ninja/Node/vcpkg: [CONTRIBUTING.md](../../../../CONTRIBUTING.md). Distribution helpers `misc/deps_linux/`; choose installed distro. Current Dockerfile Node 22. This guide never automatically installs/updates system packages.

<a id="eigenen-fork-bauen"></a>

## Build your fork

Transfer desired sources to Linux. Normal clone excludes uncommitted changes; never transfer Windows build directories/`node_modules`.

After prerequisites, from repository:

```sh
mkdir -p build
cd build
npm --prefix ../skymp5-front ci
npm --prefix ../skymp5-front test
npm --prefix ../skymp5-front run build

../build.sh --configure \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_CLIENT=OFF \
  -DBUILD_SKYRIM_PLATFORM=OFF \
  -DBUILD_SCRIPTS=OFF \
  -DBUILD_UNIT_TESTS=OFF \
  -DBUILD_GAMEMODE=OFF \
  -DDOWNLOAD_SKYRIM_DATA=OFF \
  -DOFFLINE_MODE=OFF

cmake --build . --target skymp5-server --parallel 6
```

Six jobs conservative for 24 GB; adjust measured memory. First vcpkg takes extra time/RAM.

Output `build/dist/server/`, including `ui/build.js`, `dist_back/skymp5-server.js`, native/launcher. CMake copies prebuilt frontend; no `BUILD_FRONT` needed.

Game-widget changes also ship in **Windows client**, built separately: `npm --prefix ../skymp5-client run build` from build directory. Linux server never replaces client.

<a id="erststart-und-konfiguration"></a>

## First start/configuration

Whole Linux package e.g. `/opt/skymp/server`, dedicated writable `skymp` user. Add `data/` masters/plugins/gamemode per [server guide](docs_running_a_server.md).

Edit existing `server-settings.json`, do not replace with minimal example. Relevant:

- `port`: UDP, default `7777`.
- `uiPort`: HTTP UI/API, defaults to `port`.
- `listenHost`: UDP bind.
- `uiListenHost`: HTTP bind.
- `masterKey`: match client configuration.
- `adminApi.externalUrl`: explicit public HTTPS URL if set.

Same HTTP/UDP number means different services. Panel/API use HTTP; installed client loads CEF locally `Data/Platform/UI/`. Proxy may bind HTTP loopback if all required paths forwarded, including `/ws/admin-updates` upgrades. [Ports](docs_server_ports_usage.md), [config](docs_server_configuration_reference.md), [Discord OAuth](docs_admin_discord_oauth.md).

Once as server user in package directory:

```sh
cd /opt/skymp/server
./launch_server.sh
```

Launcher checks Node/installs packaged dependencies as needed; arrange before automatic service start. Check real `/admin` setup/login/whitelist. Real OAuth needs public domain/matching Discord.

<a id="als-systemd-dienst-starten"></a>

## systemd service

After successful first start/dependencies, use unit `/etc/systemd/system/skymp.service`. Adjust user/path/Node:

```ini
[Unit]
Description=SkyMP server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=skymp
Group=skymp
WorkingDirectory=/opt/skymp/server
ExecStart=/usr/bin/node /opt/skymp/server/dist_back/skymp5-server.js
Restart=on-failure
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=60
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Stop manual server before enabling:

```sh
sudo systemd-analyze verify /etc/systemd/system/skymp.service
sudo systemctl daemon-reload
sudo systemctl enable --now skymp
sudo systemctl status skymp
sudo journalctl -u skymp -f
```

Stop service, back up `data/`/settings/world, apply [playbook](docs_server_update_playbook.md), start again. Never also `--start-after` while systemd manages it.

<a id="lasttest-und-abnahme"></a>

## Load testing and acceptance

Check CPU/process/free RAM via admin, `top`, `free -h`, first few players then realistic load. 12 vCores do not imply simulation scales everywhere.

Local browsers test real frontend/widgets with simulated API/client events. Native Linux build/full units additionally in container; Ubuntu 26.04 runtime tests real core/admin. Before production verify client/Discord/Skyrim/CEF/actual VPS operation.
