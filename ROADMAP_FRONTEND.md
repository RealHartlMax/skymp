# Frontend & Infrastructure Roadmap

This roadmap tracks the development of the admin dashboard, launcher UI, testing infrastructure, and frontend tooling for the Skyrim Multiplayer project.

## Status Audit (2026-04-18)

| Area | Roadmap Claim | Evidence in Repository | Audit Result |
| --- | --- | --- | --- |
| i18n and locale parity | en/ru/de + key consistency tests are done | `src/locales/{en,ru,de}.json`, `scripts/test-locales.js` | ✅ Confirmed |
| Frontend test baseline | unit and API integration tests are done | `scripts/test-unit.js`, `scripts/test-api-integration.js` | ✅ Confirmed |
| E2E smoke coverage | dev-banner + launcher + admin flows are in progress and already covered in smoke tests | `scripts/test-e2e-smoke.js` | ✅ Confirmed (smoke-level) |
| Admin dashboard core | tabs, moderation actions, console, logs, metrics implemented | `src/features/adminDashboard/index.tsx` | ✅ Confirmed |
| Admin backend endpoints | status/players/kick/ban/mute/message/logs/frontend-metrics/capabilities implemented | `skymp5-server/ts/ui.ts` | ✅ Confirmed |
| Admin resources and config workflows | resources inventory panel + server-settings CFG editor + locale routing APIs implemented | `skymp5-server/ts/ui.ts`, `cmake/scripts/generate_server_settings.cmake` | ✅ Confirmed |
| Dev server presets | LAN preset and fixed-port mode available | `package.json` scripts `dev:lan`, `watch:fixed` | ✅ Confirmed |
| Admin dashboard shell redesign | txAdmin-inspired three-zone layout (topbar / sidebar / main / rightbar) | `src/features/adminDashboard/index.tsx`, `styles.scss` | ✅ Confirmed |
| Respawn & Revival system | canRespawn binding, RespawnPanel, EventsPanel, backend routes `/api/admin/respawn-status` + `/api/admin/revive` + `/api/admin/events` | `skymp5-server/ts/ui.ts`, `RespawnPanel.tsx`, `EventsPanel.tsx` | ✅ Confirmed |
| Remaining risk items | dependency graph and lockfile integrity issues still listed as blockers | Known Issues table in this file | ⚠️ Still open |

## Exit Criteria For Current In-Progress Items

| Item | Exit Criteria |
| --- | --- |
| Admin dashboard advanced moderation workflows | Warn action implemented end-to-end (UI + API + audit log), cross-panel quick search from players/logs/metrics, and E2E scenario covering the flow |
| Dev server diagnostics and UX | Health diagnostics remain stable for 30+ minutes in browser and LAN mode, with documented troubleshooting steps and deterministic E2E selectors |
| Launcher update flow | In-launcher update flow supports channel-aware download, ignore/reset behavior, and one complete user-path E2E scenario per release channel |
| Mobile responsiveness | All launcher/admin core screens usable at 360px width without clipped controls or horizontal overflow on critical tables/actions |
| Accessibility (a11y) | Keyboard-only navigation works across launcher/admin dialogs and tabs, visible focus for interactive controls, and automated a11y checks pass on core screens |
| Component test coverage expansion | Critical shared UI components have SSR/unit coverage and at least one interaction-oriented test for each high-risk control |
| Dependency and lockfile recovery | `npm ci`, `npm run lint`, and `npm run build` succeed on a clean clone with committed lockfile state |

## Frontend Application Features

