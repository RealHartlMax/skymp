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
- `npm run test:a11y` extends the smoke test with mobile layout, axe WCAG checks, dialog focus and keyboard navigation.

If you start a live-reload server and Skyrim Multiplayer server on the same machine, then live-reload would work in the game.

## Mobile And Keyboard Accessibility

Launcher controls stack at narrow widths, with scrollable content instead of
clipped actions. Wide data tables scroll inside their own containers. The admin
dashboard uses a vertically scrollable layout at phone widths. Player profiles
open from the player name in the existing player list; there is no duplicate
player table in the heading.

Launcher, dashboard, update, warn, player-profile, admin-user and whitelist dialogs share focus handling:
Tab/Shift+Tab stay in the active dialog, Escape closes the top dialog, and focus
returns to its opener. Background controls are inert while a modal is open.
Profile, dashboard and configuration tabs support Left/Right and Home/End.
Close controls and form fields have accessible names; new labels are included
in all six locales. Configuration results use a live status message. The
inventory table's scroll area is also reachable by keyboard.

Admin-user forms support Enter to save and Escape to cancel. During saving,
fields and close controls are disabled. API failures remain in the dialog and
preserve the entered values. Dialog bodies scroll when viewport height is limited.
Whitelist approval uses the same behavior and validates the `type:value`
identifier before writing. Its panel search is named and its entry table can be
scrolled by keyboard.

The server-rendered `/admin` login, initial setup and legacy migration screens
have visible focus, announced errors and a scrollable layout. Pending requests
disable form fields and competing actions. Setup declares password requirements;
migration labels the old and new passwords separately. The German document
language matches the current server template.

The in-game sign-in uses the client `AuthService` OAuth widget, rendered by
`components/WidgetForm`. The unused email/password login/register demos were
removed. On startup, the old `localStorage.password` key is removed; OAuth
session storage in the native client is unaffected. Shared controls keep their
existing callbacks, with real disabled buttons, associated input labels and
native checkboxes. Game forms scroll on short screens, wrap long server names
and retain focus when client status updates arrive. Login comments use a live
status region. The existing shared control skin moved to
`components/WidgetForm/legacyControls.scss`.

Start `npm run watch`, then run the accessibility checks in another terminal
using its printed port (or serve the production output and use that URL):

```powershell
$env:PLAYWRIGHT_E2E_URL = 'http://127.0.0.1:1234/?devUi=1'
npm run test:a11y
```

The test uses simulated API/WebSocket data. It checks light/dark launcher,
players, respawn, events, warning, all three profile tabs, admin-user
create/edit/error states, all four configuration tabs, whitelist panel/dialog/
error/populated states, admin login/error/setup/migration, and three in-game
widget states at **360px and 1280px** (54 axe checks), plus focus wrapping/restoration, nested Escape
handling and tab keys. The regular smoke also checks user creation, role
editing, invalid Discord IDs, rejected saves, cancellation without a write,
and preservation of unrelated configuration JSON fields during saving. It also
checks whitelist validation/retry/cancel/refresh and admin login, duplicate
pending submissions, setup validation, migration payloads and the Discord entry
redirect. Short viewport checks keep form actions reachable at 360px by 480px.
`scripts/game-widget-checks.js` extracts the actual widget factory from the
client source and checks OAuth/Play/server-selection events, focus during
refresh, old-password cleanup, input callbacks and checkbox keyboard behavior.
Its native client bridge is simulated; it does not authenticate a real account.
Missing Playwright fails this check instead of reporting a successful skip.
JSON findings and screenshots are saved in `.cache/accessibility/` (gitignored).
Reports retain axe's `incomplete` findings for manual review. These checks do not
replace screen-reader testing, checks of other remaining forms, a real Discord
OAuth callback, or a Skyrim/CEF session.
Test writes are intercepted by `scripts/admin-form-checks.js` and
`scripts/admin-auth-checks.js`; they never update real accounts or settings.
Authentication checks render `skymp5-server/ts/adminLoginPage.ts`, the same
template used by the server's `/admin` route, and intercept its API requests.

When adding a modal, use `ModalDialog` with an accessible name and `onClose`
instead of adding a global Escape listener. Keep wide content inside a scroll
container and ensure the dialog can shrink vertically.

For the intended Linux VPS with 12 vCores / 24 GB RAM, see
[Linux VPS build and operation](../docs/docs_linux_vps.md). Build the native server
for Linux; the frontend assets are portable, while a Windows `scam_native.node`
is not. The client plugin is distributed separately to Windows game clients.
The paired server test packages dated 2026-10-19 include the same production UI
on both operating systems. Native build and runtime results are recorded in
[the validation report](../docs/docs_native_validation_2026_10_19.md); actual
VPS deployment and the Skyrim/CEF client test remain separate steps.

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
