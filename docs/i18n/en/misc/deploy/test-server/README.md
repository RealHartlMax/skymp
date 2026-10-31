# SkyMP server test version

> **New:** mods now live in `data/mods/<mod>/`; `client-resources` is no longer read. Statements about it on this page are outdated. See [mods in data/mods](../../../../../../docs/docs_mod_folders.md).

Windows and Linux contain the same backend, frontend and gamemode revision. `build-manifest.json` records source revision, platform and SHA256 of every package file. The native extension is built separately for each OS.

## Full installation or update

Linux `*-full.zip` includes defaults for initial setup. Extract only into a new empty directory. For an existing server, use `*-update.zip`: it contains program files and leaves configuration, credentials, `data/`, worlds, mods, client resources, custom package files and `gamemode.js` intact. Back up, stop the entire service including dashboard, extract with replacement into the existing directory and restart. Existing login survives; no new PIN setup. Full instructions: `UPDATE-VPS.md`.

`DASHBOARD.md` describes direct settings navigation, live metrics, interruption history and scheduled game restarts with timezone/warnings. Management remains reachable during game stop/restart.

## Preparation

1. Extract Windows x64 or Ubuntu 26.04 x86_64. On VPS, `uname -m` must return `x86_64` for this Linux package.
2. Startup scripts check runtime. Suitable installed Node.js x64 version 22+ is reused. Missing/old Node triggers a download of current Node.js 22 LTS from nodejs.org, SHA-256 validation and private installation in this server's `.runtime/`. Ubuntu/Debian install missing system packages selectively, requiring root or noninteractive sudo. On Windows, failed native-load validation installs/updates signed Microsoft C++ runtime; Windows may request admin approval.
3. Copy five files listed in `data/SPIELDATEN.txt` from your Skyrim installation into `data/`. Packages contain no game data.
4. A **first-run browser-setup package** initially prints only a browser address and random **four-digit setup code**, with no terminal questions. Open `http://VPS_IP:8080/admin`, locally `http://127.0.0.1:8080/admin`, and enter it. Configure name, ports, slots, access, public IPv4/domain and own admin account in the browser. Password is stored only as scrypt hash. Game starts automatically afterward. The wizard changes no firewall.
5. Check `server-settings.json`: UDP **7777**, HTTP **8080**. Test configuration uses Steam guest access and 16 slots. Enter a Steam Web API key in the browser; without a valid key players cannot log in. This is a test setting, not a measured capacity limit.

## Starting

Linux, from extracted directory:

```sh
sh ./start-test-server.sh
```

Windows, from extracted directory:

```bat
start-test-server.bat
```

`start-test-server.cmd`/`launch_server.bat` are Windows aliases; `launch_server.sh` is Linux alias. Scripts check OS, Node and masters. Backend dependencies are bundled; startup needs no `npm install`. Other server processes are unaffected. Later starts skip setup and retain access. To configure without then starting the game: `node setup-server.cjs`. Interactive terminal is unnecessary; the code also appears in service logs such as `journalctl`.

Private Node checks at most once per 24 hours for newer 22-LTS versions. Failed updates retain the verified runtime. A suitable global Node is not automatically replaced. `SKYMP_MANAGED_NODE=1` selects private Node even when global exists. `SKYMP_RUNTIME_OFFLINE=1` prevents downloads but still requires an installed suitable runtime. It does not install game masters/mods.

## Quick actions and process control

Scripts start persistent management with separate dashboard/game children. **Stop** releases UDP while the complete dashboard remains on the same HTTP port/login. Settings, game logs and downloads stay accessible; operators can restart the game there. Start/restart replaces only game PID; dashboard PID/WebSockets survive. Configuration, admin access and worlds remain intact. Crashes do not cause endless automatic restart loops; management retains status/manual startup.

Existing accounts/permissions are checked even with game stopped. **Kick all players** requires permission and connected players. Announcements/confirmations use dedicated browser dialogs. Direct `node dist_back/skymp5-server.js` bypasses packaged control and needs a correctly configured external supervisor.

Ctrl+C or terminating the whole starter also stops its own game process, never searches/terminates other servers. HTTP-port/bind changes need whole-starter restart; dashboard game restart changes only its child.

Player actions require running game. Downloads still need valid `data/manifest.json` for the configured mods. Control uses private IPC, with no extra public port. `PORTS-VPS.md` includes full port/HTTPS/firewall examples. Old r2 used a separate operator page during game stop; adopt matching r4 files for dashboard and Discord bot.

During first setup only the small wizard listens on **all IPv4 addresses**, default TCP 8080; UDP remains closed. Allow this TCP port in VPS/provider firewall or use SSH tunnel. Browser-selected access applies to dashboard afterward. If changing ports, use/allow the new address. If another service owns TCP 8080, first change `uiPort` to a free port.

