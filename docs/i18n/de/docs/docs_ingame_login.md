[Deutsch](docs_ingame_login.md) · [English](../../en/docs/docs_ingame_login.md) · [Русский](../../ru/docs/docs_ingame_login.md)

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

<a id="deutsch"></a>

## Zugangsarten

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
















<a id="primary-references"></a>

## Primärquellen

[Steam Web API authentication](https://partner.steamgames.com/doc/webapi/ISteamUserAuth),
[GetAuthTicketForWebApi](https://partner.steamgames.com/doc/api/ISteamUser#GetAuthTicketForWebApi),
[Cfx Steam identity provider](https://github.com/citizenfx/fivem/blob/master/code/components/citizen-server-impl/src/SteamIdentityProvider.cpp).
