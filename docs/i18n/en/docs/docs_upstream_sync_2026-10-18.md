[Deutsch](../../de/docs/docs_upstream_sync_2026-10-18.md) · [English](docs_upstream_sync_2026-10-18.md) · [Русский](../../ru/docs/docs_upstream_sync_2026-10-18.md)

<a id="upstream-abgleich-vom-18-oktober-2026"></a>

# Upstream comparison, 18 October 2026

<a id="verglichene-stände"></a>

## Compared revisions

Remote references for `origin` and `upstream` were freshly fetched before comparison. Fetching again on 19 October 2026 confirmed the same remote revisions.

| Revision | Commit |
| --- | --- |
| Original fork (`origin/main` and local `main` before integration) | `25b82485e8dd901ef032e46ad8f2b873114cadc1` |
| Main repository `upstream/main` | `2849e676fe008925384b26f34476e382a30bd877` |
| Integration branch | `sync/upstream-20261018` |

The fork lacked 29 upstream commits and had 59 additional commits including earlier merges. The latest upstream change was dated 5 October 2026. Comparison refers to the respective `main` branches.

At inspection start, a rebase had stopped with conflicts after step 2 of 51. The complete partial state, index, rebase metadata, patches and affected files were backed up to `build/fork-sync-backup-20261018/`. The original fork was restored and upstream merged on a separate branch. Original fork remains in `backup-sync-20261018123519`.

<a id="auswirkungen-und-anpassungen"></a>

## Effects and adaptations

| Area | Effect and resolution |
| --- | --- |
| Fork extensions | Dashboard, locales, server list, respawn, favourites, effects, enchantments, markers, YACA/voice retained. |
| Gamemode API | `getMyFormIdInServerFormat()` added to interface, event sources, owner/neighbour updates and eval context. |
| SkyrimPlatform | Upstream removes old System polyfill and multi-file client plugins. Core client already uses one Webpack bundle; older external plugins must bundle too. Server plugin manager retained; old polyfill excluded from new distributions. |
| Engine fixes | Missing plugin-directory loading and possible shutdown hang fixed; LCTN/CELL access and ACTI/FURN loading added. Concrete world effects require gameplay tests. |
| Generated API | New JS generator retains `Browser.getToken`, `ObjectReference.addItem`, `Actor.addToFaction`, `markerFormId`, `showMapMarker`. Removed alias `EquippedItemType.Spell` replaced with `SpellOrScroll`. |
| Existing builds | Client packager uses current generated source API. Stale removed-generator `_codegen/skyrimPlatform.ts` cannot overwrite API/package copy. |
| Map markers | `TES::ForEachReference` callback uses CommonLibSSE’s `TESObjectREFR*`, skips null pointers; `markerFormId` retained in `locationDiscovery`. |
| Server dependencies | Upstream axios, ws, esbuild requirements/lockfile adopted; fork OpenTelemetry shim retained. |
| Client settings | `GENERATE_CLIENT_SETTINGS` integrated with fork generation; `OFF` preserves installer-created settings. |
| Deployments | Repository variable `INSTALLER_REPOSITORY` replaces hardcoded upstream target; settings workflows resolve target default branch. Existing `repository_dispatch` `deploy` accepts `deploy`/`restart`. |
| Fork workflows | Installer dispatch, SSH log retrieval and its shell script retained; Docker tag updates reference retained environment file. |
| Interface | Existing dashboard startup error fixed: moderation reason validation after state initialization. Regression covers hidden dashboard startup. |
| Admin data | Permission snapshot includes `canWarn`; status type includes master address; event comparison uses actual fields, not nonexistent `title`. |
| Admin WebSocket | React callback changes no longer reconnect. Ref forwards to current handler; closing also cleans unopened connections; stale events ignored. |
| Server package | All generated frontend assets, not only `build.js`, copied to `dist/server/ui` for images/fonts/sounds in fresh packages. |
| Windows build | Additional `VCPKG_INSTALL_OPTIONS` allow temporary dependency/tool downloads on NTFS; cleanup settings retained. |
| Browser test | Waits for React mount, fails if server list missing instead of silently skipping all checks; verifies stable WebSockets and new server status. |
| C++ fixtures | Movement includes required `isMounted`; NPC tests explicitly activate spawn rules with `overriden`, matching fork configuration. |

<a id="konfiguration-für-github-deployments"></a>

## GitHub deployment configuration

In the fork, **Settings → Secrets and variables → Actions**:

- Variable `INSTALLER_REPOSITORY`: own installer repository as `owner/repo`.
- Secret `SKYMP5_INSTALLER_REPOSITORY_DISPATCH_PAT`: token with repository/workflow dispatch access.

