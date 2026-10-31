[Deutsch](../../de/docs/docs_chat_integration.md) · [English](../../en/docs/docs_chat_integration.md) · [Русский](docs_chat_integration.md)

<a id="skymp-chat-client-anbindung-und-runtime-auslieferung"></a>

# SkyMP Chat: интеграция клиента и доставка runtime

Если Chat/YACA загружены, но Enter/F8 ничего не показывает: [сравнение runtime и подтверждённые ошибки клиента](docs_plugin_ui_troubleshooting.md).

<a id="aktueller-architekturstand-plugin-runtime-api-1"></a>

## Текущая архитектура: Plugin Runtime API 1

С подготовки исходников **29 октября 2026 года** отдельный `SkyMP-Chat` владеет клиентскими/CEF-исходниками и инструментами создания `Plugins/SkyMPChat/Runtime/`. Core хранит общий bootstrap, универсальный загрузчик и CEF host. Launcher загружает и проверяет подписанные runtime активного сервера. После разового обновления bootstrap совместимые изменения Chat не требуют пересборки launcher EXE.

Контракт, структура, подписи, активация, ограничения — в [руководстве runtime](docs_plugin_runtime.md) и [Runtime API 1](../misc/plugin-runtime/README.md). Нативные DLL остаются в центральной базе под версию Skyrim. Это подготовка исходников; новые релизные пакеты/опубликованные загрузки здесь не создаются.

<a id="historische-bootstrap-auslieferung-vom-2728-oktober-2026"></a>

## Историческая доставка bootstrap, 27–28 октября 2026 года

Далее описаны прежняя общая интеграция и проверенные тогда пакеты. Клиентские/CEF-исходники и инструменты были в Core; готовые пакеты — в `local-builds/` репозитория `D:\GitHub\skymp-client-launcher`. Исторические команды/результаты описывают основу bootstrap, не заменяют новый контракт.

<a id="aufbau"></a>

## Структура

- `skymp5-client/src/services/services/chatBridge.ts`: надёжные CustomPacket ↔ браузер SkyrimPlatform. BrowserService управляет Enter/Escape/F6/F2 и блокировками меню; KeyboardEventsService определяет фронты клавиш.
- `skymp5-front/src/features/chat/bridge.js`, `reducer/`, `constructorComponents/chat/`: общий Redux chat, текст, фокус, ограниченная история, статус; без второй веб-страницы.
- `skymp5-front/scripts/build.cjs`: локальная production-сборка по Webpack/gzip-бюджету. `assets-manifest.json` перечисляет только реально собранное, исключая старые `dist`.
- `skymp5-front/CMakeLists.txt`: `BUILD_FRONT=ON` собирает локальные исходники в `build/dist/client/Data/Platform/UI`, без upstream-загрузки/PAT.
- `misc/deploy/package_client_runtime.cjs`: полная runtime из проверенной хешами базы и текущих клиента/CEF. Каталог v2, манифест v1 и ZIP совместимы с существующим launcher; его исходники не меняются.

Активный Chat использует исправленный общий чат. Явный widget callback старого gamemode остаётся резервным при отсутствии плагина. Полностью исключительный режим плагина в это разделение не входил.

<a id="anzeige-und-serverregeln-ab-skymp-chat-11"></a>

## Отображение и правила с SkyMP Chat 1.1

Настройки только в `Plugins/SkyMPChat/config.json` отдельного репозитория. Мост передаёт их Redux через API-v1 handshake. Маршрутизация и режим команд определяются сервером.

```json
{
  "hideAfterSeconds": 15,
  "showOnMessage": true,
  "showJoinMessages": true,
  "commandsOnly": false,
  "chatMode": "global",
  "proximityRadiusMeters": 30
}
```

- Enter/F6 открывает ввод без таймера скрытия. После Escape/F6/меню через 15 секунд скрывается только HUD чата; прочие CEF/видимость браузера, черновик/история сохраняются. Повторное закрытие срок не продлевает.
- `showOnMessage: true` кратко показывает новое и обновляет срок без фокуса; `false` только сохраняет историю, HUD — по клавиатуре. `hideAfterSeconds`: целые 1–300.
- `chatMode`: `global`, `cell` (одинаковая внутренняя ячейка/внешняя сетка мира), `proximity` (3D-радиус метров одного мира/помещения). Соседние внешние сетки допустимы в радиусе. Без координат нет глобального fallback; видимость не проверяется.
- `commandsOnly: true` запрещает обычный текст, slash escape, все broadcasts и личные player/system API. Личные ответы команд/ошибок, `/help`, внешние команды работают; новых прав нет.
- `showJoinMessages: true` один раз сообщает вход с именем сервера после аутентифицированной готовности Chat, не повторяет при UI reload. `false` отключает. Режим команд всегда подавляет.

