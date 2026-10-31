[Deutsch](../../de/docs/docs_launcher_worlds.md) · [English](../../en/docs/docs_launcher_worlds.md) · [Русский](docs_launcher_worlds.md)

<a id="skymp-worlds-launcher-und-online-master"></a>

# SkyMP Worlds: Launcher и online-master

> **Новое:** моды теперь находятся в `data/mods/<мод>/`; `client-resources` больше не читается. Сведения о нём на этой странице устарели. См. [моды в data/mods](docs_mod_folders.md).

Полная инструкция: https://docs.skymp-worlds.net/ (немецкий, английский, русский). Fork предоставляет /api/launcher/manifest и mod-загрузки. Client/SKSE-файлы отдельно через runtimeSource. Совместимость произвольных Skyrim-версий, plugins и старых серверов не гарантируется.

В server-admin **Настройки → Подключение Launcher** указать master-URL, public server-ID, private-key, игровой адрес/порт. Mod-sync, относительный mod-каталог и client-catalog — отдельные поля. Save объединяет значения с существующим config, создаёт private-backup; затем restart. Та же форма в защищённом browser-setup. Пустое поле ключа сохраняет прежний. Игрокам ключ не экспортируется.

Технический пример объединения для других реализаций:

    {
      "publicHost": "DEIN_OEFFENTLICHER_SPIELHOST",
      "master": "https://api.skymp-worlds.net",
      "serverUid": "OEFFENTLICHE_ID_AUS_DEM_DASHBOARD",
      "masterKey": "PRIVATER_SCHLUESSEL_AUS_DEM_DASHBOARD",
      "offlineMode": false,
      "launcherResources": {
        "enabled": true,
        "directory": "./client-resources",
        "runtimeSource": "https://update.skymp-worlds.net/client-runtime/catalog.json"
      }
    }

Публичный список требует зарегистрированную dashboard-запись active и действительный heartbeat. serverUid публичен, masterKey приватен. Не создавать новую идентичность, если данные мира связаны со старой.

Текущий local-default master: `https://api.skymp-worlds.net`. Новый CMake-config также добавляет отсутствующий catalog-URL. Явные существующие значения, включая пустой `runtimeSource`, сохраняются. Это внешний каталог, не встраивание client-DLL в server/Launcher; публикация отдельно.

Heartbeat идёт POST <master>/api/servers/<privateMasterKey>. Принятые запросы журналируются при старте/восстановлении, максимум раз в минуту. Сами heartbeat каждые 10–30 секунд, стандарт 15. 404 "Server is not registered yet" старой registry требует обновить API-webroot: api/servers/index.php перенаправляет dashboard-master. API/manage-пакеты обновлять вместе, сохраняя настоящие config.php/данные. Один server-patch старую web-route не исправит.

runtimeSource предоставляет полный version-catalog. Launcher EXE не содержит SkyMP/SKSE-DLL; выбирает релиз по file-version SkyrimSE.exe, проверяет/обновляет до старта. Цели: Data/Platform/Plugins, Data/SKSE/Plugins, корень игры. Platform/Plugins без Data не подходит этому пакету. Настройки подключения/сохранённые logins в client-пакет не входят.

Свои mods готовить под client-resources/Data/; Bethesda/DLC остаются локальными условиями. У mod-manifest/client-catalog разные контракты. Ручной client-source расширенного Launcher-профиля приоритетен; убрать для auto-update.

Сборка и изолированный heartbeat-тест из build-каталога server-репозитория:

    npm --prefix ../skymp5-server run build-ts
    node ../skymp5-server/tests/masterClient.integration.mjs

Тест запускает лишь local-HTTP-приёмник, не native-game-server. Успешная сборка/загрузка не заменяет полный game-test.

Проверка 22.10.2026: TS/изолированный тест локально успешны. Пакеты/публикация отдельно; общий [статус проекта](docs_project_status.md).
