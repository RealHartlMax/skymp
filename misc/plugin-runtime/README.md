# Plugin Runtime API 1

[Deutsche Anleitung](README.de.md)

The central SkyrimPlatform runtime contains the generic native module loader and the CEF host. A plugin owns its client code, UI templates, CSS and public assets. Updating such a plugin does not require rebuilding the launcher EXE or the central client runtime while API 1 remains compatible. Installing this bootstrap and the launcher downloader once is required before using these packages.

## Plugin layout and activation

```text
Plugins/SkyMPChat/
  plugin.json                 # runtime: "Runtime/manifest.json"
  index.cjs                   # private server entry
  config.json                 # private server configuration
  Runtime/
    manifest.json
    client.js                 # optional native JS module
    ui.js                     # optional CEF module
    ui.css                    # optional stylesheet
    assets/...
```

Server-only plugins omit `runtime`. UI-Core consumers such as Metabolism register widgets and menus with UI-Core; they do not ship a second host or browser. Chat, UI-Core and YACA own their runtime packages. Native DLLs remain part of the centrally distributed, Skyrim-version-specific base runtime.

Only plugins which successfully started in the current game-server boot are advertised. The next-start dashboard selection is deliberately separate. Install or disable a plugin and restart the game server to change this selection. Process plugins are removed from publication when they exit. Source/manifest/files must be deployed together; changed deployed files require a restart. Dashboard/backend changes require their own service restart.

## Publication and download

The public launcher manifest uses version `3` when plugin packages are required; older launchers fail with their existing unsupported-version error. Servers without a runtime package retain version `2` compatibility. The `pluginRuntime` member contains `{version:1,revision,packages:[...]}`. Each package advertises plugin ID, version, raw manifest SHA-256, manifest size and its hash-addressed manifest URL.

An old server which omits `pluginRuntime` retains the frozen legacy Chat/UI-Core bridges. The launcher records `plugin-runtime-managed:false` for that case. An upgraded server advertises an explicit package set, including an empty set; only that set supplies plugin UI and the legacy hosts are unmounted. Thus removing Chat/UI-Core from an upgraded server cannot accidentally reactivate the legacy surface.

- `GET /api/launcher/plugin-runtime/manifest`: current aggregate advertisement.
- `GET /api/launcher/plugin-runtime/manifests/:sha256`: exact manifest bytes.
- `GET /api/launcher/plugin-runtime/files/:id`: an explicitly declared public file. ID is SHA-256 of `manifestSha256 + "\0" + file.path`.

The publisher never recursively exposes the plugin directory. Only declared files below `Runtime/` are downloadable; server bundles and configuration outside it have no download route. Symlinks, traversal, Windows device names, native binaries, case collisions and unsupported paths are rejected. Text is served as binary bytes to preserve its hash.

`contract.cjs` is the canonical producer/server/native validation contract. Each plugin includes a source copy of the producer SDK in `tools/plugin-runtime/`; keep those files identical when changing the protocol.

```json
{
  "formatVersion": 1,
  "pluginId": "skymp-chat",
  "version": "1.2.0",
  "requires": {"clientApi": 1, "uiApi": 1},
  "entrypoints": {"client": "client.js", "ui": "ui.js", "styles": ["ui.css"]},
  "files": [{"path": "client.js", "size": 123, "sha256": "64 lowercase hex characters"}],
  "signature": {"algorithm": "ed25519", "keyId": "publisher", "value": "128 lowercase hex characters"}
}
```

The example is abbreviated: every entrypoint and stylesheet must occur in the file list. Unknown manifest fields are rejected. Limits: 128 active packages, 256 files/package, 16 MiB/file, 64 MiB/package, 256 MiB active total, 256 KiB/manifest, 8 MiB/active index, 240 characters/complete installed relative path. Each `(pluginId, version)` has immutable manifest bytes, including its signature. Publish a new version when changing any byte or key. The launcher keeps a verified revision ledger and refuses a changed existing version.

## Publisher signing

The launcher and native loader require an Ed25519 signature over UTF-8 canonical JSON: object keys recursively sorted, array order preserved, no whitespace; omit the entire `signature` field. Sizes are nonnegative integers. All identifiers, paths and signature encodings are restricted by the contract. Package generation uses `createRuntimeManifest` with an explicit public file list. An unsigned developer candidate may be produced, but it cannot be used by the launcher or packed as a release.

