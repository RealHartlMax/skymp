[Deutsch](docs_discord_bot.md) · [English](../../en/docs/docs_discord_bot.md) · [Русский](../../ru/docs/docs_discord_bot.md)

# Discord-Bot und Gameserver-Überwachung

Stand: 25. Oktober 2026, **Serverrevision r10**. Der eigene Discord-Reiter,
JSON-Vorlagen und die Vorschau sind in den Windows-/Linux-Voll- und Update-Paketen
enthalten. Ältere Pakete bis r9 zeigen die Bot-Felder unter **Zugriff & Discord**.
Die grundlegende Prozessüberwachung ist seit r4 vorhanden. Der Bot gehört zum dauerhaft
laufenden Webserver (`dist_back/skymp5-admin.js`). Der native Gameserver
öffnet keine eigene Discord-Gateway-Verbindung mehr. Beide Prozesse werden
vom mitgelieferten `server-supervisor.cjs` verwaltet.

## Einrichtung im Browser

1. Im [Discord Developer Portal](https://discord.com/developers/applications)
   eine eigene Anwendung mit Bot erstellen und den Bot zum gewünschten
   Discord-Server einladen. Er benötigt im Zielkanal **Kanal ansehen** und
   **Nachrichten senden**; für die optionalen Embeds außerdem **Links einbetten**.
   Administratorrechte sind nicht erforderlich.
2. Im SkyMP-Dashboard **Einstellungen → Discord-Einstellungen** oder
   **CFG-Editor → Discord** öffnen. Der direkte Einstieg ist
   `/admin?devUi=1&admin=1#discord` mit einer gültigen Admin-Sitzung.
   Den Bot aktivieren, Bot-Token und Discord-Server-ID eintragen.
3. Die **Statuskanal-ID** für Start-, Stopp-, Neustart- und Absturzmeldungen
   eintragen. Der **Warnungskanal** ist optional und erhält Verwarnungen aus
   dem Dashboard. Beide Kanäle dürfen identisch sein, bleiben aber getrennte
   Einstellungen. Discords Entwicklermodus ermöglicht das Kopieren der IDs.
4. **Discord-Einstellungen speichern**. Der Webserver übernimmt Bot-Einstellungen sofort; ein Game-
   oder Webserver-Neustart ist dafür nicht erforderlich. Das Formular zeigt
   den Verbindungszustand und den letzten Fehler. Die Zustellung kann nach
   dem Speichern einige Sekunden benötigen.

Ein Token kann mit oder ohne `Bot ` eingegeben werden; der Server normalisiert
es. Token nicht veröffentlichen oder in Fehlerberichte kopieren. Die
Konfigurationsdatei und ihre Sicherungen enthalten das Token weiterhin.

Der Bot funktioniert auch bei `offlineMode: true`. Das Aktivieren reiner
Statusmeldungen verändert die Spieler-Zugangsregeln nicht. Die Spielanmeldung
und der Bot sind getrennte Funktionen.

## Status-Embed und JSON-Vorlagen

**Status-Embed verwenden** hängt eine gestaltete Karte an die vorhandenen
Statusmeldungen an. Die Funktion ist für bestehende Installationen zunächst
ausgeschaltet. Titel, Beschreibung, bis zu 25 Felder, Footer, eine feste HTTP(S)-URL
und Zeitstempel lassen sich im ersten Editor anpassen. Der zweite Editor
enthält Statusbezeichnungen, Hex-Farben und bis zu fünf Link-Schaltflächen:

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

Verfügbare Textplatzhalter sind `{{serverName}}`, `{{statusString}}`,
`{{statusKey}}`, `{{serverClients}}`, `{{serverMaxClients}}`,
`{{serverAddress}}`, `{{uptime}}` und `{{timestamp}}`. `statusKey` ist der
Prozesszustand (`running`, `starting`, `stopping`, `stopped`, `crashed`).
`serverAddress` verwendet `publicHost`/`externalHost` und den konfigurierten
Game-Port; ohne öffentliche Adresse wird `—` angezeigt. Fehlende aktuelle
Spielerzahlen bleiben unbekannt. Farben folgen Online, Start/Stopp oder Offline.
Schaltflächen verwenden feste HTTP(S)-Links, ohne Platzhalter. Ein eigenes
Emoji kann als Unicode-Zeichen oder Discord-Emoji-ID angegeben werden.

Die Vorschau und der Bot verwenden denselben Renderer. Der Vorschau-Zustand
lässt sich wählen; dabei wird keine Nachricht verschickt. Discord-Markdown
und eigene Emojis können in Discord anders aussehen. Jeder Editor bietet
**Änderungen verwerfen** und **Standard wiederherstellen**; die Schaltfläche
unter dem Formular kann den gesamten Entwurf verwerfen. Änderungen werden
erst beim Speichern übernommen. Fehlerhafte Vorlagen bleiben im Formular und
ersetzen keine gültige Datei. Ein fehlgeschlagener Speicherversuch lässt sich
mit denselben Eingaben wiederholen. Token sind anfangs verborgen.

Die gesonderte Speicheraktion verändert Bot-/Discord-Auth-Einstellungen und
erhält Spielkonfiguration, Steam-Zugang und sonstige Betreiberwerte.
Ungespeicherte allgemeine Formularwerte bleiben beim Wechsel zwischen den
CFG-Reitern erhalten. Vorlagen- und Kanaländerungen behalten eine vorhandene
Bot-Verbindung; Token-, Server- oder Mitgliedsüberwachungsänderungen können
eine neue Verbindung erfordern. Der Game-Prozess bleibt dabei unverändert.

Die Karten werden bei Statusereignissen beziehungsweise beim Anwenden neuer
Discord-Einstellungen versendet. Es handelt sich um Momentaufnahmen, nicht um
eine laufend bearbeitete oder angeheftete Nachricht. `/status add` aus txAdmin
ist kein SkyMP-Befehl. Die Begrenzungen richten sich nach den
[Discord-Embed-Vorgaben](https://docs.discord.com/developers/resources/message#embed-limits)
und [Link-Schaltflächen](https://docs.discord.com/developers/components/reference#button).
Unbekannte Platzhalter, zu lange Inhalte, ungültige Farben und unsichere URLs
werden im Browser und im Server abgewiesen. API-Schlüssel und Token stehen
nicht als Platzhalter zur Verfügung. Mentions bleiben ausgeschaltet.

<a id="api-und-sprachfassungen--api-and-translations--api-и-переводы"></a>

## API und Sprachfassungen

`GET /api/admin/discord/settings` liefert dem angemeldeten Administrator die
Bot-Konfiguration und Standardvorlagen mit `Cache-Control: no-store`.
`POST /api/admin/discord/settings` erwartet `{ "discordBot": { ... } }`, ein
Administratorkonto mit `canConsole` und JSON vom selben Ursprung. Die Antwort
bestätigt `restartRequired: false`. Der Bot bleibt im Webserver; weitere
eingehende Ports sind nicht erforderlich. Die vollständige private Antwort
enthält das Token und gehört nicht in öffentliche Fehlerberichte.



## Meldungen und Lebensdauer

| Ereignis | Verhalten |
| --- | --- |
| Gameserver startet | Startmeldung; „online“ erst nach dem Bereitschaftssignal des Game-Prozesses |
| Geplanter Stopp | Stoppmeldung und Bestätigung nach Prozessende; Bot und Dashboard bleiben verbunden |
| Geplanter Neustart | Neustartmeldung und „wieder online“ nach erfolgreichem Start, ohne zusätzlichen Bot-Login |
| Ungeplantes Prozessende | Absturzmeldung mit Exit-Code/Signal; auch unerwartetes Ende mit Code 0 gilt als Ausfall |
| Startfehler oder Startzeitüberschreitung | Meldung, dass der Gameserver nicht gestartet werden konnte |
| Discord-Verbindungsunterbrechung | SDK-Verbindungswiederherstellung; begrenzte Warteschlange für ausstehende Meldungen |
| Bot-Anmeldung schlägt fehl | Fehleranzeige; neuer Verbindungsversuch nach 30 Sekunden, ohne den Gameserver zu stoppen |
| Bot deaktivieren | Verbindung, ausstehende Meldungen und Wiederholungen werden beendet |
| Gesamten Starter geordnet beenden | Erst Game-Prozess beenden, abschließende Meldung kurz abarbeiten, dann Bot/Dashboard beenden |

Die Sprache der Statusmeldungen folgt `localeRouting.defaultLanguage` für
DE/EN/RU; andere Sprachen verwenden Englisch. Mentions sind deaktiviert,
damit Namen oder Verwarnungstexte keine Rollen-/Everyone-Pings auslösen.
Jeder Kanal wird vor dem Senden dem konfigurierten Discord-Server zugeordnet.

Die Überwachung erkennt Prozessende und Bereitschaft, keine blockierte
Spielsimulation bei weiterhin lebendem Prozess. Es gibt keinen automatischen
Neustart nach einem Absturz; dafür bleibt **Starten** im Dashboard verfügbar.
Ein gleichzeitiger Ausfall des gesamten VPS/Webservers oder ein harter Kill
kann vom dort laufenden Bot nicht mehr gemeldet werden. Abschließende
Nachrichten beim Gesamtherunterfahren sind deshalb nur bestmöglich.

Die Warteschlange hält höchstens 50 Meldungen im Arbeitsspeicher. Sie wird
nicht über einen Webserver-Neustart hinweg gespeichert. Bei fehlenden
Kanalrechten wird ein Fehler protokolliert; eine zugestellte Nachricht wird
im Status durch `lastMessageAt` bestätigt. Keine Zustellgarantie bei einem
Discord-Ausfall.

## Spielerzugang, Sperrrollen und Login-Protokoll

Die Modi `joinAccess.mode: discordMember` und `discordRoles` verwenden weiterhin
die Online-Spielanmeldung und Discord-Mitgliedsprüfung. Beim Speichern wird
für diese Modi der im Formular gewählte Discord-Server in `discordAuth.guilds`
ergänzt; vorhandene weitere Server und deren Rollen-/Kanaleinstellungen
bleiben erhalten. Ein reiner Statusbot legt keine neue Login-Beschränkung an.

Erweiterte vorhandene Login-Einstellungen bleiben unterstützt:

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

- `banRoleId`: sperrt den Online-Login. Eine neu zugewiesene Sperrrolle wird
  vom Web-Bot über private Node-IPC an den laufenden Gameserver gemeldet.
  Dieser deaktiviert zugeordnete Charaktere und trennt aktive Verbindungen.
  Bei gestopptem Spiel greift die Rollenprüfung beim nächsten Online-Login.
- `eventLogChannelId`: Kanal für die vorhandenen Spieler-Login-Meldungen.
  Der Gameserver übergibt diese im Paketbetrieb an den Web-Bot. Der Kanal ist
  unabhängig von Status- und Warnungskanal. Bestehende Login-Meldungen können
  Spieler-IP, Profil- und Charakterzuordnung enthalten.
- `hideIpRoleId`: blendet die IP in diesen Discord-Login-Meldungen aus.

Für die Live-Sperrrollenüberwachung muss im Developer Portal der **Server
Members Intent** aktiviert sein. Ein reiner Status-/Warnungsbot fordert
diesen privilegierten Intent nicht an. Siehe
[Discord Gateway Intents](https://docs.discord.com/developers/events/gateway#privileged-intents).
Die Online-Mitgliedsprüfung verwendet den
[Bot-Authorization-Header](https://docs.discord.com/developers/reference#authentication).
`offlineMode` bietet keine verifizierte Discord-Spieleridentität und damit
keine entsprechende Spieler-Rollenprüfung.

`discordBot.enabled: false` schaltet Gateway und Nachrichten ab. Bereits
eingerichtete `discordAuth`-Zugangsprüfungen bleiben eigenständig konfiguriert.
Die [Discord-Anmeldung am Adminpanel](docs_admin_discord_oauth.md) verwendet
separates OAuth und wird durch diesen Schalter nicht deaktiviert.

## Betrieb und Update

Den Server mit `start-test-server.sh` beziehungsweise `.bat` oder dem
entsprechenden Starter-Alias starten. Ein direkter Aufruf des Game-Bundles
umgeht Bot, unabhängiges Dashboard und deren Prozesssteuerung.

Beim Update `server-supervisor.cjs`, beide Dateien unter `dist_back/`
einschließlich Maps und `ui/` gemeinsam aktualisieren. Bestehende
`server-settings.json`, Admin-Konten, Weltdaten, Mods und eigene Skripte
behalten. Die neue `DISCORD-BOT.md` liegt auch im vollständigen Serverpaket.
Es werden **keine zusätzlichen eingehenden Ports** benötigt. Discord benötigt
ausgehendes HTTPS/WSS über TCP 443 und funktionierende Namensauflösung.

## Prüfumfang

`skymp5-server/tests/discordBot.integration.mjs` prüft Produktionscode mit
simulierter Discord-SDK: Konfiguration, Meldungen, Wiederverbindung,
Fehlerbehandlung, deaktivierten Bot, Kanalzuordnung und Sperrrollen.
`misc/tests/test_dashboard_runtime.cjs --discord-fixture` verwendet das
echte Dashboard und den echten Supervisor mit einer simulierten Discord-SDK.
Damit werden Prozesswechsel, interne Nachrichten und unveränderte
Dashboard-/Bot-Prozesse geprüft. Ergebnisse der Plattform- und Paketläufe
stehen beim jeweiligen Build in `VALIDIERUNG.json`.

Diese Prüfungen senden keine Nachrichten an Discord. Echte Bot-Einladung,
Portal-Intents, Kanalrechte und Zustellung auf dem Betreiber-Discord müssen
mit dessen eigener Konfiguration geprüft werden. Slash-Befehle,
Chat-Brücke, Sprachkanal-/Voice-Adapter und Ticketsystem sind nicht enthalten.

Am 25. Oktober 2026 wurden der neue Quellstand und die gesonderte Speicher-API
unter Windows/Node 24 sowie Ubuntu 26.04/Node 22.22.1 mit simulierter Discord-SDK
geprüft. Die Browserprüfungen mit sichtbarem Chromium umfassen den exakten
`#discord`-Einstieg, Token-Anzeige, JSON-/URL-/Platzhalterfehler,
Verwerfen/Standardwerte, Speichern mit Fehler und erneutem Versuch,
Entwurfserhalt zwischen Reitern, Berechtigungsfehler und Darstellung bei
360/390/768 px. Die aktuelle isolierte Produktionskompilierung besteht ebenfalls
die automatischen WCAG-A/AA-Prüfungen für diesen Bereich. Eine manuelle
Screenreader-, CEF- oder echte Discord-Abnahme ist damit nicht belegt.

Server- und Frontend-TypeScript, Frontend-Unit-Tests und die sechs
Sprachwörterbücher wurden geprüft. CMake berücksichtigt künftig auch den
gemeinsamen JavaScript-Renderer als Abhängigkeit und beide Backend-Ausgaben.
Diese zunächst isoliert geprüften Änderungen werden mit Serverrevision r10
in beiden Backends und im Frontend der Windows-/Linux-Voll- und Update-Pakete
ausgeliefert. Lokale Browsernachweise liegen unter
`build/discord-validation/VALIDIERUNG.json`; die separaten Paket- und
Plattformprüfungen stehen unter `build/releases/2026-10-25-server-r10/`.