| Feature | Status | Details |
| --- | --- | --- |
| **DONE:** | **Fully implemented and tested.** | |
| *Localization (i18n)* | ✅ Done | i18next + react-i18next integrated; English, Russian, German locales; automated key consistency tests |
| *TypeScript Configuration* | ✅ Done | TypeScript-based frontend build is active; current baseline in skymp5-front is TypeScript 5.9.x |
| *Component Typing* | ✅ Done | SkillsMenu fully typed; Button interfaces fixed; proper React/JSX types |
| *Locale Testing* | ✅ Done | Automated locale key parity validation between en/ru/de |
| *Admin Dashboard UI* | ✅ Done | Overlay dashboard with polling status + player list, close action, kick action wired to backend |
| *Launcher Server List* | ✅ Done | Server browser UI with search/sort, details panel, direct connect, connect event dispatch |
| *Unit Tests Setup* | ✅ Done | Dependency-free Node + ts-node unit test runner integrated into npm test pipeline |
| **IN PROGRESS:** | **Currently being worked on.** | |
| *Admin Dashboard Features* | 🔄 In Progress | Tabs (players/console/logs/resources/cfg/respawn/events), player search, ban/unban (permanent + timed), kick with reason, mute/unmute with countdown badges, send-message-to-player flow, console command sender, filtered activity log, and ban/mute file persistence are implemented; txAdmin-inspired shell (topbar + left sidebar nav + main content + right player rail, summary KPI cards, viewport-constrained independent-scrolling zones, sticky table headers) is live; respawn/revival panels and event log are now included; resources inventory is now focused on Skyrim-relevant files (`.esm`/`.pex`) and server-settings CFG editor includes structured Access/Discord form validation before save; richer moderation workflows (warn, cross-panel quick search) still pending |
| *Dev Server Setup* | 🔄 In Progress | Webpack DevServer binds to all interfaces, proxies `/api`, supports browser/LAN usage, documents dev-only overlay entry points via `?devUi=1`, shows an in-browser dev mode indicator banner with effective UI URL + proxy target, includes API reachability diagnostics (`reachable`/`timeout`/`network`/HTTP code) + manual retry + pause/resume toggle (persisted) + reset warnings control + last-success age + next-check countdown + repeated-failure warning, exposes E2E-friendly `data-testid` hooks for dev banner controls/status, supports configurable health-check interval via `SKYMP_FRONT_HEALTH_MS`, auto-falls back to a free port when `1234` is occupied (`watch:fixed` keeps deterministic mode), and includes a dedicated `dev:lan` preset |
| *Launcher Features* | 🔄 In Progress | Favorites, tag filters, auto-connect last server, API endpoint override, source status, cached/demo offline fallback, direct connect validation, launcher theme toggle, selected-server version mismatch warning, and release-channel-aware update banner with optional download link are implemented |
| *E2E Testing* | 🔄 In Progress | Playwright flow script now covers dev-banner health controls/selectors (`retry`, `pause/resume`, `reset warnings`), launcher server selection, and admin metrics with mocked APIs; passes against the webpack dev server in browser-only `?devUi=1` mode |
| *API Integration Tests* | ✅ Done | `scripts/test-api-integration.js` validates server list endpoint normalization and API error/payload handling |
| *Performance Monitoring* | 🔄 In Progress | Frontend performance/error buffering posts to `/api/frontend/metrics`; admin metrics tab exposes summaries and recent entries; browser-only dev mode suppresses noisy posts unless an explicit metrics endpoint is configured |
| **TODO:** | **Planned features.** | |
| *Mobile Responsiveness* | 🔄 In Progress | First responsive pass started for launcher/admin overlays: compact spacing, stacked action rows, tab overflow handling, and small-screen table/action tuning |
| *Accessibility (a11y)* | 🔄 In Progress | First a11y pass started for launcher/admin overlays: dialog semantics, tab roles, table captions/scope, explicit button types, Escape close handling, and focus-visible states |
| *Dark Mode* | 🔄 In Progress | Launcher-level theme toggle and system preference detection are implemented; app-wide theme rollout still pending |
| *Offline Mode* | 🔄 In Progress | Server list falls back to cached or demo data when API is unreachable; broader offline sync is still pending |

## Testing Infrastructure

| Feature | Status | Details |
| --- | --- | --- |
| **DONE:** | **Fully implemented and tested.** | |
| *Locale Consistency Tests* | ✅ Done | Node.js script validates key structure across locale files |
| *Unit Test Framework* | ✅ Done | Node.js + ts-node based unit test setup in `scripts/test-unit.js` |
| *First Unit Tests* | ✅ Done | Utility tests for server list/admin helpers, i18n language detection, and FrameButton click/class behavior |
| **IN PROGRESS:** | **Currently being worked on.** | |
| *Component Tests* | 🔄 In Progress | Added dependency-free SSR checks for SkyrimButton, SkyrimInput, FrameButton, ImageButton, SkyrimHint, SkyrimSlider, and SkyrimFrame; continue until full critical component coverage |
| **TODO:** | **Planned features.** | |
| *Integration Tests* | 📋 Planned | Test component composition, context providers, state management |
| *Snapshot Tests* | 📋 Planned | Detect unintended UI changes |
| *Coverage Reporting* | 📋 Planned | Minimum 70% coverage; CI integration |
| *E2E Tests (Playwright)* | 🔄 In Progress | Mock-driven launcher selection, admin metrics API checks, and admin moderation API flow coverage (mute/unmute + message with optional reason) exist in `scripts/test-e2e-smoke.js`; the smoke flow also validates AdminDashboard test hooks and message-form open/cancel lifecycle, and passes against the live webpack dev server |
| *Visual Regression Tests* | 📋 Planned | Detect UI regressions across different screen sizes |
| *Accessibility Tests* | 📋 Planned | axe-core integration for a11y compliance |

