[Deutsch](../../de/docs/docs_plugin_ui_troubleshooting.md) · [English](docs_plugin_ui_troubleshooting.md) · [Русский](../../ru/docs/docs_plugin_ui_troubleshooting.md)

<a id="chat-und-yaca-geladen-aber-im-spiel-unsichtbar"></a>

# Chat and YACA loaded but invisible in game

Source/package comparison dated **27 October 2026**. The reported Linux server log shows successful loading of `skymp-chat` and `skymp-yaca-ts`. The investigated client has two concrete causes for the missing display; neither another Linux server build nor plugin-loader changes are needed for these causes.

<a id="nachgewiesener-unterschied"></a>

## Proven difference

The public server manifest advertises `https://update.skymp-worlds.net/client-runtime/catalog.json` as `runtimeSource`. At comparison time, this catalog still pointed to `1.7.104.0/client-2026-10-25-tintfix/runtime-manifest.json`. Its hashes exactly match the installed game files:

| File | Installed / advertised old SHA-256 | New Chat runtime SHA-256 |
| --- | --- | --- |
| `Data/Platform/Plugins/skymp5-client.js` | `3498934c92a308a6c9736eaff3c1d16449eefb5ab35fb1ff649b0a69034e9256` | `78151b2583739e0e26f4ee8b1c0960e4da1a333fdc276445454d391bfd867f71` |
| `Data/Platform/UI/build.js` | `229a40896f8f3805a1dc46c9819c839d10a7a6115c25f5649558641f9026d628` | `000df4a213f26b6d678bddd683f71f578081ec7f81c1f52491e41f5dbb750918` |

1. **Chat:** The old client and frontend entirely lack `skympChat:send` and `skympChat:packet`. A loaded server plugin cannot install that missing client transport or interface.
2. **YACA:** The `SettingsService` extracted from the installed client creates `publicKeys: {}` when no keys are configured. Signature validation treats this empty map as a configured keystore and rejects the actual YACA EventSource code with `no signature found`. The already corrected current `SettingsService` accepts the same code. Where actual keys are configured, valid signatures remain required.

The 73 native files in the new runtime package match the investigated Skyrim installation. This problem therefore does not require a new SKSE/SkyrimPlatform DLL build. A server Full/Update ZIP does not update installed client files.

<a id="korrigiertes-runtime-paket-verwenden"></a>

## Use the corrected runtime package

The package is built in the server fork; the launcher repository provides the web/distribution workflow. A verified copy was prepared for this case:

```text
D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-27-chat/
  upload/client-runtime/
    catalog.json
    1.7.104.0/client-2026-10-27-chat/
  skymp-client-runtime-1.7.104.0-client-2026-10-27-chat.zip
  VALIDATION.json
  ZIP-VALIDATION.json
  SHA256SUMS
  README-UPLOAD.md
```

For a **local test without publication**, enter this complete runtime folder for the server in **Connection Options → SkyMP Client Package**, then save the server:

```text
D:/GitHub/skymp-client-launcher/local-builds/runtime-2026-10-27-chat/upload/client-runtime/1.7.104.0/client-2026-10-27-chat
```

Close Skyrim, then connect normally through the launcher. The manual source takes precedence over the old advertised source; authentication and preparation remain within the normal launcher flow.

For **all players**, first upload the new version directory to `update.skymp-worlds.net/client-runtime/1.7.104.0/`, then replace `client-runtime/catalog.json`. Preserve existing version directories and other catalog entries. Once the live catalog advertises the new version, remove any temporary local selection. This requires neither a new launcher EXE nor Linux game-server changes.

<a id="nur-die-lokale-oberfläche-prüfen-oder-installieren"></a>

## Check or install only the local interface

The helper [install_client_ui.ps1](../../../../misc/deploy/install_client_ui.ps1) compares installed JS/UI files against an existing runtime manifest. Without `-Apply`, it writes no files. With `-Apply`, it first backs up files to be replaced. Native files and private client settings are preserved; mismatched game versions, running Skyrim, links, traversal and incorrect source hashes are rejected.

```powershell
pwsh -File misc/deploy/install_client_ui.ps1 `
  -GameDirectory 'G:/SteamLibrary/steamapps/common/Skyrim Special Edition' `
  -RuntimeDirectory 'build/client-delivery-2026-10-27-chat/upload/client-runtime/1.7.104.0/client-2026-10-27-chat'
```

If the live catalog remains old, the next automatic launcher run replaces manually copied files with the old version again. For testing, therefore select the launcher source above or publish the new catalog.

<a id="prüfgrenzen-und-gamemode-meldung"></a>

## Test limits and gamemode message

`skipping gamemode data update send, clientside hot-reload is disabled` concerns script changes for players already connected. The native server retains state and sends it on connection. It does not explain the proven old client files here and does not require enabling hot reload.

Local diagnosis is under `build/reports/plugin-ui-2026-10-27/`: live catalog, extracted installed service sources and reproduction with the actual YACA EventSource code. Browser/fixture tests do not replace real Skyrim/CEF or TeamSpeak audio acceptance.

Further reading: [Chat integration and runtime delivery](docs_chat_integration.md).
