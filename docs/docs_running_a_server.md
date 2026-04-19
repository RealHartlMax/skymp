# Running a Server

As you already know Skyrim Multiplayer is releasing public server builds. Here is an instruction on running your own server.

## Installation

### Windows

The server requires `Windows 8.1` / `Windows Server 2012` or higher. It may still launch on older operating systems, but correct work isn't guaranteed.

You obviously need to have 64-bit Windows version since the server is 64-bit program.

You are able to build whole project from sources. Server build would be in `build/dist/server`. Use `launch_server.bat` to launch. A convenience launcher is also generated as `build/launch_server.bat`.

`launch_server.bat` now includes restart protection: before starting a new server process it checks for an already running `dist_back/skymp5-server.js` process and terminates it automatically.

### Linux

Linux server support is prepared for source builds.

If your build completed successfully, the server launcher will be generated as `build/dist/server/launch_server.sh`. A convenience launcher is also generated as `build/launch_server.sh`.

Client support remains Windows-first, but the dedicated server can be prepared for Linux environments.

## Admin Dashboard

The admin dashboard is available at `http://<host>:<uiPort>/admin`.

- `uiPort` is taken from `server-settings.json` (if omitted, it falls back to `port`).
- The page uses an in-app login form (not browser Basic Auth popup).
- Credentials are validated against configured admin credentials (secure setup flow), with legacy `adminUiAuth` / `metricsAuth` fallback behavior where applicable.
- Session timeout is 10 minutes of inactivity for dashboard interactions.

## Configuration

Once you build the server, you should be able to launch it. But default config values are only usable to verify that server works. After launching the server you will see a server called `My Server` in the master list: https://skymp.io/api/servers.

To make your server reachable from outside your local machine/network, configure bind/listen settings and open required ports in your firewall/router.

```json5
{
  "dataDir": "data",
  "loadOrder": [
    "Skyrim.esm",
    "Update.esm",
    "Dawnguard.esm",
    "HearthFires.esm",
    "Dragonborn.esm"
  ],
  "listenHost": "0.0.0.0",
  "uiListenHost": "0.0.0.0",
  "port": 7777,
  "uiPort": 8080,
  "name": "My Server"
}
```

- You may find out your public IP here http://api.ipify.org
- You need to have ports open. Talk to your Internet provider support if you want to open ports. Status of each port can be checked here https://www.yougetsignal.com/tools/open-ports/. See [Server Ports Usage](docs_server_ports_usage.md) and [Server Configuration Reference](docs_server_configuration_reference.md).
- If you use `LogMeIn Hamachi` or similar software then just type an IP address you got assigned from it. Your friends who share a "local" network with you will be able to connect, players from the Internet will not.
