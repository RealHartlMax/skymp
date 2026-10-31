[Deutsch](../../de/docs/docs_native_validation_2026_10_19.md) · [English](../../en/docs/docs_native_validation_2026_10_19.md) · [Русский](docs_native_validation_2026_10_19.md)

<a id="native-server-abnahme-vom-19-oktober-2026"></a>

# Нативная приёмка сервера 19.10.2026

<a id="nachtrag-vom-22-oktober-2026"></a>

## Дополнение 22.10.2026

Ниже исторические версии. Теперь CommonLib 7.5.4 перенесён в active-source, новые `SkyrimPlatform.dll`/`SkyrimPlatformImpl.dll` собраны Release. Address-test успешен для Skyrim 1.5.97/format 1, 1.6.1170/format 2, 1.7.104/format 5.

Новый клиент в Launcher `local-builds/current/client-runtime/`; `VALIDATION.json`, `native-compat/real-catalog-validation.json` подтверждают download/version/hash/cache/restore. По текущим данным пользователь убрал старый research-plugin ниже.

По-прежнему **нет запуска игры/настоящего сеанса**. Skyrim/SKSE/CEF открыты. Старая server-suite отдельно: Linux 264/264, Windows 263/264 с `Activate torch`, для новых client-правок не повторялась. [Статус](docs_project_status.md), [установка](docs_client_installation.md).

<a id="umfang-und-quellstand"></a>

## Объём и исходники

По запросу сначала **test-пакеты Linux/Windows из одного local-source**. Skyrim не запускается, commit/push нет; база `ce91db65`.

Snapshot включает local frontend/client/server и собранный frontend. Исключены Git, credentials, personal-agent, game-master, Windows `node_modules`. SHA256 source-архива — `sourceFingerprint` обоих manifests. Native отдельно под OS.

Оба Release, `BUILD_CLIENT=OFF`, `BUILD_SKYRIM_PLATFORM=OFF`, `BUILD_SCRIPTS=OFF`, `BUILD_GAMEMODE=OFF`, `BUILD_UNIT_TESTS=ON`, `DOWNLOAD_SKYRIM_DATA=OFF`. Общий gamemode `skymp5-functions-lib/local-gamemode.js`, прежний свой PEX перенесён, Windows-Papyrus-compiler не нужен. Server-only больше не выбирает client-CommonLib.

<a id="build--und-laufzeitumgebungen"></a>

## Среды сборки/запуска

| | Linux-build | Linux-runtime | Windows-build |
| --- | --- | --- | --- |
| Архитектура | x86_64 | x86_64 | x64 |
| ОС | Ubuntu 25.10 Docker | Ubuntu 26.04.1 LTS отдельный контейнер | Windows 10 build 19045 |
| Компилятор | Clang 20.1.8 | не нужен | MSVC 14.51.36231 / Visual Studio 18 2026 |
| CMake | 4.3.0 | не нужен | 4.4.0 |
| Node | 22.22.2 | 22.22.1 | 24.19.0 |

Linux image `skymp/skymp-vcpkg-deps:733f2d5`, digest `sha256:31da377a08790891335582f8951ab076621591b838fe7306013d344a45982ea5`. vcpkg `cb2981c4e03d421fa03b9bb5044cd1986180e7e4`. Два jobs/4 GB limit не измеряют VPS-capacity. Лог VPS подтверждает Linux x64, пакет требует `x86_64`.

<a id="ergebnisse"></a>

## Результаты

<a id="browser-ersteinrichtung-vom-20-oktober"></a>

### Browser-setup 20 октября

Полные пакеты `build/releases/2026-10-20-browser-setup/` заменяют terminal-wizard. Первый запуск даёт временный HTTP TCP 8080/случайный четырёхзначный код в terminal. Все данные в браузере. После PIN/settings/master-check/своего admin HTTP передаётся игре.

- Оба архива распакованы, каждый файл сверен manifest, общий дополнительный source-snapshot.
- Windows/Linux: по 19 config/10 настоящих HTTP-групп: одноразовый PIN, expiry/global-attempt-limit, Origin/CSRF, missing/invalid masters, сохранность данных, отсутствие повторного setup аккаунтов.
- Оба настоящих пакета: HTTP-setup с terminal-only кодом, native-start с пятью full-masters, свой login; wrong-password/public-bootstrap/frontend-hash/UDP тоже проверены.
- Видимый Chromium: полный flow/errors/reload-session, пять шагов 1280/360px без overflow/JS. Десять axe — нет WCAG A/AA нарушений, incomplete gradient-contrast сохранён для ручной проверки. CSP-исключение axe лишь тестовое, пакетная CSP строгая.
- Wizard Windows/Ubuntu 24.04 Node 24; неизменённый Linux/native-backend Ubuntu 26.04 Node 22. VPS-load/Skyrim/CEF открыты, игра не запускалась.

`SHA256SUMS`, отчёты/`VALIDIERUNG.json` рядом с новыми архивами. Предсозданного admin/мастеров нет. Runtime-origin/source-snapshot отдельно в manifest. Документы/результаты финализированы после snapshot.

<a id="nativer-serverkern-und-vorherige-abnahme"></a>

### Native-core/предыдущая приёмка

