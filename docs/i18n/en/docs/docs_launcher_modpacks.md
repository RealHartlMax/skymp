[Deutsch](../../de/docs/docs_launcher_modpacks.md) · [English](docs_launcher_modpacks.md) · [Русский](../../ru/docs/docs_launcher_modpacks.md)

<a id="modpakete-vor-dem-spielstart-installieren"></a>

# Install mod packages before starting the game

> **New:** mods now live in `data/mods/<mod>/`; `client-resources` is no longer read. Statements about it on this page are outdated. See [mods in data/mods](docs_mod_folders.md).

Standalone Launcher in `skymp-client-launcher` prepares required files before SKSE. Files come from game operator's file server. Players need no Nexus/Vortex account, but still need a suitable owned Skyrim installation.

<a id="ablauf-für-spieler"></a>

## Player workflow

1. Select server and press **Connect**.
2. Launcher reads mod manifest/fixed load order.
3. Own Skyrim/DLC files are checked locally, not downloaded.
4. Missing/changed mods download and verify size/SHA-256. Existing cache files are rechecked/reused.
5. Server client package is prepared too when `runtimeSource` is set. Manual Launcher package selection takes precedence.
6. Only after success are files/load order activated and SKSE started. Errors prevent startup.

Progress shows current download/size. Interrupted downloads are never activated; valid cache remains reusable on retry. Server switching backs up originals/replaces previously managed files. **Restore original files** also restores previous single-player load order.

<a id="moddateien-auf-dem-server-bereitstellen"></a>

## Supply server mod files

Example in unpacked server directory:

```text
server-settings.json
data/
  Skyrim.esm                    # eigene Server-Spieldaten, kein Download
  Update.esm
  ...
  Community.esp                 # auch in loadOrder eintragen
  Community.bsa                 # optionales Clientarchiv
client-resources/
  Data/
    Community - Textures.bsa
    Scripts/ClientScript.pex
    meshes/Community/Schwert.nif
    textures/Community/sword.dds
    SKSE/Plugins/Community.ini
```

Custom plugins in `loadOrder` are automatically offered from `data/`, along with existing `NAME.bsa`/`NAME - *.bsa` archives. The five Bethesda masters/Creation Club files are not distributed.

Put additional **player-required** files under `client-resources/Data/` in final Skyrim layout. Server Papyrus under `data/scripts/` is not automatically installed for players. If client also needs a script, additionally put it at `client-resources/Data/Scripts/`.

Package contains already selected/installed mod files. ZIP/7z archives and FOMOD dialogs are not executed on players' machines; operator prepares desired options once. Publish only files intended for this server package.

A plugin additionally placed in `client-resources/Data/` must match server file. Plugins must appear in `loadOrder`. Restart after changing plugin list so native server/game manifest share order. Asset changes are detected without restart; metadata cache lasts two seconds. Publishing while downloading may abort transfer; reconnect after copying completes.

Optional setting in existing `server-settings.json`:

```json
{
  "launcherResources": {
    "enabled": true,
    "directory": "./client-resources"
  }
}
```

Defaults without it: `enabled: true`, `./client-resources`. Admin accounts, world data/server config never belong here. Symlinks, Windows path conflicts and protected client paths are rejected.

<a id="client-dll-paket-vom-gleichen-http-server-anbieten"></a>

## Offer client/DLL package from same HTTP server

Current Launcher also supports `catalog.json` matching actual Skyrim version. See [version catalog and complete client packages](docs_launcher_runtime_updates.md).

SKSE/SkyMP DLLs and JavaScript runtime belong in supported separate client package. Launcher checks size/SHA-256 there too, installs before game startup. Operator centrally fixes version without players needing mod-manager accounts.

Publish a suitable complete client directory using existing Launcher tool, for example a new `ui/client-runtime/`:

```sh
node launcher/scripts/create-runtime-manifest.mjs \
  --source /PFAD/ZUM/FERTIGEN/CLIENT \
  --output /PFAD/ZUM/SERVER/ui/client-runtime
```

Command belongs to **Launcher repository**; adjust source/target paths. Target directory must be new. Server already serves `ui/` through HTTP port. Then configure, for example:

```json
{
  "launcherResources": {
    "directory": "./client-resources",
    "runtimeSource": "http://87.106.58.116:8080/client-runtime/runtime-manifest.json"
  }
}
```

`runtimeSource` must be complete HTTP(S) URL without credentials, query or fragment. Same URL can still come from server list/connection options; explicit manual selection wins. Current initial Launcher setup requires game with `SkyrimSE.exe`. Complete versioned client package can include SKSE/matching Address Library; EXE/DLL versions/address format are checked before activation. Older unversioned packages need matching preprepared installation. SkyMP client must also be built for this Skyrim version and tested in game.

<a id="schnittstelle-für-den-launcher"></a>

## Launcher interface

### GET `/api/launcher/manifest`

Public, no admin login. Example with abbreviated hashes:

```json
{
  "version": "2",
  "revision": "<SHA256 des Manifestinhalts>",
  "generatedAt": "2026-10-21T12:00:00.000Z",
  "totalSize": 12345,
  "loadOrder": ["Skyrim.esm", "Community.esp"],
  "requiredLocalFiles": [
    { "filename": "Skyrim.esm", "size": 249753412, "crc32": 123456 }
  ],
  "resources": [
    {
      "name": "sword.dds",
      "path": "Data/textures/Community/sword.dds",
      "kind": "asset",
      "size": 12345,
      "hash": "sha256:<64 hex characters>",
      "downloadPath": "api/launcher/files/<64-character resource ID>"
    }
  ]
}
```

`path` is target relative to Skyrim game directory, starting `Data/`. `name` is display text; identical names in different directories stay separate. `downloadPath` is relative to selected file-server base URL, also works behind proxy subpaths. `totalSize` sums mod files; optional separate client package has its own manifest. `requiredLocalFiles` contains only local game files and sizes/CRC32 from server-generated game manifest.

Types: `mod` (`.esm/.esp/.esl`), `archive` (`.bsa`), `script` (`.pex`), `asset` (models/textures/audio/animations/interface/translations), `config` (`.ini/.json/.xml/.txt/.toml/.yaml/.yml`). Runtime DLL/JS remain separate; protected platform/login files are not mods.

<a id="get-oder-head-apilauncherfilesid"></a>

### GET or HEAD `/api/launcher/files/:id`

Returns exact file with `Content-Length`, `X-Resource-Hash`, `ETag`, `Accept-Ranges: bytes`. Single byte ranges use HTTP 206. ID reveals no server path, depends on destination/content.

| Status | Meaning |
| --- | --- |
| 400 | Invalid resource ID |
| 404 | API disabled or revision gone |
| 409 | File changed after manifest; refetch manifest |
| 416 | Invalid byte range |
| 503 | Incomplete/unreadable/contradictory publication |

New-API 503 never falls back to incomplete legacy package. Only 404 on new manifest permits old `/api/resources/manifest`/`/manifest.json` contract. Existing profiles stay compatible. Limits: 10,000 files, 8 GiB/file, 64 GiB/mod package.

<a id="validierung"></a>

## Validation

Tests use temporary game directories, never start Skyrim. Actual Node/Koa API on Windows/Linux and Rust downloader against it: full installation, cache hits/corruption, updates, invalid packages, restoration. Later client-release DLL/address-database probes appear in [22 October project status](docs_project_status.md). Real Skyrim/CEF testing remains separate and open.
