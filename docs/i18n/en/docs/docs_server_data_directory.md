[Deutsch](../../de/docs/docs_server_data_directory.md) · [English](docs_server_data_directory.md) · [Русский](../../ru/docs/docs_server_data_directory.md)

# Server Data Directory

> **New:** mods now live in `data/mods/<mod>/`; `client-resources` is no longer read. Statements about it on this page are outdated. See [mods in data/mods](docs_mod_folders.md).

Data directory of the server (`"./data"` by default) contains different kinds of game resources, including mods, UI, etc.

Client mod publication uses a separate `client-resources/Data/` directory,
with verified downloads and installation by the standalone launcher before
SKSE starts. See [Launcher mod packages](docs_launcher_modpacks.md).

## Vanilla Skyrim SE Mods

Should be placed into the root of the data directory and added to `"loadOrder"` in `server-settings.json`.
Client assets may be packed into a .bsa archive by Creation Kit or community tools,
or published as loose files under `client-resources/Data/` for the standalone launcher.
That archive must have the same name with related mod (i.e. `"FooBar.bsa"` for `"FooBar.esp"`).
Please note that currently .bsa archives are used only on the client-side. If you want scripts to be working on the server, place them into the `scripts` subdirectory.

Core Skyrim masters (`*.esm`) are required but not distributed in release server archives. Copy them from your own Skyrim installation `Data` directory into this server `data` directory root.

Required files for standard load order:

- `Skyrim.esm`
- `Update.esm`
- `Dawnguard.esm`
- `HearthFires.esm`
- `Dragonborn.esm`

Source locations:

- Windows (Steam default): `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\`
- Linux/Proton (Steam default): `~/.steam/steam/steamapps/common/Skyrim Special Edition/Data/`

## UI

`ui` assets are served over the HTTP UI listener (`uiPort`).

- In production builds, frontend artifacts are typically deployed to the server UI bundle location.
- In local frontend development, `/ui/*` requests can be proxied to webpack dev server (`localhost:1234`) when detected.

## Manifest

The server generates `manifest.json` during startup. Do not modify that file, consider modifying `server-settings.json` instead.

`"versionMajor"` is a major version of the Manifest, currently, `1`.
`"mods"` is an array of objects with fields `"crc32"`, `"filename"` and `"size"`.
`"loadOrder"` is a load order of mods (taken from `server-settings.json` directly).

This native game manifest remains version 1. It differs from the launcher's
version-2 `/api/launcher/manifest` and the optional runtime `catalog.json`.
Their version numbers describe different contracts.

## Runtime-generated admin/state files

Depending on enabled features and admin usage, the server may create additional files in `dataDir`, for example:

- `admin-auth.json` - secure admin credential store
- `admin-bans.json` - persisted ban entries
- `admin-mutes.json` - persisted mute entries
- `admin-history.json` - moderation action history
- `admin-player-stats.json` - tracked player stats used by admin views
- `admin-menu-debug.log` - optional admin menu debug log output
- `.admin/server-performance.json` - private rolling 24-hour minute history;
  preserve this hidden directory during updates. See [server metrics](docs_server_metrics.md).

These files are managed by the server runtime and should not be edited manually while server is running.

## changeForms

`changeForms` stores serialized actor/object state snapshots. Some admin features (for example offline inventory snapshots) read data from this directory.
