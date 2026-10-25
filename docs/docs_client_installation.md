# Client Installation

Checked against the local fork and launcher on **22 October 2026**.

## Install with the standalone launcher

1. Install your own Skyrim Special Edition/Anniversary Edition and select its
   directory containing `SkyrimSE.exe` in the launcher.
2. Select the server and use **Prepare files** for a test without starting Skyrim.
3. The launcher fetches the server's mod manifest, verifies local game masters,
   and downloads the operator's published mod files with size/SHA-256 checks.
4. If the server offers a complete versioned client catalog, the launcher selects
   the matching Skyrim release and can also install SKSE and Address Library.
   A manually selected client package takes precedence.
5. **Connect** starts SKSE only after preparation succeeds. A missing or
   inconsistent package blocks launch.

Players do not need a Nexus/Vortex account for files hosted by the operator.
The game itself and matching Bethesda master files remain local prerequisites.
See [mod packages](docs_launcher_modpacks.md),
[client version catalogs](docs_launcher_runtime_updates.md), and
[SkyMP Worlds](docs_launcher_worlds.md).

## Manual or legacy installation

The source build produces `build/dist/client`. Copy its contents into the
Skyrim directory, preserving `Data/...` and the package's directory structure.
Install the SKSE build that matches the **exact game runtime** and the client's
release; do not choose a download solely from a generic “current SE” label.
The official SKSE download location is <https://skse.silverlock.org/>.
Install the matching Address Library and the server's required mods/load order.

Runtime DLLs belong in the paths declared by the client package, including
`Data/SKSE/Plugins/` and `Data/Platform/Distribution/RuntimeDependencies/`.
Connection settings are stored separately in
`Data/Platform/Plugins/skymp5-client-settings.txt`; no personal login data should
be copied into a distributable runtime package.

## Compatibility and test boundary

The local CommonLib port now builds client DLLs and passes independent
Address Library format-1/2/5 probes, including a 1.7.104 database. This does
**not** establish that every native hook, CEF or a multiplayer session works
on Skyrim 1.7.104. An old third-party native DLL may still fail during SKSE
initialization, before any connection to a server.

The full game test remains open. Use [current project status](docs_project_status.md)
for the dated evidence and distinguish installing/downloading a package from
successfully playing with it.
