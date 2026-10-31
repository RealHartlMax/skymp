[Deutsch](../../de/docs/docs_launcher_worlds.md) · [English](docs_launcher_worlds.md) · [Русский](../../ru/docs/docs_launcher_worlds.md)

<a id="skymp-worlds-launcher-und-online-master"></a>

# SkyMP Worlds: Launcher and online master

> **New:** mods now live in `data/mods/<mod>/`; `client-resources` is no longer read. Statements about it on this page are outdated. See [mods in data/mods](docs_mod_folders.md).

Complete guide: https://docs.skymp-worlds.net/ (German, English, Russian). This fork supplies /api/launcher/manifest and corresponding mod downloads. Client/SKSE files are offered separately through runtimeSource. Arbitrary Skyrim versions, plugins or existing servers are not guaranteed compatible.

In server admin panel under **Settings → Launcher connection**, enter master URL, public server ID, private key, game address and port. Mod synchronization, relative mod directory and client catalog are separate fields. Saving merges these values into existing configuration and creates a private backup; restart server afterwards. Same form exists in protected initial browser setup. An empty key field keeps existing key. Key is never exported to players.

Technical merge example for other implementations:

    {
      "publicHost": "DEIN_OEFFENTLICHER_SPIELHOST",
      "master": "https://api.skymp-worlds.net",
      "serverUid": "OEFFENTLICHE_ID_AUS_DEM_DASHBOARD",
      "masterKey": "PRIVATER_SCHLUESSEL_AUS_DEM_DASHBOARD",
      "offlineMode": false,
      "launcherResources": {
        "enabled": true,
        "directory": "./client-resources",
        "runtimeSource": "https://update.skymp-worlds.net/client-runtime/catalog.json"
      }
    }

A registered dashboard entry with active status and valid heartbeat is required for public listing. serverUid is public; masterKey stays private. Do not create a new identity when world data already belongs to the old identity.

Current local default master is `https://api.skymp-worlds.net`. Newly generated CMake configuration also adds catalog URL if absent. Explicit existing values, including empty `runtimeSource`, remain. This offers an external catalog, embedding no client DLLs in server or Launcher; publication remains separate.

Heartbeat goes to POST <master>/api/servers/<privateMasterKey>. Accepted requests are logged at startup, after recovery and at most once per minute. Actual heartbeats still run every 10–30 seconds (default 15). A 404 with "Server is not registered yet" from old registry requires API-webroot update: api/servers/index.php must forward to dashboard master. Update API/manage web packages together, preserve real config.php/data. Server patch alone cannot repair an outdated web route.

runtimeSource must supply a complete version catalog. Launcher EXE contains no SkyMP/SKSE DLLs. It selects matching release by SkyrimSE.exe file version, verifies all files and updates before startup. Correct targets: Data/Platform/Plugins, Data/SKSE/Plugins, game root. Platform/Plugins without Data is not a target for this package. Connection settings/saved logins do not belong in client packages.

Prepare custom mods under client-resources/Data/; Bethesda/DLC files stay local prerequisites. Mod manifest/client catalog have separate contracts. Manual client source in advanced Launcher profile takes precedence; remove it for automatic server updates.

Build and isolated heartbeat test from server repository build directory:

    npm --prefix ../skymp5-server run build-ts
    node ../skymp5-server/tests/masterClient.integration.mjs

Test starts only a local HTTP receiver, no native game server. Successful build/download test does not replace full game testing.

Review on 22 October 2026: TypeScript/isolated test pass locally. Generated packages/actual publication are separate steps; current overall state: [project status](docs_project_status.md).
