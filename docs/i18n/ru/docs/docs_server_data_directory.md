[Deutsch](../../de/docs/docs_server_data_directory.md) · [English](../../en/docs/docs_server_data_directory.md) · [Русский](docs_server_data_directory.md)

<a id="server-data-directory"></a>

# Каталог данных сервера

> **Новое:** моды теперь находятся в `data/mods/<мод>/`; `client-resources` больше не читается. Сведения о нём на этой странице устарели. См. [моды в data/mods](docs_mod_folders.md).

Каталог данных сервера (по умолчанию `"./data"`) содержит игровые ресурсы, включая моды, UI и другое.

Для публикации клиентских модов используется отдельный `client-resources/Data/`. Отдельный launcher проверяет загрузки и устанавливает их до запуска SKSE. См. [пакеты модов launcher](docs_launcher_modpacks.md).

<a id="vanilla-skyrim-se-mods"></a>

## Обычные моды Skyrim SE

Файлы размещаются в корне каталога данных и добавляются в `"loadOrder"` файла `server-settings.json`. Клиентские ресурсы можно упаковать в .bsa через Creation Kit/инструменты сообщества или публиковать отдельными файлами в `client-resources/Data/` для launcher. Архив должен называться как связанный мод, например `"FooBar.bsa"` для `"FooBar.esp"`. Сейчас BSA используются только клиентом. Для работы скриптов на сервере разместите их в подкаталоге `scripts`.

Основные master-файлы Skyrim (`*.esm`) обязательны, но не распространяются в серверных релизных архивах. Скопируйте их из `Data` собственной установки Skyrim в корень серверного каталога данных.

Необходимые файлы стандартного порядка:

- `Skyrim.esm`
- `Update.esm`
- `Dawnguard.esm`
- `HearthFires.esm`
- `Dragonborn.esm`

Исходные расположения:

- Windows (Steam default): `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\`
- Linux/Proton (Steam default): `~/.steam/steam/steamapps/common/Skyrim Special Edition/Data/`

## UI

Ресурсы `ui` предоставляются HTTP UI listener (`uiPort`).

- В производственных сборках frontend обычно устанавливается в расположение серверного UI bundle.
- При локальной разработке запросы `/ui/*` могут проксироваться обнаруженному webpack dev server (`localhost:1234`).

<a id="manifest"></a>

## Манифест

Сервер создаёт `manifest.json` при запуске. Не меняйте этот файл; изменяйте `server-settings.json`.

`"versionMajor"` — основная версия манифеста, сейчас `1`.
`"mods"` — массив объектов с `"crc32"`, `"filename"`, `"size"`.
`"loadOrder"` берётся прямо из `server-settings.json`.

Этот нативный игровой манифест остаётся версии 1. Он отличается от манифеста launcher версии 2 `/api/launcher/manifest` и необязательного runtime `catalog.json`. Их номера описывают разные контракты.

<a id="runtime-generated-adminstate-files"></a>

## Admin-файлы и состояние, создаваемые при работе

В зависимости от функций и использования сервер может создавать в `dataDir` дополнительные файлы:

- `admin-auth.json` — безопасное хранилище учётных данных администратора
- `admin-bans.json` — сохранённые блокировки
- `admin-mutes.json` — сохранённые запреты чата
- `admin-history.json` — история модерации
- `admin-player-stats.json` — статистика для административных представлений
- `admin-menu-debug.log` — необязательный отладочный журнал меню администратора
- `.admin/server-performance.json` — частная скользящая 24-часовая поминутная история; сохраняйте скрытый каталог при обновлении. См. [метрики сервера](docs_server_metrics.md).

Этими файлами управляет серверная runtime; не редактируйте их вручную при работающем сервере.

## changeForms

`changeForms` хранит сериализованные снимки состояния актёров/объектов. Некоторые admin-функции, например офлайн-снимки инвентаря, читают этот каталог.
