[Deutsch](../../de/docs/docs_chat_integration.md) · [English](docs_chat_integration.md) · [Русский](../../ru/docs/docs_chat_integration.md)

<a id="skymp-chat-client-anbindung-und-runtime-auslieferung"></a>

# SkyMP Chat: client integration and runtime delivery

If Chat and YACA load on the server but Enter/F8 shows nothing in game: [runtime comparison and proven client defects](docs_plugin_ui_troubleshooting.md).

<a id="aktueller-architekturstand-plugin-runtime-api-1"></a>

## Current architecture: Plugin Runtime API 1

Since source preparation on **29 October 2026**, the separate `SkyMP-Chat` repository owns its client/CEF sources and tools producing `Plugins/SkyMPChat/Runtime/`. Core retains the shared client bootstrap, generic runtime loader and CEF host. The launcher downloads/verifies signed plugin runtimes advertised by the active game server. After this one-time bootstrap update, compatible Chat changes do not require rebuilding the launcher EXE.

The authoritative contract, layout, signatures, activation and download limits are in the [plugin runtime guide](docs_plugin_runtime.md) and [Runtime API 1](../../../../misc/plugin-runtime/README.md). Native DLLs remain in the central Skyrim-specific base runtime. This migration is source preparation; this task creates no new release packages or published downloads.

<a id="historische-bootstrap-auslieferung-vom-2728-oktober-2026"></a>

## Historical bootstrap delivery, 27–28 October 2026

The following sections describe the previous shared integration and packages verified then. Its client/CEF sources and build tools lived in Core; completed delivery packages lived under `local-builds/` in `D:\GitHub\skymp-client-launcher`. These historical commands/results document that bootstrap baseline and do not replace the new runtime contract.

<a id="aufbau"></a>

## Structure

- `skymp5-client/src/services/services/chatBridge.ts`: existing reliable CustomPackets ↔ existing SkyrimPlatform browser. BrowserService manages Enter/Escape/F6/F2 and menu locks; KeyboardEventsService detects key edges.
- `skymp5-front/src/features/chat/bridge.js`, `reducer/`, `constructorComponents/chat/`: shared Redux chat, text, input focus, bounded history and plugin status; no second chat webpage.
- `skymp5-front/scripts/build.cjs`: local production build with existing Webpack rules and gzip budget. `assets-manifest.json` lists only built assets, avoiding publication of stale `dist` files.
- `skymp5-front/CMakeLists.txt`: `BUILD_FRONT=ON` builds local sources into `build/dist/client/Data/Platform/UI`; no upstream download/frontend PAT.
- `misc/deploy/package_client_runtime.cjs`: complete runtime from a matching hash-verified base plus current client/CEF builds. Catalog v2, runtime manifest v1 and ZIP remain compatible with the existing launcher; launcher source is unchanged.

Active SkyMP Chat uses the repaired existing chat. An explicit widget callback from an older gamemode remains as a legacy fallback when Chat is absent. Fully exclusive plugin mode was not part of that repository split.

<a id="anzeige-und-serverregeln-ab-skymp-chat-11"></a>

## Display and server rules from SkyMP Chat 1.1

Settings live exclusively in `Plugins/SkyMPChat/config.json` in the separate Chat repository. The existing client bridge passes them to Redux in the API-v1 handshake. The server controls routing and commands-only rules.

```json
{
  "hideAfterSeconds": 15,
  "showOnMessage": true,
  "showJoinMessages": true,
  "commandsOnly": false,
  "chatMode": "global",
  "proximityRadiusMeters": 30
}
```

