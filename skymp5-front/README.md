# skymp5-front

This repo contains GUI demo for Skyrim Multiplayer. Original chat interface by **davinchi59** has been ported.

- `npm run build` produces a minified production build and enforces the JavaScript gzip budget.
- `npm run build:dev` produces a development bundle for debugging without a dev server.
- `npm run watch` is used to start live-reload server (auto-selects a free port).
- `npm run watch:fixed` starts live-reload server on port `1234`.
- `npm run dev:lan` starts live-reload server for LAN/browser testing (`0.0.0.0` + auto port).
- `npm run test:api` runs API integration checks for server list endpoint handling.
- `npm run test:bundle` verifies the production budget guard, including lazy chunks and development-mode behavior.
- `npm run test:e2e` runs optional Playwright smoke test (if Playwright is installed).

If you start a live-reload server and Skyrim Multiplayer server on the same machine, then live-reload would work in the game.

## Production Build And Bundle Budget

`npm run build` uses Webpack production mode. All `watch`/`dev:lan` commands
explicitly use development mode, preserving hot reload and development diagnostics.
The single `build.js` entry remains compatible with the existing server HTML and
Skyrim UI packaging; this step does not introduce runtime chunk downloads.

Every successful build emits `bundle-size.json` beside `build.js`, respecting the configured
`outputPath`. It contains raw and gzip byte sizes for each emitted JavaScript
asset, initial-asset flags, totals, build mode and budget status. Existing files
left over in the output folder are not counted. Images, audio, license text and
source maps are outside this JavaScript budget. Gzip sizes describe transfer
size when compression is enabled; they do not imply that the server compresses
responses or that the game loads gzip files.

Production builds fail above **850 KiB gzip** for the sum of all emitted
JavaScript, including future lazy chunks. This guard also runs in existing CI
prechecks that build this checkout. CMake packaging copies the report along with
the prebuilt frontend assets. Development builds report their
size without enforcing the limit. The initial production baseline is **813,004
bytes gzip**, down from **1,153,515 bytes** for the previous development bundle.
The roadmap's **500 KiB** goal remains open; code splitting and lazy loading are
follow-up work. The baseline guard is defined in `scripts/bundle-budget-plugin.js`.
If the budget fails, the error lists the current sizes; output files can still
belong to the previous successful build and must not be used as a fresh report.

## How To Use This

Create `config.js` and specify an output folder.

```js
module.exports = {
  /* TIP: Change to '<your_server_path>/data/ui' */
  outputPath: './dist',
};
```

## Dev Server In Browser And Local Network

The webpack dev server is configured to listen on all interfaces.

1. Start frontend dev server:

```bash
npm run watch
```

If port `1234` is already busy, webpack dev server now picks a free port automatically.

To force the classic fixed port behavior:

```bash
npm run watch:fixed
```

For explicit LAN/browser testing with auto-port fallback:

```bash
npm run dev:lan
```

2. Open in browser from the same machine:

```text
http://127.0.0.1:<printed-port>/
```

3. Open from another device in your local network:

```text
http://<your-lan-ip>:<printed-port>/
```

For browser-only UI testing without the game client, you can force the logged-in overlay mode:

```text
http://127.0.0.1:1234/?devUi=1&devOverlay=serverList
http://127.0.0.1:1234/?devUi=1&devOverlay=admin
```

`devOverlay` accepts `serverList`, `admin`, or both comma-separated.

In `?devUi=1` mode, the top dev banner also shows the effective UI URL and current `/api` proxy target.
It includes a lightweight API reachability indicator based on `/api/servers` with clear status (`reachable`, `timeout`, `network error`, or backend/proxy HTTP status), a manual `Retry` button, a "last successful check" age hint, and a "next check in" countdown.
It also provides a `Pause checks`/`Resume checks` toggle (persisted in localStorage), a `Reset warnings` action, and escalates to a warning after repeated consecutive failures.

For stable browser automation selectors, dev banner exposes `data-testid` hooks:

- `dev-banner-health-controls`
- `dev-banner-health-status`
- `dev-banner-retry-btn`
- `dev-banner-pause-btn`
- `dev-banner-reset-warnings-btn`
- `dev-banner-health-meta`
- `dev-banner-health-warning` (only when warning is visible)

You can override host, port, backend target and health-check interval:

```bash
SKYMP_FRONT_HOST=0.0.0.0 SKYMP_FRONT_PORT=1234 SKYMP_FRONT_API_TARGET=http://127.0.0.1:7777 npm run watch
```

```bash
SKYMP_FRONT_HEALTH_MS=5000 npm run watch
```

For E2E smoke checks with Playwright, set the target URL if needed:

```bash
PLAYWRIGHT_E2E_URL=http://127.0.0.1:1234/ npm run test:e2e
```

In browser-only dev overlay mode (`?devUi=1`), frontend metrics posting is suppressed by default if no explicit metrics endpoint is configured. This avoids repeated proxy noise when no local backend is running on port `7777`.

If you want to test metrics ingestion in that mode, expose a backend and set a custom endpoint before loading the page:

```js
window.SKYMP_METRICS_ENDPOINT = 'http://127.0.0.1:7777/api/frontend/metrics';
```
