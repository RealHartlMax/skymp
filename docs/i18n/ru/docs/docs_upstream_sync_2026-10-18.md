[Deutsch](../../de/docs/docs_upstream_sync_2026-10-18.md) · [English](../../en/docs/docs_upstream_sync_2026-10-18.md) · [Русский](docs_upstream_sync_2026-10-18.md)

<a id="upstream-abgleich-vom-18-oktober-2026"></a>

# Сверка upstream от 18 октября 2026 года

<a id="verglichene-stände"></a>

## Сравнённые состояния

Перед сравнением заново получены remote-ссылки `origin` и `upstream`. Повторное получение 19 октября подтвердило те же состояния.

| Состояние | Коммит |
| --- | --- |
| Исходный fork (`origin/main` и локальный `main` до интеграции) | `25b82485e8dd901ef032e46ad8f2b873114cadc1` |
| Основной `upstream/main` | `2849e676fe008925384b26f34476e382a30bd877` |
| Ветка интеграции | `sync/upstream-20261018` |

Fork отставал на 29 коммитов и имел 59 дополнительных, включая старые merge. Последнее изменение upstream — 5 октября 2026. Сравнивались ветки `main`.

При начале проверки rebase остановлен с конфликтами после шага 2 из 51. Полное состояние, index, метаданные, патчи и файлы сохранены в `build/fork-sync-backup-20261018/`. Затем fork восстановлен и upstream объединён отдельно. Исходный fork остаётся в `backup-sync-20261018123519`.

<a id="auswirkungen-und-anpassungen"></a>

## Влияние и адаптации

| Область | Решение |
| --- | --- |
| Расширения fork | Dashboard, языки, список серверов, возрождение, избранное, эффекты, зачарования, маркеры, YACA/voice сохранены. |
| Gamemode API | `getMyFormIdInServerFormat()` добавлен в interface, event source, owner/neighbour, eval. |
| SkyrimPlatform | Удалены старый System polyfill и многофайловые клиентские плагины. Core уже одним Webpack; старые внешние тоже нужно объединить. Серверный manager сохранён, старый polyfill не включать. |
| Движок | Исправлены отсутствие каталога плагинов и зависание завершения; добавлены LCTN/CELL, ACTI/FURN. Эффект мира проверить в игре. |
| API генерации | JS-генератор сохраняет `Browser.getToken`, `ObjectReference.addItem`, `Actor.addToFaction`, `markerFormId`, `showMapMarker`; `EquippedItemType.Spell` заменён `SpellOrScroll`. |
| Старые сборки | Упаковщик использует текущий исходный API; старый `_codegen/skyrimPlatform.ts` не перезапишет API/пакет. |
| Карта | Callback `TES::ForEachReference` использует `TESObjectREFR*`, пропускает null; `markerFormId` в `locationDiscovery` сохранён. |
| Зависимости | axios, ws, esbuild/lockfile upstream приняты, OpenTelemetry shim сохранён. |
| Настройки клиента | `GENERATE_CLIENT_SETTINGS` объединён; `OFF` сохраняет настройки installer. |
| Deploy | `INSTALLER_REPOSITORY` вместо upstream; настройки определяют default branch; `repository_dispatch` `deploy` принимает `deploy`/`restart`. |
| Workflow fork | Installer dispatch, SSH-журналы и shell-скрипт сохранены; Docker tags ссылаются на существующий env. |
| UI | Исправлен startup dashboard: проверка причин после state; регрессия скрытого dashboard. |
| Admin данные | `canWarn` в snapshot, адрес master в status, реальные поля вместо несуществующего `title`. |
| WebSocket | Смена callback React не пересоединяет; ref вызывает текущий handler; закрытие чистит и неоткрытые, поздние события игнорируются. |
| Пакет | Все frontend assets, не только `build.js`, в `dist/server/ui`, включая изображения/шрифты/звуки. |
| Windows | `VCPKG_INSTALL_OPTIONS` позволяет временные сборки/загрузки на NTFS; cleanup сохранён. |
| Браузер | Ожидание React, ошибка без server list вместо пропуска; стабильный WebSocket и новый status. |
| C++ данные | Движение включает `isMounted`; NPC-тесты включают spawn через `overriden`. |

<a id="konfiguration-für-github-deployments"></a>

## Настройка GitHub deploy