После настроек перезапустите полный игровой сервер. Новые опции требуют новый frontend и перезапуск Skyrim. Нативная DLL адаптеру не нужна. Старые API-v1 без опций используют 15 секунд, автоматический показ сообщений, обычный чат.

<a id="build-und-tests"></a>

## Сборка и тесты

PowerShell в `D:\GitHub\skymp`:

```powershell
npm --prefix skymp5-client run build
npm --prefix skymp5-front run build
npm --prefix skymp5-client run test:chat
npm --prefix skymp5-front test
node --test misc/tests/test_client_runtime_package.cjs
node misc/tests/test_frontend_source_build.cjs
```

CMake-тест настраивает изолированный проект без frontend PAT и собирает настоящий target. Тест Chat-клиента не требует checkout плагина. Для браузерной совместимости `skymp5-front/scripts/chat-browser-host.cjs` с `createHost({pluginRoot})` соединяет готовый CEF и фактический bundle плагина. Путь явный; копии плагина в Core нет.

<a id="neue-client-runtime-für-den-vps-vorbereiten"></a>

## Подготовка новой runtime для VPS

Нужна полная база под Skyrim с `runtime-manifest.json`, уже содержащая нативные файлы, CEF, SKSE, Address Library. Упаковщик не строит DLL и не подтверждает новую нативную совместимость.

```powershell
node misc/deploy/package_client_runtime.cjs `
  --base build/reports/yaca-client-2026-10-27/client-runtime `
  --catalog build/client-delivery-2026-10-25-threadpool/client-runtime/catalog.json `
  --release client-2026-10-27-chat `
  --output build/client-delivery-2026-10-27-chat
pwsh -File misc/deploy/verify_client_runtime.ps1 `
  -PackageDirectory build/client-delivery-2026-10-27-chat
```

Пути — реально использованная локальная среда; для иного checkout явно задайте подходящую базу/каталог. Существующий выходной каталог отклонён. До копирования размеры/SHA-256 всей базы проверяются. Нативные файлы побайтово прежние; заменяются клиент и CEF. Частные настройки, auth, журналы, ссылки, Bethesda исключены.

Результат:

```text
build/client-delivery-2026-10-27-chat/
  upload/client-runtime/
    catalog.json
    1.7.104.0/client-2026-10-27-chat/
      runtime-manifest.json
      Data/…
      skse64_loader.exe
      skse64_1_7_104.dll
  skymp-client-runtime-1.7.104.0-client-2026-10-27-chat.zip
  VALIDATION.json
  ZIP-VALIDATION.json
  SHA256SUMS
  README-UPLOAD.md
```

Каталог содержит SHA-256 нового манифеста; тот — размер/хеш каждого файла. Другие версии Skyrim входного каталога сохраняются, их файлы VPS ZIP не удаляет/заменяет.

<a id="upload-reihenfolge"></a>

### Порядок загрузки

1. Скопировать **новый каталог версии** из `upload/client-runtime/` в существующий webroot VPS, например `…/client-runtime/`, сохранив старые версии.
2. Только затем заменить `client-runtime/catalog.json`. Если live-каталог изменился, сначала взять его версии как `--catalog` и перепаковать локально.
3. Серверный плагин отдельно в `Plugins/SkyMPChat/`, обнаружить/включить в dashboard и полностью перезапустить игру; VPS/ПК не перезагружать.
4. Игроки получают runtime через launcher и перезапускают Skyrim после замены.

Runtime ZIP — в webroot runtime, не каталог игровых плагинов. Один серверный плагин клиентские файлы не обновляет.

<a id="prüfgrenzen"></a>

## Границы проверки

Локально проверяются упаковка/HTTP, цепочка хешей/каталога, адаптер, frontend, браузерная совместимость. Два Chromium или mock-соединения не равны двум Skyrim. Фокус Skyrim/CEF, подавление клавиатуры, Steam-запуск, два игрока требуют ручной проверки. На VPS ничего не загружено.

Linux: те же Node/npm с `/` и продолжением строк `\`; ZIP требует обычный `zip`. Разделение проверено на Windows, Linux не запускался.

<a id="geprüftes-lokales-paket-vom-28102026"></a>

## Проверенный локальный пакет 28.10.2026

Выполнено в fork:

```powershell
node misc/deploy/package_client_runtime.cjs `
  --base build/client-delivery-2026-10-27-chat/upload/client-runtime/1.7.104.0/client-2026-10-27-chat `
  --catalog build/client-delivery-2026-10-27-chat/upload/client-runtime/catalog.json `
  --release client-2026-10-28-chat-1.1 `
  --output build/client-delivery-2026-10-28-chat-1.1
