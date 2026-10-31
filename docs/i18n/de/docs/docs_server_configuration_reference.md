[Deutsch](docs_server_configuration_reference.md) · [English](../../en/docs/docs_server_configuration_reference.md) · [Русский](../../ru/docs/docs_server_configuration_reference.md)

<a id="server-configuration-reference"></a>

# Serverkonfigurationsreferenz

> **Neu:** Mods liegen jetzt in `data/mods/<Mod>/`; `client-resources` wird nicht mehr gelesen. Angaben dazu auf dieser Seite sind überholt. Siehe [Mods in data/mods](docs_mod_folders.md).

Konfiguriere den Server vorzugsweise durch alle erforderlichen Werte in `server-settings.json`. Die Datei verwendet Standard-JSON ohne C-artige Kommentare. Siehe auch [Server-Kommandozeilen-API](docs_server_command_line_api.md).

Am **26. Oktober 2026** mit dem lokalen Checkout abgeglichen. Mit `json5` gekennzeichnete Beispiele zeigen einzelne Felder; die tatsächliche Datei benötigt Schlüssel in Anführungszeichen und darf keine Kommentare enthalten. Prüfgrenzen stehen unter [Projektstatus](docs_project_status.md), die paketierte Erstinstallation unter [Browser-Einrichtung](docs_linux_vps.md).

<a id="restartschedule-game-only-restarts-r12"></a>

## restartSchedule (nur Gameserver-Neustarts, r12)

Verwende **Einstellungen → Gameserver**, statt JSON zu bearbeiten. Das optionale Objekt `restartSchedule` enthält `enabled` (Standard `false`), `timeZone` (IANA-Name wie `Europe/Berlin`), `times` (höchstens zwölf tägliche `HH:mm`-Werte) und `warningMinutes` (höchstens fünf ganzzahlige Minutenwerte von 1 bis 60). Es benötigt den mitgelieferten Supervisor, startet keine gestoppten Spiele und lässt das Dashboard online. Beanspruchte Termine und das Überspringen des nächsten Termins werden dauerhaft unter `dataDir` gespeichert und müssen beim Update erhalten bleiben. Siehe [Betrieb, Zeitumstellung und API](docs_dashboard_operations.md).

<a id="playeraccess-steam-authentication-r5"></a>

## playerAccess (Steam-Authentifizierung, r5)

Verwende die Browser-Einrichtung oder **CFG → Zugang & Discord**. Beispiel:

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

`guest` benötigt kein Master-Konto; `account` verlangt nach der Steam-Prüfung die konfigurierte Master-Anmeldung im Spiel. Steam ist in beiden Modi verpflichtend, auch bei alten `offlineMode`-Konfigurationen. `approvalRequired` gilt für Gäste, `joinAccess` für Konten. Der Alias `steam_webApiKey` wird akzeptiert, wenn der neue Schlüssel fehlt. Ohne gültigen Schlüssel ist keine Spieleranmeldung möglich. Die App-ID ist standardmäßig Skyrim SE/AE. Halte den Schlüssel serverseitig; eine SteamID allein ist kein Nachweis. Starte nach Änderungen der Zugangseinstellungen den Gameserver neu. Sitzungen, Schutz vor Doppelanmeldungen und Update-Anforderungen stehen unter [Anmeldung und API-Vertrag](docs_ingame_login.md).

## name

Name des Servers, der auf einem Masterserver veröffentlicht wird.

```json5
{
  // ...
  name: 'My Server',
  // ...
}
```

## masterKey

Privater Schlüssel zur Authentifizierung der Master-API-Heartbeats. Mit SkyMP Worlds verwenden Spieler die öffentliche `serverUid`; verteile den privaten `masterKey` nicht als Clientkonfiguration. Ältere Master können für beide Zwecke denselben Routingschlüssel verwenden. Erhalte beim Serverupdate eine bestehende Identität.

```json5
{
  // ...
    masterKey: '<private key from the owner dashboard>',
  // ...
}
```

<a id="master-serveruid-and-publichost"></a>

## master, serverUid und publicHost

