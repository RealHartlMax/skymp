[Deutsch](../../de/docs/docs_server_ports_usage.md) · [English](docs_server_ports_usage.md) · [Русский](../../ru/docs/docs_server_ports_usage.md)

# Server Ports Usage

Normal operation uses a UDP game listener and a separate TCP/HTTP listener.
The webpack and Chromium ports below are development facilities. This page
describes their roles; the configured HTTP and UDP port numbers can also be equal.

For the current test packages, forward **7777/UDP** for gameplay and
**8080/TCP** for HTTP/WebSocket access. The
[VPS firewall and process-control guide](docs_vps_ports_and_process_control.md)
includes HTTPS recommendations, concrete rules and the independent full
dashboard available while the game backend is stopped (r3 and later).

## Main Port

Used to perform synchronization and other basic networking.

- Protocol is UDP
- Default value is 7777
- Configurable via [configuration file](docs_server_configuration_reference.md) or [command line API](docs_server_command_line_api.md)

## UI Port

Used by the embedded browser, admin dashboard, mod downloads and optional
client-runtime hosting. The launcher reads `/api/launcher/manifest` here.

- Protocol is HTTP
- Configurable via `uiPort` in `server-settings.json`
- If `uiPort` is omitted, server uses the same value as `port`
- `uiListenHost` can be used to control bind address for this HTTP listener
- Local test packages set `uiPort: 8080`; read the actual server configuration
- Remote launcher downloads need an externally reachable HTTP(S) base URL as well as the UDP game port

## WebPack DevServer Port

If you run the WebPack dev server and the skymp server on the same machine, the skymp server would proxy UI requests to the WebPack dev server.
This feature allows you to use frontend live reload to test game systems.

- Development probe target is `http://localhost:1234`
- When available, `/ui/*` requests are proxied to that dev server
- Other API/asset requests are served by the built-in server app

## Chromium DevTools

Actually, this is not a serverside port.
You may need to know that the embedded browser exposes port 9000 for remote DevTools.
Just type `localhost:9000` in your _real_ browser to open Chromium DevTools for the in-game browser.