В fork: **Settings → Secrets and variables → Actions**:

- `INSTALLER_REPOSITORY`: свой installer как `owner/repo`.
- `SKYMP5_INSTALLER_REPOSITORY_DISPATCH_PAT`: токен доступа/запуска workflow.

Нужны `server-build-deploy-1-5.yml`, `server-settings-1-0.yml`. Старый dispatch использует `on-skymp-push`. Без installer необязательный deploy не работает; локальной сборке он не нужен.

Upstream заменяет SSH на installer и удаляет `stop`. Старые `action: stop`/`canaryFile` требуют адаптации; workflow явно отклоняет их, не игнорируя старую защиту. SSH-получение журналов сохранено.

<a id="windows-arbeitsverzeichnisse"></a>

## Рабочие каталоги Windows

`D:` использует exFAT, `C:` NTFS. CMake 4.4.2 не восстанавливал время при распаковке ZIP; Meson отклонял новый файл с округлённым будущим временем. Отдельная запись подтвердила округление.

Временные каталоги vcpkg помещены на NTFS. Исходники, зависимости, дистрибутив остаются. Настройка PowerShell из `build/`:

```powershell
$nativeWorkRoot=(Join-Path $env:TEMP 'skymp-native-vcpkg-20261018').Replace('\','/')
cmake .. "-DVCPKG_INSTALL_OPTIONS:STRING=--x-buildtrees-root=$nativeWorkRoot/buildtrees;--x-packages-root=$nativeWorkRoot/packages;--downloads-root=$nativeWorkRoot/downloads" -DGENERATE_CLIENT_SETTINGS:BOOL=OFF
```

Последняя опция сохраняет настройки клиента. Для настоящих master добавить `-DUNIT_DATA_DIR:PATH=...` с Data. Читаются master, не сохранённый мир.

<a id="lokale-prüfungen"></a>

## Локальные проверки

Успешно:

- Webpack клиента и voice-sync.
- TypeScript сервер: типы/esbuild.
- Frontend: сборка/полные типы.
- Языки, unit frontend со стартом dashboard, API mock.
- Playwright нового frontend с HTTP/WebSocket mock: launcher, избранное/соединение, модерация, предупреждения, respawn, события, история, стабильные обновления; без необработанных ошибок.
- Детерминированная генерация пяти fork-деклараций.
- YAML workflow и Bash 43 Linux-шагов.
- Полный нативный Windows Release: SkyrimPlatform, addon, C++ тесты, Visual Studio 2026.
- Все 71 файла frontend совпали SHA-256 с пакетом.
- `test_removeallitems`, `test_onactivate`, `test_factions` в отдельном временном дистрибутиве с пятью master.
- Реальный native HTTP: авторизованный status, 401 без входа, точный `/build.js`, чистый выход gamemode; preload блокирует только probe старого devserver 1234.

- Полный `ctest -C Release -R '^test_unit$' --output-on-failure`: 265 случаев, 476 763 assertions, 46,38 с. Сначала отдельно/группой повторены движение и десять NPC/template/activation. Storage прошёл также с seed первого неудачного прогона.

ESPM использовал пять master. Проверки CI/фиксированных хешей установки локально пропускаются тестовой программой. Настоящая игра подключённым Skyrim остаётся открытой.

Настройки сохранены с резервными копиями. CMake использует прежние master/offline; `GENERATE_CLIENT_SETTINGS=OFF` защищает клиента. Существующий мир не использовался. Журналы/PowerShell — локальные неверсионируемые `build/fork-sync-*`.

Интеграция сначала отправлена в `sync/upstream-20261018`, затем по явному запросу fast-forward в `main` 19 октября. Код соответствует проверенному `cc48d6f0`; затем обновлён только статус публикации. `main` содержит исходный fork/upstream как предков. Отправка только в свой `RealHartlMax/skymp`.

Native integration сбрасывает `server-settings.json`, `gamemode.js`, удаляет `world/changeForms`. Не запускать без защиты на разработческом мире. Нужны отдельный мир и Skyrim с новым клиентом.

<a id="wiederholen-der-prüfungen"></a>

## Повтор проверки

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

Запустить frontend/devserver, задать `PLAYWRIGHT_E2E_URL` с `?devUi=1`, выполнить `npm --prefix skymp5-front run test:e2e`. API mock не заменяет подключённый клиент.