- Linux Release успешен. `scam_native.node` настоящий ELF x86_64, `ldd` находит Ubuntu 26.04 libs, Node N-API экспортирует `ScampServer`.
- Полная suite **264 cases/476 480 assertions**, 15,81 с.
- Ubuntu 26.04 real-server: пять masters, `/admin`, production `/build.js`, admin-login/session/UDP успешны.
- 20 октября Linux: 90 файлов SHA256, install-check, прежняя five-master config, right/wrong-password/session/frontend/UDP без интернета. Архив отдельно распакован/сверен с manifest/source.
- Windows Release/TS/offline-heartbeat успешны, настоящий пакет install/start/masters/frontend/UDP/admin/wrong-password успешен. NTFS-suite **263/264**, 477 544/477 545 assertions. Открыт `Activate torch`, `unit/PartOne_ActivateTest.cpp:587`, `ref.IsHarvested()` в 25-ms reloot; отдельно тоже fail. Время/assertions не менялись. Поэтому `installationAndStartupPassed: true`, `nativeFullSuitePassed: false`, полный pass не заявляется. Прежних exFAT SaveStorage-failures в полном NTFS нет.
- **Backend/source-map и 73 frontend-файла идентичны SHA256** между OS. Gamemode/свой PEX из одних sources.
- Offline-start без master-heartbeat signal-handlers/initial-send; regression включает updates/онлайн/shutdown.
- `DOWNLOAD_SKYRIM_DATA=OFF` запрещает optional-download; masters полностью копируются временным файлом, затем rename.

Linux-Native-SHA256:
`a150eb58f08a98d4d20d3ae765db7e15877803ed097f315e33dafe0b0302551e`.
Windows-Native-SHA256:
`3453479b8db908986b46a0f6d54eaeeea7fc48380269e2f767c2f8ed33b722f3`.
Frontend-`build.js`-SHA256:
`0dadcc5c885f04f853f816d1d393028381020f3efbc48f2e3357f314d6875888`.

Прежний прерванный Linux-run использовал медленные Windows-mounts. Финальный — полные SHA256 masters на native Docker-volume. Первый runtime ошибочно запросил `/ui/build.js`; настоящая `/build.js`, исправленный успешен.

Локальные журналы/машиночитаемые результаты:

- `build/linux-native-final-build.log`
- `build/linux-native/unit-last-test.log`
- `build/linux-native/ubuntu2604-runtime-report.json`
- `build/linux-native/platform-parity.json`
- `build/windows-native-configure.log` и `build/windows-native-build.log`
- `build/windows-native-build-serial.log`
- `build/releases/2026-10-19/linux-package-test.json`
- `build/releases/2026-10-19/linux-x64-archive-verification.json`
- `build/releases/2026-10-19/windows-package-test.json`
- `build/releases/2026-10-19/windows-x64-archive-verification.json`

Первый parallel-Windows-build превысил commit-memory 16-GB ПК (`0x800705AF`). Продолжение ограничивает MSBuild/MSVC одним compiler-процессом без изменения system/pagefile:

```powershell
$env:_CL_ = ($env:_CL_ + ' /MP1').Trim()
cmake --build . --target skymp5-server unit --config Release --parallel 1 -- /p:CL_MPCount=1 /nr:false
```

<a id="docker-bereinigung-am-20-oktober"></a>

## Очистка Docker 20 октября

После export/package-pass удалены семь завершённых SkyMP-контейнеров, свой volume `skymp-linux-native-20261019`, три исключительно использованных image build/runtime/base. Sources/native/log/проверенный архив остаются в workspace. Новому Linux-build нужен новый cache.

Неиспользуемый Docker-build-cache очищен: 6,684 GB + 34,62 GB, после 0 B. Outplay продолжал работу, другие containers/images/persistent-data сохранены.

<a id="pakete-und-start"></a>

## Пакеты/запуск

Пакеты в `build/releases/2026-10-19/`:

- `skymp-server-test-2026-10-19-linux-x64.tar.gz`
- `skymp-server-test-2026-10-19-windows-x64.zip`
- `skymp-server-test-2026-10-19-source.tar.gz`
- `SHA256SUMS`
- `VALIDIERUNG.json` с native-unit/package-проверками

Source-архив до финальной квалификации; поздние результаты/docs отдельно в workspace/`VALIDIERUNG.json`. Оба server-архива ссылаются на прежний общий built-source.

Каждый содержит `README-TEST.md`, launcher, `check-install.cjs`, hashes, отдельно созданный admin-доступ `TEST-ZUGANG.txt`. Credentials/settings одинаковы. Private metadata/прежние user-world-data не вошли snapshot.

Packager `misc/deploy/package_test_server.cjs` берёт лишь bundled-backend/source-map/UI/native/gamemode/metadata/свой PEX. Без старых TS/PDB/`node_modules`. `misc/tests/test_server_package.cjs` в новом CWD со своими masters проверяет SHA256/native-install/start/frontend/wrong-right-password/session/UDP. Меняются лишь network-bindings теста.

Доступ/запуск: [Linux VPS](docs_linux_vps.md). Test offline, 16 slots, UDP 7777/HTTP 8080 loopback; сначала SSH-tunnel. Node >=22, пять своих masters.

<a id="zurückgestellter-skyrim-cef-test-historischer-stand-vom-20-oktober"></a>

## Отложенный Skyrim/CEF-тест: историческое 20 октября

Steam на `G:` — Skyrim `1.7.104.0`. SKSE `2.3.1`/Address Library v13 установлены из архивов с backup. Старые DLL остановились на initialization (`REL/ID.h(219)`), CommonLib неверно читает 1.7/format 5.

Экспериментальный CommonLib 7.5.4 после смены задания отложен в `build/cef-compat/deferred-client-port/`, не active-source. Временно изолированный research-helper возвращён. Server-пакеты новых client-DLL не содержат.

User-terminal 20 октября подтверждает реальный VPS-start: Linux x64, Node 22.22.1, пять masters, secure admin-store. Это пользовательское доказательство, не local SSH/systemd. Первый public-HTTP 8080 отказал при loopback-bind. Позже 200/настоящий login, `needsSetup: false`. Credentials не передавались, VPS-config не менялась. Player-load/remote-game/real-Discord/Skyrim/CEF открыты.
