[Deutsch](../../de/docs/docs_mod_folders.md) · [English](docs_mod_folders.md) · [Русский](../../ru/docs/docs_mod_folders.md)

# Providing mods in `data/mods`

Each mod has its own folder on the server. This replaces `client-resources`, which is no longer read. Nothing changes on the player's PC: Skyrim and SKSE only load from `Data/`, so the launcher keeps installing the files there.

## Layout

```text
data/
  Skyrim.esm
  mods/
    RaceMenu/
      RaceMenu.esp
      RaceMenuPlugin.esp
      RaceMenu.bsa
      SKSE/Plugins/skee64.dll
      SKSE/Plugins/skee64.ini
```

On the player's PC, `data/mods/RaceMenu/SKSE/Plugins/skee64.ini` becomes `Data/SKSE/Plugins/skee64.ini`.

## Rules

- A folder is distributed if one of its plugins is active or if it contains no plugins at all.
- Plugins are enabled in the dashboard and saved in `loadOrder` as `mods/RaceMenu/RaceMenu.esp`. Plugins directly in `data/` keep working.
- If two mods contain the same file, the folder placed later wins. The order is stored in `modFolders`; otherwise folders are sorted alphabetically. The dashboard shows conflicts.
- Files that cannot be distributed are skipped and listed in the dashboard. Source and debug files (`.pdb`, `.h`, `.psc`) and the folders `fomod`, `ModderResource` and `Source` are ignored silently.
- The server also reads `Scripts` and `Strings` from mod folders. For identical scripts, the folder placed later wins here too.

## SKSE DLLs

DLLs are executable code and only fit a specific Skyrim version. They are therefore distributed only if all of these conditions are met:

1. The operator enables the folder's DLLs in the dashboard. This is stored in `launcherResources.skseFolders`.
2. The operator enters the Skyrim version in `launcherResources.skseGameVersion` in four-part form, for example `1.6.1170.0`.
3. The player confirms each DLL in the launcher. Approval applies per server and file hash; if a file changes, the launcher asks again.
4. The installed Skyrim version matches. Otherwise the launcher stops.

The runtime DLLs `SkyrimPlatform.dll` and `MpClientPlugin.dll` cannot be replaced. With DLLs the manifest has version 4; older launchers reject it instead of silently skipping the DLLs. Players therefore need a current launcher.

## Moving from `client-resources`

The server no longer publishes `client-resources` and warns at startup if files are still there. Move the contents of `client-resources/Data/` to `data/mods/<mod>/` and restart the server. Updates do not delete the old folder. The `launcherResources.directory` field is no longer used.

The client runtime and plugin runtimes are not affected.

## Security

The `data/` directory is no longer served publicly. Over HTTP only `/manifest.json` remains reachable from it; mod files go through the launcher downloads.

## Verification status

The server side is covered by tests. The launcher changes have not been built or checked with `cargo test` yet, and nothing has been accepted in the game.
