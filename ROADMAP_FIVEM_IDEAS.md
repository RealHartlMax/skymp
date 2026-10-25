# FiveM-Inspired Roadmap for SkyMP

This roadmap translates key architectural concepts and best practices from FiveM (citizenfx/fivem) into actionable tasks for SkyMP, focusing on stability, performance, player synchronization, and resource/mod download automation.

Status checked **22 October 2026**. See [current project status](docs/docs_project_status.md)
for implementation/test evidence. Pre-game file synchronization is implemented in
the separate desktop launcher; actual Skyrim/CEF/gameplay acceptance remains open.

---

## Completed & Implemented Patterns

### Property Binding Architecture

- **Implementation:** `canRespawn` property binding system for custom server-side control
- **Pattern:** Read-write property bindings exposed via `mp.set()`/`mp.get()` from TypeScript
- **Benefit:** Clean separation of concerns; enables advanced game mechanics (healer revival systems) without C++ monoliths
- **Lesson:** FiveM-style flexible property systems enable complex gameplay without architectural bloat
- **Related Files:** CanRespawnBinding.h/cpp, IsDeadBinding.cpp, SpawnDelayBinding.cpp (reference architecture)

### Configuration-Driven Gameplay

- **Implementation:** `startSpawn`, `starterInventory` configurable via server-settings.json
- **Pattern:** Settings interface -> CMake generation -> Runtime property binding
- **Benefit:** Non-technical server admins can customize spawn points and starter gear without code changes
- **Related Files:** settings.ts, spawn.ts, generate_server_settings.cmake

### Startup Process Hardening

- **Implementation:** Windows launchers now auto-terminate stale `dist_back/skymp5-server.js` processes before startup
- **Pattern:** Supervisor-like preflight process cleanup in launcher scripts
- **Benefit:** Avoids startup collisions and peer init failures caused by orphaned background node instances
- **Related Files:** `skymp5-server/CMakeLists.txt`, `build/dist/server/launch_server.bat`

### Independent Web Administration (r3)

- **Implementation:** Packaged starters own separate dashboard and game processes.
- **Behavior:** Game stop/restart/crash preserves the complete dashboard, settings, logs, launcher downloads, authentication and WebSocket connections. The dashboard can start the game again.
- **Boundary:** Live player actions require a running game. Whole-service termination still ends both owned processes. Public ports remain UDP 7777 plus one HTTP(S) TCP listener.
- **Evidence:** `misc/tests/test_dashboard_runtime.cjs`, platform package reports and the visible-browser report in the r3 release.

---

## 1. Resource Distribution API (Phase 1 - Done)

**Goal:** Public HTTP endpoints so clients can fetch the server's resource manifest and download individual files, forming the foundation for FiveM-style auto-download.

- **Status:** Done. Current `GET /api/launcher/manifest` and `GET|HEAD /api/launcher/files/:id` are implemented in `launcherResources.ts` and registered by `ui.ts`. The flat v1 endpoints remain for older launchers.
- **Manifest:** Full destination paths, sizes, SHA-256, total size, revision, load order, local game requirements and optional runtime source.
- **Download:** Opaque IDs, streaming, ETag, hash/size headers and single byte ranges.
- **Publication:** Explicit `client-resources/Data/` plus custom server plugins/archives. Private files, Bethesda masters, runtime code and unsafe paths are excluded from mod publication.
- **See:** [current mod packages](docs/docs_launcher_modpacks.md) and [legacy v1 API](docs/docs_resource_auto_download.md).

---

## 2. Resource Diagnostics & Validation Panel

**Goal:** Wire the manifest data into the admin dashboard with a dedicated panel: show per-resource hash, size, kind; highlight missing or corrupt files; allow manual refresh.

- **Status:** Partial. The resource inventory and refresh exist. A complete publication-specific missing/corrupt/hash diagnostics panel is still open; the public API's validation errors do not replace that UI.

- **Effort:** Medium
- **Risk:** Low (isolated, non-intrusive)
- **Affected Files:** skymp5-front admin dashboard, `ui.ts`

---

## 3. Launcher Resource Sync (Phase 2 — Done for preparation)

**Implemented:** Before SKSE starts, the standalone launcher fetches v2, checks
sizes/SHA-256/local game files, downloads changed resources into a per-server
cache and installs complete packages with original-file backup and restoration.
Nested textures, meshes, scripts and other assets retain their paths. A failed
publication or download prevents activation/start. Runtime catalogs can supply
the matching client/SKSE/Address Library package.

- **Code:** `skymp-client-launcher/launcher/src-tauri/src/connection.rs` and `runtime_version.rs`.
- **Evidence:** 25 current Rust tests, six runtime-publishing checks, and the existing real Node/Rust install/cache/repair/update/restore contract test.
- **Remaining:** Actual Skyrim/CEF/world-entry acceptance, partial-file resume and configurable retry/backoff. No in-game mod installer is required for this phase.

---

## 4. Resource Manifest & Dependency System (Phase 3)

**Goal:** Extend the manifest with explicit dependency declarations, semantic versioning, and load-order constraints. Enables operators to declare `"requires": ["Skyrim.esm"]` style rules.

- **Status:** Partial. Explicit load order, local base-game checks, content revisions and package validation are implemented. Dependency graphs, mod semantic-version constraints and automatic dependency resolution remain open.

- **Effort:** Medium
- **Risk:** Medium (touches resource loading)
- **Affected Files:** `launcherResources.ts`, `data/manifest.json`, launcher `connection.rs`; future dependency resolver

---

## 5. State Bag System (Key-Value Sync)

**Goal:** Implement a lightweight, extensible state bag system for per-entity, per-player, and global key-value sync, inspired by FiveM's state bags. Enables efficient, granular sync and reduces heavy entity replication.

- **Effort:** High
- **Risk:** Medium-High (core sync changes)
- **Affected Files:** skymp5-server, skymp5-client, entity sync modules

---

## 6. Entity Relevancy & Ownership Migration

**Goal:** Introduce entity relevancy/culling and explicit ownership migration for efficient network sync and server authority, inspired by FiveM's entity scoping and migration.

- **Effort:** High
- **Risk:** High (core sync/ownership logic)
- **Affected Files:** skymp5-server, skymp5-client, entity sync modules

---

## Prioritization & Next Steps

1. **Done:** Phase 1 API and Phase 2 launcher preparation/installation.
2. **Next acceptance:** Compatible native client, actual Skyrim/CEF connection and operator-hosted package on the VPS.
3. **Open:** Complete resource-diagnostics UI, resumable downloads and cache eviction.
4. **Phase 3 partial:** Keep published load order; add dependency/version declarations and a resolver.
5. **Later:** State Bags and additional entity relevancy/ownership improvements.

---

_This roadmap is based on a deep analysis of FiveM's architecture and tailored to SkyMP's current pain points and future goals. Each task can be further broken down into subtasks as needed._