`master` ist die HTTP(S)-Basis-URL für Registrierung und Online-Konto-/Sitzungsanfragen. `serverUid` ist die öffentliche Spieleridentität des Servers, `masterKey` bleibt privat. `publicHost` veröffentlicht den extern erreichbaren Spielhostname/die IP und bindet keinen Netzwerksocket. `externalHost` wird ebenfalls als Ersatz für den veröffentlichten Host akzeptiert. Bindeadressen bleiben `listenHost` und `uiListenHost`.

Der aktuelle lokale Standard von `Settings` lautet `https://api.skymp-worlds.net`. Ausdrücklich vorhandene Master-Einstellungen haben weiterhin Vorrang.

Ergänze für die bestehende SkyMP-Worlds-PHP-Integration diese Felder in der vorhandenen Konfiguration; erhalte die eigenen IDs und Daten des Servers:

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

Der Heartbeat verwendet `POST <master>/api/servers/<privateMasterKey>`. Sein Intervall wird auf 10–30 Sekunden begrenzt (Standard 15 Sekunden). Der Offline-Testmodus veröffentlicht keinen Heartbeat. Website-Upload und Kontoeinrichtung sind von der Gameserver-Konfiguration getrennt; siehe [SkyMP Worlds](docs_launcher_worlds.md).

## launcherResources

Öffentliche Mod-Veröffentlichung vor dem Spielstart, getrennt vom Admin-Inventarscanner.

```json
{
  "launcherResources": {
    "enabled": true,
    "directory": "./client-resources",
    "runtimeSource": "https://files.example.org/client-runtime/catalog.json"
  }
}
```

- Ohne Objekt gelten zur Laufzeit: aktiviert, Ordner `./client-resources`, keine Runtime-Quelle.
- Der aktuelle CMake-Konfigurationsgenerator ergänzt bei fehlenden Werten den externen Runtime-Katalog `https://update.skymp-worlds.net/client-runtime/catalog.json`. Ausdrückliche vorhandene Werte bleiben erhalten, einschließlich `runtimeSource: ""`. `-DSKYMP_RUNTIME_CATALOG_URL=""` deaktiviert dieses generierte Standardangebot, ändert aber keine ausdrücklich gespeicherten Einstellungen. Eine konfigurierte URL belegt weder Upload noch Ingame-Abnahme ihrer Inhalte.
- Lose Clientdateien gehören unter `directory/Data/`; eigene Serverplugins aus `loadOrder` und passende BSA-Archive werden außerdem aus `dataDir` veröffentlicht.
- `runtimeSource` ist optional und akzeptiert eine absolute HTTP(S)-URL ohne Zugangsdaten, Query oder Fragment. Sie kann ein Runtime-Manifest oder einen vom aktuellen Desktop-Launcher verstandenen Versionskatalog bezeichnen.
- `GET /api/launcher/manifest` veröffentlicht Größen, SHA-256, Pfade, Ladereihenfolge und lokale Spielanforderungen. Bethesda-Master und private Serverdateien sind ausgeschlossen.
- Native DLLs/JS verwenden das separate Runtime-Paket. Eine manuelle Runtime-Quelle im Launcher hat Vorrang vor der veröffentlichten Quelle.

Siehe [Mod-Veröffentlichung](docs_launcher_modpacks.md) und [Runtime-Katalog](docs_launcher_runtime_updates.md). Ein gültiges Paket oder ein erfolgreicher Download beweist keine native Spielkompatibilität.

## joinAccess

Online-Beitrittsrichtlinie, die `systems/login.ts` nach Ermitteln des Spielerprofils prüft. Sie ist vom Dashboard-Zugang getrennt.

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

| Feld/Wert | Verhalten |
| --- | --- |
| `mode: "open"` | Standard; keine zusätzliche Beitrittsrichtlinie |
| `mode: "adminOnly"` | Erlaubt einen passenden Eintrag in `approvedLicenses` oder `approvedDiscordIds`; eine Dashboard-Rolle allein gewährt keinen Zugang |
| `mode: "approvedLicense"` | Benötigt eine passende Profil-Lizenzkennung |
| `mode: "discordMember"` | Benötigt verknüpfte Discord-Identität und erfolgreiche Mitgliedschaftsprüfung |
| `mode: "discordRoles"` | Benötigt verknüpfte Discord-Identität, bestätigte Mitgliedschaft und mindestens einen passenden Eintrag in `discordRoleIds` |
| `rejectionMessage` | Grundtext der Ablehnung; der Server ergänzt einen konkreten Grund |
| `approvedLicenses`, `approvedDiscordIds`, `discordRoleIds` | Kennungsarrays; Duplikate und leere Einträge werden normalisiert |

