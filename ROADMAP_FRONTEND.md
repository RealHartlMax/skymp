# Frontend & Infrastructure Roadmap

This roadmap tracks the development of the admin dashboard, launcher UI, testing infrastructure, and frontend tooling for the Skyrim Multiplayer project.

## Frontend Application Features

| Feature | Status | Details |
| --- | --- | --- |
| **DONE:** | **Fully implemented and tested.** | |
| *Localization (i18n)* | ✅ Done | i18next + react-i18next integrated; English, Russian, German locales; automated key consistency tests |
| *TypeScript Configuration* | ✅ Done | TypeScript-based frontend build is active; current baseline in skymp5-front is TypeScript 4.x |
| *Component Typing* | ✅ Done | SkillsMenu fully typed; Button interfaces fixed; proper React/JSX types |
| *Locale Testing* | ✅ Done | Automated locale key parity validation between en/ru/de |
| *Admin Dashboard UI* | ✅ Done | Overlay dashboard with polling status + player list, close action, kick action wired to backend |
| *Launcher Server List* | ✅ Done | Server browser UI with search/sort, details panel, direct connect, connect event dispatch |
| *Unit Tests Setup* | ✅ Done | Dependency-free Node + ts-node unit test runner integrated into npm test pipeline |
| **IN PROGRESS:** | **Currently being worked on.** | |
| **TODO:** | **Planned features.** | |
| *Dev Server Setup* | 📋 Planned | Webpack DevServer with HMR, dev proxy to backend, hot reload documentation |
| *Admin Dashboard Features* | 📋 Planned | Player management (kick/ban), server stats, log viewer, configuration UI, real-time updates |
| *Launcher Features* | 📋 Planned | Server filters, favorites, auto-connect, server status indicators, player progression display |
| *E2E Testing* | 📋 Planned | Playwright tests for login, server selection, admin workflows |
| *API Integration Tests* | 📋 Planned | Mock server for testing admin endpoints (/api/admin/*) |
| *Performance Monitoring* | 📋 Planned | Error tracking, performance metrics, user analytics |
| *Mobile Responsiveness* | 📋 Planned | Adapt dashboard/launcher for tablet/mobile devices |
| *Accessibility (a11y)* | 📋 Planned | WCAG 2.1 compliance, screen reader support, keyboard navigation |
| *Dark Mode* | 📋 Planned | Theme toggle, system preference detection |
| *Offline Mode* | 📋 Planned | Cache server data, work offline, sync on reconnect |

## Testing Infrastructure

| Feature | Status | Details |
| --- | --- | --- |
| **DONE:** | **Fully implemented and tested.** | |
| *Locale Consistency Tests* | ✅ Done | Node.js script validates key structure across locale files |
| *Unit Test Framework* | ✅ Done | Node.js + ts-node based unit test setup in `scripts/test-unit.js` |
| *First Unit Tests* | ✅ Done | Utility tests for server list, i18n language detection, and FrameButton click/class behavior |
| **IN PROGRESS:** | **Currently being worked on.** | |
| *Component Tests* | 🔄 Planning | Add React Testing Library tests for core components after resolving npm dependency install blocker |
| **TODO:** | **Planned features.** | |
| *Integration Tests* | 📋 Planned | Test component composition, context providers, state management |
| *Snapshot Tests* | 📋 Planned | Detect unintended UI changes |
| *Coverage Reporting* | 📋 Planned | Minimum 70% coverage; CI integration |
| *E2E Tests (Playwright)* | 📋 Planned | Login flow, server selection, admin workflows |
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
| *Installer Pipeline Integration* | 🔄 In Progress | Main branch pushes trigger installer repository dispatch; installer binary is built in external/private installer repo |
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
| *Backend Routes* | ✅ Done | `/admin`, `/api/admin/status`, `/api/admin/players`, kick endpoint; language support |
| *Dashboard Layout* | ✅ Done | Main overlay frame with sections for stats and player management |
| *Server Stats Panel* | ✅ Done | Online players, max players, uptime, tick counters, API status |
| *Player List View* | ✅ Done | Live player table with id/name/level/location and selection state |
| *Player Management* | ✅ Done (Kick) | Kick action integrated (`POST /api/admin/players/:id/kick`) |
| **IN PROGRESS:** | **Currently being worked on.** | |
| *Advanced Admin Panels* | 🔄 Planning | Console, deep configuration editor, richer telemetry and moderation tools |
| **TODO:** | **Planned features.** | |
| *Player Management Extensions* | 📋 Planned | Ban/unban and send-message dialogs |
| *Console Panel* | 📋 Planned | Live command execution, log viewer, syntax highlighting |
| *Configuration UI* | 📋 Planned | Server settings editor, save/reload functionality |
| *Network Graph* | 📋 Planned | Real-time ping visualization, bandwidth monitoring |
| *Event Log* | 📋 Planned | Login/logout history, actions, errors with filtering |
| *User Permissions* | 📋 Planned | Role-based access control (admin, moderator, viewer) |
| *Settings Panel* | 📋 Planned | Language/timezone, notification preferences, theme |
| *WebSocket Updates* | 📋 Planned | Real-time dashboard updates via WebSocket |
| *Search & Filter* | 📋 Planned | Quick player search, log filtering, stat queries |

## Launcher Application

| Component | Status | Details |
| --- | --- | --- |
| **DONE:** | **Fully implemented and tested.** | |
| *Server Browser UI* | ✅ Done | Table view with server name, IP, players, ping, version |
| *Server Details* | ✅ Done | Description and selected server detail panel |
| *Direct Connect* | ✅ Done | Connect by IP + port with client-side validation |
| *Status Indicators* | ✅ Done | Online/offline dot, full-server player highlighting, ping quality colors |
| **TODO:** | **Planned features.** | |
| *Favorites System* | 📋 Planned | Mark/unmark servers, quick access |
| *Server Filters* | 📋 Planned | By region, player count, version, tags |
| *Auto-Connect* | 📋 Planned | Last server memory, auto-join on launch |
| *Player Stats Display* | 📋 Planned | Character progression, playtime, achievements |
| *Account Settings* | 📋 Planned | Credentials, characters, preferences |
| *Notifications* | 📋 Planned | Server updates, friend invites, patch notes |
| *Update Checker* | 📋 Planned | Auto-update launcher, version mismatch warnings |

## Known Issues & Improvements

| Issue | Priority | Description |
| --- | --- | --- |
| npm peer dependency warnings | Low | Some deprecation warnings during install; consider updating packages |
| TypeScript 6 compatibility | Done | All deprecation warnings silenced with `ignoreDeprecations: "6.0"` |
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
- **TypeScript 4.x** - Type safety and developer experience
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
- typescript@^4.6.3
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
