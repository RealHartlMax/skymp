[Deutsch](../../de/docs/docs_native_validation_2026_10_19.md) · [English](docs_native_validation_2026_10_19.md) · [Русский](../../ru/docs/docs_native_validation_2026_10_19.md)

<a id="native-server-abnahme-vom-19-oktober-2026"></a>

# Native server acceptance, 19 October 2026

<a id="nachtrag-vom-22-oktober-2026"></a>

## Addendum, 22 October 2026

Report below records historical server/client versions. CommonLib 7.5.4 port now exists in active local source; new `SkyrimPlatform.dll`/`SkyrimPlatformImpl.dll` built Release. Standalone address-database test passes Skyrim 1.5.97/format 1, 1.6.1170/format 2, 1.7.104/format 5.

Newer client is in Launcher repository `local-builds/current/client-runtime/`; `VALIDATION.json`/`native-compat/real-catalog-validation.json` prove download, version/hash checks, cache/restore. Per current evidence user removed older research plugin described below.

Still **no game launch or real session**. Full Skyrim/SKSE/CEF remains open. Previous server suite separate: Linux 264/264, Windows 263/264 with open `Activate torch`; full suite not rerun for new client changes. [Project status](docs_project_status.md), [client installation](docs_client_installation.md).

<a id="umfang-und-quellstand"></a>

## Scope and source state

At user request first build **Linux/Windows server test packages from same local source**. Skyrim never started. Changes stay uncommitted/unpushed; baseline `ce91db65`.

Snapshot contains local frontend/client/server changes, including built frontend. Excludes Git metadata, credentials, personal agent directories, game masters, Windows `node_modules`. Source archive SHA256 is `sourceFingerprint` in both manifests. Native addon built separately per OS.

Both use Release, `BUILD_CLIENT=OFF`, `BUILD_SKYRIM_PLATFORM=OFF`, `BUILD_SCRIPTS=OFF`, `BUILD_GAMEMODE=OFF`, `BUILD_UNIT_TESTS=ON`, `DOWNLOAD_SKYRIM_DATA=OFF`. Shared gamemode `skymp5-functions-lib/local-gamemode.js`; existing own PEX copied, no Windows Papyrus compiler needed. Server-only builds no longer select client CommonLib.

<a id="build--und-laufzeitumgebungen"></a>

## Build and runtime environments

| | Linux build | Linux runtime | Windows build |
| --- | --- | --- | --- |
| Architecture | x86_64 | x86_64 | x64 |
| OS | Ubuntu 25.10 Docker | Ubuntu 26.04.1 LTS separate container | Windows 10 build 19045 |
| Compiler | Clang 20.1.8 | none needed | MSVC 14.51.36231 / Visual Studio 18 2026 |
| CMake | 4.3.0 | not needed | 4.4.0 |
| Node | 22.22.2 | 22.22.1 | 24.19.0 |

Linux image `skymp/skymp-vcpkg-deps:733f2d5`, digest `sha256:31da377a08790891335582f8951ab076621591b838fe7306013d344a45982ea5`. vcpkg `cb2981c4e03d421fa03b9bb5044cd1986180e7e4`. Local Linux uses two jobs/4 GB container limit; not a VPS capacity measurement. Supplied VPS startup log confirms Linux x64; package requires `x86_64`.

<a id="ergebnisse"></a>

## Results

<a id="browser-ersteinrichtung-vom-20-oktober"></a>

### Browser initial setup, 20 October

Full packages in `build/releases/2026-10-20-browser-setup/` replace terminal wizards. First launcher call starts temporary HTTP setup on TCP 8080, prints random four-digit code to terminal. All input in browser. After code approval, settings, master verification and own admin account, HTTP port passes to actual game server.

- Both finished archives extracted, every file checked against manifest; same additional source snapshot.
- Windows/Linux each passed 19 config groups/10 real HTTP groups: one-use PIN, expiry/global attempt limit, Origin/CSRF, missing/invalid masters, data preservation, no setup again for existing accounts.
- Both real packages pass HTTP setup using terminal-only code, native startup with five full masters, chosen-account login. Wrong password/public bootstrap retry/frontend hash/native UDP also checked.
- Visible Chromium: full flow/errors/reload session; five steps at 1280/360px, no horizontal overflow/JS exceptions. Ten axe checks no WCAG A/AA violations; incomplete gradient contrast retained for manual review. Axe CSP exception only in test, package CSP stays strict.
- Browser wizard tested Windows/Ubuntu 24.04 Node 24; unchanged Linux/native backend also Ubuntu 26.04 Node 22. VPS load/Skyrim/CEF open; game not started.

`SHA256SUMS`, detailed reports/`VALIDIERUNG.json` beside new archives. Setup needs no predefined admin and contains no game masters. Runtime origin/new source snapshot separately in manifest. Final docs/results postdate frozen source snapshot.

<a id="nativer-serverkern-und-vorherige-abnahme"></a>

### Native core and previous acceptance

