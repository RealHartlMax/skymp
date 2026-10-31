[Deutsch](../../de/docs/docs_server_configuration_reference.md) · [English](../../en/docs/docs_server_configuration_reference.md) · [Русский](docs_server_configuration_reference.md)

<a id="server-configuration-reference"></a>

# Справочник конфигурации сервера

> **Новое:** моды теперь находятся в `data/mods/<мод>/`; `client-resources` больше не читается. Сведения о нём на этой странице устарели. См. [моды в data/mods](docs_mod_folders.md).

Рекомендуется задавать все необходимые значения в `server-settings.json`. Это стандартный JSON без комментариев в стиле C. См. также [API командной строки](docs_server_command_line_api.md).

Проверено по локальному checkout **26 октября 2026 года**. Примеры `json5` ниже иллюстрируют отдельные поля; настоящий файл требует ключи в кавычках и не допускает комментарии. Границы проверки см. в [статусе проекта](docs_project_status.md), первую установку из пакета — в [настройке через браузер](docs_linux_vps.md).

<a id="restartschedule-game-only-restarts-r12"></a>

## restartSchedule (перезапуски только игры, r12)

Используйте **Настройки → Игровой сервер**, а не редактирование JSON. Необязательный объект `restartSchedule` содержит `enabled` (по умолчанию `false`), `timeZone` (имя IANA, например `Europe/Berlin`), `times` (до двенадцати ежедневных значений `HH:mm`) и `warningMinutes` (до пяти целых минутных значений от 1 до 60). Нужен комплектный supervisor; остановленная игра не запускается, dashboard остаётся онлайн. Занятые срабатывания и пропуск ближайшего сохраняются в `dataDir`; сохраняйте их при обновлении. См. [работу, перевод часов и API](docs_dashboard_operations.md).

<a id="playeraccess-steam-authentication-r5"></a>

## playerAccess (аутентификация Steam, r5)

Используйте настройку через браузер или **CFG → Доступ и Discord**. Например:

```json
{
  "playerAccess": {
    "mode": "guest",
    "approvalRequired": true,
    "steamApiKey": "<private 32-character Steam Web API key>",
    "steamAppId": 489830
  }
}
```

`guest` не требует учётную запись master; `account` после проверки Steam требует настроенный вход в master внутри игры. Steam обязателен в обоих режимах, включая старый `offlineMode`. `approvalRequired` действует для гостей, правила `joinAccess` — для режима аккаунта. Если нового ключа нет, принимается псевдоним `steam_webApiKey`. Без действительного ключа вход невозможен. App ID по умолчанию относится к Skyrim SE/AE. Храните ключ на сервере: одна SteamID не является доказательством. После изменения доступа перезапустите игровой сервер. Сессии, защита от повторного входа и требования обновления описаны в [контракте входа и API](docs_ingame_login.md).

## name

Имя сервера, публикуемое на master-сервере.

```json5
{
  // ...
  name: 'My Server',
  // ...
}
```

## masterKey

Частный ключ, которым сервер аутентифицирует heartbeat Master API. В SkyMP Worlds игроки используют публичный `serverUid`; не распространяйте частный `masterKey` в клиентской конфигурации. Старые master могут использовать один ключ маршрутизации для обеих целей. При обновлении сохраняйте существующую идентичность сервера.

```json5
{
  // ...
    masterKey: '<private key from the owner dashboard>',
  // ...
}
```

<a id="master-serveruid-and-publichost"></a>

## master, serverUid и publicHost

`master` — базовый HTTP(S) URL регистрации и запросов аккаунтов/сессий. `serverUid` — публичный идентификатор сервера для игроков; `masterKey` остаётся частным. `publicHost` объявляет доступное извне имя/IP игры и не привязывает сетевой сокет. `externalHost` также принимается как резервный объявляемый хост. Адреса привязки остаются `listenHost` и `uiListenHost`.

Текущее локальное значение `Settings` по умолчанию — `https://api.skymp-worlds.net`. Явно заданные существующие настройки master имеют приоритет.

Для существующей PHP-интеграции SkyMP Worlds добавьте эти поля в имеющуюся конфигурацию, сохранив собственные ID и данные сервера:

