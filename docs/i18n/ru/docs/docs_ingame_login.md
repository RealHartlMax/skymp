[Deutsch](../../de/docs/docs_ingame_login.md) · [English](../../en/docs/docs_ingame_login.md) · [Русский](docs_ingame_login.md)

<a id="spielerzugang-steam-und-legacy-anmeldung"></a>

# Доступ игроков, Steam и legacy-вход

> **Исходники на 30.10.2026:** Подготовленная новая server/client-реализация при блокировке через `POST /api/admin/player-access` также завершает активные игровые сеансы проверенной SteamID. Клиент показывает уведомление о блокировке и возвращается в главное меню Skyrim; будущий вход тоже запрещён. Нужны последующие согласованные сборка и доставка. Отчёты r8 ниже остаются историческими, не доказывают настоящую Skyrim/CEF-приёмку.

На 24.10.2026, server-r8. Вместе обновить server/desktop-Launcher/`skymp5-client.js`. В server-архиве нет EXE/полного native-client.

r6 даёт fixed-codes key/ticket/limits/network/invalid-response/storage. Numeric Valve-коды передаются без private-log. После update **restart всего starter/dashboard**: `/api/launcher/auth/steam` в web; одного game-restart мало. Причина прежнего VPS-401 не подтверждена.

r7: `steamDescription` только server-log, sanitized Valve-объяснение до 160 символов, без keys/tickets/SteamIDs/URL. Public-HTTP лишь fixed/numeric.

r8 policy v2/compact server-bound `ticketIdentity`. После restart Launcher получает fresh-policy/ticket. Stale-echo `ticketIdentity` до Valve отклоняется HTTP 409/`STEAM_POLICY_CHANGED`. Valve 105 “Identity parameter did not match” — `STEAM_TICKET_AUDIENCE_MISMATCH`. Server-identity приоритетна. Старый Launcher может без echo, но ticket обязан совпасть. Launcher отдельно.

<a id="deutsch"></a>

## Режимы доступа

**Steam обязателен каждому новому режиму.** Launcher берёт `GetAuthTicketForWebApi` у запущенного авторизованного Steam для Skyrim SE/AE App-ID `489830`. Web проверяет Valve/private-API-Key, выдаёт ограниченную session. Произвольного SteamID/profile мало. `steam_api64.dll` загружается, не заменяется; Skyrim при проверке не стартует.

**Настройки → CFG → Доступ и Discord**:

| Доступ | Дополнительный вход/разрешение |
| --- | --- |
| Открытый без игрового входа | Verified SteamID, без Worlds/skymp.net |
| Открытый с dashboard-approval | Admin разрешает SteamID |
| Открытый с аккаунтом | Steam + выбранный service |
| Discord membership | Steam/аккаунт со связанным Discord/нужным guild |
| Discord roles | Ещё минимум одна роль списка |
| Approved-license/admin-only | Прежние lists, `steam:<SteamID64>` как license |

Account-mode сохраняет **SkyMP Worlds**, **Legacy (skymp.net)**/свой compatible-master. Legacy использует upstream/account/Discord. Смена провайдера очищает key/public-ID формы, затем новые credentials. Guest не меняет server-list регистрацию автоматически.

<a id="einrichtung-und-updates"></a>

### Настройка/update

1. Создать [Steam Web API Key](https://steamcommunity.com/dev/apikey).
2. В setup либо **Доступ и Discord → Steam Web API Key**, Save. Серверный key: пустой setup сохраняет старый, CFG может явно удалить.
3. Выбрать access/Save, **restart game**, dashboard/bot остаются.
4. Обновить EXE/versioned-client, Steam запущен/авторизован.
5. Approval: **Steam-игроки**, разрешить. Pending-game опрашивает десять минут, далее reconnect Launcher. Block запрещает будущий вход; подготовленное обновление также завершает активные сеансы проверенной SteamID, см. примечание об исходниках.

Без valid-key панель работает, новые logins отклонены. Public HTTPS защищает ticket/session. Steam OpenID-callback не нужен.

`data/player-access.json`: approvals/guest-profiles/account-bindings/hashed-sessions, сохранять/backup. Guest-stable IDs от `2000000000`, account сохраняет свой. Guest/account смена персонажей автоматически не объединяет.

Одна active-game-session SteamID на инстанс. Master-account после успеха связан SteamID, другой Steam не захватит. Связь server-local, диалога unbind нет. SteamID — аккаунт, не hardware/защита от новых аккаунтов. Свободные offline-ID проверку не обходят. Старый server без auth-policy может старый Launcher-протокол.

<a id="schnittstellen-und-nachweise"></a>

### Интерфейсы/доказательства

- `GET /api/launcher/auth-policy`: требования/App-ID/audience, без secrets.
- `POST /api/launcher/auth/steam` JSON `{ "steamId": "…", "ticket": "…" }`, лишь Valve-confirmed ID, private eight-hour `steamSession`, ticket не хранится.
- `GET/POST /api/admin/player-access`: admin читает/разрешает/блокирует, same-origin JSON.
- Игра передаёт `loginWithSteam`, master-session только по запросу; второй concurrent Steam-login отказан.

Настоящий ticket локально получен/освобождён без Skyrim/DLL-замены. Server-Valve simulated; operator-key/Skyrim/CEF/account/Discord/multiplayer отдельно.
















<a id="primary-references"></a>

## Первичные источники

[Steam Web API authentication](https://partner.steamgames.com/doc/webapi/ISteamUserAuth),
[GetAuthTicketForWebApi](https://partner.steamgames.com/doc/api/ISteamUser#GetAuthTicketForWebApi),
[Cfx Steam identity provider](https://github.com/citizenfx/fivem/blob/master/code/components/citizen-server-impl/src/SteamIdentityProvider.cpp).
