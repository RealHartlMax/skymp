[Deutsch](../../de/docs/docs_launcher_runtime_updates.md) · [English](docs_launcher_runtime_updates.md) · [Русский](../../ru/docs/docs_launcher_runtime_updates.md)

<a id="client-skse-und-address-library-unabhängig-vom-launcher-aktualisieren"></a>

# Update client, SKSE and Address Library independently of Launcher

<a id="threadpool-korrektur-vom-25-oktober-2026"></a>

## Threadpool fix of 25 October 2026

Local crash report `e2f0b649790b2ddcbdfc6ec41f4d1616` still contained old `SkyrimPlatformImpl.dll`, SHA-256 `f60f3c5c8b4853a98988140578852430ce828f8ad90a21a36cf749a2d0acb295`. Existing source fix encapsulates `BS::thread_pool` in one translation unit, so C++20/C++latest consumers no longer share differently laid-out objects. Fork regression tests both language modes, parallel initialization, 1400 tasks, futures and shutdown:

```powershell
# Aus dem build-Verzeichnis mit installierten MSVC-x64-Werkzeugen:
../misc/tests/thread-pool-abi/Run-Regression.ps1
cmake --build . --config Release --target skyrim_platform skyrim_platform_entry SkyrimPlatformCEF --parallel 4
```

New delivery is separate at `build/client-delivery-2026-10-25-threadpool/`, containing immutable `1.7.104.0/client-2026-10-25-threadpool` runtime and catalog. Upload complete directory first, switch catalog afterwards. Preserve other Skyrim versions when merging production catalog. Manual old client source still takes precedence; remove or update it. Launcher EXE/Steam DLL are not replaced for this.

Server revision r10 alone replaces no player client DLL. Build/hash/regression results are beside runtime in `VALIDIERUNG.json`. Native build success is not a Skyrim/CEF pass; latest report has no dump proving recurrence at the same address.

<a id="bisheriges-steam-paket"></a>

## Previous Steam package

Server r5 needs new `skymp5-client.js` for Steam requirement/guest access and new Launcher EXE for native Steam-ticket retrieval. Local `build/client-delivery-2026-10-24/` has full Skyrim 1.7.104.0 catalog; see its README for upload order. This does not additionally qualify native compatibility. Details: [Steam and in-game login](docs_ingame_login.md).

Launcher EXE contains no SKSE/SkyMP DLLs. It starts SKSE loader from selected game directory after preparing client/server files. Installed Skyrim suffices for initial setup. Complete external client package may supply SKSE, Papyrus scripts and Address Library.

<a id="versionskatalog-statt-festem-lokalen-buildpfad"></a>

## Version catalog instead of fixed local build path

Set stable `catalog.json` URL in server profile and `launcherResources.runtimeSource`, for example:

```json
{
  "launcherResources": {
    "runtimeSource": "https://dein-dateihost/client-runtime/catalog.json"
  }
}
```

Launcher reads actual `SkyrimSE.exe` file version without executing it and selects exact matching catalog entry. Newer package for another Skyrim version never substitutes. Without matching release, active files remain and game does not start.

Catalog is fetched before each preparation; HTTP asks for cache revalidation. Catalog pins manifest SHA-256; manifest pins each file size/SHA-256. Matching cache files reused, changed hashes download anew. Existing backup/restore retained.

Deliberately selected manual source still wins. For automatic updates, leave **SkyMP client package** empty in advanced profile. Local `build/dist/client` never updates over Internet.

<a id="ein-vollständiges-paket-erzeugen"></a>

## Create a complete package

Commands below run in Launcher repository. Need SkyMP client built for target, extracted matching SKSE archive and matching Address Library. Each supported Skyrim version gets its own immutable directory:

```powershell
node launcher/scripts/create-runtime-manifest.mjs `
  --source D:/GitHub/skymp/build/dist/client `
  --output ./publish/client-runtime/1.7.104.0/client-2026-10-21 `
  --game-version 1.7.104.0 `
  --skse-version 2.3.1 `
  --skse-source C:/Pakete/skse64_2_03_01 `
  --address-library C:/Pakete/AddressLibrary/SKSE/Plugins/versionlib-1-7-104-0.bin

node launcher/scripts/create-runtime-catalog.mjs `
  --root ./publish/client-runtime `
  --manifest 1.7.104.0/client-2026-10-21/runtime-manifest.json
```

Repeat `--manifest` per release for multiple Skyrim versions. Exactly one current entry per Skyrim version. Add `--replace` for targeted update of existing catalog. Existing package directories never overwritten.

Tool copies matching SKSE loader/runtime files/scripts from provided archive. Other SKSE runtime DLLs/mismatched address databases omitted from version-bound package. Bethesda masters, account data/personal connection settings never published.

Before activation Launcher additionally checks declared Skyrim version, embedded versions of both SKSE binaries, address-database format. Old unversioned manifests remain usable by existing servers, but imply no automatic compatibility guarantee.

<a id="eine-neue-ausgabe-veröffentlichen"></a>

## Publish a new release

1. Build/provide/check matching SkyMP client, SKSE, Address Library. New Skyrim updates may require native SkyMP DLL changes; an address file alone cannot replace them.
2. Create new package directory, upload fully.
3. Point catalog there; upload new `catalog.json` **last**. Keep old packages for ongoing downloads initially.
4. Next preparation gives players new compatible release. Package-only updates need no new Launcher build.

Use short cache lifetime or `Cache-Control: no-cache` for catalog. Immutable package paths can cache long term. Release job can run both tools after passing client build, then follow upload order.

<a id="warum-die-vorhandene-neue-address-library-trotzdem-nicht-geöffnet-wurde"></a>

## Why the existing new Address Library still did not open

Diagnosis on 21 October 2026 found Skyrim **1.7.104.0**, SKSE **2.3.1**, `versionlib-1-7-104-0.bin`. Old CommonLib in `skymp_mod_research.dll` recognized only 1.6 as AE. 1.7 fell into old SE branch, making DLL seek `version-1-7-104-0.bin`. Reader also lacked format 5 support.

Lookup happens inside native plugin after SKSE loads it; Launcher selected no different address file. Renaming does not add missing format/runtime support. Extra research plugin is not part of SkyMP client package; update it for Skyrim 1.7 or deliberately disable it too.

Launcher download tests/standalone native address-database test do not replace full Skyrim/SKSE testing. Report that separately per client release.