Code is one-use for ten minutes. Five failures cause a global one-minute cooldown, then a new terminal code. Browser approval lasts 30 minutes. Restart before completion creates a fresh code and saves no partial setup. Missing/invalid masters can be rechecked without restart. HTTP transmits setup/login unencrypted; use HTTPS/SSH tunnel for continued access.

The wizard backs up prior `server-settings.json`, creates `VERBINDUNG.txt` and `skymp5-client-settings.example.txt`. The latter is a one-player JSON template, not an installed client. Existing admin accounts are detected and never reset. Extract fresh first-run packages into a **new directory**; never overwrite an existing installation with their default configuration.

## Admin panel on VPS

Preconfigured test credentials are in `TEST-ZUGANG.txt`; browser-setup packages use your selected account. “Local” binds HTTP/UDP to loopback; “VPS with SSH tunnel” binds UDP to all IPv4 and HTTP loopback; “VPS with public dashboard” binds both to all IPv4. Local URL: `http://127.0.0.1:8080/admin`.

Open an SSH tunnel from your PC:

```sh
ssh -L 18081:127.0.0.1:8080 DEIN_BENUTZER@DEINE_VPS_IP
```

Visit `http://127.0.0.1:18081/admin` and keep the tunnel open. UDP 7777 must be reachable for gameplay tests. Remote-client HTTP/public HTTPS are configured separately in server settings/reverse proxy.

For direct access set `uiListenHost` to `"0.0.0.0"` in existing configuration and restart. `listenHost` controls UDP and should also be `"0.0.0.0"` for remote players. Browse `http://VPS_IP:8080/admin`. `adminApi.externalUrl` is not a bind address; direct-IP mode can leave it unset and derive it from requests.

With active UFW, allow used ports:

```sh
sudo ufw allow 7777/udp
sudo ufw allow 8080/tcp
sudo ufw status verbose
ss -lnup
ss -lntp
```

Provider firewalls must also permit them. Do not enable UFW solely because of this guide; existing SSH rules must match the actual port. For permanent admin use, configure domain HTTPS or SSH tunnel, because HTTP does not encrypt login.

## Test-player connection

Use updated Windows launcher and matching client package. Steam must be running/signed in. Launcher requests ticket; server verifies Steam ID and issues private session. Launcher manages `Data/Platform/Plugins/skymp5-client-settings.txt` with backup/restore. Generated example contains addresses, no session. Freely selected `gameData.profileId` no longer authenticates. Open guests need no Worlds/skymp.net account; dashboard approval may be required. Account/Discord modes remain separate choices. Details/key setup: `INGAME-LOGIN.md`.

A compatible Windows client, SKSE/Address Library and matching Skyrim masters are required. Server archives contain no client DLLs and do not fix runtime incompatibility.

## Preparing mods through launcher

Place extra client files in `client-resources/Data/` using Skyrim's directory layout. Custom plugins go in `data/`/`loadOrder`; matching BSA publish automatically. See `client-resources/README.md` and source `docs/docs_launcher_modpacks.md`.

The standalone launcher reads `/api/launcher/manifest`, downloads and verifies size/SHA-256, then starts SKSE. Own Skyrim remains required. Current launcher can install SKSE from complete versioned runtime; old packages need preinstalled SKSE. No Nexus/Vortex account is needed.

## Discord bot and status

Since r4, bot runs in independent webserver, preserving Discord connection across game stop/restart/crash. Enter token, server ID and status channel under Settings/Discord settings or CFG/Discord, formerly Access & Discord through r9. Since r10 there are JSON templates/preview. Enable bot. Saving applies connection and shows status; notifications work in offline game mode. See `DISCORD-BOT.md` for roles/channel rights. Complete starter remains required.

## Mod load order since r11

In **Resources**, rescan ESM/ESP/ESL, enable and save dependency order. Only `loadOrder` changes; restart game afterward. Files belong in server data; supply matching player copies under `client-resources/Data/`. Disabled plugins are omitted from modern manifest. See `MOD-LOAD-ORDER.md`.

## Logo and banner

`logo.png`/`banner.png` sit beside configuration. New Full packages include repository images. Own images are detected at next heartbeat; no web image URLs. Updates do not replace own images. Since r10, both packages also ship defaults in `server-assets/`, used only when root images are absent.

Recommended logo **512 × 512** (1:1), banner **1920 × 320** (6:1), PNG up to 8 MiB each. Keep important content central because banners crop. Fork images ship unchanged.

## Data and updates

Persistent test data is created in `data/`/`world/`. Back up configuration, admin auth store and worlds before replacement. Each browser-setup installation owns its selected account. This is a server test package; Skyrim/CEF client is not included.