- Enter/F6 opens input; no hide timer while open. After Escape/F6/menu opening, only the chat HUD hides after 15 seconds, preserving other CEF surfaces/browser visibility, draft/history. Repeated close does not extend the deadline.
- `showOnMessage: true` briefly displays new messages and restarts the timer without taking focus; `false` retains them in history and shows HUD only by keyboard. `hideAfterSeconds`: integer 1–300.
- `chatMode`: `global`, `cell` (same interior cell/exterior grid in same world), or `proximity` (3D metre radius in same world/interior). Nearby exterior grids are allowed within radius. Missing spatial data never falls back globally; no line-of-sight test.
- `commandsOnly: true` blocks ordinary text, slash escape, all broadcasts and private player/system API messages. Private command/error replies, `/help` and registered external commands remain; no new permissions.
- `showJoinMessages: true` emits one global system message with server name after first authenticated Chat readiness, not on UI reload. `false` disables it. Commands-only always suppresses it.

Restart the full game server after configuration changes. New display options require the new frontend and a Skyrim restart. The existing adapter needs no new native DLL. Older API-v1 servers without display data default to 15 seconds, show-on-message and ordinary chat.

<a id="build-und-tests"></a>

## Build and tests

PowerShell in fork `D:\GitHub\skymp`:

```powershell
npm --prefix skymp5-client run build
npm --prefix skymp5-front run build
npm --prefix skymp5-client run test:chat
npm --prefix skymp5-front test
node --test misc/tests/test_client_runtime_package.cjs
node misc/tests/test_frontend_source_build.cjs
```

The CMake test configures an isolated project without frontend PAT and builds the actual frontend target. The Chat client test needs no plugin checkout. For optional browser interop, `skymp5-front/scripts/chat-browser-host.cjs` with `createHost({pluginRoot})` connects the built CEF and actual bundled plugin entry. Plugin path is explicit; Core contains no plugin copy.

<a id="neue-client-runtime-für-den-vps-vorbereiten"></a>

## Prepare a new client runtime for the VPS

Provide a complete Skyrim-matching base with `runtime-manifest.json`, already containing native client files, CEF dependencies, SKSE and matching Address Library. The packager builds no DLLs and proves no new native compatibility.

```powershell
node misc/deploy/package_client_runtime.cjs `
  --base build/reports/yaca-client-2026-10-27/client-runtime `
  --catalog build/client-delivery-2026-10-25-threadpool/client-runtime/catalog.json `
  --release client-2026-10-27-chat `
  --output build/client-delivery-2026-10-27-chat
pwsh -File misc/deploy/verify_client_runtime.ps1 `
  -PackageDirectory build/client-delivery-2026-10-27-chat
```

Paths reflect the actual local setup; other checkouts must explicitly supply their matching base/catalog. Existing output folders are rejected. Every base file is checked for declared size/SHA-256 before copying. Native files remain byte-identical; built client and CEF assets are replaced. Private settings, auth, logs, links and Bethesda game files are excluded.

Output:

```text
build/client-delivery-2026-10-27-chat/
  upload/client-runtime/
    catalog.json
    1.7.104.0/client-2026-10-27-chat/
      runtime-manifest.json
      Data/…
      skse64_loader.exe
      skse64_1_7_104.dll
  skymp-client-runtime-1.7.104.0-client-2026-10-27-chat.zip
  VALIDATION.json
  ZIP-VALIDATION.json
  SHA256SUMS
  README-UPLOAD.md
```

Catalog contains the new manifest SHA-256; manifest contains size/hash of every installed file. Other Skyrim versions in the input catalog are retained. Their existing VPS files are neither deleted nor replaced by the new ZIP.

<a id="upload-reihenfolge"></a>

### Upload order

1. Copy the **new version directory** from `upload/client-runtime/` into the existing VPS runtime webroot, e.g. the configured `…/client-runtime/`. Preserve old version directories.
2. Replace `client-runtime/catalog.json` only after complete upload. If live catalog changed, first use its additional versions as `--catalog` input and repackage locally.
3. Install the server plugin separately under `Plugins/SkyMPChat/` in the game working directory, discover/enable it in dashboard and restart the full game server; no VPS/PC reboot.
4. Players receive runtime through the existing launcher and restart Skyrim after file replacement.

Runtime ZIP belongs in the runtime webroot, not the game plugin folder. Uploading only the server plugin does not update client files.

<a id="prüfgrenzen"></a>

## Test limits

Packaging/HTTP delivery, hash/catalog chain, adapter, frontend and browser interop can be checked locally. Two Chromium contexts or native mock connections are not two Skyrim clients. Actual Skyrim/CEF focus, native keyboard suppression, Steam startup and two-player behaviour require manual smoke testing. Nothing was uploaded to a VPS.

Linux equivalent: same Node/npm commands with `/` paths and shell continuation `\`; ZIP creation needs the usual `zip` utility. This repository split was checked on Windows; Linux was not run.

<a id="geprüftes-lokales-paket-vom-28102026"></a>

## Verified local package, 28 October 2026

Run in the fork:

```powershell
node misc/deploy/package_client_runtime.cjs `
  --base build/client-delivery-2026-10-27-chat/upload/client-runtime/1.7.104.0/client-2026-10-27-chat `
  --catalog build/client-delivery-2026-10-27-chat/upload/client-runtime/catalog.json `
  --release client-2026-10-28-chat-1.1 `
  --output build/client-delivery-2026-10-28-chat-1.1
