[Deutsch](../../de/docs/docs_packaged_server_update.md) · [English](docs_packaged_server_update.md) · [Русский](../../ru/docs/docs_packaged_server_update.md)

<a id="server-zips-für-ersteinrichtung-und-bestehende-installationen"></a>

# Server ZIPs for first installation and existing servers

> **New:** mods now live in `data/mods/<mod>/`; `client-resources` is no longer read. Statements about it on this page are outdated. See [mods in data/mods](docs_mod_folders.md).

As of 26 October 2026, r12. Linux x64 and Windows x64 each have two ZIPs with files directly at the archive root:

- `skymp-server-2026-10-26-r12-<plattform>-full.zip`: complete new installation with default configuration, gamemode, PEX scripts and browser PIN setup. Extract into an empty directory and add your own Skyrim master files.
- `skymp-server-2026-10-26-r12-<plattform>-update.zip`: replaceable program files, dashboard and starters only. Intended for an existing server; credentials, configuration, saves and custom files are preserved. No new PIN setup is needed.

The Update ZIP excludes `server-settings.json`, `data/` (including PEX), `world/`, `client-resources/`, mods, plugins and `gamemode.js`. Custom `package.json`, `package-lock.json`, `.runtime/`, `.env` and logs are preserved too. The bundled file list describes only included program files. Both ZIPs retain executable permissions for Linux `.sh` starters. `<plattform>` is `linux-x64` or `windows-x64`.

**New in r12:** dashboard process/tick history and durable disconnect statistics, direct settings tabs and a game-server restart schedule with IANA time zone, warnings and skip-next. `DASHBOARD.md` is in Full and Update ZIPs. Preserve `server-settings.json` and all of `data/`, including schedule state and history. Replace both backends, supervisor and frontend together. On smartphones, server controls collapse so the actual page remains directly accessible.

**Retained from r11:** resource mod load order, active plugin selection in the launcher manifest and validated player names from Steam login. SteamID remains the server-verified identity. `MOD-LOAD-ORDER.md` is also in the Update ZIP. Update both backends and dashboard frontend together.

**New in r10:** server metrics with 24-hour history and a Discord tab with status-embed templates, preview and live saving. Both packages include default `server-assets/logo.png` and `server-assets/banner.png`. Custom `logo.png` and `banner.png` beside configuration take precedence and are never overwritten by Update. Full packages also include both at the root.

The known native threadpool client fix is shipped as a **separate client runtime package**. Updating the server does not replace game DLLs. Upload the new runtime directory first and its catalog last to the existing host; see [runtime updates](docs_launcher_runtime_updates.md).

**Steam ticket identity in r8:** auth policy v2 uses a compact server-bound identity. Restart the whole service after updating and connect afresh through the current launcher so policy and ticket match. An outdated returned identity gives `STEAM_POLICY_CHANGED` (HTTP 409); the corresponding Valve ticket rejection gives `STEAM_TICKET_AUDIENCE_MISMATCH`. Steam approvals, account links and data are preserved.

**Steam diagnostics from r6, extended in r7:** includes the fixed error classification in launcher findings `STEAM-FEHLER-2026-10-24.md`. r7 adds a sanitised Valve explanation, limited to 160 characters, to the server log; public responses remain fixed codes and numeric diagnostics. Restart the complete starter/service including dashboard for this HTTP change; restarting only the game through the dashboard is insufficient. The code reveals the verification reason; the previous VPS rejection remains unresolved until reconnecting against the updated VPS.

<a id="vor-dem-dateiaustausch"></a>

## Before replacing files

1. Back up the existing server directory, including `server-settings.json`, admin accounts, world data, mods, scripts and custom `gamemode.js`.
2. Stop the complete starter/systemd service. Stopping the game in the dashboard does not stop the web server. Never run old/new instances on the same ports concurrently.
3. Verify the **Update ZIP** checksum. Then extract it into the existing server directory, replacing files. Use Full only in a new empty directory; its defaults would overwrite existing settings and custom files.