Use the SDK in this directory, or the identical copy in a plugin project:

```powershell
# Once, outside the public plugin/runtime tree; keep the private file private.
node tools/plugin-runtime/package.cjs keygen --output C:/private/publisher.pem --key-id publisher
# The printed JSON maps publisher ID to its public key. Verify/distribute it independently.
$env:SKYMP_PLUGIN_SIGNING_KEY = 'C:/private/publisher.pem'
$env:SKYMP_PLUGIN_KEY_ID = 'publisher'
# On a later, explicitly requested build, the plugin's build tool signs its Runtime.
# Or sign an already built candidate without changing the file list:
node tools/plugin-runtime/package.cjs sign --root Runtime --private-key C:/private/publisher.pem --key-id publisher
```

Players enter the independently verified **public** key map in Launcher settings → Game → Trusted plugin publishers. Keys never come from a game server's advertisement. Unknown publishers, altered bytes, invalid signatures, incompatible APIs and changed immutable versions stop preparation before Skyrim starts. No persistent publisher keys or release packages were created by the source implementation task; automated tests use temporary disposable fixture keys only.

## Installation and server switching

The launcher downloads the version-specific base runtime first, requires its `pluginRuntimeApi:1` capability, then validates every signed plugin manifest and file. Plugin files live only in `Data/Platform/PluginRuntime/packages/<pluginId>/<manifestSha256>/`. A hash-pinned `active.json` binds the complete package set to the selected host and port. Its hash and the independent publisher pins are written to client settings through the existing reversible installation journal. These files use the same collision checks, backups and restore path as other launcher-managed resources. Download failure leaves installation unactivated. A server change replaces the package set and restores files through that journal; a direct in-game switch to another host is rejected until that server is prepared in the launcher.

The native loader rechecks the active index, signature and every file before evaluating any client module. `client.js` is a bundled CommonJS module exporting `apiVersion = 1` and `activate(api)`, which returns an optional synchronous disposer. Use injected `api.sp`, `api.controller` and `api.constants.CustomPacket`; do not import a second SkyrimPlatform instance. Native subscriptions, emitter listeners, focus ownership and registered disposers are removed on disconnect, failed activation or reload. Trusted native JS has the same authority as other SkyrimPlatform scripts; this is publisher verification, not a sandbox.

The CEF module is a self-contained script registering `window.SkyMPPluginRuntime.register({pluginId,apiVersion:1,mount(ctx)})`. `mount` receives an owned DOM root, asset resolver, React/store/i18n host, reducer registration, focus, event and disposal methods. It returns an optional synchronous disposer. Shared imports are React, ReactDOM, React Redux, React i18next, React Draggable and React Resizable; `require('skymp-plugin-host')` exposes the current context while the script loads. Use the existing CEF browser. Remove all extra sockets, timers and listeners in cleanup. CSS/assets and Redux keys are owned by the plugin, and no duplicate reducer owner is allowed. UI activation failure unloads the package set and stops the connection. Chat/UI-Core-specific gameplay messages remain on their existing validated server bridges.

YACA keeps its established EventSource/native TeamSpeak transport. Its production server bundle does not embed the UI in the native EventSource body: the signed downloaded UI owns that surface and disposes its socket and timers. This also avoids the EventSource's 100 KiB body limit as the UI grows. `dist/ui/overlay.js` remains a legacy tooling output; explicitly setting `SKYMP_YACA_LEGACY_OVERLAY=1` for a later build includes that fallback for legacy testing. The current production package requires the new bootstrap. Older already-published plugins remain compatible through the frozen legacy bridges.

## Acceptance before a release

Source tests and no-emit checks do not prove launcher installation, native Skyrim/CEF behavior or voice/audio. After the separately authorized builds: sign the plugin manifests, prepare one server, verify downloaded hashes, start Skyrim, exercise Chat/UI-Core/Metabolism/YACA, restart/reconnect, switch to a server with fewer/different/no plugins, verify cleanup/restoration, and reject a modified file, unknown publisher and reused changed version. Test supported Skyrim versions separately. Keep private server state and publisher keys out of release archives.
