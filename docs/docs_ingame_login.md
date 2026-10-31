# Spielerzugang, Steam und Legacy-Anmeldung

> **Quellstand 30. Oktober 2026:** Die vorbereitete neue Server-/Clientfassung beendet bei einer Steam-Sperre über `POST /api/admin/player-access` auch die zu dieser verifizierten SteamID gehörenden aktiven Spielsitzungen. Der Client zeigt den Sperrhinweis und kehrt ins Skyrim-Hauptmenü zurück; spätere Anmeldungen bleiben ebenfalls gesperrt. Diese Änderung benötigt den späteren gemeinsamen Build und die Auslieferung. Die folgenden r8-Prüfberichte bleiben historische Nachweise; eine echte Skyrim-/CEF-Abnahme wird damit nicht behauptet.

Stand: 24. Oktober 2026, Serverrevision r8. Server, Desktop-Launcher und
`skymp5-client.js` müssen gemeinsam aktualisiert werden. Die Serverarchive
enthalten keine Launcher-EXE und kein vollständiges natives Clientpaket.

Revision r6 ergänzt die Steam-Fehlerdiagnose: feste Fehlercodes unterscheiden
Key-Abweisung, Ticketablehnung, Limits, Erreichbarkeit, ungültige Antworten und
Speicherfehler. Numerische Valve-Codes werden weitergegeben; private Inhalte
werden nicht protokolliert. Nach dem Update **den gesamten Starter einschließlich
Dashboard neu starten**: `/api/launcher/auth/steam` läuft im Webprozess. Ein
Game-Neustart allein lädt diese HTTP-Korrektur nicht. Die Ursache eines bisherigen
HTTP 401 auf dem VPS ist damit noch nicht bestätigt.

Revision r7 ergänzt bei Ticketablehnung `steamDescription` im Serverprotokoll:
Die Valve-Erklärung wird bereinigt und auf 160 Zeichen begrenzt; Keys, Tickets,
SteamIDs und URLs werden entfernt. Öffentliche HTTP-Antworten enthalten diese
Erklärung nicht und verwenden weiterhin feste Codes und numerische Werte.

Revision r8 verwendet Auth-Policy v2 mit kompakter, servergebundener
`ticketIdentity`. Der Launcher muss nach dem Dienstneustart die aktuelle Policy
abrufen und ein neues Ticket anfordern. Ein veraltetes zurückgegebenes
`ticketIdentity` wird vor der Valve-Anfrage mit HTTP 409 / `STEAM_POLICY_CHANGED`
abgewiesen. Valve-Code 105 mit „Identity parameter did not match“ erhält den
festen Fehlercode `STEAM_TICKET_AUDIENCE_MISMATCH`. Die serverseitig berechnete
Kennung bleibt für die Prüfung maßgeblich. Ältere Launcher dürfen das zusätzliche
Echo-Feld weglassen; ihre Tickets müssen trotzdem zur aktuellen Kennung passen.
Der bestehende Launcher wird im separaten Repository bereitgestellt.

## Deutsch

**Steam ist für jeden neuen Anmeldeweg Pflicht.** Der Launcher fordert beim
laufenden, angemeldeten Steam-Client ein `GetAuthTicketForWebApi`-Ticket für
Skyrim SE/AE (App-ID `489830`) an. Der Webserver prüft es mit seinem privaten
Steam Web API Key bei Valve. Danach erhält der Launcher eine zeitlich begrenzte
Server-Sitzung. Eine frei übergebene SteamID oder Profilnummer genügt nicht.
Die vorhandene `steam_api64.dll` wird geladen, nicht ersetzt; Skyrim wird während
der Ticketprüfung nicht gestartet.

Unter **Einstellungen → CFG-Editor → Zugriff & Discord** stehen bereit:

| Zugang | Zusätzliche Anmeldung / Freigabe |
| --- | --- |
| Offen ohne Ingame-Login | Verifizierte SteamID reicht; kein Worlds-/skymp.net-Konto |
| Offen ohne Ingame-Login, mit Dashboard-Freigabe | Administrator muss die SteamID freigeben |
| Offen mit Ingame-Login | Steam und Konto beim gewählten Anmeldedienst |
| Discord-Mitgliedschaft | Steam, Ingame-Konto mit verknüpftem Discord und Mitgliedschaft im konfigurierten Server |
| Discord-Rollen | Zusätzlich mindestens eine eingetragene Rollen-ID |
| Freigegebene Lizenz / Nur Administration | Bestehende Listenregeln; `steam:<SteamID64>` kann als Lizenz verwendet werden |

Bei Kontozugang bleibt die Auswahl **SkyMP Worlds**, **Legacy (skymp.net)**
oder eigener kompatibler Master erhalten. Legacy nutzt weiterhin den upstream
Master und dessen Konto-/Discord-Verfahren. Ein Wechsel des Anmeldedienstes
löscht den bisherigen privaten Schlüssel und die öffentliche Server-ID im
Formular; neue Zugangsdaten anschließend eintragen. Gastzugang ändert nicht
automatisch die Registrierung für die globale Serverliste.

