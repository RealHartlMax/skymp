# skymp5-front

This repo contains GUI demo for Skyrim Multiplayer. Original chat interface by **davinchi59** has been ported.

* `yarn build` is used to build the project.
* `yarn watch` is used to start live-reload server.
* `yarn test:api` runs API integration checks for server list endpoint handling.
* `yarn test:e2e` runs optional Playwright smoke test (if Playwright is installed).

If you start a live-reload server and Skyrim Multiplayer server on the same machine, then live-reload would work in the game.

## How To Use This 

Create `config.js` and specify an output folder.
```js
module.exports = {
    /* TIP: Change to '<your_server_path>/data/ui' */
    outputPath: "./dist",
};
```

## Dev Server In Browser And Local Network

The webpack dev server is configured to listen on all interfaces.

1. Start frontend dev server:
```bash
yarn watch
```
2. Open in browser from the same machine:
```text
http://127.0.0.1:1234/
```
3. Open from another device in your local network:
```text
http://<your-lan-ip>:1234/
```

For browser-only UI testing without the game client, you can force the logged-in overlay mode:

```text
http://127.0.0.1:1234/?devUi=1&devOverlay=serverList
http://127.0.0.1:1234/?devUi=1&devOverlay=admin
```

`devOverlay` accepts `serverList`, `admin`, or both comma-separated.

You can override host, port and backend target:

```bash
SKYMP_FRONT_HOST=0.0.0.0 SKYMP_FRONT_PORT=1234 SKYMP_FRONT_API_TARGET=http://127.0.0.1:7777 yarn watch
```

For E2E smoke checks with Playwright, set the target URL if needed:

```bash
PLAYWRIGHT_E2E_URL=http://127.0.0.1:1234/ yarn test:e2e
```

In browser-only dev overlay mode (`?devUi=1`), frontend metrics posting is suppressed by default if no explicit metrics endpoint is configured. This avoids repeated proxy noise when no local backend is running on port `7777`.

If you want to test metrics ingestion in that mode, expose a backend and set a custom endpoint before loading the page:

```js
window.SKYMP_METRICS_ENDPOINT = 'http://127.0.0.1:7777/api/frontend/metrics';
```