Adopted deployments expect `server-build-deploy-1-5.yml` and `server-settings-1-0.yml`. Existing installer dispatch still uses `on-skymp-push`. Without a matching installer repository these optional deployment actions cannot run; local builds do not require it.

Upstream replaces SSH deployment with installer workflows and removes `stop`. Old `action: stop` or `canaryFile` callers must adapt; the workflow explicitly rejects them rather than silently ignoring prior safeguards. Fork SSH log retrieval remains.

<a id="windows-arbeitsverzeichnisse"></a>

## Windows working directories

Local `D:` uses exFAT, `C:` NTFS. CMake 4.4.2 repeatedly failed restoring timestamps while unpacking tool ZIPs; Meson then rejected a freshly written timestamp rounded into the future. An independent write test confirmed rounding on the repository drive.

Temporary vcpkg directories therefore move to NTFS. Sources, installed dependencies and distribution stay in the existing repository. Configure from `build/` in PowerShell:

```powershell
$nativeWorkRoot=(Join-Path $env:TEMP 'skymp-native-vcpkg-20261018').Replace('\','/')
cmake .. "-DVCPKG_INSTALL_OPTIONS:STRING=--x-buildtrees-root=$nativeWorkRoot/buildtrees;--x-packages-root=$nativeWorkRoot/packages;--downloads-root=$nativeWorkRoot/downloads" -DGENERATE_CLIENT_SETTINGS:BOOL=OFF
```

The last option preserves client settings. Real-master tests additionally need `-DUNIT_DATA_DIR:PATH=...` pointing to the existing Data directory. Tests read master files, not the saved server world.

<a id="lokale-prüfungen"></a>

## Local checks

Successfully checked:

- Client Webpack build and voice-sync packet test.
- TypeScript server typecheck/esbuild bundle.
- Frontend build and full typecheck.
- Locale consistency, frontend unit tests including dashboard startup, mocked API integration.
- Playwright against fresh frontend/mocked HTTP/WebSocket: launcher, favourites/connection, moderation, warnings, respawn, events, history, stable updates; no unhandled errors.
- Deterministic code generation retaining five checked fork declarations.
- Workflow YAML and Bash syntax for 43 Linux steps.
- Full native Windows Release build: SkyrimPlatform, server addon, C++ tests with Visual Studio 2026.
- All 71 frontend files in actual server package match fresh build SHA-256.
- Native `test_removeallitems`, `test_onactivate`, `test_factions` in isolated temporary distribution with copies of five masters.
- Actual native HTTP server: authenticated status, unauthenticated 401, exact `/build.js`, clean gamemode shutdown. Test preload suppresses only probing the existing local UI devserver on 1234.

- Full C++ run through `ctest -C Release -R '^test_unit$' --output-on-failure`: all 265 cases / 476,763 assertions passed in 46.38 seconds. Movement and ten NPC/template/activation tests were rerun individually/as a group first. Storage tests also passed with the first failed run’s seed.

ESPM tests used the five existing masters. CI-only or fixed-installation-hash checks are skipped locally by the test program. Real connected Skyrim gameplay remains open.

Existing server/client settings were backed up and retained. CMake cache uses existing master/offline settings; `GENERATE_CLIENT_SETTINGS=OFF` protects client settings. Existing world was not used. Logs and isolated PowerShell script are local unversioned `build/fork-sync-*` artifacts.

Tested integration was first pushed to fork branch `sync/upstream-20261018`, then explicitly requested fast-forward into `main` on 19 October 2026. Code matches tested `cc48d6f0`; only publication status was documented afterward. `main` contains complete original fork and upstream commits as ancestors. Push destination was solely own fork `RealHartlMax/skymp`.

Native integration tests reset `server-settings.json`/`gamemode.js` and delete `world/changeForms` in their distribution. Never run unprotected against the development world. Full gameplay needs a separate test world and running Skyrim with the new client.

<a id="wiederholen-der-prüfungen"></a>

## Repeat checks

```powershell
npm --prefix skymp5-front test
npm --prefix skymp5-front run test:api
npm --prefix skymp5-front run build
npm --prefix skymp5-client run build
npm --prefix skymp5-client run test:voice-sync
npm --prefix skymp5-server run build-ts

node skyrim-platform/tools/ts_converter/index.js
yarn --cwd skyrim-platform/tools/const_enum_extractor install --frozen-lockfile
node skyrim-platform/tools/const_enum_extractor/index.js

cd build
cmake --build . --config Release --parallel 4
ctest -C Release -R '^test_unit$' --output-on-failure
```

For browser testing, start the built frontend/devserver and set `PLAYWRIGHT_E2E_URL` including `?devUi=1`. Run `npm --prefix skymp5-front run test:e2e`. API responses are mocked; this does not replace a connected game client.
