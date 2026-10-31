[Deutsch](../../de/docs/docs_vps_ports_and_process_control.md) · [English](docs_vps_ports_and_process_control.md) · [Русский](../../ru/docs/docs_vps_ports_and_process_control.md)

<a id="vps-ports-protokolle-und-game-prozesssteuerung"></a>

# VPS: ports, protocols and game-process control

As of **23 October 2026**, server test package **r3**. Values apply to its defaults on `87.106.58.116`; your `server-settings.json` overrides them.

<a id="eingehende-regeln-für-den-direkten-test"></a>

## Inbound rules for direct testing

| VPS destination port | Protocol | Purpose | Access |
| --- | --- | --- | --- |
| **7777** | **UDP** | Game/synchronization | Test players |
| **8080** | **TCP**, HTTP/WebSocket | Browser setup, dashboard, Launcher mods/downloads | Test browsers/Launchers |
| Actual SSH port, often 22 | TCP, SSH | Administration/optional tunnel | Prefer own IP/VPN |

Client source ports stay arbitrary. Choose **destination port**/protocol in VPS rules. No extra TCP rule needed for game port. Dashboard WebSockets share HTTP TCP port, including `/ws/admin-updates`/`/ws/live-console`.

Direct test addresses:

- Dashboard/setup: `http://87.106.58.116:8080/admin`
- Manifest: `http://87.106.58.116:8080/api/launcher/manifest`
- Game: host `87.106.58.116`, port `7777`, UDP

Launcher needs web address as well as UDP to download before game start. Restricting whole web port to operator IP would block other players' downloads too.

Directly assigned public VPS normally needs firewall rules. NAT forwarding only if provider actually uses NAT. Both provider/active local firewall must allow traffic.

Merge/check values in existing settings; do not replace file with this incomplete example:

```json
{
  "listenHost": "0.0.0.0",
  "port": 7777,
  "uiListenHost": "0.0.0.0",
  "uiPort": 8080,
  "publicHost": "87.106.58.116"
}
```

`listenHost` binds UDP game, `uiListenHost` HTTP. `publicHost` advertises and never replaces bind settings. `adminApi.externalUrl` is not a bind address either.

With UFW already active and unchanged correct SSH access:

```sh
sudo ufw allow 7777/udp comment 'SkyMP game'
sudo ufw allow 8080/tcp comment 'SkyMP web test'
sudo ufw status verbose
```

Guide never automatically enables UFW/changes SSH. See [Ubuntu firewall documentation](https://ubuntu.com/server/docs/how-to/security/firewalls/).

<a id="empfehlung-für-dauerhaften-öffentlichen-betrieb"></a>

## Recommended permanent public operation

Game remains **7777/UDP**. Use reverse proxy with valid TLS certificate on **443/TCP** for web:

| Listener | Reachability | Purpose |
| --- | --- | --- |
| 7777/UDP | Public | Game |
| 443/TCP | Public | HTTPS dashboard/Launcher downloads/WSS |
| 80/TCP | Public if needed | Redirect/ACME HTTP-01 |
| 127.0.0.1:8080/TCP | Internal | Reverse proxy → SkyMP admin |

After proxy works set `uiListenHost` to `127.0.0.1`, restart whole starter. Public 8080 no longer needed. Point Launcher at public HTTPS base. Merely setting `uiPort` 443 or forwarding 443→8080 does not enable encryption.

HTTP-01 certificate checks need port 80; other methods differ. [Let's Encrypt challenge types](https://letsencrypt.org/docs/challenge-types/).

Nginx must preserve public `Host`, including nonstandard port, and WebSocket upgrades. Process-control writes check request origin. Example fragments for existing HTTPS setup:

```nginx
# Im http-Kontext:
map $http_upgrade $skymp_connection_upgrade {
    default upgrade;
    ''      close;
}

# Im vorhandenen HTTPS-server-Block:
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $skymp_connection_upgrade;
    proxy_read_timeout 300s;
}
```

Certificate, domain/IP mapping and TLS listener configured separately; fragment is not complete HTTPS vhost. See [Nginx WebSocket docs](https://nginx.org/en/docs/http/websocket.html). This HTTP/1.1 setup needs no 443/UDP.

<a id="was-die-dashboard-prozesssteuerung-beeinflusst"></a>

## What dashboard process control affects

`start-test-server.sh`, `start-test-server.bat`/aliases start permanent administration with public HTTP. It starts dashboard/game as **two separate children**. Dashboard loads no native game addon. Commands use **Node IPC**, no extra public control port.

| Action | Game | Public HTTP |
| --- | --- | --- |
| Dashboard Stop | Own child exits, UDP freed | Same port continues |
| Operator Start | New child | Continues |
| Dashboard Restart | Own child replaced | Continues |
| Game crash | Child exits, operator restarts | Reachable |
| Ctrl+C, exit starter, stop whole systemd service | Own child exits | Exits too |

**From r3 full dashboard survives:** login/settings/admin users/previous game logs/mod downloads work with stopped/crashed game. Page never reloads on game stop; dashboard PID/WebSockets remain. UI shows game state/**Start** when stopped. Live kick/announcement need running game, otherwise `GAME_NOT_RUNNING`, HTTP 409. Mod downloads still require valid `data/manifest.json` matching `loadOrder`; after changing list may need game start to regenerate.

Old r2 retains separate operator page. Full separation needs r3 files including `dist_back/skymp5-admin.js`, game backend, dashboard frontend, `server-supervisor.cjs`.

Dashboard actions do not stop upstream Nginx/Caddy. Administration stops only own child, never searches other Node/webservers. Exiting whole starter stops both own children.

systemd should start bundled starter. `systemctl stop`/`systemctl restart` whole service affects administration too. Use dashboard for game-only restart. HTTP port/bind changes require whole starter restart. Direct `node dist_back/skymp5-server.js` bypasses bundled management.

<a id="interne-ports-und-ausgehende-verbindungen"></a>

## Internal ports and outbound connections

From r4 [Discord bot](docs_discord_bot.md) stays connected in dashboard, gets game changes through private IPC, can report start/stop/restart/crash. Full starter stop ends game first, then bot/dashboard. No extra public listener.

- Dashboard/game each use dynamic **127.0.0.1 TCP port** for internal HTTP forwarding. Never publicly open these or a dynamic range.
- **1234/TCP** is frontend developer server; detection skipped in managed package. Do not open on VPS.
- **9000/TCP** is player-side CEF DevTools, no VPS requirement.
- Voice/TeamSpeak/other plugins need extra rules only if separately hosted.
- With restricted egress, allow HTTPS **443/TCP** for Node downloads, Discord API/gateway HTTPS/WSS and optional master/online login. Mirrors may need **80/TCP or 443/TCP**. DNS usually **53/UDP and 53/TCP** to resolver. Allow replies on permitted connections too.

Master heartbeat is outbound, no extra inbound port. External client-runtime URL also creates no SkyMP listener.

<a id="erreichbarkeit-prüfen"></a>

## Check reachability

```sh
ss -lnup
ss -lntp
curl -I http://127.0.0.1:8080/admin
```

Also test HTTP from another machine. HTTP/TCP success proves no UDP game connection; separately test matching client. Package checks UDP binding/free on stop/new game PID on start/restart. Dashboard contract test checks settings/logs/downloads/same PID/WebSockets after crash. Evidence per release; local tests replace neither VPS check nor game session.

See [Linux VPS/browser setup](docs_linux_vps.md), [server configuration](docs_server_configuration_reference.md), [Launcher mods](docs_launcher_modpacks.md).
