# SkyMP Worlds

Мультиплеер Skyrim с общим лаунчером, независимыми серверами и управлением браузером. Форк [SkyMP](https://github.com/skyrim-multiplayer/skymp) содержит сервер, нативный клиент и панель.

**[Общий лаунчер SkyMP Worlds](https://github.com/RealHartlMax/skymp-client-launcher)** разрабатывается отдельно. Игрок пользуется одним приложением для разных серверов, подготавливающим их моды/клиент до запуска.

**26 октября 2026 · Тест / WIP.** Исходники и границы проверок — [статус](docs/docs_project_status.md). У релизов/локальных сборок свои версии/доказательства.

[Панель](docs/docs_dashboard_operations.md) даёт общую навигацию, live-метрики, историю обрывов, ежедневные рестарты с часовым поясом. Веб остаётся при stop игры. Full/Update ZIP раздельны.

| Цель | Начало |
| --- | --- |
| Играть | [Лаунчер](https://github.com/RealHartlMax/skymp-client-launcher), [подключение](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md) |
| Свой сервер | [Браузер/Linux VPS](docs/docs_linux_vps.md), [релизы](https://github.com/RealHartlMax/skymp/releases) |
| Обновить | [Сохранение данных](docs/docs_packaged_server_update.md) |
| Участвовать | [Разработка](#разработка), [задачи](docs/docs_project_status.md) |

### Подключение к серверу

1. Нужна собственная установленная Skyrim SE/AE под Windows. Для точной версии
   `SkyrimSE.exe` должен быть доступен совместимый клиентский пакет.
2. Установите [глобальный лаунчер](https://github.com/RealHartlMax/skymp-client-launcher)
   и выберите папку Skyrim в настройках.
3. Найдите сервер и нажмите **Подключиться**. Для тестового сервера доступно прямое подключение.
4. Лаунчер проверяет локальные игровые файлы, загружает недостающие или изменённые моды,
   проверяет размеры и SHA-256 и применяет порядок загрузки. Полный каталог версий
   также предоставляет подходящие SkyMP-клиент, SKSE, Address Library и игровой интерфейс.
   SKSE запускается после успешной подготовки. Для неполного пакета недостающие
   совместимые компоненты необходимо установить отдельно.
5. Запустите Steam и войдите в аккаунт. Новый лаунчер получает билет Steam, а сервер
   проверяет SteamID. Гостям игровой аккаунт не нужен; при режиме одобрения требуется
   разрешение администратора. Режим аккаунта дополнительно требует **входа в игре**.
   [Steam и варианты входа](docs/docs_ingame_login.md).

Для файлов, предоставленных оператором сервера, аккаунт Nexus/Vortex не нужен.
Skyrim и необходимые файлы Bethesda/DLC должны быть установлены локально.
EXE лаунчера не содержит DLL SkyMP/SKSE: оператор публикует клиентский пакет отдельно.
Доступны подготовка без запуска игры и восстановление исходных файлов. Подробнее:
[подключение](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md).

### Создание сервера

1. Распакуйте полный **серверный пакет этого форка для Linux x64 или Windows x64**
   в новую папку. См. [релизы](https://github.com/RealHartlMax/skymp/releases) и
   [состояние локальных сборок](docs/docs_project_status.md). Лаунчер поставляется отдельно.
2. Скопируйте собственные `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`,
   `HearthFires.esm` и `Dragonborn.esm` в `data/`.
3. Из папки с `server-settings.json` запустите `start-test-server.bat` под Windows
   или `sh ./start-test-server.sh` под Linux. Скрипты `launch_server` используют тот же запуск.
4. Откройте **7777/UDP** для игры и **8080/TCP** для HTTP/WebSocket/загрузок;
   для HTTPS используйте TLS reverse proxy на **443/TCP**.
5. Откройте `http://<server>:8080/admin`, введите случайный **четырёхзначный код
   из терминала** и настройте сервер и собственную учётную запись администратора в браузере.
6. Настройте интеграцию с лаунчером в панели. Публичный список требует
   зарегистрированный активный сервер и действующий heartbeat.

Скрипты запуска могут установить приватную среду Node 22 и недостающие системные
пакеты Ubuntu/Debian при наличии прав и интернета. JavaScript-зависимости включены.
Готовые пароли и мастер-файлы Skyrim не поставляются. Остановка, перезапуск или сбой
игрового процесса сохраняют полную панель, журналы, загрузки и настроенного Discord-бота
в веб-процессе. При обновлении сохраняйте настройки, учётные записи, миры, моды и свой gamemode.

[Установка сервера](docs/docs_linux_vps.md) · [Обновление](docs/docs_packaged_server_update.md) ·
[Руководство оператора](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.ru.md)

Для регистрации в интеграции задаются master URL, публичный ID, закрытый ключ и публичный адрес. Стартер проверяет Node 22+, при необходимости ставит частный проверенный Node 22. `npm install` не нужен. Установка недостающих системных пакетов требует интернета/прав и не выполняет полное обновление ОС. Используйте стартер, чтобы вход, настройки, логи, загрузки/Discord продолжали работать отдельно от игры.

## Компоненты и обязанности

| Компонент | Задача | Исходники |
| --- | --- | --- |
| Игра | Нативная симуляция, мир, Papyrus, игроки, sync Linux/Windows x64 | `skymp5-server/` |
| Веб/панель | Браузерная настройка, аккаунты, параметры, модерация, консоль, логи, управление игрой | `skymp5-server/`, `skymp5-front/`, `misc/deploy/test-server/` |
| Discord | Статусы, предупреждения, роли; работает в веб-сервере | [Инструкция](docs/docs_discord_bot.md) |
| Нативный клиент/UI | Skyrim, соединение, вход, интерфейс | `skymp5-client/`, `skyrim-platform/`, `skymp5-front/` |
| Windows-лаунчер | Поиск, профили, загрузки, активация/restore/SKSE; Tauri/React/Rust | [Репозиторий](https://github.com/RealHartlMax/skymp-client-launcher) |
| Веб-службы Worlds | Список, аккаунты, управление, публикация клиента; PHP | [Хостинг](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/PHP_HOSTING.md) |

Сервер использует общие службы либо аналогичную собственную инфраструктуру. Они принадлежат репозиторию лаунчера. В сервере нет EXE лаунчера. Манифест модов/каталог runtime независимы для отдельного обновления.

### Публикация модов и клиента

- Свои `.esp`/`.esm`/`.esl` — в `data/` и `loadOrder`, связанные BSA тоже публикуются.
- Каждый мод — готовая структура в `data/mods/<мод>/`, текстуры/модели/`Scripts/*.pex` и `SKSE/`.
- Серверный `data/scripts/` игрокам автоматически не ставится; нужные скрипты дополнительно публикуйте.
- `GET /api/launcher/manifest` даёт пути, размеры, SHA-256, требования, загрузки/порядок до старта.
- Полный SkyMP/SKSE/Address Library/UI под версию публикуется каталогом в **Интеграция → Пакет клиента / каталог версий**. Пути определяет манифест, включая `Data/Platform/Plugins`, `Data/SKSE/Plugins`, корень игры.

Пакеты содержат готовые файлы, не запускают FOMOD игроку. Bethesda/DLC/Creation Club и приватные данные исключаются. [Моды](docs/docs_launcher_modpacks.md), [runtime](docs/docs_launcher_runtime_updates.md).

### Сеть и независимое управление

| Связь | Стандарт | Назначение |
| --- | --- | --- |
| Игра | `7777/UDP` | Публичная игра/sync |
| Прямой веб | `8080/TCP` | Настройка, панель, HTTP, WebSocket |
| TLS-прокси | Публичный `443/TCP`, внутренний `127.0.0.1:8080/TCP` | HTTPS/WSS, публичный 8080 после настройки не нужен |
| Discord | Исходящий `443/TCP` | HTTPS/WSS без входящего bot-порта |
| Управление | Loopback/приватный Node IPC | Без публичного порта |

Значения настраиваются. Игровой/файловый адреса должны быть доступны игрокам, одного админа недостаточно. WebSocket делит HTTP-порт. Стартер разделяет веб/игру, прямой game-bundle обходит управление. [Порты/процессы](docs/docs_vps_ports_and_process_control.md).

Discord сообщает start/stop/restart/readiness/ошибки/неожиданный выход и живёт при stop игры. Потерю всего веб/VPS бот сообщить не может. Автоматический рестарт игры после сбоя не включён.

## Документация

| Тема | Инструкция |
| --- | --- |
| Доказательства, границы, задачи | [Статус](docs/docs_project_status.md), [frontend-план](../../../ROADMAP_FRONTEND.md) |
| Первый сервер/Ubuntu | [Linux/setup](docs/docs_linux_vps.md) |
| Обновление | [Пакеты](docs/docs_packaged_server_update.md) |
| Firewall, адреса, процессы | [Порты VPS](docs/docs_vps_ports_and_process_control.md) |
| Моды игрокам | [Моды лаунчера](docs/docs_launcher_modpacks.md) |
| Нативный клиент/обновления | [Каталоги runtime](docs/docs_launcher_runtime_updates.md) |
| Список/master/онлайн | [SkyMP Worlds](docs/docs_launcher_worlds.md) |
| Steam/гости/legacy | [Доступ](docs/docs_ingame_login.md) |
| Discord/мониторинг | [Discord](docs/docs_discord_bot.md) |
| Конфигурация/консоль | [Настройки](docs/docs_server_configuration_reference.md), [команды](docs/docs_admin_console_commands.md) |
| Клиент/разработка | [Установка](docs/docs_client_installation.md) |
| Подключение/управление | [Связь](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md), [DE](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.de.md)/[EN](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.en.md)/[RU](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.ru.md) |
| PHP | [Хостинг](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/PHP_HOSTING.md) |
| Структура | [Репозиторий](docs/docs_repository_structure.md) |

## Разработка

Клонируйте с подмодулями:

```sh
git clone --recurse-submodules https://github.com/RealHartlMax/skymp.git
cd skymp
```

Инструменты/настройка/участие — [CONTRIBUTING.md](CONTRIBUTING.md). Проверенная Linux-среда/сборка — [свой форк](docs/docs_linux_vps.md#eigenen-fork-bauen). После CMake сборка/тесты **внутри `build/`**:

```sh
cmake --build .
ctest --verbose
```

Результаты в `build/dist/server/`, `build/dist/client/`; тестовые пакеты/доказательства отдельно `build/releases/`. Лаунчер/runtime/PHP собираются в [репозитории лаунчера](https://github.com/RealHartlMax/skymp-client-launcher).

### Проверки и совместимость

Пакеты проверены Windows x64/Ubuntu 26.04.1 x64: PIN, вход, нативная готовность, загрузки, UDP, независимые процессы. Discord проверен локально SDK-тестами, реальная доставка отдельно.

Скачивание/процесс Skyrim не доказывают полную сессию. Настоящие Skyrim/SKSE/CEF, мультиплеер, VPS и нагрузка — отдельные шаги. В Windows-suite остаётся `Activate torch`. Нет общей гарантии всех SE/AE/модов. Определяющими являются версии/доказательства конкретных пакетов; [статус](docs/docs_project_status.md).

## Происхождение и лицензии

Основа — [skyrim-multiplayer/skymp](https://github.com/skyrim-multiplayer/skymp). Лаунчер/веб отдельно в [RealHartlMax/skymp-client-launcher](https://github.com/RealHartlMax/skymp-client-launcher).

Лицензии отдельных [сервера](../../../skymp5-server/LICENSE), [клиента](../../../skymp5-client/LICENSE), [frontend](../../../skymp5-front/LICENSE), [Skyrim Platform](../../../skyrim-platform/LICENSE). См. [TERMS.md](TERMS.md), [THIRD_PARTY_LICENSES](../../../THIRD_PARTY_LICENSES). Файлы Skyrim/Bethesda в пакетах отсутствуют.