pwsh -NoProfile -File misc/deploy/verify_client_runtime.ps1 `
  -PackageDirectory build/client-delivery-2026-10-28-chat-1.1
```

PASS: 213 installed files, 38 binary text downloads, 73 unchanged native files; 253 ZIP entries checked separately with .NET. Existing client JavaScript is byte-identical; this extension requires new frontend/server plugin. Existing launcher validator `D:/GitHub/skymp-client-launcher/launcher/scripts/validate-runtime-package.mjs --root D:/GitHub/skymp/build/client-delivery-2026-10-28-chat-1.1/upload/client-runtime` also passed the complete catalog/manifest/file chain.

Transfer the entire new directory **including `payloads/`** in binary mode, catalog last. Preserve live versions and any other entries in a changed live catalog before publication. Nothing was uploaded or changed in a game installation. New display/range/join options still need manual Skyrim acceptance.

<a id="konfigurierbare-sprachdateien-ab-skymp-chat-12"></a>

## Configurable locales from SkyMP Chat 1.2

Server plugin `locale` selects `locales/de.json` or `locales/en.json`; custom files are possible. Groups `server`, `validation`, `ui` belong to the separate Chat repository. Missing files/keys of known languages use embedded defaults. Invalid JSON, unknown keys or placeholders fail startup.

The API-v1 handshake forwards `localization: {locale, ui}` through the client to Redux chat. Labels/time formatting use it without changing other menus’ global language. Disconnect/server switch clears old strings; older servers retain client fallback. Strings render as text.

Distribute the new frontend once. Later JSON/language changes require only a full game-server restart, no native DLL/launcher source changes. External plugins receive `ctx.locale`.

Verified 1.2 delivery: `D:/GitHub/skymp-client-launcher/local-builds/releases/v0.2.1/client-runtime-chat-1.2.0-2026-10-28`. Checked 213 installed files, 38 binary text downloads, 253 ZIP entries. Client JavaScript/all 73 native files remain identical to the stated 1.1 base; only frontend changes. Passed 41 plugin tests, 15 client tests, eleven existing browser groups and four locale groups. New locale/JSON features are not yet checked in Skyrim.

## Verified compatibility with console security

Checked on 31 October 2026 against the actual state of `SkyMP-Chat` (`Plugins/SkyMPChat/api.d.ts`, `src/registry.cjs`, `src/runtime.cjs`):

- Chat remains the only command registry. Other plugins register `/` commands through `globalThis.skympChat.registerCommand`. The core does not parse `/` commands.
- Native console commands (`MsgType.ConsoleCommand`, handshake `consoleSecurity:*`) and chat commands (CustomPackets `skympChat:*`) stay separate. `ConsoleSecurity::ValidateRequest` rejects `/` commands.
- Chat does not touch console commands and does not need `consoleCommandsService`. Console security changes no chat keys and no chat packets.
- The two systems have separate permission resolvers. An optional role bridge is described in [SkyMP Console Security](docs_console_security.md).
- The core works without the Chat plugin. The Chat repository needed no code change for console security.
