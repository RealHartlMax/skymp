[Deutsch](../../de/docs/docs_ingame_login.md) · [English](docs_ingame_login.md) · [Русский](../../ru/docs/docs_ingame_login.md)

<a id="spielerzugang-steam-und-legacy-anmeldung"></a>

# Player access, Steam and legacy login

> **Source state, 30 October 2026:** The prepared new server/client implementation also terminates active game sessions belonging to the verified SteamID when blocked through `POST /api/admin/player-access`. The client shows the ban notice and returns to the Skyrim main menu; future login stays blocked. This requires the later coordinated build and deployment. The r8 reports below remain historical evidence, without claiming real Skyrim/CEF acceptance.

As of 24 October 2026, server r8. Update server, desktop Launcher and `skymp5-client.js` together. Server archives include neither Launcher EXE nor complete native runtime.

r6 Steam diagnostics use fixed codes for key rejection, ticket failure, limits, reachability, malformed response/storage errors. Numeric Valve codes forwarded, private content not logged. After update **restart whole starter/dashboard**: `/api/launcher/auth/steam` is web-side; game restart alone cannot load HTTP fix. Earlier VPS HTTP 401 cause still unconfirmed.

r7 logs `steamDescription` for rejected tickets: sanitized Valve explanation, max 160 characters, removing keys/tickets/SteamIDs/URLs. Public HTTP never includes it, retains fixed codes/numeric values.

r8 policy v2 has compact server-bound `ticketIdentity`. Launcher fetches fresh policy/ticket after restart. Stale echoed `ticketIdentity` rejects before Valve with HTTP 409/`STEAM_POLICY_CHANGED`. Valve 105 “Identity parameter did not match” maps `STEAM_TICKET_AUDIENCE_MISMATCH`. Server-computed identity authoritative. Older Launchers may omit echo, but tickets must match. Launcher supplied separately.

<a id="deutsch"></a>

## Access modes

**Steam is required for every new login mode.** Launcher requests `GetAuthTicketForWebApi` from running signed-in Steam for Skyrim SE/AE App-ID `489830`. Webserver validates through Valve using private API key, then returns limited server session. Arbitrary SteamID/profile number insufficient. Existing `steam_api64.dll` loaded, not replaced; Skyrim not started for verification.

**Settings → CFG editor → Access & Discord** offers:

| Access | Additional login/approval |
| --- | --- |
| Open without in-game login | Verified SteamID, no Worlds/skymp.net account |
| Open without login, dashboard approval | Admin approves SteamID |
| Open with in-game login | Steam + chosen account service |
| Discord membership | Steam/account linked to Discord/configured guild membership |
| Discord roles | Additionally at least one listed role |
| Approved license/admin only | Existing lists, `steam:<SteamID64>` can serve as license |

Account mode retains **SkyMP Worlds**, **Legacy (skymp.net)**/compatible custom master. Legacy retains upstream account/Discord process. Changing provider clears private key/public server ID in form; enter new credentials. Guest access never automatically changes global listing registration.

<a id="einrichtung-und-updates"></a>

### Setup and updates

1. Create [Steam Web API Key](https://steamcommunity.com/dev/apikey).
2. Enter in browser first-run or **Access & Discord → Steam Web API Key**, save. Key stays server-side. Empty first-run key retains existing; CFG can deliberately delete it.
3. Choose/save access, **restart game server** to reload login config; dashboard/bot stay.
4. Supply updated EXE/version-bound client. Steam running/signed in.
5. In approval mode approve under **Access & Discord → Steam players**. Pending game polls ten minutes, then reconnect via Launcher. Blocking prevents later logins. The prepared update also terminates matching active verified-Steam sessions; see source-state note.

Without valid key administration remains, new logins fail. Public HTTPS protects ticket/session. No Steam OpenID callback required.

`data/player-access.json` stores approvals/guest profiles/account bindings/hashed sessions; preserve/back up. Stable guest IDs server-generated from `2000000000`. Existing accounts keep profile ID; switching guest/account never automatically continues same character.

One active game session per SteamID/server instance. Successful master login binds account to SteamID, another Steam account cannot take over. Binding server-local; no unbind dialog yet. SteamID is account identity, not hardware or protection from new accounts. Arbitrary offline-profile IDs no longer bypass checks. Older servers without auth-policy may use former Launcher protocol.

<a id="schnittstellen-und-nachweise"></a>

### Interfaces and evidence

- `GET /api/launcher/auth-policy`: requirements/App-ID/audience, no Steam/master secrets.
- `POST /api/launcher/auth/steam`: JSON `{ "steamId": "…", "ticket": "…" }`; only Valve-confirmed SteamID, returns private eight-hour `steamSession`; tickets not stored.
- `GET/POST /api/admin/player-access`: admin reads/approves/blocks Steam access, same-origin JSON for writes.
- Game sends `loginWithSteam`, master session only on request. Concurrent second Steam login rejected.

Real ticket requested/released locally through unchanged game DLL without Skyrim. Server checks simulate Valve. Actual operator-key validation/Skyrim/CEF/account/Discord/multiplayer acceptance separate.
















## Primary references

[Steam Web API authentication](https://partner.steamgames.com/doc/webapi/ISteamUserAuth),
[GetAuthTicketForWebApi](https://partner.steamgames.com/doc/api/ISteamUser#GetAuthTicketForWebApi),
[Cfx Steam identity provider](https://github.com/citizenfx/fivem/blob/master/code/components/citizen-server-impl/src/SteamIdentityProvider.cpp).
