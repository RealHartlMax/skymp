# FiveM-Inspired Roadmap for SkyMP

This roadmap translates key architectural concepts and best practices from FiveM (citizenfx/fivem) into actionable tasks for SkyMP, focusing on stability, performance, player synchronization, and resource/mod download automation.

---

## ✅ Completed & Implemented Patterns

### Property Binding Architecture
- **Implementation:** `canRespawn` property binding system for custom server-side control
- **Pattern:** Read-write property bindings exposed via `mp.set()`/`mp.get()` from TypeScript
- **Benefit:** Clean separation of concerns; enables advanced game mechanics (healer revival systems) without C++ monoliths
- **Lesson:** FiveM-style flexible property systems enable complex gameplay without architectural bloat
- **Related Files:** CanRespawnBinding.h/cpp, IsDeadBinding.cpp, SpawnDelayBinding.cpp (reference architecture)

### Configuration-Driven Gameplay  
- **Implementation:** `startSpawn`, `starterInventory` configurable via server-settings.json
- **Pattern:** Settings interface → CMake generation → Runtime property binding
- **Benefit:** Non-technical server admins can customize spawn points and starter gear without code changes
- **Related Files:** settings.ts, spawn.ts, generate_server_settings.cmake

### Startup Process Hardening
- **Implementation:** Windows launchers now auto-terminate stale `dist_back/skymp5-server.js` processes before startup
- **Pattern:** Supervisor-like preflight process cleanup in launcher scripts
- **Benefit:** Avoids startup collisions and peer init failures caused by orphaned background node instances
- **Related Files:** `skymp5-server/CMakeLists.txt`, `build/dist/server/launch_server.bat`

---

## 1. Resource Diagnostics & Validation Endpoint
**Goal:** Add a diagnostics endpoint (CLI or admin dashboard) to validate resource integrity, manifest correctness, and missing/corrupt files for both server and client.
- **Effort:** Medium
- **Risk:** Low (isolated, non-intrusive)
- **Affected Files:** skymp5-server, admin dashboard, manifestGen.ts, dataDir scripts

---

## 2. State Bag System (Key-Value Sync)
**Goal:** Implement a lightweight, extensible state bag system for per-entity, per-player, and global key-value sync, inspired by FiveM’s state bags. Enables efficient, granular sync and reduces heavy entity replication.
- **Effort:** High
- **Risk:** Medium-High (core sync changes)
- **Affected Files:** skymp5-server, skymp5-client, entity sync modules

---

## 3. Resource Manifest & Dependency System
**Goal:** Refactor resource manifest to support explicit dependencies, versioning, and integrity checks. Enables robust resource management and future auto-download.
- **Effort:** Medium
- **Risk:** Medium (touches resource loading)
- **Affected Files:** manifestGen.ts, dataDir, resource loader scripts

---

## 4. Resource Auto-Download & Caching
**Goal:** Implement server-driven resource/mod auto-download and client-side caching, similar to FiveM’s resource system. Players receive required mods/assets automatically.
- **Effort:** High
- **Risk:** High (security, bandwidth, UX)
- **Affected Files:** skymp5-client, skymp5-server, resource loader, dataDir

---

## 5. Entity Relevancy & Ownership Migration
**Goal:** Introduce entity relevancy/culling and explicit ownership migration for efficient network sync and server authority, inspired by FiveM’s entity scoping and migration.
- **Effort:** High
- **Risk:** High (core sync/ownership logic)
- **Affected Files:** skymp5-server, skymp5-client, entity sync modules

---

## Prioritization & Next Steps
1. Start with Resource Diagnostics (low risk, high visibility)
2. Prepare design docs for State Bag and Resource Manifest refactor
3. Prototype Resource Auto-Download in a feature branch
4. Plan for incremental rollout of Entity Relevancy/Ownership

---

*This roadmap is based on a deep analysis of FiveM’s architecture and tailored to SkyMP’s current pain points and future goals. Each task can be further broken down into subtasks as needed.*