### Einrichtung und Updates

1. Einen [Steam Web API Key](https://steamcommunity.com/dev/apikey) erstellen.
2. Im Browser-Erstassistenten oder unter **Zugriff & Discord → Steam Web API Key**
   eintragen und speichern. Der Schlüssel bleibt auf dem Server. Ein leeres
   Schlüsselfeld im Erstassistenten erhält einen vorhandenen Schlüssel; im
   CFG-Editor kann er bewusst gelöscht werden.
3. Zugang auswählen und speichern. Danach den **Game-Server neu starten**, damit
   der Login-Dienst die Konfiguration einliest. Dashboard und Bot bleiben aktiv.
4. Aktualisierte Launcher-EXE und versionsgebundenes Clientpaket bereitstellen.
   Im Launcher muss Steam laufen und angemeldet sein.
5. Bei Freigabemodus unter **Zugriff & Discord → Steam-Spieler** freigeben.
   Die wartende Spielsitzung fragt den Status zehn Minuten lang ab; danach über
   den Launcher erneut verbinden. Eine Sperre verhindert weitere Anmeldungen. In der vorbereiteten neuen Fassung
   werden auch aktive Sitzungen derselben verifizierten SteamID beendet;
   siehe Quellstand-Hinweis oben.

Ohne gültigen API-Key bleibt die Verwaltung erreichbar; neue Spieleranmeldungen
werden abgewiesen. Öffentlich HTTPS verwenden, damit Ticket und Sitzung beim
Transport geschützt sind. Ein Steam-OpenID-Callback ist nicht erforderlich.

`data/player-access.json` speichert Steam-Freigaben, Gast-Profilnummern,
Kontobindungen und gehashte Sitzungen. Diese private Datei bei Updates sichern
und erhalten. Gastprofile erhalten serverseitig stabile IDs ab `2000000000`.
Bestehende Kontoprofile behalten ihre Profilnummer; ein Wechsel zwischen Gast-
und Kontomodus führt deshalb nicht automatisch dieselbe Spielfigur weiter.

Eine SteamID kann auf einer Serverinstanz nur eine aktive Spielsitzung besitzen.
Ein Masterkonto wird beim erfolgreichen Login an eine SteamID gebunden; ein
anderer Steam-Account kann es danach nicht übernehmen. Diese Bindung ist
serverlokal; ein Dialog zum Lösen einer Bindung ist noch nicht vorhanden.
Die SteamID ist eine Kontoidentität, keine Hardwarekennung und keine Garantie
gegen neue Steam-Konten. Frei wählbare Offline-Profilnummern umgehen die Prüfung
nicht mehr. Andere alte Server ohne Auth-Policy-Endpunkt können im Launcher
weiterhin ihr bisheriges Protokoll verwenden.

### Schnittstellen und Nachweise

- `GET /api/launcher/auth-policy`: Anforderungen, App-ID und Ticket-Audience;
  enthält weder Steam- noch Master-Schlüssel.
- `POST /api/launcher/auth/steam`: JSON `{ "steamId": "…", "ticket": "…" }`;
  akzeptiert nur die von Valve bestätigte SteamID und gibt `steamSession` zurück.
  Diese Sitzung ist privat und acht Stunden gültig. Tickets werden nicht gespeichert.
- `GET/POST /api/admin/player-access`: Administratoren können Steam-Freigaben
  lesen, freigeben oder sperren. Browser-Schreibzugriffe verlangen gleiche Origin und JSON.
- Das Spiel übergibt `loginWithSteam` und erst auf Aufforderung die vorhandene
  Master-Sitzung. Ein zweiter gleichzeitiger Steam-Login wird abgewiesen.

Lokal wurde ein echtes Steam-Ticket mit der unveränderten Spiel-DLL angefordert
und freigegeben, ohne Skyrim zu starten. Serverprüfungen verwenden simulierte
Valve-Antworten. Eine echte Valve-Validierung mit Betreiber-Key sowie Skyrim/CEF,
Kontozugang, Discord und Multiplayer bleiben gesonderte Abnahmeschritte.

## English

Server r8 publishes auth policy v2 with a compact server-bound ticket identity.
After restarting the entire service, reconnect with the current launcher to fetch
the policy and a fresh ticket. A stale echoed identity returns HTTP 409 /
`STEAM_POLICY_CHANGED`; the matching Valve code-105 rejection returns
`STEAM_TICKET_AUDIENCE_MISMATCH`. Verification always uses the server identity.
Legacy requests may omit the echo but their tickets must match the current policy.

Server r7 adds a sanitized Valve ticket-rejection explanation to the operator
log only, limited to 160 characters. Keys, tickets, Steam IDs, URLs and control
characters are removed; public HTTP responses keep fixed codes and numeric values.
Restart the entire supervisor, including the dashboard, after updating.

Steam is mandatory for every r5 login mode. The updated Windows launcher requests
a Web API ticket through the existing Skyrim Steam DLL and the running Steam
client. The server validates it with Valve using its private Steam Web API key.
The game DLL is not replaced. A client-supplied Steam ID alone is never trusted.

In **Settings → CFG → Access & Discord**, choose open Steam access without an
in-game account, Steam access with dashboard approval, account login, Discord
membership/roles, approved licenses or administrators only. Account mode keeps
SkyMP Worlds, **Legacy (skymp.net)** and compatible custom masters. Guest modes
need no Worlds/skymp.net account. All modes still need signed-in Steam.

Enter the Steam key in browser first-run setup or the dashboard, save, then restart
only the game server after access changes. Without a valid key, administration
continues but player logins fail. Publish the web endpoint over HTTPS.
Update the launcher EXE and versioned client runtime together with the server.
Keep `data/player-access.json`: it holds approvals, stable guest profile IDs,
account bindings and hashed sessions. Existing account profiles and new guest
profiles are separate; characters are not migrated automatically. One active
game session per Steam ID is allowed on a server instance. A master account is
bound to its verified Steam identity. Blocking prevents future login. The prepared update also terminates matching
active verified-Steam sessions; see the source-state note above. Pending guests poll for ten minutes.

The native ticket request passed locally without starting Skyrim or replacing
its Steam DLL. Server validation uses simulated Valve responses; real API-key
validation, Skyrim/CEF and multiplayer acceptance remain open.

## Русский

Сервер r8 публикует политику входа v2 с компактным идентификатором билета,
привязанным к серверу. После полного перезапуска службы подключитесь заново
через актуальный лаунчер, чтобы получить политику и новый билет. Устаревшее
значение в запросе возвращает HTTP 409 / `STEAM_POLICY_CHANGED`; соответствующий
отказ Valve с кодом 105 — `STEAM_TICKET_AUDIENCE_MISMATCH`. Проверка использует
идентификатор сервера; старые запросы без дополнительного поля допустимы,
но билет всё равно должен соответствовать актуальной политике.

Сервер r7 добавляет очищенное пояснение Valve об отклонённом билете только
в журнал сервера, не более 160 символов. Ключи, билеты, SteamID, URL и управляющие
символы удаляются; публичный HTTP-ответ содержит только фиксированные коды
и числовую диагностику. После обновления перезапустите весь процесс запуска,
включая веб-панель.

Steam обязателен для любого входа на сервер r5. Обновлённый Windows-лаунчер
получает Web API билет через существующую Steam DLL Skyrim и запущенный Steam.
Сервер проверяет билет у Valve своим закрытым Steam Web API Key. DLL игры не
заменяется. Переданного клиентом SteamID без проверки недостаточно.

В **Настройки → CFG → Доступ и Discord** доступны вход без игрового аккаунта,
вход с одобрением SteamID администратором, вход через аккаунт, Discord/роли,
списки лицензий и доступ только администрации. Для аккаунтов сохранены SkyMP
Worlds, **Legacy (skymp.net)** и совместимый собственный мастер. Гостям аккаунт
Worlds/skymp.net не нужен; вход в Steam нужен во всех режимах.

Введите ключ в браузерном мастере настройки или панели, сохраните изменения и
перезапустите только игровой сервер. Без ключа панель работает, но новые игровые
подключения отклоняются. Для публичного доступа используйте HTTPS. Вместе с
сервером обновите EXE лаунчера и версионный пакет клиента.

Сохраняйте `data/player-access.json`: в нём одобрения, постоянные гостевые профили,
привязки аккаунтов и хеши сессий. Гостевые и прежние аккаунтные персонажи не
объединяются автоматически. На одном сервере разрешена одна активная сессия
для SteamID. Аккаунт мастера привязывается к проверенной SteamID. Блокировка
запрещает последующие входы; подготовленное обновление также завершает активные
сеансы той же проверенной SteamID, см. примечание об исходниках выше.
Ожидающий одобрения клиент проверяет статус десять минут.

Локально получен настоящий билет без запуска Skyrim и замены Steam DLL.
Проверки сервера используют имитацию ответов Valve. Настоящая проверка с ключом,
Skyrim/CEF и многопользовательская сессия пока требуют отдельной проверки.

## Primary references

[Steam Web API authentication](https://partner.steamgames.com/doc/webapi/ISteamUserAuth),
[GetAuthTicketForWebApi](https://partner.steamgames.com/doc/api/ISteamUser#GetAuthTicketForWebApi),
[Cfx Steam identity provider](https://github.com/citizenfx/fivem/blob/master/code/components/citizen-server-impl/src/SteamIdentityProvider.cpp).
