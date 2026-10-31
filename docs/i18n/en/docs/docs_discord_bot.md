[Deutsch](../../de/docs/docs_discord_bot.md) · [English](docs_discord_bot.md) · [Русский](../../ru/docs/docs_discord_bot.md)

<a id="discord-bot-und-gameserver-überwachung"></a>

# Discord bot and game-server monitoring

As of 25 October 2026, **server r10**. Dedicated tab/JSON templates/preview in Windows/Linux Full/Update; <=r9 bot fields under **Access & Discord**. Monitoring since r4. Bot belongs to persistent web `dist_back/skymp5-admin.js`; native game opens no Gateway. Bundled `server-supervisor.cjs` manages both.

<a id="einrichtung-im-browser"></a>

## Browser setup

1. Create own application/bot in [Developer Portal](https://discord.com/developers/applications), invite to guild. Target permissions **View Channel**, **Send Messages**, optional **Embed Links**. No Administrator needed.
2. Dashboard **Settings → Discord settings** or **CFG → Discord**, direct `/admin?devUi=1&admin=1#discord` with valid session. Enable, enter token/guild ID.
3. **Status channel ID** for start/stop/restart/crash; optional **warning channel** for dashboard warnings. May be same but separate settings. Discord developer mode copies IDs.
4. **Save Discord settings** applies immediately in web, no game/web restart. Shows connection/error; delivery may take seconds.

Token with/without `Bot ` accepted/normalized. Never publish/copy into reports; config/backups still contain it.

Works with `offlineMode: true`. Status monitoring alone never changes access rules; login/bot separate.

<a id="status-embed-und-json-vorlagen"></a>

## Status embed and JSON templates

**Use status embed** attaches designed card to existing messages, initially off for existing installs. First editor: title/description/up to 25 fields/footer/fixed HTTP(S) URL/timestamp. Second: status labels/hex colors/up to five link buttons:

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

Placeholders: `{{serverName}}`, `{{statusString}}`, `{{statusKey}}`, `{{serverClients}}`, `{{serverMaxClients}}`, `{{serverAddress}}`, `{{uptime}}`, `{{timestamp}}`. `statusKey`: `running`, `starting`, `stopping`, `stopped`, `crashed`. `serverAddress` uses `publicHost`/`externalHost`/game port, missing `—`. Missing player counts unknown. Online/start-stop/offline colors. Buttons fixed HTTP(S), no placeholders. Emoji Unicode or Discord ID.

Preview/bot share renderer; choose preview state, sends nothing. Discord Markdown/custom emoji may render differently. Editors offer **Discard changes**/**Restore default**, bottom button discards whole draft. Only Save applies. Invalid templates stay form, never replace valid file. Retry failed save with same inputs. Tokens initially hidden.

Dedicated save changes bot/Discord-auth only, preserves game/Steam/other settings. Unsaved general drafts survive CFG-tab switch. Template/channel change retains connection; token/guild/member-monitoring can reconnect. Game unchanged.

Cards sent on lifecycle/applying settings, snapshots rather than continuously edited/pinned message. txAdmin `/status add` is not SkyMP command. [Embed limits](https://docs.discord.com/developers/resources/message#embed-limits), [link buttons](https://docs.discord.com/developers/components/reference#button) apply. Unknown placeholders/length/colors/unsafe URLs rejected browser/server. Keys/tokens never placeholders, mentions off.

<a id="api-und-sprachfassungen--api-and-translations--api-и-переводы"></a>

## API and translations

`GET /api/admin/discord/settings` supplies authenticated admin config/default templates, `Cache-Control: no-store`. `POST /api/admin/discord/settings`: `{ "discordBot": { ... } }`, admin `canConsole`, same-origin JSON; returns `restartRequired: false`. Bot stays web, no extra inbound port. Full private response includes token; never publish it.



<a id="meldungen-und-lebensdauer"></a>

## Messages and lifecycle

| Event | Behavior |
| --- | --- |
| Game starting | Start notice, online only after ready |
| Planned stop | Stopping/stopped notices, bot/dashboard remain |
| Planned restart | Restart/online after success, no extra bot login |
| Unexpected exit | Crash with exit/signal, unexpected code 0 also failure |
| Startup failure/timeout | Failed-start notice |
| Discord interruption | SDK reconnect/bounded pending queue |
| Bot login failure | Error/retry 30 seconds, game continues |
| Disable bot | Stop connection/queue/retries |
| Whole starter graceful stop | End game, briefly flush final message, end bot/dashboard |

Status language `localeRouting.defaultLanguage` DE/EN/RU, others English. Mentions disabled so names/warnings never ping roles/everyone. Channel guild checked before send.

Detects process exit/readiness, not hung simulation in live process. No automatic crash restart, dashboard **Start** remains. Whole VPS/web loss/hard kill cannot be reported by same-host bot; final shutdown messages best effort.

Queue at most 50 in memory, not persisted across web restart. Missing channel rights logged; `lastMessageAt` confirms delivered. No guarantee during Discord outage.

<a id="spielerzugang-sperrrollen-und-login-protokoll"></a>

## Player access, ban roles and login logs

`joinAccess.mode: discordMember`/`discordRoles` still use online login/member check. Saving adds selected guild to `discordAuth.guilds`, preserves other guild roles/channels. Status-only bot adds no restriction.

Existing advanced login settings:

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

- `banRoleId` blocks online login. New assignment relayed by web bot/private IPC to game, which disables matching characters/disconnects active users. If stopped, check on next online login.
- `eventLogChannelId`: existing login notices via game→web bot, separate from status/warnings. May include player IP/profile/character mapping.
- `hideIpRoleId`: hides IP in these notices.

Enable privileged **Server Members Intent** in portal for live ban monitoring; status/warnings-only bot does not request it. [Gateway intents](https://docs.discord.com/developers/events/gateway#privileged-intents), membership uses [Bot Authorization](https://docs.discord.com/developers/reference#authentication). `offlineMode` has no verified Discord-player identity/role check.

`discordBot.enabled: false` stops Gateway/messages. `discordAuth` access checks remain independent. [Admin Discord login](docs_admin_discord_oauth.md) separate OAuth, not disabled by this switch.

<a id="betrieb-und-update"></a>

## Operation/update

Use `start-test-server.sh`/`.bat`/starter alias. Direct game bundle bypasses bot/independent dashboard/control.

Update `server-supervisor.cjs`, both `dist_back/` files/maps and `ui/` together. Preserve `server-settings.json`, admin/world/mods/scripts. `DISCORD-BOT.md` also in Full. **No extra inbound ports**; outbound HTTPS/WSS TCP 443/DNS.

<a id="prüfumfang"></a>

## Validation scope

`skymp5-server/tests/discordBot.integration.mjs` tests production against simulated SDK: config/messages/reconnect/errors/disabled/channel/ban roles. `misc/tests/test_dashboard_runtime.cjs --discord-fixture` real dashboard/supervisor with fake SDK: process changes/IPC/unchanged bot-dashboard. Platform/package results per-build `VALIDIERUNG.json`.

Tests send no Discord messages. Own invite/intents/rights/delivery must be verified on operator Discord. No slash commands/chat bridge/voice-channel adapter/tickets.

25 October sources/separate-save API checked Windows Node 24/Ubuntu 26.04 Node 22.22.1 with fake SDK. Visible Chromium: exact `#discord`, token/JSON/URL/placeholder errors, discard/default, rejected/retried save, tab draft, permissions, 360/390/768px. Isolated production passes scoped WCAG A/AA. No manual screenreader/CEF/real Discord proof.

Server/frontend TS, units, six dictionaries checked. CMake now tracks shared JS renderer/both backends. Initially isolated changes ship in r10 both backends/frontend Full/Update Win/Linux. Browser `build/discord-validation/VALIDIERUNG.json`, package/platform `build/releases/2026-10-25-server-r10/`.