- Linux Release build passes. `scam_native.node` real ELF x86_64, `ldd` resolves Ubuntu 26.04 dependencies; Node N-API exports `ScampServer`.
- Linux full suite **264 cases/476,480 assertions passed**, final 15.81 s.
- Ubuntu 26.04 actual server: five masters, `/admin`, production `/build.js`, real admin login/session, bound UDP pass.
- 20 October Linux package: all 90 files SHA256, supplied install check, unchanged five-master config, right/wrong passwords/session/frontend/UDP without Internet. Final archive independently extracted/compared against manifest/source.
- Windows native Release/TypeScript/offline-heartbeat pass. Actual package install/start/five masters/frontend/UDP/admin/wrong password pass. Full NTFS suite **263/264** (477,544/477,545 assertions). Open `Activate torch`, `unit/PartOne_ActivateTest.cpp:587`, `ref.IsHarvested()` within 25 ms reloot; isolated run also fails. Times/assertions unchanged. Thus `installationAndStartupPassed: true`, `nativeFullSuitePassed: false`, no full native pass claimed. Earlier exFAT SaveStorage failures absent in complete NTFS run.
- **Backend bundle/source map and all 73 frontend files SHA256-identical** across OS. Shared gamemode/own PEX from same sources.
- Offline startup no master-heartbeat signal handlers/initial heartbeat. Regression also checks updates/unchanged online heartbeat/shutdown.
- `DOWNLOAD_SKYRIM_DATA=OFF` prevents optional downloads too. Local masters fully copy through temporary file, then rename.

Linux-Native-SHA256:
`a150eb58f08a98d4d20d3ae765db7e15877803ed097f315e33dafe0b0302551e`.
Windows-Native-SHA256:
`3453479b8db908986b46a0f6d54eaeeea7fc48380269e2f767c2f8ed33b722f3`.
Frontend-`build.js`-SHA256:
`0dadcc5c885f04f853f816d1d393028381020f3efbc48f2e3357f314d6875888`.

Earlier interrupted Linux tests used slow Windows-mounted files. Final test used complete SHA256-checked masters on native Docker volume. First runtime test incorrectly requested `/ui/build.js`; actual route `/build.js`, corrected run passes.

Local logs/machine-readable results:

- `build/linux-native-final-build.log`
- `build/linux-native/unit-last-test.log`
- `build/linux-native/ubuntu2604-runtime-report.json`
- `build/linux-native/platform-parity.json`
- `build/windows-native-configure.log` and `build/windows-native-build.log`
- `build/windows-native-build-serial.log`
- `build/releases/2026-10-19/linux-package-test.json`
- `build/releases/2026-10-19/linux-x64-archive-verification.json`
- `build/releases/2026-10-19/windows-package-test.json`
- `build/releases/2026-10-19/windows-x64-archive-verification.json`

First parallel Windows rebuild exceeded commit memory on local 16 GB machine (`0x800705AF`). Continuation limits MSBuild/MSVC to one compiler process without changing system/pagefile settings:

```powershell
$env:_CL_ = ($env:_CL_ + ' /MP1').Trim()
cmake --build . --target skymp5-server unit --config Release --parallel 1 -- /p:CL_MPCount=1 /nr:false
```

<a id="docker-bereinigung-am-20-oktober"></a>

## Docker cleanup, 20 October

After export/successful package verification, removed seven completed SkyMP build/test containers, own `skymp-linux-native-20261019` volume, three exclusively used build/runtime/base images. Sources/native results/logs/verified Linux archive remain in workspace. New Linux source build needs new cache.

Unused Docker build cache cleaned too; Docker reported 6.684 GB plus 34.62 GB, afterwards 0 B. Running Outplay services remained active; other projects' containers/images/persistent data preserved.

<a id="pakete-und-start"></a>

## Packages and startup

Test packages at `build/releases/2026-10-19/`:

- `skymp-server-test-2026-10-19-linux-x64.tar.gz`
- `skymp-server-test-2026-10-19-windows-x64.zip`
- `skymp-server-test-2026-10-19-source.tar.gz`
- `SHA256SUMS`
- `VALIDIERUNG.json` with completed native unit/package checks

Source archive is pre-final-qualification snapshot. Later results/updated acceptance separate in workspace/`VALIDIERUNG.json`; both archives still reference same built source.

Each package has `README-TEST.md`, own test launcher, `check-install.cjs`, hashes, separately generated admin test credentials in `TEST-ZUGANG.txt`. Both share credentials/settings. Private build metadata/existing user-world data excluded from source snapshot.

Packager `misc/deploy/package_test_server.cjs` copies only bundled backend/source map/UI/native/gamemode/metadata/own PEX. No old loose TS outputs/PDB/`node_modules`. `misc/tests/test_server_package.cjs` checks actual package in fresh CWD with own masters: SHA256/native-install/start/frontend/wrong-right admin/session/UDP. Only network bindings change for local test.

Startup/VPS access: [Linux guide](docs_linux_vps.md). Test offline, 16 slots, UDP 7777/HTTP 8080; HTTP loopback, initial admin via SSH tunnel. Node >=22/five own masters required.

<a id="zurückgestellter-skyrim-cef-test-historischer-stand-vom-20-oktober"></a>

## Deferred Skyrim/CEF test: historical 20 October state

Steam on `G:` uses Skyrim `1.7.104.0`. SKSE `2.3.1`/Address Library v13 installed from supplied archives with backup. Existing DLLs then stopped at address initialization (`REL/ID.h(219)`); old CommonLib reader mishandles 1.7/format 5.

Experimental CommonLib 7.5.4 port deferred after task change, backed up separately under `build/cef-compat/deferred-client-port/`, outside active source. Temporarily isolated research helper restored. Server packages contain no new client DLLs.

User's 20 October terminal log confirms real VPS native startup: Linux x64, Node 22.22.1, five masters, secure admin store. User evidence, no local SSH/systemd test. Initial public HTTP 8080 refused while package binds loopback. Later public check returns 200/real login, setup `needsSetup: false`. No credentials sent/VPS settings changed. Player load, remote game, real Discord callback/Skyrim/CEF remain open.