## Development Tooling & DevOps

| Feature | Status | Details |
| --- | --- | --- |
| **DONE:** | **Fully implemented and tested.** | |
| *NPM Scripts* | ✅ Done | build, watch, test, test:i18n, test:unit, lint, lint:fix, storybook |
| *TypeScript Build* | ✅ Done | Webpack bundling, tree-shaking, minification |
| *Code Formatting* | ✅ Done | ESLint configured; formatting conventions documented in CONTRIBUTING.md |
| *Git Hooks* | ✅ Done | Husky + lint-staged for pre-commit checks |
| **IN PROGRESS:** | **Currently being worked on.** | |
| *Documentation* | 🔄 In Progress | Updated CONTRIBUTING.md with frontend setup and dev guidelines |
| **TODO:** | **Planned features.** | |
| *CI/CD Pipeline* | 📋 Planned | GitHub Actions: TypeScript check, tests, build, deploy artifacts |
| *Installer Pipeline Integration* | ✅ Done | Main branch pushes trigger installer repository dispatch; installer binary is built in external/private installer repo |
| *Dev Server Documentation* | 📋 Planned | HMR setup, dev proxy configuration, troubleshooting |
| *Build Optimization* | 📋 Planned | Code splitting, lazy loading, bundle analysis |
| *Docker Support* | 📋 Planned | Dockerfile for frontend build and dev containers |
| *Environment Configuration* | 📋 Planned | .env variables for API endpoints, feature flags |
| *Release Process* | 📋 Planned | Semantic versioning, changelog automation, deployment steps |
| *Storybook* | 📋 Planned | Component library documentation and interactive examples |
| *Performance Profiling* | 📋 Planned | Webpack Bundle Analyzer, React DevTools profiler guide |

## Admin Dashboard