```json
{
  "master": "https://api.skymp-worlds.net",
  "serverUid": "<public dashboard ID>",
  "masterKey": "<private dashboard key>",
  "publicHost": "play.example.org",
  "offlineMode": false,
  "masterHeartbeatIntervalMs": 15000
}
```

Heartbeat использует `POST <master>/api/servers/<privateMasterKey>`. Интервал ограничен 10–30 секундами (по умолчанию 15). Офлайн-тестовый режим не публикует heartbeat. Загрузка сайта и настройка аккаунтов отделены от конфигурации игрового сервера; см. [SkyMP Worlds](docs_launcher_worlds.md).

## launcherResources

Публичная публикация модов до запуска игры, отдельно от административного сканера инвентаря.

```json
{
  "launcherResources": {
    "enabled": true,
    "directory": "./client-resources",
    "runtimeSource": "https://files.example.org/client-runtime/catalog.json"
  }
}
```

- Если объект отсутствует, значения времени выполнения: включено, каталог `./client-resources`, источник runtime отсутствует.
- Текущий генератор конфигурации CMake дополняет отсутствующие значения внешним каталогом runtime `https://update.skymp-worlds.net/client-runtime/catalog.json`. Явные существующие значения, включая `runtimeSource: ""`, сохраняются. `-DSKYMP_RUNTIME_CATALOG_URL=""` отключает это генерируемое предложение по умолчанию, но не меняет явно сохранённые настройки. Настроенный URL не доказывает загрузку содержимого или его игровую приёмку.
- Отдельные клиентские файлы размещаются в `directory/Data/`; собственные серверные плагины из `loadOrder` и соответствующие BSA также публикуются из `dataDir`.
- `runtimeSource` необязателен: абсолютный HTTP(S) URL без учётных данных, query и fragment. Он может указывать на манифест runtime или каталог выбора версии, понятный текущему desktop launcher.
- `GET /api/launcher/manifest` публикует размеры, SHA-256, пути, порядок загрузки и локальные игровые требования. Master-файлы Bethesda и частные серверные файлы исключены.
- Нативные DLL/JS используют отдельный пакет runtime. Ручной источник runtime в launcher имеет приоритет над объявленным.

См. [публикацию модов](docs_launcher_modpacks.md) и [каталог runtime](docs_launcher_runtime_updates.md). Корректный пакет или загрузка не доказывает нативную совместимость игры.

## joinAccess

Политика входа в онлайн-игру, проверяемая `systems/login.ts` после получения профиля игрока. Она отделена от доступа к административной панели.

```json
{
  "joinAccess": {
    "mode": "approvedLicense",
    "rejectionMessage": "Please ask the server team for access.",
    "approvedLicenses": ["<profile license identifier>"],
    "approvedDiscordIds": [],
    "discordRoleIds": []
  }
}
```

| Поле/значение | Поведение |
| --- | --- |
| `mode: "open"` | По умолчанию; дополнительной политики входа нет |
| `mode: "adminOnly"` | Нужна запись в `approvedLicenses` или `approvedDiscordIds`; сама роль dashboard доступа не даёт |
| `mode: "approvedLicense"` | Нужен соответствующий идентификатор лицензии профиля |
| `mode: "discordMember"` | Нужны связанная идентичность Discord и успешная проверка членства |
| `mode: "discordRoles"` | Нужны связанная идентичность Discord, подтверждённое членство и хотя бы одна роль из `discordRoleIds` |
| `rejectionMessage` | Основной текст отказа; сервер добавляет конкретную причину |
| `approvedLicenses`, `approvedDiscordIds`, `discordRoleIds` | Массивы идентификаторов; дубликаты и пустые записи нормализуются |

Неизвестные режимы возвращаются к `open`; используйте форму доступа dashboard или проверьте написание. Режимы Discord отклоняют вход, если проверка недоступна, аккаунт не связан, членство не подтверждено или требуемые роли не настроены. `approvedLicense` не считает список Discord ID совпадением лицензии. Офлайн-тестовые идентичности используют другой путь входа и не заменяют проверенные публичные аккаунты игроков.

<a id="discordauth-and-discordbot"></a>

## discordAuth и discordBot

Онлайн-интеграция входа читает `discordAuth.botToken` и `discordAuth.guilds`. Каждая guild задаёт `guildId` и может указать `banRoleId`, `eventLogChannelId`, `hideIpRoleId`.

