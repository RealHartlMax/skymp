[Deutsch](../../de/docs/docs_admin_console_commands.md) · [English](../../en/docs/docs_admin_console_commands.md) · [Русский](docs_admin_console_commands.md)

<a id="admin-console-commands"></a>

# Команды административной консоли

Административная консоль сервера поддерживает небольшой диспетчер команд с явными разрешениями и устаревшим резервным выполнением JavaScript.

Это аутентифицированная **административная консоль dashboard/сервера**. Она отделена от нативных команд Skyrim и зарегистрированных `/`-команд необязательного плагина Chat. [Console Security](docs_console_security.md) управляет нативной клиентской консолью и проверяет нативные запросы в Core. Она не заменяет ни этот диспетчер администратора, ни существующий реестр команд Chat.

<a id="supported-commands"></a>

## Поддерживаемые команды

- `help [command]` — список команд или краткое описание.
- `players` — подключённые игроки с `userId`, `actorId` и именем актёра.
- `kick <userId> [reason...]` — отключить игрока.
- `kick-all [reason...]` — отключить всех игроков.
- `ban <userId> [durationMinutes] [reason...]` — заблокировать игрока.
- `unban <userId>` — снять блокировку.
- `mute <userId> [durationMinutes] [reason...]` — запретить игроку писать.
- `unmute <userId>` — снять запрет.
- `warn <userId> <message...>` — отправить предупреждение.
- `message <userId> <message...>` — отправить личное сообщение.
- `announce <message...>` — показать визуальное объявление всем подключённым игрокам.
- `js <chakraJavaScript...>` — выполнить исходный JavaScript Chakra; только для администраторов.

<a id="aliases"></a>

## Псевдонимы

Для удобства доступны короткие псевдонимы:

- `commands` -> `help`
- `?` -> `help`
- `listplayers` -> `players`
- `lsplayers` -> `players`
- `say` -> `announce`
- `msg` -> `message`
- `pm` -> `message`
- `kickall` -> `kick-all`
- `eval` -> `js`

<a id="permissions"></a>

## Разрешения

Для каждого действия доступ проверяется по административным возможностям:

- `canViewLogs` для `help` и `players`
- `canKick` для `kick` и `kick-all`
- `canBan` для `ban`
- `canUnban` для `unban`
- `canMute` для `mute`
- `canUnmute` для `unmute`
- `canWarn` для `warn`
- `canMessage` для `message` и `announce`
- `canConsole` для `js`

Если команда не распознана, но у пользователя есть `canConsole`, для совместимости сохраняется старое резервное выполнение JavaScript.

`announce` показывается как HUD-баннер в верхней части экрана с плавным появлением и исчезновением, а не как сообщение чата. Быстрое действие dashboard **Отправить объявление** использует тот же существующий клиентский обработчик `announcementToast` и показывает баннер восемь секунд. Текущий клиент отображает не более 240 символов объявления.

<a id="examples"></a>

## Примеры

```text
help
players
kick 12 "spamming chat"
ban 12 1440 "griefing"
mute 18 30 "temporary mute for moderation review"
announce "Server restart in 5 minutes"
js console.log('admin test')
```

Типичные сценарии:

- Начните с `help`, если не знаете, какие команды доступны вашей роли.
- Сначала определите `userId` через `players`, затем выполняйте модерацию.
- Причины с пробелами заключайте в кавычки.
- Используйте `js` только для диагностики или старых сценариев, а не как основной административный путь.

<a id="notes"></a>

## Примечания

- Диспетчер обрезает внешние пробелы и разбирает аргументы с кавычками, поэтому сообщения с пробелами передаются безопасно.
- Команды модерации также пишут в историю администратора и журналы сервера, где применимо.
- Реализация находится в `skymp5-server/ts/ui.ts`.