| Component | Status | Details |
| --- | --- | --- |
| **DONE:** | **Fully implemented and tested.** | |
| *Backend Routes* | ✅ Done | `/admin`, `/api/admin/status`, `/api/admin/players`, kick (with reason), ban/unban (permanent + timed with expiry), `POST/DELETE /api/admin/players/:id/mute`, `GET /api/admin/mutes`, `POST /api/admin/players/:id/message`, console command endpoint, and logs endpoint; file-persisted ban/mute lists, language support |
| *Dashboard Layout* | ✅ Done | txAdmin-inspired shell: fixed topbar with brand + tab navigation + role/user display; left sidebar with server card, full navigation list, status pills (uptime/port/players), and reset action; main content zone with panel-toolbar bars, summary KPI cards (online/banned/muted/downed), and independently-scrollable panel area with sticky table headers; right player rail with search and online/max counter |
| *Server Stats Panel* | ✅ Done | Online players, max players, uptime, tick counters, API status |
| *Player List View* | ✅ Done | Live player table with id/name/level/location and selection state |
| *Player Management* | ✅ Done (Kick) | Kick action integrated (`POST /api/admin/players/:id/kick`) |
| **IN PROGRESS:** | **Currently being worked on.** | |
| *Advanced Admin Panels* | 🔄 In Progress | Console, deep configuration editor, richer telemetry and moderation tools; frontend metrics tab is now included |
| *Resources Panel* | ✅ Done (Inventory) | `GET /api/admin/resources` with server-side filesystem scan and UI table is implemented; current filter is intentionally narrowed to Skyrim-relevant file types (`.esm` and `.pex`) |
| *CFG Editor* | 🔄 In Progress | `GET/POST /api/admin/cfg/server-settings` plus load/format/save UI is implemented; structured Access/Discord forms now include client-side validation (mode-dependent requirements, Discord ID format checks); respawn control (`canRespawn` property) and spawn configuration (`startSpawn`, `starterInventory`) are now editable server-settings; scoped write policies remain planned |
| *Locale Routing* | ✅ Done (Config + API) | `server-settings.json` supports `localeRouting.defaultLanguage` + `localeRouting.countryCodeToLanguage`; clean-build defaults are generated by CMake; resolver endpoint `GET /api/admin/locale/resolve` is available |
| *Player Management Extensions* | ✅ Done | Kick with optional reason; ban/unban (permanent or timed with duration select + countdown badge + `data/admin-bans.json` persistence); mute/unmute with duration (`POST/DELETE /api/admin/players/:id/mute`), countdown badges, `data/admin-mutes.json` persistence; send-message-to-player; optional moderation reason for all actions; richer workflows (warn, cross-session audit) remain planned |
| *Respawn & Revival Configuration* | ✅ Done | `canRespawn` property binding enables healer/doctor revival mechanics; server-side state tracking via `trackedRespawnStates`; backend routes: `GET /api/admin/respawn-status`, `POST /api/admin/revive`, `GET /api/admin/events`; frontend `RespawnPanel` shows downed player list with downtime countdown, canRespawn indicator, and manual revive action; `EventsPanel` shows revival event log with type filter (downed/revived/respawn_disabled/respawn_enabled/auto_revived), page-size select, and auto-refresh; all locale strings present in en/de/ru; `canManageRespawn` capability integrated in role model |
| *Console Panel* | 🔄 In Progress | Command input, result/error feedback, clear-output action, reset-to-defaults action, and client-side command history are implemented via `/api/admin/console`; dashboard tab/filter/search/history preferences now persist locally, while richer audit features are still pending |
| *Event Log* | 🔄 In Progress | Type filter, page size, time-window filter, and older/recent pagination are implemented via `/api/admin/logs`; richer audit fields pending |
| *User Permissions* | 🔄 In Progress | Role capability model (`admin/moderator/viewer`) is exposed via `/api/admin/capabilities`, enforced server-side on sensitive admin endpoints, and displayed in dashboard UI; full RBAC policy editor/audit model is still pending |
| *Search & Filter* | ✅ Done (Basic) | Player search by id/name/ip and log type filters are implemented |
| **TODO:** | **Planned features.** | |
| *Configuration UI* | 🔄 In Progress | Basic `server-settings.json` editor (load/format/save) is live in Admin; restart-required hints are shown; structured forms and scoped write rules are planned |
| *Network Graph* | 📋 Planned | Real-time ping visualization, bandwidth monitoring |
| *User Permissions* | 📋 Planned (Extended) | Full role-based access control (admin, moderator, viewer), policy editor, and audit integration |
| *Settings Panel* | 📋 Planned | Language/timezone, notification preferences, theme |
| *WebSocket Updates* | 📋 Planned | Real-time dashboard updates via WebSocket |
| *Search & Filter* | 📋 Planned (Extended) | Advanced stat queries, saved filters, and cross-panel quick search |

## Launcher Application

| Component | Status | Details |
| --- | --- | --- |
| **DONE:** | **Fully implemented and tested.** | |
| *Server Browser UI* | ✅ Done | Table view with server name, IP, players, ping, version |
| *Server Details* | ✅ Done | Description and selected server detail panel |
| *Direct Connect* | ✅ Done | Connect by IP + port with client-side validation |
| *Status Indicators* | ✅ Done | Online/offline dot, full-server player highlighting, ping quality colors |
| *Favorites System* | ✅ Done | Mark/unmark servers with persisted local favorites filter |
| *Server Filters* | ✅ Done (Basic) | Search, full-server toggle, favorites toggle, and tag filters are implemented |
| *Auto-Connect* | ✅ Done (Basic) | Last server memory and optional auto-connect on launcher open are implemented |
| *Account Settings* | ✅ Done (Launcher Preferences) | Launcher stores theme, API endpoint, favorites, cache, and last-server preferences locally |
| **TODO:** | **Planned features.** | |
| *Player Stats Display* | 📋 Planned | Character progression, playtime, achievements |
| *Notifications* | 📋 Planned | Server updates, friend invites, patch notes |
| *Update Checker* | 🔄 In Progress | Version mismatch warning and release-channel-aware latest-version banner (stable/beta/nightly + optional download URL + changelog preview/release-notes link + per-channel "ignore this version" persistence + reset ignored version action) are implemented; full in-launcher auto-update flow still pending |