Example after backup and complete service stop; adjust paths:

```bash
unzip -o /pfad/skymp-server-2026-10-25-r11-linux-x64-update.zip -d /pfad/zum/bestehenden/server
```

Restart the existing systemd service or run `sh ./start-test-server.sh` in the server directory. For SFTP, transfer the Update ZIP **contents** with the same directory structure and replace files. Do not delete existing data directories. All current program files are supplied regardless of whether the starting revision is r5–r10; an already configured independent-dashboard installation is assumed.

<a id="gemeinsam-aktualisieren"></a>

## Update together

The Update ZIP already selects these files. For manual replacement from a Full package, take them together:

- Complete `dist_back/`, including `skymp5-server.js`, `skymp5-admin.js` and both source maps
- Complete `ui/` and matching `scam_native.node`
- `server-supervisor.cjs`
- `setup-server.cjs`, `setup-web.cjs`, `launcher-connection.cjs`, `check-install.cjs`
- `setup-ui/`, `supervisor-ui/`
- `server-assets/` defaults; preserve custom root images
- Linux: `start-test-server.sh`, `launch_server.sh`, `bootstrap-runtime.sh`
- Windows: `start-test-server.bat`, `start-test-server.cmd`, `launch_server.bat`, `bootstrap-runtime.ps1`
- `build-manifest.json`, `release-info.json`, `QUELLSTAND.txt`, `README-TEST.md`, `DISCORD-BOT.md`, `INGAME-LOGIN.md`, `MOD-LOAD-ORDER.md`, `PORTS-VPS.md`, `UPDATE-VPS.md` and licences

Native **server modules** in local r11 are byte-identical to r10. For later releases or other starting points, always use the matching module from the same complete platform package.

**Preserve; do not replace with defaults:**

- `server-settings.json` and custom environment/service configuration
- Custom root `logo.png` and `banner.png`
- `data/`, including masters, `admin-auth.json`, `player-access.json`, moderation, player statistics and custom scripts
- `world/` and other configured storage directories
- `client-resources/`, custom mods, plugins and `gamemode.js`
- Existing logs and custom package/dependency files

Private `.runtime/` may remain; the starter still verifies it. Compare and selectively merge new bundled standard scripts instead of replacing custom script directories. The launcher is updated in its separate repository; server archives contain no launcher EXE.

**r5 requires Steam at every player login.** Set the Steam Web API key under CFG/Access & Login and choose the access mode. Supply the new launcher EXE and matching client package too. Old clients cannot satisfy mandatory verification. Guest profiles are separate; existing account profiles are not migrated automatically. See [Steam and in-game login](docs_ingame_login.md).

<a id="start-und-kontrolle"></a>

## Startup and checks

Run `sh ./start-test-server.sh` or `start-test-server.bat` in the server directory. A systemd service must call the starter with the correct working directory, e.g. `ExecStart=/bin/sh /opt/skymp/start-test-server.sh`. After service-file changes, run `sudo systemctl daemon-reload`.

Running `node dist_back/skymp5-server.js` directly bypasses independent management and its Discord bot.

1. Verify the existing login. If first-run setup appears unexpectedly, check the working directory and existing `data/admin-auth.json` first.
2. Stop the game: dashboard, logs, settings and downloads must stay available. Start/restart must replace only the game process.
3. Configure or verify Discord under Settings/CFG/Discord and select a status channel. Saving applies the bot immediately. Check connection status and actual start/stop/restart messages in your Discord.
4. Check game connection and launcher downloads separately with a compatible client. Local package/SDK tests do not replace VPS acceptance.

No additional inbound ports: direct testing still uses `7777/UDP`, `8080/TCP`; HTTPS uses the existing proxy. Discord needs outbound HTTPS/WSS over TCP 443 and DNS. See `PORTS-VPS.md` and `DISCORD-BOT.md`.