Unbekannte Modi fallen auf `open` zurück; verwende das Dashboard-Zugangsformular oder prüfe die Schreibweise. Discord-Modi verweigern die Anmeldung, wenn die Prüfung nicht verfügbar ist, das Konto nicht verknüpft wurde, die Mitgliedschaft nicht bestätigt werden kann oder keine erforderlichen Rollen konfiguriert sind. `approvedLicense` wertet die Discord-ID-Liste nicht als Lizenztreffer. Offline-Testidentitäten verwenden einen anderen Anmeldepfad und ersetzen keine verifizierten öffentlichen Spielerkonten.

<a id="discordauth-and-discordbot"></a>

## discordAuth und discordBot

Die Online-Anmeldung liest `discordAuth.botToken` und `discordAuth.guilds`. Jede Guild legt eine `guildId` fest und kann `banRoleId`, `eventLogChannelId` und `hideIpRoleId` angeben.

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

Das Discord-Formular im Admin-CFG verwendet `discordBot`: `enabled`, `token`, `guildId`, `statusChannelId`, `warningsChannelId`. In neuen Paketen ist der Bot deaktiviert. Seit r4 läuft er ausschließlich im unabhängigen Dashboard-Prozess, auch bei Offline-Spielmodus. Statusmeldungen betreffen Start, Bereitschaft, Stopp, Neustart, Startfehler und Absturz des Gameservers. Dashboard-Warnungen und bestehende konfigurierte Anmeldeprotokolle verwenden denselben Bot. Die Spielsteuerung erhält seine Discord-Verbindung. Speichern wendet die Bot-Konfiguration sofort an; `GET /api/admin/status` liefert Verbindungs-, Fehler- und Zustellstatus ohne Tokens.