## Known Issues & Improvements

| Issue | Priority | Description |
| --- | --- | --- |
| npm peer dependency warnings | Low | Some deprecation warnings during install; consider updating packages |
| TypeScript 6 compatibility | Done | Frontend baseline is stable and plugin-example tsconfig has been modernized (`target/moduleResolution` updates + `ignoreDeprecations: "6.0"`) |
| Bundle size optimization | Medium | Implement code splitting and lazy loading for better performance |
| Missing error boundaries | High | Add React Error Boundaries for graceful error handling |
| Inconsistent loading states | Medium | Standardize spinner/skeleton loaders across all async views |
| Lack of input validation | Medium | Basic client-side validation is now active for Admin CFG Access/Discord fields (required values and Discord ID format checks); extend the same guardrails to remaining admin forms |
| No rate limiting UI feedback | Medium | Show rate limit messages when API calls are throttled |
| npm install blocker for new test libs | Medium | `npm install` currently fails with `Invalid Version`; unblock dependency tree before adding RTL/Vitest |
| Dependency tree corruption (lint) | High | `npm run lint` fails due missing transitive packages (e.g., `fast-glob`) in current `node_modules` state |
| Dependency tree corruption (build) | High | `npm run build` fails due missing transitive packages (e.g., `caniuse-lite/dist/unpacker/browsers`) |
| Lockfile integrity mismatch | High | `npm ci` and `yarn install --frozen-lockfile` fail with `Invalid Version` / `invalid package version undefined`; lock/dependency graph needs cleanup |
| Webpack config bootstrap file | Done | Added `skymp5-front/config.js` with default `outputPath: './dist'` so local webpack config can resolve |

## Architecture Notes

### Technology Stack
- **React 18** - UI framework with functional components and hooks
- **TypeScript 5.9.x** - Type safety and developer experience
- **Webpack** - Module bundler with HMR support
- **i18next** - Internationalization library
- **React-i18next** - React integration for i18n
- **SCSS** - Styling with nesting and variables
- **Koa** - Backend server for admin API

### Project Structure
```
skymp5-front/
├── src/
│   ├── components/        # Reusable UI components
│   ├── features/          # Feature modules (dashboard, launcher, skills)
│   ├── interfaces/        # TypeScript interfaces
│   ├── locales/           # i18n translation files (en/ru/de)
│   ├── services/          # API calls, utilities
│   ├── App.js             # Main app component
│   └── index.tsx          # Entry point
├── scripts/               # Build and automation scripts
├── public/                # Static assets
├── package.json
└── tsconfig.json
```

### Performance Targets
- Initial load time: < 2s (with network throttling)
- Time to interactive: < 3s
- Bundle size: < 500KB (gzipped)
- Lighthouse score: > 80 across all categories

## Dependencies

### Production
- react@^18.0.0
- react-i18next@^15.0.0
- i18next@^23.0.0
- typescript@^5.0.0

### Development
- webpack@^5.0.0
- typescript@^5.9.3
- eslint@^8.0.0

See `skymp5-front/package.json` for complete dependency list.

## Next Steps

1. **Week 1-2**: Repair dependency graph and lockfile integrity until clean-clone `npm ci`, `npm run lint`, and `npm run build` are green
2. **Week 2-3**: Close admin moderation workflow gaps (warn flow and cross-panel quick search) with audit log consistency
3. **Week 3-4**: Expand admin resources/config track (resource actions, locale-routing form UX, guarded save policies) and add E2E scenarios
4. **Week 4-5**: Complete mobile and accessibility pass for launcher/admin critical paths and add automated a11y checks
5. **Week 5-6**: Implement build optimization track (code splitting/lazy loading) and baseline bundle monitoring
6. **Week 6+**: CI/CD hardening and release process automation (artifacts, changelog discipline, deployment gates)

## Contributing

Contributions to the frontend are welcome! Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup instructions
- Code style guidelines
- Testing requirements
- TypeScript best practices
- Localization guidelines