pwsh -NoProfile -File misc/deploy/verify_client_runtime.ps1 `
  -PackageDirectory build/client-delivery-2026-10-28-chat-1.1
```

PASS: 213 файлов установки, 38 бинарных текстовых загрузок, 73 прежних нативных файла; 253 ZIP-записи отдельно проверены .NET. JavaScript клиента прежний; нужны новый frontend и серверный плагин. Валидатор `D:/GitHub/skymp-client-launcher/launcher/scripts/validate-runtime-package.mjs --root D:/GitHub/skymp/build/client-delivery-2026-10-28-chat-1.1/upload/client-runtime` также подтвердил всю цепочку.

Передавать весь новый каталог **включая `payloads/`** в бинарном режиме, каталог выбора последним. Сохранить live-версии/иные записи изменившегося каталога. Ничего не загружено и не изменено в игре. Опции отображения/дальности/входа ещё требуют Skyrim.

<a id="konfigurierbare-sprachdateien-ab-skymp-chat-12"></a>

## Настраиваемые языковые файлы с Chat 1.2

`locale` выбирает `locales/de.json` или `locales/en.json`; возможны свои файлы. `server`, `validation`, `ui` принадлежат отдельному Chat. Нет файла/ключа известного языка — встроенные defaults. Неверный JSON, неизвестные ключи/подстановки дают ошибку запуска.

Handshake API-v1 передаёт `localization: {locale, ui}` через клиент в Redux. Подписи/время используют язык, не меняя другие меню. Разрыв/смена сервера очищает прежние строки; старые серверы сохраняют fallback клиента. Строки отображаются текстом.

Новый frontend распространить один раз. Потом JSON/язык требует только полного перезапуска игрового сервера, без DLL/launcher-кода. Внешние плагины получают `ctx.locale`.

Проверенный пакет 1.2: `D:/GitHub/skymp-client-launcher/local-builds/releases/v0.2.1/client-runtime-chat-1.2.0-2026-10-28`. Проверены 213 файлов, 38 бинарных загрузок, 253 ZIP-записи. Клиентский JS и 73 нативных файла идентичны базе 1.1; заменён только frontend. Пройдены 41 тест плагина, 15 клиента, 11 прежних браузерных групп, четыре языковые. Новые функции JSON/языка в Skyrim не проверены.

## Проверенная совместимость с защитой консоли

Проверено 31 октября 2026 года по фактическому состоянию `SkyMP-Chat` (`Plugins/SkyMPChat/api.d.ts`, `src/registry.cjs`, `src/runtime.cjs`):

- Chat остаётся единственным реестром команд. Другие плагины регистрируют `/`-команды через `globalThis.skympChat.registerCommand`. Ядро не разбирает `/`-команды.
- Нативные консольные команды (`MsgType.ConsoleCommand`, рукопожатие `consoleSecurity:*`) и команды чата (CustomPacket `skympChat:*`) разделены. `ConsoleSecurity::ValidateRequest` отклоняет `/`-команды.
- Chat не затрагивает консольные команды и не нуждается в `consoleCommandsService`. Защита консоли не меняет клавиши и пакеты чата.
- У двух систем раздельные резолверы прав. Необязательный мост для ролей описан в [SkyMP Console Security](docs_console_security.md).
- Ядро работает без плагина Chat. Репозиторию Chat для защиты консоли не потребовались изменения кода.