Der Quellstand nach r9 ergänzt **CFG → Discord**, auch aus Einstellungen erreichbar, sowie eine getrennte, ausschließlich für Besitzer zugängliche GET/POST-API `/api/admin/discord/settings`. Speichern erhält andere Einstellungen und wirkt sofort. `statusEmbedEnabled` ist standardmäßig `false`; `statusEmbed` definiert Titel/Beschreibung/Felder/Fußzeile/URL/Zeitstempel, `statusConfig` die Labels online/partial/offline, `#RRGGBB`-Farben und bis zu fünf HTTP(S)-Linkschaltflächen. Standards folgen der Serversprache. Browservorschau und Transport teilen Validierung und Platzhalterdarstellung. Siehe [Vorlagenanleitung](docs_discord_bot.md#status-embed-und-json-vorlagen). Diese Quelländerungen sind noch in keinem neuen Releasepaket enthalten.

Das Speichern eines Discord-basierten `joinAccess`-Modus ergänzt die gewählte Haupt-Guild in `discordAuth.guilds` und erhält bestehende Guilds samt Moderations-/Logeinstellungen. Reines Monitoring erzeugt keine Zugangsbeschränkung. Alte Bots nur mit `discordAuth` bleiben aktiv, bis sie ausdrücklich mit `discordBot.enabled` deaktiviert werden. Deaktivieren stoppt Gateway/Benachrichtigungen; konfigurierte Online-Anmeldeprüfungen und Admin-OAuth bleiben getrennt. Tokens werden mit oder ohne `Bot ` normalisiert.

Die vollständige Admin-CFG-Antwort und private Konfigurations-/Sicherungsdateien enthalten das Token und sind vertraulich. Nur Administratoren können das vollständige CFG lesen. Einrichtung, Kanalrechte, privilegierter Member-Intent, Lebenszyklusgrenzen und die Trennung simulierter Integrationstests von realer Zustellung stehen unter [Discord-Bot-Betrieb](docs_discord_bot.md). Admin-Discord-OAuth ist unabhängig und unter [Admin Discord OAuth](docs_admin_discord_oauth.md) beschrieben.

## showCharacterNicknames

Boolescher Wert, Standard `true`. Steuert Charakternamen über entfernten Actors. Der Server sendet den Wert beim Verbinden und veröffentlicht Änderungen aus dem Admin-CFG-Allgemein-Formular. Eine ausdrückliche Servervorgabe hat Vorrang vor dem lokalen F1-Schalter des Clients.

```json
{ "showCharacterNicknames": false }
```

## listenHost

Bindeadresse für den Haupt-UDP-Verkehr (RakNet). Ohne Angabe wird `0.0.0.0` verwendet.

```json5
{
  // ...
  listenHost: '127.0.0.1',
  // ...
}
```

## uiListenHost

Bindeadresse für `uiPort` (HTTP). Ohne Angabe wird `0.0.0.0` verwendet.

```json5
{
  // ...
  uiListenHost: '127.0.0.1',
  // ...
}
```

## adminApi

Verhalten der Admin-API und Dashboard-URLs.

- `enabled` steuert die Verfügbarkeit der Admin-API-Routen.
- `externalUrl` darf leer bleiben (`""`); dann verwendet die automatische Erkennung eingehende `Host`- und `X-Forwarded-Proto`-Header.
- Ein ausdrücklich gesetztes `externalUrl` wird für erzeugte Dashboard-URLs verwendet.

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

HTTP-Basic-Authentifizierung für den Endpunkt `/metrics`.

Ohne Angabe ist `/metrics` nicht verfügbar.

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

Zugangsdaten für das Web-Admin-Dashboard (`/admin`).

Alte Bootstrap-Zugangsdaten. Die aktuelle Einrichtung erstellt einen vorrangigen scrypt-Zugangsspeicher unter `<dataDir>/admin-auth.json`. Alte Zugangsdaten aus `adminUiAuth`/`metricsAuth` können migriert und der Klartextschlüssel aus `server-settings.json` entfernt werden. Browser-Erstinstallationspakete enthalten kein vorab erstelltes Konto: Verwende die Terminal-PIN und erstelle im Browser einen Besitzer. Siehe [Admin-Sitzungsendpunkte](docs_running_a_server.md#admin-session-api).

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

HTTP-Port für Serverressourcen und Dashboard-Routen, beispielsweise `/admin`, `/api/admin/*` und `/metrics`.

Ohne Angabe verwendet der Server `port`.

```json5
{
  // ...
  uiPort: 8080,
  // ...
}
```

## port

Spielclients verbinden sich über diesen Port mit dem Server. Die aktuelle Skyrim-Multiplayer-Version verwendet mehrere Ports und Protokolle für verschiedene Paketarten. Weitere Informationen unter [Serverports](docs_server_ports_usage.md).

```json5
{
  // ...
  port: 7777,
  // ...
}
```

## maxPlayers

Legt das Spielerlimit fest. Im Launcher und auf skymp.io sichtbar.

```json5
{
  // ...
  maxPlayers: 108,
  // ...
}
```

## dataDir

Relativer oder absoluter Pfad zu einem "data"-Ordner mit:

- Skyrim-Vanilla-Masterdateien (Skyrim.esm, Update.esm usw.)
- Plugin-Dateien (Mods im .esp-Format)
- kompilierte Papyrus-Skripte im .pex-Format

Dieser Ordner wird über `uiPort` per HTTP bereitgestellt.

Der Server verwendet den Ordner derzeit auch für eigene Inhalte:

- Weboberfläche unter `${dataDir}/ui` speichern
- automatisch erzeugtes Manifest der verwendeten .esm/.esp-Dateien und ihrer CRC32 speichern

```json5
{
  // ...
  dataDir: 'data',
  // ...
}
```

## loadOrder

Liste relativer oder absoluter Pfade zu .esp/.esm-Dateien, die der Server beim Start in derselben Reihenfolge wie Skyrim SE lädt.

Relative Pfade werden im Ordner `${dataDir}` gesucht.

Absolute Pfade funktionieren, sind aber nicht über `uiPort` erreichbar. Externe Werkzeuge können sie nicht vom Server herunterladen.

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

Legt vom Server geladene BSA-Archive fest.

Derzeit nur für kompilierte Papyrus-Skripte verwendet.

Relative und absolute Pfade funktionieren ähnlich wie bei esp/esm.

```json5
{
  // ...
  archives: ['Skyrim - Misc.bsa'],
  // ...
}
```

## lang

Sprache, deren Übersetzungen aus den Stringdateien unter Data/strings gelesen werden.

```json5
{
  // ...
  lang: 'english',
  // ...
}
```

## offlineMode

Alter Konfigurationsschalter. In r5 wählt `true` Steam-Gastzugang und deaktiviert die alte Master-Kontoanmeldung; beliebige vom Client gewählte Profil-IDs werden dadurch nicht erlaubt. Der Launcher muss eine geprüfte Steam-Sitzung anfordern. Neue Konfigurationen verwenden stattdessen `playerAccess.mode: "guest"` mit `offlineMode: false`. Siehe [Steam- und Anmeldemodi](docs_ingame_login.md).

```json5
{
  // ...
  offlineMode: true,
  // ...
}
```

## databaseDriver

Name des Datenbanktreibers zum Speichern der Serverdaten, Standard `file`. Dazu gehören Optionen wie `"databaseName"`. Weitere Informationen unter [Datenbanktreiber](docs_database_drivers.md).

```json5
{
  // ...
  databaseDriver: 'file',
  // ...
}
```

## reloot

Zeit in Millisekunden, bis ein Spielobjekt seinen ursprünglichen Zustand wiederherstellt. Anders als Skyrim SE besitzt Skyrim Multiplayer keinen eingebauten Zellreset. Stattdessen setzt der Server jedes Weltobjekt stündlich zurück. Diese Option ändert das Intervall pro Objektart. `"CONT"` bedeutet beispielsweise Container: Truhen, Fässer usw. Siehe "record types" auf [UESP](https://en.uesp.net/wiki/Skyrim_Mod:Mod_File_Format).

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

Verbietet Reloot für einen Gegenstand oder eine Gruppe anhand ihres espm-Datensatztyps. Siehe [UESP](https://en.uesp.net/wiki/Skyrim_Mod:Mod_File_Format).

```json5
{
  // ...
  // here your record types go
  "forbiddenReloot": ["FLOR", "TREE", "BOOK", ... ]
  // ...
}
```

## itemPickupMode

Steuert das Aufheben von Weltgegenständen beim Aktivieren loser Objekte, Pflanzen oder Bäume.

- `"allow"` (Standard): bisheriges Verhalten; Gegenstand wird sofort aufgenommen.
- `"minigame"`: ruft vor dem Aufheben `mp.onItemPickupAttempt(...)` auf. Blockiert ein Listener das Ereignis, wird das Aufheben verweigert.
- `"block-all"`: deaktiviert das Aufheben von Weltgegenständen vollständig.

```json5
{
  // ...
  itemPickupMode: 'minigame',
  // ...
}
```

Bei `itemPickupMode: "minigame"` löst der Server diesen Hook aus:

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

Steuert die Geschwindigkeit der Spielzeit relativ zur realen Zeit. Standard ist `20` (Skyrim-Standard).

Die Formel lautet: **1 reale Sekunde = `timeScale` Spielsekunden**.

| `timeScale` | 1 reale Sekunde = … im Spiel | 1 reale Minute = … im Spiel | Hinweise |
|-------------|-----------------------------|----------------------------|----------|
| `1` | 1 s | 1 min | Echtzeit – Uhr entspricht der realen Welt |
| `20` | 20 s | 20 min | **Skyrim-Standard** – ein Spieltag ≈ 72 reale Minuten |
| `60` | 1 min | 1 h | Ein Spieltag ≈ 24 reale Minuten |
| `3600` | 1 h | 1 Tag | Extrem – ein Spieltag ≈ 24 reale Sekunden |
| `0` | 0 s | 0 min | Zeit anhalten |

```json5
{
  // ...
  timeScale: 20,
  // ...
}
```

## itemsEnabled

Bei `false` werden Weltgegenstandsreferenzen nicht instanziiert. In der Spielwelt erscheinen keine losen Gegenstände. Standard ist `true`.

Nützlich für PvP-Server, die keine Dungeon-Beute benötigen.

```json5
{
  // ...
  itemsEnabled: false,
  // ...
}
```

## itemLoadFilter

Feiner Eigentumsfilter bei `itemsEnabled: true`, basierend auf dem Feld `XOWN` im ESP-/ESM-Datensatz.

- `skipOwned` (Standard `false`): Gegenstände von NPCs oder Fraktionen (`XOWN != 0`) auslassen, etwa Ladeninventar und stehlbare Gegenstände.
- `skipUnowned` (Standard `false`): freie Beute (`XOWN == 0`) auslassen, etwa Dungeon-Gegenstände ohne Besitzer.

Beide Flags dürfen gleichzeitig aktiv sein. Dann werden keine Gegenstände instanziiert, entsprechend `itemsEnabled: false`.

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

Steuert den Umgang mit beim Start neu entdeckten Plugins.

- `mode: "safe"` (für Daemon/Produktion empfohlen): Neue Plugins bleiben deaktiviert (`startupEnabled: false`) und benötigen manuelle Freigabe.
- `mode: "prompt"`: Bei Start auf einem TTY erscheint für jedes neue Plugin eine interaktive Ja-/Nein-Abfrage.
- `mode: "auto"`: Neue Plugins werden ohne Terminalabfrage bereits bei diesem Start freigegeben und geladen.

Ohne Angabe oder bei ungültigem Wert gilt `"safe"`. Alle Modi erhalten gespeicherte Startfreigaben bekannter Plugins, einschließlich früher ausdrücklich deaktivierter Plugins. Unter **Ressourcen → Server-Plugins** kann das Dashboard diesen Modus speichern, einzelne Plugins aktivieren/deaktivieren oder alle erkannten deaktivierten Plugins mit weiterhin vorhandenem Manifest freigeben. Änderungen gelten beim nächsten Gameserver-Start. Verwende `auto` nur für einen Plugin-Ordner mit geprüftem Code.

```json5
{
  // ...
  pluginDiscovery: {
    mode: 'safe',
  },
  // ...
}
```

Siehe auch `pluginsLoadOrder` und die Dokumentation des Plugin-Systems.

Optionaler untergeordneter Schlüssel:

- `processCommandAllowlist`: Zeichenfolgenarray zulässiger Befehle für Plugins mit `kind: process`.
- Verglichen wird mit der vollständigen Befehlszeichenfolge oder ihrem Basisnamen.
- Ohne Angabe gilt keine zusätzliche Befehlsbeschränkung (abwärtskompatibel).

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

Ausdrückliche Ladereihenfolge für Plugins. Genannte Plugins starten zuerst in dieser Reihenfolge, anschließend alle übrigen aktivierten Plugins alphabetisch.

```json5
{
  // ...
  pluginsLoadOrder: ['core', 'chat-server', 'emotewheel'],
  // ...
}
```

## pluginDiscovery.abortOnPluginError

Bei `true` beendet ein synchroner Startfehler eines nicht als `optional` markierten Plugins den Serverstart, sofern er bis zum Plugin-Bootstrap gelangt. Standard `false`. Die Option gehört in `pluginDiscovery`; ein oberstes `abortOnPluginError` wird vom Loader nicht gelesen.

Der aktuelle temporäre JavaScript-Loader protokolliert Ausführungsfehler intern, sodass sie den Bootstrap möglicherweise nicht erreichen. Asynchrone Prozessfehler treten ebenfalls erst nach dem Start auf. Prüfe deshalb zusätzlich zum gemeldeten Laufzeitstatus Logs und tatsächliches Plugin-Verhalten. Siehe [Plugin-System](../../../../README-plugins.md).

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

Relativer oder absoluter Pfad zu einer Gamemode-Datei oder einem Ordner. Bei einem Ordner wird `index.js` gesucht.

```json5
{
  // ...
  gamemodePath: 'gamemode.js',
  // ...
}
```

## startPoints

Liste von Spawnpunkten, aus denen einer zufällig gewählt wird.

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

Ein einzelner Spawnpunkt für neue Charaktere. Ist `startSpawn` vorhanden, verwendet der Server ausschließlich diesen ersten Spawnpunkt.

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

Gilt nur bei der erstmaligen Charaktererstellung. Danach erscheint der Actor an seinem gespeicherten `spawnPoint`.

## starterInventory

Inventar, das neuen Charakteren einmalig zugewiesen wird.

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

Unterstützte Eintragsfelder:

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

Boolesche Einstellung zum Aktivieren oder Deaktivieren von Hot Reload für kompilierte Papyrus-Skripte (.pex).

```json5
{
  // ...
  isPapyrusHotReloadEnabled: false,
  // ...
}
```

## locale

Name der von der Papyrus-Funktion `M.GetText` verwendeten Lokalisierungsdatei unter `data/localization`, ohne Dateiendung.

```json5
{
  // ...
  locale: 'ru-RU',
  // ...
}
```

## localeRouting

Steuert die Frontend-Sprachauswahl anhand des Ländercodes; wird von den Routen zur Admin-/Client-Sprachauflösung verwendet.

- `defaultLanguage`: Ersatzsprache ohne passende Zuordnung.
- `countryCodeToLanguage`: Zuordnung von ISO-Ländercodes zu Sprachcodes.

Ohne gültige Angabe gelten sichere Standards: `defaultLanguage: "en"` und eingebaute Zuordnungen für `de`, `en`, `es`, `ru`.

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

Veraltet. `true` wird ignoriert und erzeugt `LEGACY_CONSOLE_BYPASS_IGNORED`. Der Schalter erteilt niemals Rechte für Server-Konsolenbefehle. Entferne ihn und konfiguriere ausdrücklich `consoleSecurity`. Bestehende Actor-Berechtigungen `consoleCommandsAllowed` bleiben für vertrauenswürdigen Servercode verfügbar.

## consoleSecurity

Der Core verwaltet den Konsolenschutz unabhängig von Chat-Plugins. Standards:

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

`restricted` blockiert immer die unterstützten lokalen Cheatbefehle. Nur eine ausdrückliche `development`-Richtlinie darf `blockVanillaCheats:false` setzen; Serverautorisierung bleibt in beiden Modi verpflichtend. Ungültige Startwerte erhalten sichere Ersatzwerte und Diagnosen; ungültige Dashboard-Schreibzugriffe werden abgelehnt.

`movementEnforcement` akzeptiert `off` oder `monitor`. Der frühere Wert `enforce` war nie strenger und wird als `monitor` gelesen. Bestehende harte Bewegungsprüfungen bleiben in allen Modi aktiv. Geschwindigkeits- und Aufwärtsheuristiken erzeugen nur Beobachtungen; sie bannen keine Spieler und beweisen kein Noclip. `monitorMovement:false` deaktiviert diese zusätzlichen Beobachtungen.

Konfiguriere **Einstellungen → Sicherheit** (`#settings/security`) mit Admin-Rolle und `canConsole`. Gespeicherte Änderungen gelten nach einem Gameserver-Neustart. Das Dashboard vergleicht gespeicherte Werte mit dem tatsächlichen nativen Prozess und kennzeichnet Client-Hookmeldungen als unbestätigt. Core, Client-Bootstrap und Dashboard müssen aktualisiert sein, bevor die neue Schutzfunktion als verfügbar gilt.

Unter [Console Security](docs_console_security.md) stehen unterstützte Hooks, native Request-Validierung, Migration, optionaler Permission-Resolver und Grenzen.

## sweetPieMinimumPlayersToStart

Mindestspielerzahl zum Beginn eines Deathmatches. Gilt nur für SweetPie, nicht für Vanilla-Server. Standard 5.

```json5
{
  // ...
  sweetPieMinimumPlayersToStart: 5,
  // ...
}
```

## sweetPieAllowCheats

Verhindert, dass der Gamemode Cheats deaktiviert. Gilt nur für SweetPie, nicht für Vanilla-Server. Standard false.

```json5
{
  // ...
  sweetPieAllowCheats: true,
  // ...
}
```

## sweetPieChatSettings

Erlaubt das Anpassen von Chat-Einstellungen, etwa des Sichtbarkeitsradius von Nachrichten.

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

Aktiviert oder deaktiviert `/new2024`, das den Spieler in die SweetPie-Halle teleportiert.

```json5
  // ...
  "sweetPieCommandEnabled": true
  // ...
```

## npcEnabled

Aktiviert das Laden von NPCs. Standard false.

```json5
{
  // ...
  npcEnabled: false,
  // ...
}
```

## npcSettings

Optionale NPC-Konfiguration. Sie darf fehlen oder leer sein; dann dürfen bei `"npcEnabled": true` alle NPCs geladen werden. Die Felder von `"NpcSettings"` legen erlaubte Spieldateien und Spawn-Beschränkungen für Innen- und Außenbereiche fest. Standardmäßig sind alle NPCs erlaubt (`"npcSettings": {}`). `"default":{}` legt `"spawnInInterior"` und `"spawnInExterior"` für nicht genannte Spieldateien fest. Optionale Klassenfilter:

- `allowHumanoid` (Standard `true`) – humanoide NPCs erlauben/verbieten (Schlüsselwort `ActorTypeNPC`).
- `allowCreature` (Standard `true`) – Kreaturen, Tiere und Monster erlauben/verbieten.

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

Beispiel: Städte weitgehend leeren, aber Tiere und Monster weiterhin erscheinen lassen.

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

Nur mit der Moddatei "SweetPie.esp" verfügbar. Ermöglicht eine flexible Anpassung der Ausdauerkosten von Spielerangriffen anhand von im Creation Kit gesetzten Schlüsselwörtern. Ohne dieses Feld gelten fest im Code hinterlegte Standardwerte.

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

Konfiguriere additionalServerSettings im Startskript oder der Konfigurationsdatei wie folgt, um das Abrufen aktueller Servereinstellungen von GitHub zu automatisieren:

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

Steuert die Variablen der serverseitigen Schadensmultiplikator-Formel. Ohne "damageMultFormulaSettings" verwendet der Server Standardwerte.

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

Boolesche Einstellung für Hot Reload bei verbundenen Clients.

- `false` (Standard): Gamemode-Skriptänderungen werden im Serverzustand angewandt, aber **nicht** an bereits verbundene Spieler verteilt. Diese müssen sich erneut anmelden. Das schützt die Clientstabilität, wenn Skripte kein Hot Reload unterstützen.
- `true`: Änderungen werden sofort an alle verbundenen Clients verteilt. Für lokale Entwicklung nützlich, kann aber Desynchronisierung oder Clientfehler verursachen, wenn Skripte nicht erneut zur Laufzeit angewandt werden können.

```json5
{
  // ...
  enableGamemodeDataUpdatesBroadcast: false,
  // ...
}
```

## supervisor

Die paketierten Starter `start-test-server`/`launch_server` übernehmen die Prozesssteuerung automatisch; Shellbefehle sind unnötig. Seit r3 besitzt das vollständige Dashboard einen eigenen Prozess. Spiel-Stopp/-Start/-Neustart und Abstürze erhalten Einstellungen, Logs, Sitzung und WebSocket-Verbindungen. `GET /api/admin/status` liefert `gameState`, `gamePid`, `dashboardPid`. Authentifiziertes Same-Origin-`POST /api/admin/server/control` akzeptiert im Paketmodus `start`, `stop`, `restart` und benötigt `canConsole`. Siehe [VPS-Ports und Prozesssteuerung](docs_vps_ports_and_process_control.md).

Die folgenden Einstellungen gelten für den **alten direkten Backend-/externen Supervisor-Modus**. Ein Befehl zum Stoppen des gesamten Hosting-Dienstes stoppt auch dessen Web-Backend. Verwende für ein unabhängiges Dashboard den paketierten Starter.

- `enabled`: aktiviert/deaktiviert Supervisor-Steuerung.
- `stopCommand`: Befehl für die Stoppaktion.
- `restartCommand`: Befehl für die Neustartaktion.

Im alten Modus benötigen Stopp-/Neustart-Schaltflächen einen konfigurierten Supervisor. Der Paketmodus bietet bei gestopptem Spiel auch Start; Spieleraktionen zur Laufzeit benötigen einen laufenden Gameserver. Ein zusätzlicher öffentlicher Steuerport ist nicht nötig.

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

Bereitstellungsbeispiele für Ubuntu 24.04 stehen in [docs_running_a_server.md](docs_running_a_server.md).
