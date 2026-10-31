[Deutsch](../../de/docs/docs_launcher_runtime_updates.md) · [English](../../en/docs/docs_launcher_runtime_updates.md) · [Русский](docs_launcher_runtime_updates.md)

<a id="client-skse-und-address-library-unabhängig-vom-launcher-aktualisieren"></a>

# Обновление клиента, SKSE и Address Library независимо от Launcher

<a id="threadpool-korrektur-vom-25-oktober-2026"></a>

## Исправление threadpool от 25.10.2026

Локальный crash-report `e2f0b649790b2ddcbdfc6ec41f4d1616` ещё содержал старый `SkyrimPlatformImpl.dll`, SHA-256 `f60f3c5c8b4853a98988140578852430ce828f8ad90a21a36cf749a2d0acb295`. Исправление изолирует `BS::thread_pool` в одной единице компиляции: C++20/C++latest больше не разделяют объект разной структуры. Regression проверяет оба режима, параллельную инициализацию, 1400 задач, futures, завершение:

```powershell
# Aus dem build-Verzeichnis mit installierten MSVC-x64-Werkzeugen:
../misc/tests/thread-pool-abi/Run-Regression.ps1
cmake --build . --config Release --target skyrim_platform skyrim_platform_entry SkyrimPlatformCEF --parallel 4
```

Новая поставка отдельно: `build/client-delivery-2026-10-25-threadpool/`, неизменяемый `1.7.104.0/client-2026-10-25-threadpool` и каталог. Сначала загрузить каталог пакета целиком, потом переключить catalog. Другие Skyrim-версии production сохранить. Старая ручная client-source остаётся приоритетной, её убрать/обновить. Launcher EXE/Steam DLL для этого не заменяются.

Один server-r10 не заменяет client-DLL у игроков. Результаты сборки/хешей/regression рядом в `VALIDIERUNG.json`. Успешная native-сборка не означает Skyrim/CEF-pass; последний отчёт не содержит dump для подтверждения той же ошибки по тому же адресу.

<a id="bisheriges-steam-paket"></a>

## Предыдущий Steam-пакет

Server-r5 требует новый `skymp5-client.js` для Steam-required/guest и новый Launcher EXE для native-Steam-ticket. Локальный `build/client-delivery-2026-10-24/` содержит полный catalog Skyrim 1.7.104.0, порядок upload — его README. Дополнительной native-квалификации это не даёт. См. [Steam/игровой вход](docs_ingame_login.md).

Launcher EXE не содержит SKSE/SkyMP-DLL. Запускает SKSE-loader выбранной игры после подготовки client/server-файлов. Для начальной настройки достаточно установленной Skyrim. Внешний полный пакет может дать SKSE, Papyrus-scripts, Address Library.

<a id="versionskatalog-statt-festem-lokalen-buildpfad"></a>

## Version-catalog вместо локального build-пути

В профиле/`launcherResources.runtimeSource` задать стабильный URL `catalog.json`, например:

```json
{
  "launcherResources": {
    "runtimeSource": "https://dein-dateihost/client-runtime/catalog.json"
  }
}
```

Launcher читает настоящую file-version `SkyrimSE.exe`, не запуская её, выбирает точно подходящую запись. Более новый пакет другой версии не замена. Без совпадения активные файлы остаются, игра не запускается.

Catalog запрашивается перед каждой подготовкой, HTTP требует revalidation. В нём SHA-256 manifest, в manifest — size/SHA-256 всех файлов. Подходящий cache переиспользуется, новые хеши загружаются. Прежние backup/restore сохраняются.

Явный ручной source приоритетен. Для auto-update оставить **SkyMP client-пакет** пустым в расширенном профиле. `build/dist/client` не обновляется интернетом.

<a id="ein-vollständiges-paket-erzeugen"></a>

## Создание полного пакета

Команды ниже из Launcher-репозитория. Нужны client под целевую версию, распакованный соответствующий SKSE, подходящий Address Library. Для каждой версии свой неизменяемый каталог:

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

Для нескольких версий повторить `--manifest` на релиз. Ровно одна актуальная запись на Skyrim-версию. Для точечного обновления catalog добавить `--replace`. Старые package-каталоги не перезаписываются.

Инструмент берёт нужные SKSE-loader/runtime/scripts из архива. Другие SKSE-runtime-DLL/неподходящие address-базы исключаются. Bethesda-master, аккаунты, личные подключения не публикуются.

До активации проверяются объявленная Skyrim-версия, встроенные версии двух SKSE-бинарников, формат address-базы. Старые manifests без версии остаются применимы, но автоматической совместимости не обещают.

<a id="eine-neue-ausgabe-veröffentlichen"></a>

## Публикация новой поставки

1. Собрать/подготовить/проверить согласованные SkyMP, SKSE, Address Library. Skyrim-update может требовать новые native-DLL; одна address-база их не заменяет.
2. Создать новый package-каталог, полностью загрузить.
3. Переключить catalog; новую `catalog.json` загрузить **последней**. Прежние пакеты сначала оставить текущим downloads.
4. Следующая подготовка даст новую совместимую версию. Package-only update не требует нового Launcher-build.

Для catalog короткий cache либо `Cache-Control: no-cache`. Immutable-пути кешировать надолго. Release-job может выполнить оба инструмента после client-build, соблюдая порядок upload.

<a id="warum-die-vorhandene-neue-address-library-trotzdem-nicht-geöffnet-wurde"></a>

## Почему новая существующая Address Library всё равно не открылась

21.10.2026 обнаружены Skyrim **1.7.104.0**, SKSE **2.3.1**, `versionlib-1-7-104-0.bin`. Старый CommonLib `skymp_mod_research.dll` признавал AE только 1.6; 1.7 попала в SE-ветку, DLL искала `version-1-7-104-0.bin`. Reader также не поддерживал format 5.

Поиск внутри native-plugin после загрузки SKSE, Launcher другую базу не выбирал. Переименование не добавит format/runtime-поддержку. Research-plugin не входит в SkyMP-пакет; его тоже обновить для 1.7 либо явно отключить.

Download-тесты Launcher/самостоятельный native address-test не заменяют полную Skyrim/SKSE-проверку. Результат отдельно для каждой client-версии.
