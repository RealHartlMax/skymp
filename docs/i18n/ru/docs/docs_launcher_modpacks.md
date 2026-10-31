[Deutsch](../../de/docs/docs_launcher_modpacks.md) · [English](../../en/docs/docs_launcher_modpacks.md) · [Русский](docs_launcher_modpacks.md)

<a id="modpakete-vor-dem-spielstart-installieren"></a>

# Установка mod-пакетов до старта игры

> **Новое:** моды теперь находятся в `data/mods/<мод>/`; `client-resources` больше не читается. Сведения о нём на этой странице устарели. См. [моды в data/mods](docs_mod_folders.md).

Самостоятельный Launcher `skymp-client-launcher` готовит файлы до SKSE. Источник — файловый сервер оператора. Nexus/Vortex-аккаунт игроку не нужен, но нужна собственная подходящая Skyrim.

<a id="ablauf-für-spieler"></a>

## Действия игрока

1. Выбрать сервер, нажать **Подключиться**.
2. Launcher читает mod-manifest/порядок.
3. Свои Skyrim/DLC проверяются локально, не скачиваются.
4. Отсутствующее/изменённое скачивается с size/SHA-256; cache проверяется/используется снова.
5. При `runtimeSource` готовится client-пакет. Ручной выбор Launcher приоритетен.
6. Только после успеха активируются файлы/порядок и SKSE. При ошибке игра не стартует.

Progress показывает загрузку/размер. Прерванное не активируется, верный cache сохраняется для retry. При смене сервера originals резервируются, прежние управляемые файлы заменяются. **Восстановить оригинальные файлы** возвращает и single-player load-order.

<a id="moddateien-auf-dem-server-bereitstellen"></a>

## Mod-файлы на сервере

Пример распакованного server-каталога:

```text
server-settings.json
data/
  Skyrim.esm                    # eigene Server-Spieldaten, kein Download
  Update.esm
  ...
  Community.esp                 # auch in loadOrder eintragen
  Community.bsa                 # optionales Clientarchiv
client-resources/
  Data/
    Community - Textures.bsa
    Scripts/ClientScript.pex
    meshes/Community/Schwert.nif
    textures/Community/sword.dds
    SKSE/Plugins/Community.ini
```

Свои плагины `loadOrder` автоматически отдаются из `data/`, вместе с имеющимися `NAME.bsa`/`NAME - *.bsa`. Пять Bethesda-master и Creation Club не распространяются.

Дополнительные **нужные игроку** файлы — `client-resources/Data/` с готовой Skyrim-структурой. Server-Papyrus `data/scripts/` автоматически игроку не устанавливается. Нужный клиенту script дополнительно положить в `client-resources/Data/Scripts/`.

Пакет — уже выбранные/установленные mod-файлы. ZIP/7z/FOMOD-диалоги на ПК игрока не выполняются; оператор один раз готовит опции. Публиковать лишь предназначенное этому серверу.

Plugin в `client-resources/Data/` обязан совпадать с server-файлом. Plugins перечисляются в `loadOrder`; после изменения списка restart для согласованного native/game-manifest порядка. Assets обновляются без restart, metadata-cache две секунды. Публикация во время загрузки может оборвать её; после копирования reconnect.

Необязательная настройка существующего `server-settings.json`:

```json
{
  "launcherResources": {
    "enabled": true,
    "directory": "./client-resources"
  }
}
```

Без неё defaults: `enabled: true`, `./client-resources`. Admin-аккаунты, мир, config сюда не входят. Symlink, Windows-path-conflicts, защищённые client-path запрещены.

<a id="client-dll-paket-vom-gleichen-http-server-anbieten"></a>

## Client/DLL-пакет с того же HTTP-сервера

Launcher поддерживает `catalog.json` для настоящей Skyrim-версии. См. [version-catalog/полные client-пакеты](docs_launcher_runtime_updates.md).

SKSE/SkyMP-DLL, JS-runtime — в отдельном поддерживаемом client-пакете. Launcher проверяет size/SHA-256, ставит до старта. Оператор задаёт версию централизованно без mod-manager-аккаунта игрока.

