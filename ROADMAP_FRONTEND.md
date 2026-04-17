# Frontend & Infrastructure Roadmap

This roadmap tracks the development of the admin dashboard, launcher UI, testing infrastructure, and frontend tooling for the Skyrim Multiplayer project.

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
| *Admin Dashboard Features* | 🔄 In Progress | Tabs (overview/players/console/logs/metrics), player search, ban/unban, mute/unmute with countdown badges, send-message-to-player flow, console command sender, clear console output, filtered activity log, and ban/mute file persistence are implemented; richer moderation workflows (kick+reason, timed ban) still pending |
| *Dev Server Setup* | 🔄 In Progress | Webpack DevServer binds to all interfaces, proxies `/api`, supports browser/LAN usage, documents dev-only overlay entry points via `?devUi=1`, and now shows an in-browser dev mode indicator banner |
| *Launcher Features* | 🔄 In Progress | Favorites, tag filters, auto-connect last server, API endpoint override, source status, cached/demo offline fallback, direct connect validation, launcher theme toggle, and selected-server version mismatch warning are implemented |
| *E2E Testing* | 🔄 In Progress | Playwright flow script now covers launcher server selection and admin metrics with mocked APIs and passes against the webpack dev server in browser-only `?devUi=1` mode |
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
| *Backend Routes* | ✅ Done | `/admin`, `/api/admin/status`, `/api/admin/players`, kick/ban/unban, `POST/DELETE /api/admin/players/:id/mute`, `GET /api/admin/mutes`, `POST /api/admin/players/:id/message`, console command endpoint, and logs endpoint; file-persisted ban/mute lists, language support |
| *Dashboard Layout* | ✅ Done | Main overlay with stats cards, tab navigation, and dedicated panels for overview/players/console/logs |
| *Server Stats Panel* | ✅ Done | Online players, max players, uptime, tick counters, API status |
| *Player List View* | ✅ Done | Live player table with id/name/level/location and selection state |
| *Player Management* | ✅ Done (Kick) | Kick action integrated (`POST /api/admin/players/:id/kick`) |
| **IN PROGRESS:** | **Currently being worked on.** | |
| *Advanced Admin Panels* | 🔄 In Progress | Console, deep configuration editor, richer telemetry and moderation tools; frontend metrics tab is now included |
| *Player Management Extensions* | ✅ Done | Ban/unban, mute/unmute with duration (`POST/DELETE /api/admin/players/:id/mute`), muted-player countdown badges in the table, send-message-to-player (`POST /api/admin/players/:id/message`), optional moderation reason for audit logs, and file-persisted ban/mute lists (`data/admin-bans.json` + `data/admin-mutes.json`) are all implemented; richer moderation workflows (kick+reason, timed ban) remain planned |
| *Console Panel* | 🔄 In Progress | Command input, result/error feedback, clear-output action, reset-to-defaults action, and client-side command history are implemented via `/api/admin/console`; dashboard tab/filter/search/history preferences now persist locally, while richer audit features are still pending |
| *Event Log* | 🔄 In Progress | Type filter, page size, time-window filter, and older/recent pagination are implemented via `/api/admin/logs`; richer audit fields pending |
| *User Permissions* | 🔄 In Progress | Role capability model (`admin/moderator/viewer`) is exposed via `/api/admin/capabilities`, enforced server-side on sensitive admin endpoints, and displayed in dashboard UI; full RBAC policy editor/audit model is still pending |
| *Search & Filter* | ✅ Done (Basic) | Player search by id/name/ip and log type filters are implemented |
| **TODO:** | **Planned features.** | |
| *Configuration UI* | 📋 Planned | Server settings editor, save/reload functionality |
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
| *Update Checker* | 🔄 In Progress | Version mismatch warning is shown in launcher server details; full auto-update and release-channel flow still pending |

## Known Issues & Improvements

| Issue | Priority | Description |
| --- | --- | --- |
| npm peer dependency warnings | Low | Some deprecation warnings during install; consider updating packages |
| TypeScript 6 compatibility | Done | Current TypeScript 5.9 baseline runs with `ignoreDeprecations: "5.0"`; no active frontend blocker remains here |
| Bundle size optimization | Medium | Implement code splitting and lazy loading for better performance |
| Missing error boundaries | High | Add React Error Boundaries for graceful error handling |
| Inconsistent loading states | Medium | Standardize spinner/skeleton loaders across all async views |
| Lack of input validation | High | Validate user inputs on admin forms before submission |
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

1. **Week 1-2**: Keep expanding unit tests and unblock dependency installation for component-test framework setup
2. **Week 2-3**: Expand admin features (ban/message, console panel, configuration UI)
3. **Week 3-4**: Expand launcher features (favorites, advanced filters, auto-connect)
4. **Week 4-5**: E2E coverage for login/server/admin workflows
5. **Week 5-6**: Performance optimization, code splitting, and CI hardening
6. **Week 6+**: Accessibility audit, mobile polish, and deployment stabilization

## Contributing

Contributions to the frontend are welcome! Please refer to [CONTRIBUTING.md](CONTRIBUTING.md) for:
- Development setup instructions
- Code style guidelines
- Testing requirements
- TypeScript best practices
- Localization guidelines
