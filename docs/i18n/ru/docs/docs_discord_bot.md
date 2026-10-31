[Deutsch](../../de/docs/docs_discord_bot.md) · [English](../../en/docs/docs_discord_bot.md) · [Русский](docs_discord_bot.md)

<a id="discord-bot-und-gameserver-überwachung"></a>

# Discord-бот и мониторинг игры

На 25.10.2026, **server-r10**. Отдельная вкладка/JSON/preview в Win/Linux Full/Update, <=r9 поля Access & Discord. Мониторинг с r4. Bot в постоянном web `dist_back/skymp5-admin.js`, native-game Gateway не открывает. Оба под `server-supervisor.cjs`.

<a id="einrichtung-im-browser"></a>

## Настройка в браузере

1. Свой application/bot [Developer Portal](https://discord.com/developers/applications), invite. Права **Смотреть канал**, **Отправлять сообщения**, optional **Встраивать ссылки**; Administrator не нужен.
2. **Настройки → Discord** либо **CFG → Discord**; `/admin?devUi=1&admin=1#discord` с session. Включить/token/guild-ID.
3. **Status-channel** для start/stop/restart/crash, optional **warning-channel** dashboard. Можно одинаковые, настройки отдельные. Developer-mode позволяет копировать ID.
4. **Сохранить Discord** применяется сразу web, без restart. Видны connection/error; доставка через секунды.

Token с/без `Bot ` нормализуется. Не публиковать/в отчёты; config/backups его содержат.

Работает `offlineMode: true`. Status-only не меняет access, login/bot отдельны.

<a id="status-embed-und-json-vorlagen"></a>

## Status-embed/JSON-шаблоны

**Использовать embed** добавляет карточку к старому сообщению, изначально выключено. Первый editor: title/description/до 25 fields/footer/фиксированный HTTP(S)/timestamp. Второй: названия/hex-color/до пяти link-buttons:

```json
{
  "onlineString": "🟢 Online",
  "onlineColor": "#35CBA7",
  "partialString": "🟡 Startet / stoppt",
  "partialColor": "#E5B967",
  "offlineString": "🔴 Offline",
  "offlineColor": "#E58E8E",
  "buttons": [
    { "label": "Community", "url": "https://example.org/", "emoji": "🌐" }
  ]
}
```

Placeholders `{{serverName}}`, `{{statusString}}`, `{{statusKey}}`, `{{serverClients}}`, `{{serverMaxClients}}`, `{{serverAddress}}`, `{{uptime}}`, `{{timestamp}}`. `statusKey`: `running`, `starting`, `stopping`, `stopped`, `crashed`. Адрес из `publicHost`/`externalHost`/game-port, без него `—`. Нет counts — неизвестно. Цвета online/start-stop/offline. Buttons фиксированные HTTP(S), без placeholders. Emoji Unicode/Discord-ID.

Preview/bot общий renderer; выбор state ничего не отправляет. Discord Markdown/emoji могут отличаться. Editors **Отменить**/**Стандарт**, низ отменяет весь draft. Только Save применяет. Неверное остаётся формой, не заменяет файл; можно повторить failed-save. Tokens сначала скрыты.

Отдельный save меняет bot/Discord-auth, сохраняет game/Steam/прочее. Общие unsaved-draft живут между CFG-tabs. Templates/channel не переподключают, token/guild/member-monitoring могут. Игра прежняя.

Карточки при lifecycle/settings — снимки, не редактируемое/закреплённое сообщение. `/status add` txAdmin не команда SkyMP. [Embed-limits](https://docs.discord.com/developers/resources/message#embed-limits), [buttons](https://docs.discord.com/developers/components/reference#button). Unknown-placeholder/length/color/unsafe-URL отклоняются browser/server. Keys/tokens не placeholders, mentions выключены.

<a id="api-und-sprachfassungen--api-and-translations--api-и-переводы"></a>

## API и переводы

`GET /api/admin/discord/settings`: admin-config/default, `Cache-Control: no-store`. `POST /api/admin/discord/settings` `{ "discordBot": { ... } }`, admin `canConsole`, same-origin JSON, `restartRequired: false`. Bot остаётся web, новых входящих нет. Private-response содержит token, не публиковать.



<a id="meldungen-und-lebensdauer"></a>

## Сообщения/жизненный цикл

| Событие | Поведение |
| --- | --- |
| Game-start | Старт, online только ready |
| Planned-stop | Остановка/подтверждение, bot/dashboard живы |
| Planned-restart | Restart/online после успеха, без bot-login |
| Unexpected-exit | Crash с exit/signal, даже неожиданный 0 — failure |
| Start-fail/timeout | Сообщение неудачи |
| Discord-disconnect | SDK-reconnect/ограниченная очередь |
| Bot-login-fail | Error/retry 30 секунд, game не останавливается |
| Disable | Соединение/queue/retry завершаются |
| Full graceful-stop | Сначала game, краткий flush, затем bot/dashboard |

Язык `localeRouting.defaultLanguage` DE/EN/RU, остальные EN. Mentions отключены, имена/warnings не пингуют. Guild канала проверяется.

Видит exit/ready, не зависшую simulation живого процесса. Auto-restart нет, **Start** доступен. Падение VPS/web/hard-kill тот же bot не сообщит, final-send best effort.

До 50 сообщений в памяти, web-restart не переживают. Missing-rights в log, `lastMessageAt` подтверждает доставку. Discord-outage без гарантии.

<a id="spielerzugang-sperrrollen-und-login-protokoll"></a>

## Доступ игроков/ban-roles/login-log

`joinAccess.mode: discordMember`, `discordRoles` используют online/member-check. Save добавляет выбранный guild в `discordAuth.guilds`, сохраняет другие роли/каналы. Status-only не ограничивает вход.

Поддерживаются прежние расширения:

```json
{
  "discordAuth": {
    "botToken": "<dein Bot-Token>",
    "guilds": [
      {
        "guildId": "123456789012345678",
        "banRoleId": "423456789012345678",
        "eventLogChannelId": "623456789012345678",
        "hideIpRoleId": "723456789012345678"
      }
    ]
  }
}
```

- `banRoleId` запрещает online-login; новое назначение web-bot передаёт private-IPC игре, та отключает персонажей/соединения. При stopped проверяется следующий login.
- `eventLogChannelId`: login-уведомления game→bot, отдельно status/warning. Могут содержать IP/profile/character.
- `hideIpRoleId` скрывает IP.

Для live-ban включить **Server Members Intent**. Status/warning-only его не требует. [Intents](https://docs.discord.com/developers/events/gateway#privileged-intents), member-check [Bot Authorization](https://docs.discord.com/developers/reference#authentication). `offlineMode` без verified-Discord-identity/roles.

`discordBot.enabled: false` выключает Gateway/messages, независимый `discordAuth` остаётся. [Admin Discord OAuth](docs_admin_discord_oauth.md) отдельно, не отключается.

<a id="betrieb-und-update"></a>

## Эксплуатация/update

`start-test-server.sh`/`.bat`/alias. Direct-game обходит bot/dashboard/control.

Вместе `server-supervisor.cjs`, оба `dist_back/`/maps, `ui/`. Сохранить `server-settings.json`, admin/world/mod/scripts. `DISCORD-BOT.md` в Full. **Нет новых входящих**, egress HTTPS/WSS TCP 443/DNS.

<a id="prüfumfang"></a>

## Объём проверок

`skymp5-server/tests/discordBot.integration.mjs`: production/fake-SDK, config/messages/reconnect/errors/disabled/channel/ban. `misc/tests/test_dashboard_runtime.cjs --discord-fixture`: настоящий dashboard/supervisor, fake-SDK, process/IPC/прежние bot-dashboard. Результаты release `VALIDIERUNG.json`.

Тесты ничего Discord не отправляют. Real-invite/intents/rights/delivery проверять своими settings. Slash/chat-bridge/voice-adapter/tickets нет.

25.10 sources/save-API Windows Node 24/Ubuntu 26.04 Node 22.22.1/fake-SDK. Chromium: `#discord`, token/JSON/URL/placeholder-errors, discard/default, rejected/retry-save, drafts/permissions/360/390/768px. Production scoped-WCAG A/AA проходит; manual screenreader/CEF/Discord не доказаны.

Server/frontend TS/units/шесть словарей проверены. CMake учитывает shared JS-renderer/оба backends. Изолированное первоначально поставляется r10 Full/Update обоих OS. Browser `build/discord-validation/VALIDIERUNG.json`, package `build/releases/2026-10-25-server-r10/`.