Подходящий полный client-каталог опубликовать существующим Launcher-tool, например в новом `ui/client-runtime/`:

```sh
node launcher/scripts/create-runtime-manifest.mjs \
  --source /PFAD/ZUM/FERTIGEN/CLIENT \
  --output /PFAD/ZUM/SERVER/ui/client-runtime
```

Команда из **Launcher-репозитория**; адаптировать пути. Выходной каталог новый. Сервер уже отдаёт `ui/` через HTTP-port. Затем, например, настроить:

```json
{
  "launcherResources": {
    "directory": "./client-resources",
    "runtimeSource": "http://87.106.58.116:8080/client-runtime/runtime-manifest.json"
  }
}
```

`runtimeSource` — полный HTTP(S)-URL без credentials/query/fragment. URL можно задавать списком серверов/опциями подключения; явный ручной выбор побеждает. Первичной настройке нужна игра с `SkyrimSE.exe`. Полный versioned-пакет может содержать SKSE/Address Library; EXE/DLL-version/формат проверяются до активации. Старые unversioned-пакеты требуют подготовленную совместимую установку. SkyMP-client тоже собрать под версию и проверить в игре.

<a id="schnittstelle-für-den-launcher"></a>

## Интерфейс Launcher

### GET `/api/launcher/manifest`

Публичный, без admin-login; пример с сокращёнными хешами:

```json
{
  "version": "2",
  "revision": "<SHA256 des Manifestinhalts>",
  "generatedAt": "2026-10-21T12:00:00.000Z",
  "totalSize": 12345,
  "loadOrder": ["Skyrim.esm", "Community.esp"],
  "requiredLocalFiles": [
    { "filename": "Skyrim.esm", "size": 249753412, "crc32": 123456 }
  ],
  "resources": [
    {
      "name": "sword.dds",
      "path": "Data/textures/Community/sword.dds",
      "kind": "asset",
      "size": 12345,
      "hash": "sha256:<64 hex characters>",
      "downloadPath": "api/launcher/files/<64-character resource ID>"
    }
  ]
}
```

`path` — цель относительно каталога Skyrim, начинается `Data/`. `name` для показа; одинаковые имена разных папок разделены. `downloadPath` относительно file-server base-URL, работает за proxy-subpath. `totalSize` суммирует mods; separate-client имеет свой manifest. `requiredLocalFiles` — только локальные game-файлы с size/CRC32 server-generated manifest.

Типы: `mod` (`.esm/.esp/.esl`), `archive` (`.bsa`), `script` (`.pex`), `asset` (модели/текстуры/аудио/анимации/interface/переводы), `config` (`.ini/.json/.xml/.txt/.toml/.yaml/.yml`). Runtime-DLL/JS отдельно; защищённые platform/login-файлы не mods.

<a id="get-oder-head-apilauncherfilesid"></a>

### GET либо HEAD `/api/launcher/files/:id`

Точный файл с `Content-Length`, `X-Resource-Hash`, `ETag`, `Accept-Ranges: bytes`. Один byte-range — HTTP 206. ID не раскрывает server-path, зависит от цели/содержимого.

| Статус | Значение |
| --- | --- |
| 400 | Неверный resource-ID |
| 404 | API отключён либо ревизия отсутствует |
| 409 | Файл изменён после manifest, запросить снова |
| 416 | Неверный byte-range |
| 503 | Неполная/нечитаемая/противоречивая публикация |

503 нового API не откатывается к неполному legacy-пакету. Только manifest-404 разрешает старые `/api/resources/manifest`/`/manifest.json`. Профили совместимы. Лимиты: 10 000 файлов, 8 GiB/файл, 64 GiB/пакет.

<a id="validierung"></a>

## Проверка

Тесты используют временные game-каталоги, Skyrim не запускают. Проверяют настоящий Node/Koa на Windows/Linux, Rust-downloader: полную установку, cache-hit/повреждение, update, неверные пакеты, restore. Поздние client-release-DLL/address-probes отражены в [статусе 22 октября](docs_project_status.md). Настоящая Skyrim/CEF-проверка отдельно и открыта.