```json
{
  "discordAuth": {
    "botToken": "<operator token>",
    "guilds": [{ "guildId": "123456789012345678" }]
  },
  "discordBot": {
    "enabled": false,
    "token": "",
    "guildId": "",
    "statusChannelId": "",
    "warningsChannelId": ""
  }
}
```

Форма Discord в Admin CFG использует `discordBot`: `enabled`, `token`, `guildId`, `statusChannelId`, `warningsChannelId`. В новых пакетах бот отключён. С r4 он работает исключительно в независимом процессе dashboard, включая офлайн-режим игры. Статусы охватывают запуск, готовность, остановку, перезапуск, ошибку запуска и сбой игры. Предупреждения dashboard и настроенные журналы входа используют того же бота. Управление игрой сохраняет соединение Discord. Сохранение применяет настройки сразу; `GET /api/admin/status` сообщает состояние соединения, ошибок и доставки без токенов.

Исходники после r9 добавляют **CFG → Discord**, также доступный из настроек, и отдельный GET/POST API `/api/admin/discord/settings` только для владельца. Сохранение сохраняет остальные настройки и действует сразу. `statusEmbedEnabled` по умолчанию `false`; `statusEmbed` задаёт заголовок, описание, поля, подвал, URL, время, а `statusConfig` — подписи online/partial/offline, цвета `#RRGGBB` и до пяти HTTP(S)-кнопок. Значения по умолчанию следуют языку сервера. Предпросмотр и транспорт используют общие проверки и обработку подстановок. См. [руководство шаблонов](docs_discord_bot.md#status-embed-und-json-vorlagen). Эти изменения исходников ещё не вошли в новый релизный пакет.

Сохранение режима `joinAccess` на основе Discord добавляет основную guild в `discordAuth.guilds`, сохраняя существующие guild и их настройки модерации/журналов. Одно наблюдение не создаёт ограничение входа. Старые боты только с `discordAuth` остаются активными до явного отключения через `discordBot.enabled`. Отключение останавливает Gateway/уведомления; онлайн-проверки входа и admin OAuth остаются отдельными. Токены нормализуются с префиксом `Bot ` или без него.

Полный ответ CFG администратора и частные файлы конфигурации/резервных копий содержат токен; обращайтесь с ними как с секретами. Полный CFG доступен только администраторам. Настройка, права каналов, привилегированный member intent, границы жизненного цикла и различие симуляции и реальной доставки описаны в [работе бота Discord](docs_discord_bot.md). Admin Discord OAuth — отдельный механизм, см. [Admin Discord OAuth](docs_admin_discord_oauth.md).

## showCharacterNicknames

Логическое значение, по умолчанию `true`. Управляет именами персонажей над удалёнными актёрами. Сервер передаёт выбор при соединении и рассылает изменения из общей формы Admin CFG. Явный выбор сервера имеет приоритет над локальным переключателем F1.

```json
{ "showCharacterNicknames": false }
```

## listenHost

IP-адрес привязки основного UDP-трафика (RakNet). Без указания используется `0.0.0.0`.

```json5
{
  // ...
  listenHost: '127.0.0.1',
  // ...
}
```

## uiListenHost

IP-адрес привязки `uiPort` (HTTP). Без указания используется `0.0.0.0`.

```json5
{
  // ...
  uiListenHost: '127.0.0.1',
  // ...
}
```

## adminApi

Поведение Admin API и URL dashboard.

- `enabled` определяет доступность маршрутов Admin API.
- `externalUrl` можно оставить пустым (`""`); тогда автоматическое определение использует заголовки `Host` и `X-Forwarded-Proto`.
- Явно заданный `externalUrl` используется для формирования URL dashboard.

```json5
{
  // ...
  adminApi: {
    enabled: true,
    externalUrl: '',
  },
  // ...
}
```

## metricsAuth

HTTP Basic аутентификация конечной точки `/metrics`.

Если параметр отсутствует, `/metrics` недоступен.

```json5
{
  // ...
  metricsAuth: {
    user: 'prometheus',
    password: 'secret',
  },
  // ...
}
```

## adminUiAuth

Учётные данные веб-панели администратора (`/admin`).

Устаревшие начальные учётные данные. Текущая настройка создаёт хранилище scrypt в `<dataDir>/admin-auth.json`, имеющее приоритет. Старые данные `adminUiAuth`/`metricsAuth` могут мигрироваться с удалением открытого ключа из `server-settings.json`. Пакеты первой настройки в браузере не содержат готового аккаунта: используйте PIN терминала и создайте владельца в браузере. См. [API сессий администратора](docs_running_a_server.md#admin-session-api).

```json5
{
  // ...
  adminUiAuth: {
    user: '<legacy owner>',
    password: '<legacy password to migrate>',
  },
  // ...
}
```

## uiPort

HTTP-порт ресурсов сервера и маршрутов dashboard, например `/admin`, `/api/admin/*`, `/metrics`.

Если не указан, сервер использует `port`.

```json5
{
  // ...
  uiPort: 8080,
  // ...
}
```

## port

Через этот порт игровые клиенты соединяются с сервером. Текущая версия Skyrim Multiplayer использует несколько портов и протоколов для разных пакетов. Подробнее в [назначении портов](docs_server_ports_usage.md).

```json5
{
  // ...
  port: 7777,
  // ...
}
```

## maxPlayers

Устанавливает предел игроков. Видно в launcher и на skymp.io.

```json5
{
  // ...
  maxPlayers: 108,
  // ...
}
```

## dataDir

Относительный или абсолютный путь к каталогу "data", содержащему:

- исходные master-файлы Skyrim (Skyrim.esm, Update.esm и т. д.)
- файлы плагинов (моды .esp)
- скомпилированные скрипты Papyrus .pex

Каталог предоставляется по HTTP через `uiPort`.

Сейчас сервер использует каталог также для собственных нужд:

- хранение веб-интерфейса в `${dataDir}/ui`
- хранение автоматически создаваемого манифеста используемых .esm/.esp и их CRC32

```json5
{
  // ...
  dataDir: 'data',
  // ...
}
```

## loadOrder

Список относительных или абсолютных путей .esp/.esm, загружаемых сервером при старте в том же порядке, что и Skyrim SE.

Относительные пути ищутся в `${dataDir}`.

Абсолютные пути работают, но недоступны через `uiPort`. Внешние инструменты не смогут скачать их с сервера.

```json5
{
  // ...
  loadOrder: [
    'Skyrim.esm',
    'Update.esm',
    'Dawnguard.esm',
    'HearthFires.esm',
    'Dragonborn.esm',
  ],
  // ...
}
```

## archives

Задаёт BSA-архивы, загружаемые сервером.

Сейчас используется только для скомпилированных скриптов Papyrus.

Относительные и абсолютные пути работают аналогично esp/esm.

```json5
{
  // ...
  archives: ['Skyrim - Misc.bsa'],
  // ...
}
```

## lang

Язык перевода, получаемого из строковых файлов в Data/strings.

```json5
{
  // ...
  lang: 'english',
  // ...
}
```

## offlineMode

Устаревший переключатель. В r5 `true` выбирает гостевой доступ Steam и отключает старый вход в master-аккаунт; произвольные выбранные клиентом ID профиля он не разрешает. Launcher должен получить проверенную сессию Steam. Новые конфигурации используют `playerAccess.mode: "guest"` с `offlineMode: false`. См. [Steam и режимы входа](docs_ingame_login.md).

```json5
{
  // ...
  offlineMode: true,
  // ...
}
```

## databaseDriver

Имя драйвера хранения данных сервера, по умолчанию `file`. Связанные параметры включают `"databaseName"`. Подробнее в [драйверах базы данных](docs_database_drivers.md).

```json5
{
  // ...
  databaseDriver: 'file',
  // ...
}
```

## reloot

Время в миллисекундах до восстановления исходного состояния игрового объекта. В отличие от Skyrim SE, Skyrim Multiplayer не имеет встроенного сброса ячеек. Вместо этого сервер сбрасывает каждый объект мира раз в час. Параметр меняет интервал для каждого вида объектов. Например, `"CONT"` — контейнеры: сундуки, бочки и т. д. См. "record types" на [UESP](https://en.uesp.net/wiki/Skyrim_Mod:Mod_File_Format).

```json5
{
  // ...
  reloot: {
    FLOR: 86400000,
    TREE: 86400000,
    AMMO: 86400000,
    ARMO: 86400000,
    BOOK: 86400000,
    INGR: 86400000,
    ALCH: 86400000,
    SCRL: 86400000,
    CONT: 86400000,
    SLGM: 86400000,
    WEAP: 86400000,
    MISC: 86400000,
  },
  // ...
}
```

## forbiddenReloot

Запрещает повторное появление добычи для предмета или группы по типу записи espm. См. [UESP](https://en.uesp.net/wiki/Skyrim_Mod:Mod_File_Format).

```json5
{
  // ...
  // here your record types go
  "forbiddenReloot": ["FLOR", "TREE", "BOOK", ... ]
  // ...
}
```

## itemPickupMode

Управляет подбором предметов мира при активации отдельных объектов, растений или деревьев.

- `"allow"` (по умолчанию): сохраняет текущее поведение, предмет подбирается сразу.
- `"minigame"`: перед подбором вызывает `mp.onItemPickupAttempt(...)`. Если любой слушатель блокирует событие, подбор запрещён.
- `"block-all"`: полностью отключает подбор предметов мира.

```json5
{
  // ...
  itemPickupMode: 'minigame',
  // ...
}
```

При `itemPickupMode: "minigame"` сервер вызывает этот перехватчик:

```ts
mp.onItemPickupAttempt = (
  sourceRefrId: number,
  actorRefrId: number,
  itemBaseId: number,
  itemCount: number,
  isOwned: boolean,
  isQuestItem: boolean,
) => {
  // return false to block pickup
  return !isOwned && !isQuestItem;
};
```

## timeScale

Управляет скоростью игрового времени относительно реального. По умолчанию `20` (стандарт Skyrim).

Формула: **1 реальная секунда = `timeScale` игровых секунд**.

| `timeScale` | 1 реальная секунда = … в игре | 1 реальная минута = … в игре | Примечания |
|-------------|------------------------------|-----------------------------|------------|
| `1` | 1 с | 1 мин | Реальное время — часы совпадают с реальным миром |
| `20` | 20 с | 20 мин | **Стандарт Skyrim** — игровые сутки ≈ 72 реальные минуты |
| `60` | 1 мин | 1 ч | Игровые сутки ≈ 24 реальные минуты |
| `3600` | 1 ч | 1 день | Экстремально — игровые сутки ≈ 24 реальные секунды |
| `0` | 0 с | 0 мин | Остановить время |

```json5
{
  // ...
  timeScale: 20,
  // ...
}
```

## itemsEnabled

При `false` ссылки предметов мира не создаются. Отдельные предметы в игровом мире не появляются. По умолчанию `true`.

Полезно PvP-серверам, которым не нужна добыча подземелий.

```json5
{
  // ...
  itemsEnabled: false,
  // ...
}
```

## itemLoadFilter

Подробный фильтр владения при `itemsEnabled: true` на основе поля `XOWN` записи ESP/ESM.

- `skipOwned` (по умолчанию `false`): пропускать предметы NPC/фракций (`XOWN != 0`), например товары магазинов и предметы для кражи.
- `skipUnowned` (по умолчанию `false`): пропускать свободную добычу (`XOWN == 0`), например предметы подземелий без владельца.

Оба флага можно включить одновременно: тогда предметы не создаются, как при `itemsEnabled: false`.

```json5
{
  // ...
  itemLoadFilter: {
    skipOwned: true,   // no shop/NPC items
    skipUnowned: false, // keep free dungeon loot
  },
  // ...
}
```

## pluginDiscovery

Управляет обработкой новых плагинов, обнаруженных при запуске.

- `mode: "safe"` (рекомендуется для службы/продакшена): новые плагины остаются отключёнными (`startupEnabled: false`) и требуют ручного включения.
- `mode: "prompt"`: при запуске на TTY для каждого нового плагина появляется запрос да/нет.
- `mode: "auto"`: новые плагины включаются и запускаются в тот же запуск без запроса терминала.

При отсутствии или неверном значении используется `"safe"`. Все режимы сохраняют настройки запуска известных плагинов, включая явно отключённые ранее. **Ресурсы → Серверные плагины** позволяет сохранять режим, включать/отключать отдельные плагины или включать все обнаруженные отключённые с существующим манифестом. Изменения действуют при следующем запуске игрового сервера. Используйте `auto` только для каталога с проверенным кодом.

```json5
{
  // ...
  pluginDiscovery: {
    mode: 'safe',
  },
  // ...
}
```

См. также `pluginsLoadOrder` и документацию системы плагинов.

Необязательный вложенный ключ:

- `processCommandAllowlist`: массив строк, ограничивающий команды плагинов `kind: process`.
- Сопоставляется полная строка команды или её базовое имя.
- Без параметра дополнительных ограничений нет (обратная совместимость).

```json5
{
  // ...
  pluginDiscovery: {
    mode: 'safe',
    processCommandAllowlist: ['node', 'node.exe'],
  },
  // ...
}
```

## pluginsLoadOrder

Явный порядок загрузки плагинов. Сначала запускаются перечисленные плагины в указанном порядке, затем остальные включённые по алфавиту.

```json5
{
  // ...
  pluginsLoadOrder: ['core', 'chat-server', 'emotewheel'],
  // ...
}
```

## pluginDiscovery.abortOnPluginError

При `true` синхронная ошибка запуска не-`optional` плагина останавливает запуск сервера, если доходит до bootstrap. По умолчанию `false`. Параметр вложен в `pluginDiscovery`; верхнеуровневый `abortOnPluginError` загрузчик не читает.

Текущий временный загрузчик JavaScript журналирует ошибки внутри, поэтому они могут не дойти до bootstrap. Асинхронные ошибки процессов также приходят после запуска. Помимо статуса проверяйте журналы и реальное поведение плагина. См. [систему плагинов](../README-plugins.md).

```json5
{
  // ...
  pluginDiscovery: {
    mode: 'safe',
    abortOnPluginError: true,
  },
  // ...
}
```

## gamemodePath

Относительный или абсолютный путь к файлу или каталогу gamemode. Для каталога ищется `index.js`.

```json5
{
  // ...
  gamemodePath: 'gamemode.js',
  // ...
}
```

## startPoints

Список точек появления, из которых одна выбирается случайно.

```json5
{
  // ...
  startPoints: [
    {
      pos: [22659, -8697, -3594],
      worldOrCell: '0x1a26f',
      angleZ: 268,
    },
  ],
  // ...
}
```

## startSpawn

Единственная точка появления новых персонажей. При наличии `startSpawn` сервер использует её как единственную начальную точку.

```json5
{
  // ...
  startSpawn: {
    pos: [22659, -8697, -3594],
    worldOrCell: '0x1a26f',
    angleZ: 268,
  },
  // ...
}
```

Используется только при первом создании персонажа. После этого актёр возрождается в сохранённом `spawnPoint`.

## starterInventory

Инвентарь, один раз назначаемый новым персонажам.

```json5
{
  // ...
  starterInventory: {
    entries: [
      {
        baseId: 0x1397e,
        count: 1,
        worn: true,
      },
      {
        baseId: 0x12eb7,
        count: 1,
        worn: true,
      },
      {
        baseId: 0x3eada,
        count: 10,
      },
    ],
  },
  // ...
}
```

Поддерживаемые поля записей:

- `baseId`
- `count`
- `worn`
- `wornLeft`
- `health`
- `enchantmentId`
- `maxCharge`
- `removeEnchantmentOnUnequip`
- `chargePercent`
- `name`
- `soul`
- `poisonId`
- `poisonCount`

## isPapyrusHotReloadEnabled

Логический параметр включения или отключения горячей перезагрузки скомпилированных скриптов Papyrus (.pex).

```json5
{
  // ...
  isPapyrusHotReloadEnabled: false,
  // ...
}
```

## locale

Имя файла локализации в `data/localization`, используемого Papyrus-функцией `M.GetText`, без расширения.

```json5
{
  // ...
  locale: 'ru-RU',
  // ...
}
```

## localeRouting

Управляет выбором языка frontend по коду страны; используется маршрутами определения языка администратора/клиента.

- `defaultLanguage`: резервный язык при отсутствии сопоставления.
- `countryCodeToLanguage`: карта кодов стран ISO в коды языков.

При отсутствии или неверном значении применяются безопасные значения: `defaultLanguage: "en"` и встроенные сопоставления для `de`, `en`, `es`, `ru`.

```json5
{
  // ...
  localeRouting: {
    defaultLanguage: 'en',
    countryCodeToLanguage: {
      DE: 'de',
      AT: 'de',
      CH: 'de',
      US: 'en',
      GB: 'en',
      ES: 'es',
      MX: 'es',
      RU: 'ru',
    },
  },
  // ...
}
```

## enableConsoleCommandsForAll

Устарел. `true` игнорируется с `LEGACY_CONSOLE_BYPASS_IGNORED`. Параметр никогда не даёт права на серверные консольные команды. Удалите его и явно настройте `consoleSecurity`. Существующие разрешения актёров `consoleCommandsAllowed` остаются доступны доверенному серверному коду.

## consoleSecurity

Core управляет защитой консоли независимо от Chat. По умолчанию:

```json
{
  "consoleSecurity": {
    "mode": "restricted",
    "blockVanillaCheats": true,
    "blockUnauthorizedServerCommands": true,
    "monitorMovement": true,
    "movementEnforcement": "monitor",
    "logViolations": true,
    "logAllowedAdminCommands": true
  }
}
```

`restricted` всегда блокирует поддерживаемые локальные чит-команды. Только явная политика `development` может задать `blockVanillaCheats:false`; серверная авторизация обязательна в обоих режимах. Неверные значения при запуске безопасно заменяются с диагностикой, а неверные записи dashboard отклоняются.

`movementEnforcement` принимает `off` или `monitor`. Прежнее значение `enforce` никогда не было строже и читается как `monitor`. Существующие жёсткие проверки движения активны во всех режимах. Эвристики скорости и подъёма дают только наблюдения; они не банят и не доказывают noclip. `monitorMovement:false` отключает дополнительные наблюдения.

Настраивайте **Настройки → Безопасность** (`#settings/security`) с ролью администратора и `canConsole`. Изменения действуют после перезапуска игрового сервера. Dashboard сравнивает сохранённые значения с нативным процессом и помечает отчёты клиентских перехватчиков как неподтверждённые. До заявления о доступности защиты нужно обновить Core, клиентский bootstrap и dashboard.

Поддерживаемые перехватчики, проверка нативных запросов, миграция, необязательный resolver и ограничения описаны в [Console Security](docs_console_security.md).

## sweetPieMinimumPlayersToStart

Минимальное число игроков для начала deathmatch. Только SweetPie, на обычный сервер не влияет. По умолчанию 5.

```json5
{
  // ...
  sweetPieMinimumPlayersToStart: 5,
  // ...
}
```

## sweetPieAllowCheats

Не позволяет gamemode отключать читы. Только SweetPie, на обычный сервер не влияет. По умолчанию false.

```json5
{
  // ...
  sweetPieAllowCheats: true,
  // ...
}
```

## sweetPieChatSettings

Позволяет настраивать чат, например радиус видимости сообщений.

```json5
{
  // ...
  sweetPieChatSettings: {
    // Hearing distance in units. If player A says something and player B is farther away, they won't see that message.
    hearingRadiusNormal: 123,
  },
  // ...
}
```

## sweetPieCommandEnabled

Включает или отключает `/new2024`, телепортирующую игрока в зал SweetPie.

```json5
  // ...
  "sweetPieCommandEnabled": true
  // ...
```

## npcEnabled

Включает загрузку NPC. По умолчанию false.

```json5
{
  // ...
  npcEnabled: false,
  // ...
}
```

## npcSettings

Необязательная конфигурация NPC. Может отсутствовать или быть пустой: тогда при `"npcEnabled": true` можно загружать всех NPC. Поля `"NpcSettings"` определяют разрешённые игровые файлы и ограничения появления внутри/снаружи. По умолчанию разрешены все NPC (`"npcSettings": {}`). Поле `"default":{}` задаёт `"spawnInInterior"` и `"spawnInExterior"` для неупомянутых файлов. Поддерживаются фильтры классов:

- `allowHumanoid` (по умолчанию `true`) — разрешить/запретить гуманоидных NPC (ключевое слово `ActorTypeNPC`).
- `allowCreature` (по умолчанию `true`) — разрешить/запретить существ, зверей, монстров.

```json5
{
  // ...
  npcSettings: {
    default: {
      spawnInInterior: true,
      spawnInExterior: false,
      allowHumanoid: true,
      allowCreature: true,
    },
    'Skyrim.esm': {
      spawnInInterior: true,
      spawnInExterior: false,
    },
    'Dawnguard.esm': {
      spawnInInterior: false,
      spawnInExterior: true,
    },
    'DragonBorn.esm': {
      spawnInInterior: true,
      spawnInExterior: true,
    },
  },
  // ...
}
```

Пример: сделать города почти пустыми, сохранив появление животных и монстров.

```json5
{
  npcEnabled: true,
  npcSettings: {
    default: {
      spawnInInterior: true,
      spawnInExterior: true,
      allowHumanoid: false,
      allowCreature: true,
    },
  },
}
```

## weaponStaminaModifiers

Доступно только с "SweetPie.esp". Позволяет гибко настраивать затраты выносливости на атаки по ключевым словам Creation Kit. Без поля используются некоторые жёстко заданные значения по умолчанию.

```json5
{
  // ...
  weaponStaminaModifiers: {
    WeapTypeDagger: 4.0,
    WeapTypeShortSword: 5.0,
    WeapTypeSword: 6.0,
    // ...
  },
  // ...
}
```

## additionalServerSettings

Чтобы автоматизировать получение последних настроек с GitHub, задайте additionalServerSettings в стартовом скрипте или конфигурации так:

```json5
{
  // ...
  additionalServerSettings: [
    {
      type: 'github',
      repo: 'your-org/server-settings-repo',
      ref: 'main', // Specify the branch, tag, or commit hash here
      pathRegex: '^(common|indev)/.*', // No need to check for .json extension
      token: 'YOUR_GITHUB_PERSONAL_ACCESS_TOKEN',
    },
  ],
  // ...
}
```

## damageMultFormulaSettings

Управляет переменными серверной формулы множителя урона. Если "damageMultFormulaSettings" отсутствует, применяются значения по умолчанию.

```json5
{
  // ...
  damageMultFormulaSettings: {
    multiplier: 1.0,
  },
  // ...
}
```

## enableGamemodeDataUpdatesBroadcast

Логический параметр горячей перезагрузки для подключённых клиентов.

- `false` (по умолчанию): изменения gamemode применяются к состоянию сервера, но **не** рассылаются подключённым игрокам. Им нужно войти заново. Это сохраняет стабильность, если скрипты не поддерживают горячую перезагрузку.
- `true`: изменения немедленно рассылаются всем клиентам. Полезно локально, но может вызвать рассинхронизацию или ошибки клиента, если скрипты не рассчитаны на повторное применение во время работы.

```json5
{
  // ...
  enableGamemodeDataUpdatesBroadcast: false,
  // ...
}
```

## supervisor

Комплектные стартеры `start-test-server`/`launch_server` обеспечивают управление процессом автоматически, без shell-команд. С r3 полный dashboard имеет собственный процесс. Остановка/запуск/перезапуск и сбои игры сохраняют настройки, журналы, сессию и WebSocket. `GET /api/admin/status` включает `gameState`, `gamePid`, `dashboardPid`. Аутентифицированный same-origin `POST /api/admin/server/control` принимает `start`, `stop`, `restart` в пакетном режиме и требует `canConsole`. См. [порты VPS и управление процессом](docs_vps_ports_and_process_control.md).

Следующие настройки относятся к **устаревшему прямому backend/внешнему supervisor**. Команда остановки всего сервиса останавливает и его веб-бэкенд; для независимого dashboard используйте комплектный стартер.

- `enabled`: включает/отключает управление supervisor.
- `stopCommand`: команда остановки.
- `restartCommand`: команда перезапуска.

В старом режиме кнопкам остановки/перезапуска нужен настроенный supervisor. Пакетный режим предлагает также запуск остановленной игры; действия над игроками требуют работающий игровой сервер. Дополнительный публичный порт управления не нужен.

```json5
{
  // ...
  supervisor: {
    enabled: true,
    stopCommand: '/opt/skymp/misc/systemd/skymp-supervisorctl.sh stop',
    restartCommand: '/opt/skymp/misc/systemd/skymp-supervisorctl.sh restart',
  },
  // ...
}
```

Примеры развёртывания на Ubuntu 24.04 — в [docs_running_a_server.md](docs_running_a_server.md).
