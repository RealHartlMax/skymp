# Source validation on 2026-10-29

This source revision implements the generic Plugin Runtime Loader in the server, shared client/CEF and launcher, plus plugin-owned modules for Chat, UI-Core and YACA. Metabolism remains a UI-Core consumer. No application builds, ZIPs, commits, pushes or publications were performed.

## Checks performed

- `node --test misc/plugin-runtime/tests/*.test.cjs`: 24 tests, including real temporary filesystem/Ed25519 checks, inventory access to configured storage, offline/profile-switch protection, public file publication, native activation and cleanup with SkyrimPlatform event handles, Redux state removal, legacy/YACA behavior, publisher settings and the actual server plugin startup path through the updated verifier.
- `npm test` in `SkyMP-Chat`: 41 existing server source tests passed. This command does not invoke a build.
- `tsc --noEmit` in server, client, frontend, launcher renderer, UI-Core and YACA succeeded without output files.
- `node skymp5-front/scripts/test-locales.js`: the six locale files have matching keys.
- Browser validation of the actual generic CEF host source in Chromium passed installation, asset resolution, repeated revision, DOM/listener/reducer teardown, wrong module owner, script error after registration, mount failure, blocked interaction and managed mode. React/SkyrimPlatform were replaced by a test host; no frontend build was produced.
- JavaScript/JSX/TypeScript syntax checks and Rust parsing through `rustfmt --emit stdout` succeeded. Rust unit-test sources are prepared for Ed25519 compatibility with the JS producer, unknown publishers, changed signatures, immutable versions, paths and canonical JSON.

Consumer tests use neighboring plugin/launcher checkouts. Without this local workspace, they explicitly skip; standalone contract/server/loader tests remain executable.

## Pending a later authorized build

No Rust compilation or `cargo test` was performed because they produce build outputs. The new plugin modules, base runtime and launcher binaries have not yet been built. This task has not produced signed release manifests or permanent publisher keys.

After building, separately accept launcher download/installation/restore, actual Skyrim/CEF activation and server changes, supported Skyrim versions, TeamSpeak audio and visible lipsync. Older local release artifacts do not contain these source changes.

Contract and workflow: [German guide](../../../../../misc/plugin-runtime/README.de.md), [technical reference](../../../../../misc/plugin-runtime/README.md).
