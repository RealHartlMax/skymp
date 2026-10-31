[Deutsch](README-plugins.md) · [English](docs/i18n/en/README-plugins.md) · [Русский](docs/i18n/ru/README-plugins.md)

# Plugin-System fuer den SkyMP-Server

Dieses Dokument beschreibt Einrichtung, Betrieb und Migration fuer das Plugin-System.

Neu im Quellstand fuer v2.1.0: [Plugin Runtime Loader](docs/docs_plugin_runtime.md).
Plugins koennen eigene signierte Client-/CEF-Pakete ueber `Runtime/manifest.json`
deklarieren. Der Launcher laedt sie vom Gameserver; nach dem einmaligen generischen
Bootstrap erfordern kompatible Plugin-Aenderungen keinen gemeinsamen Runtime-Neubau.
Der genaue Vertrag mit Signierung und Installationspfaden steht unter
[misc/plugin-runtime](misc/plugin-runtime/README.md).

## Zweck

Das Plugin-System trennt den monolithischen Gamemode in kleinere Addons auf.

- Plugins werden beim Start aus `Plugins/` erkannt.
- Erkennung erfolgt ueber `plugin.json` (nicht ueber Ordnernamen).
- Neue Plugins bleiben standardmaessig deaktiviert.
- Aktivierung erfolgt im Dashboard, per Prompt oder mit einem optionalen Automatikmodus.

## Pfade (Windows/Linux)

Der Pfad ist immer relativ zum Server-Arbeitsverzeichnis (`process.cwd()`).

- Windows Beispiel: `Server\\Plugins\\ChatServer\\plugin.json`
- Linux Beispiel: `Server/Plugins/ChatServer/plugin.json`

Konvention:

- Ordnername ist exakt `Plugins` (Gross-/Kleinschreibung beibehalten).
- Es werden nur direkte Unterordner von `Plugins` gescannt.

## Fertige Plugins: Lieferformat und Abhaengigkeiten

Ein Plugin wird als entpackter Ordner geliefert, zum Beispiel:

```text
Server/
  Plugins/
    HelloPlugin/
      plugin.json
      index.cjs
      README.md
```

ZIP-Dateien werden vom Loader nicht entpackt. Die Erkennung richtet sich nach
`plugin.json`, der darin enthaltene `name` muss eindeutig sein. Ein normales
Server-Plugin benoetigt keine eigene `.dll`, `.esp` oder `.esm`.

- `kind: gamemode`: Ein ausfuehrbarer CommonJS-JavaScript-Einstieg, empfohlen
  `index.cjs`. TypeScript vorher in JavaScript uebersetzen. Der aktuelle Loader
  kopiert nur die Entry-Datei in einen temporaeren Ordner und laedt sie dort als
  `.js`. Deshalb lokale Module und npm-Abhaengigkeiten in die Entry-Datei
  buendeln, beispielsweise mit esbuild und
  `--bundle --platform=node --format=cjs`. Ein bloss danebenliegendes `node_modules/` oder
  `require('./helper.cjs')` reicht bei diesem Loader nicht. Auch `__dirname`
  zeigt nicht auf den installierten Plugin-Ordner; persistente Daten mit einem
  ausdruecklich gewaehlten Pfad ablegen.
- `kind: process`: Ein startfertiges Programm beziehungsweise Node-Skript mit
  `command` und `args`. Der Prozess startet im Plugin-Ordner. Hier funktionieren
  lokale Dateien und normale Node-Modulaufloesung; benoetigte Abhaengigkeiten
  muessen mitgeliefert oder vorher installiert sein. Der Loader fuehrt kein
  `npm install` und keinen Build aus. Fuer mehrere Betriebssysteme muessen
  Befehl, Laufzeit und gegebenenfalls native Abhaengigkeiten dazu passen.

Beim `process`-Plugin wird der Start allein durch `command` und `args`
bestimmt. `main` ist dort kein automatisch gestartetes Skript.

## Dashboard und benoetigte Neustarts

Die Verwaltung befindet sich im Dashboard unter **Ressourcen → Server-Plugins**.
Sie zeigt entdeckte Plugins mit Version, Pfad, aktuellem Laufzeitstatus und
Freigabe fuer den naechsten Gameserver-Start. Die Liste aktualisiert den Status
alle fuenf Sekunden; **Status aktualisieren** liest ihn sofort erneut ein.
Das fuehrt keine neue Erkennung auf der Festplatte aus.

Jedes Plugin hat einen Button **Aktivieren** beziehungsweise **Deaktivieren**.
**Alle deaktivierten aktivieren** gibt alle bereits erkannten Plugins mit
vorhandener `plugin.json` frei, unabhaengig vom aktuellen Suchfilter.
Die Auswahl **Neue Plugins beim Gameserver-Start → Automatisch aktivieren**
speichert `pluginDiscovery.mode: "auto"` in `server-settings.json`.
Damit werden erstmals erkannte Plugins beim naechsten Start sofort geladen.
Bereits bekannte, deaktivierte Plugins bleiben deaktiviert; fuer diese den
einzelnen Button oder die Sammelaktivierung verwenden.

Lesen benoetigt `canViewLogs`, Aendern benoetigt `canConsole`. Die Buttons
speichern `startupEnabled` in `Plugins/.discovery-state.json`; sie laden oder
entladen keinen Code im laufenden Server. Eine Freigabe bleibt gespeichert;
ein Terminal-Hilfsskript muss nicht bei jedem Start ausgefuehrt werden.

| Aenderung | Erforderlicher Neustart |
| --- | --- |
| Bekanntes Server-Plugin aktualisieren, aktivieren oder deaktivieren | Gameserver neu starten |
| Neues Plugin im Modus `safe` installieren | Gameserver starten/neustarten, damit es erkannt wird; im Dashboard freigeben; anschliessend Gameserver erneut starten/neustarten |
| Neues Plugin im vorher gewaehlten Modus `auto` installieren | Gameserver starten/neustarten; Erkennung und Aktivierung erfolgen in diesem Start |
| `process`-Plugin unter `Plugins/` aktualisieren | Gameserver neu starten; dadurch wird auch der Plugin-Prozess neu gestartet |
| Dashboard-/Serverpaket selbst aktualisieren | Nach der [Updateanleitung](docs/docs_packaged_server_update.md) auch den Starter mit Dashboard neu starten |
| Zusaetzliche Skyrim-Mods oder SKSE-/Clientdateien aendern | Separat ueber Mod-/Laufzeitpakete verteilen; betroffene Clients mit passenden Dateien neu starten |

Bei den aktuellen Paketen mit getrenntem Dashboard und Game-Prozess bleibt
das Dashboard bei einem reinen Gameserver-Neustart erreichbar. Ein Neustart
des Rechners oder VPS ist fuer Server-Plugins nicht erforderlich. Verbundene
Spieler verlieren beim Gameserver-Neustart ihre Verbindung.

Neue Plugins bleiben standardmaessig deaktiviert. In `prompt` kann die
Freigabe beim ersten interaktiven Start erfolgen; beim Start als Dienst steht
dieser Prompt normalerweise nicht zur Verfuegung. `auto` benoetigt kein
Terminal. Die Freigabe bekannter Plugins bleibt bei Updates mit demselben
`name` und bei Aenderungen des Discovery-Modus erhalten.

Es gibt derzeit keinen Live-Upload, keinen Plugin-Marketplace und keine
Funktion zum einzelnen Starten, Stoppen oder Hot-Reload eines Plugins.
Der separate Datei-Watcher des Haupt-Gamemodes bietet keinen Plugin-Reload:
Er laedt die Plugins nach `mp.clear()` nicht erneut. Bei installiertem
Plugin-Satz deshalb einen vollstaendigen Gameserver-Neustart verwenden.

## Ersteinrichtung und Discovery-State

Beim ersten Start erzeugt der Server eine State-Datei:

- `Plugins/.discovery-state.json`

Inhalt pro Plugin:

- `pluginPath`: Relativer Pfad des Plugin-Ordners
- `fingerprint`: Hash aus Manifest plus relevanten Entry-Daten
- `version`: Version aus dem Manifest
- `startupEnabled`: Automatisch beim Boot laden/starten
- `discoveredAt`, `updatedAt`: Zeitstempel

Die State-Datei trennt:

- bekannt
- neu
- aktualisiert
- entfernt (aus dem Plugin-Ordner verschwunden)

## plugin.json Mindestschema

Pflichtfelder:

- `name`: Eindeutiger Schluessel, 1 bis 64 Zeichen aus `a-z`, `A-Z`, `0-9`, `_`, `-`
- `version`: Versionsstring, muss mit einer Ziffer beginnen (empfohlen SemVer)
- `kind`: `gamemode` oder `process`
- `displayName`: Anzeigename fuer Operatoren
- `description`: Kurzbeschreibung fuer Entscheidung/Review

Optionale Felder:

- `main`: Relativer Einstiegspunkt (Default im Loader: `index.cjs`)
- `optional`: Bei Fehler nicht als kritischer Startfehler behandeln
- `startupDefault`: Dokumentationshinweis, wird bei neuen Plugins bewusst ignoriert
- `command`: Pflicht fuer `kind: process`, auszufuehrender Befehl
- `args`: Nur fuer `kind: process`, Argumentliste

`displayName` darf hoechstens 100, `description` hoechstens 512 Zeichen
enthalten. `main` muss innerhalb des Plugin-Ordners liegen; absolute Pfade
oder `..` als Pfadanfang werden abgewiesen. Manifestdateien sind auf 64 KiB
Text begrenzt, `args` auf 128 String-Eintraege.

### Komplettbeispiel: gamemode

```json
{
  "name": "emotewheel",
  "version": "1.2.0",
  "kind": "gamemode",
  "displayName": "Emote Wheel",
  "description": "Adds chat-driven emote wheel bindings",
  "main": "index.cjs",
  "optional": false
}
```

### Komplettbeispiel: process

```json
{
  "name": "chat-server",
  "version": "0.4.1",
  "kind": "process",
  "displayName": "Chat Server",
  "description": "Standalone chat bridge process",
  "main": "server.mjs",
  "command": "node",
  "args": ["server.mjs"],
  "optional": true
}
```

## Boot-Ablauf

1. Haupt-Gamemode aus `gamemodePath` laden.
2. `Plugins/` auf direkte Unterordner scannen.
3. Nur Ordner mit `plugin.json` einbeziehen.
4. Manifest validieren und Fingerprint berechnen.
5. Gegen `Plugins/.discovery-state.json` vergleichen.
6. Sortierung:
   - Erst `pluginsLoadOrder` aus Settings (falls vorhanden)
   - Danach alphabetisch nach `name`
7. Nur Plugins mit `startupEnabled=true` starten.
8. State-Datei aktualisieren.

`kind: gamemode`:

- Plugin-Entry via `require` laden.

`kind: process`:

- Prozess via `spawn` starten (`cwd` = Plugin-Ordner).
- Logs werden mit Prefix ausgegeben (`[plugin:<name>]`).
- Beim Serverende werden Kindprozesse beendet (Windows: `taskkill /t /f`, Linux: `SIGTERM`).

## Aktivierung neuer Plugins

Neue Plugins werden standardmaessig deaktiviert angelegt (`startupEnabled=false`).

Konfiguration in `server-settings.json`:

```json
{
  "pluginDiscovery": {
    "mode": "safe",
    "processCommandAllowlist": ["node", "node.exe"],
    "abortOnPluginError": true
  },
  "pluginsLoadOrder": ["core", "chat-server", "emotewheel"]
}
```

`pluginDiscovery.mode`:

- `safe`: Kein Prompt, neue Plugins bleiben deaktiviert
- `prompt`: Bei interaktivem Start Ja/Nein-Prompt fuer neu entdeckte Plugins
- `auto`: Neue Plugins beim ersten Erkennen automatisch aktivieren; bekannte Plugins behalten ihre gespeicherte Freigabe

Ohne gueltige Einstellung gilt `safe`. `auto` eignet sich fuer Installationen,
bei denen nur gepruefte Plugins in `Plugins/` abgelegt werden.

`pluginDiscovery.processCommandAllowlist`:

- Optionales String-Array fuer `kind: process` Plugins.
- Wenn gesetzt, duerfen nur diese Commands gestartet werden.
- Vergleich erfolgt gegen kompletten `command` oder dessen Dateinamen (z. B. `node`).
- Wenn nicht gesetzt, gibt es keine zusaetzliche Einschraenkung (Rueckwaertskompatibilitaet).

`pluginDiscovery.abortOnPluginError` (default `false`):

- `true`: Server bricht den Start ab, wenn ein nicht-`optional` Plugin einen Fehler wirft. Empfohlen fuer Produktivumgebungen.
- `false`: Plugin-Fehler werden geloggt, Server startet dennoch.

Aktuelle Einschraenkung: Der gemeinsame temporaere JavaScript-Loader faengt
Ausfuehrungsfehler intern ab und loggt sie. Der Plugin-Bootstrap kann solche
Fehler deshalb als erfolgreich geladen melden. Auch asynchrone Prozessfehler
werden erst nach dem Start gemeldet. `running` und diese Option sind daher
kein verlaesslicher Nachweis, dass jede Plugin-Funktion fehlerfrei arbeitet;
die Serverlogs und das konkrete Verhalten mitpruefen.

Hinweis fuer Daemon-Betrieb:

- Mit `safe` starten und Freigabe per Panel/State-Workflow machen.
- Alternativ im Dashboard `auto` waehlen, wenn neue Plugins ohne Terminalabfrage beim Start aktiviert werden sollen.

## Minimalbeispiele

### Minimal: gamemode-Plugin

Dateien:

- `Plugins/HelloPlugin/plugin.json`
- `Plugins/HelloPlugin/index.cjs`

`index.cjs`:

```js
// Die Entry-Datei wird beim Gameserver-Start einmal ausgefuehrt.
console.log("[HelloPlugin] loaded");

// Persistente Eigenschaft fuer einen moeglichen spaeteren RP-Gamemode.
mp.makeProperty("helloPluginRank", {
  isVisibleByOwner: false,
  isVisibleByNeighbors: false,
  updateOwner: "",
  updateNeighbor: ""
});
```

### Minimal: process-Plugin

Dateien:

- `Plugins/ChatServer/plugin.json`
- `Plugins/ChatServer/server.mjs`

`server.mjs`:

```js
setInterval(() => {
  console.log("[ChatServer] heartbeat");
}, 10000);
```

## Sicherheit

Alles unter `Plugins/` kann Host-Code ausfuehren.

- Niemals unbekannte Plugins blind aktivieren.
- Neue Plugins nur nach Review auf `startupEnabled=true` setzen.
- `plugin.json` plus Entry-Dateien als trusted code behandeln.
- Fuer `kind: process` Plugins in Produktion `pluginDiscovery.processCommandAllowlist` setzen (z. B. nur `node`/`node.exe`).

## Troubleshooting

- Plugin wird nicht erkannt:
  - Liegt `plugin.json` direkt in `Plugins/<Name>/`?
  - Sind Pflichtfelder gesetzt?
- Plugin startet nicht:
  - `main` pruefen (`kind: gamemode`)
  - `command` und `args` pruefen (`kind: process`)
  - Logs mit Prefix `[plugins]` und `[plugin:<name>]` kontrollieren
- Prompt erscheint nicht:
  - `pluginDiscovery.mode` ist `prompt`?
  - Start ist interaktiv (TTY)?
- Prozess bleibt haengen:
  - Auf Windows wird `taskkill /t /f` verwendet
  - Auf Linux `SIGTERM` (ggf. eigenen Handler im Plugin implementieren)

## Runtime-Status im Admin-API

`PATCH /api/admin/plugins/:name` mit JSON `{"startupEnabled": true}` oder
`false` speichert die Freigabe fuer den naechsten Start. Die Antwort enthaelt
`restartRequired: true`. Ein noch nicht beim Start entdecktes Plugin wird mit
`404` abgewiesen. Die API fuehrt keinen neuen Ordnerscan und keinen Live-Start aus.

`POST /api/admin/plugins/enable-all` mit JSON `{}` aktiviert alle bereits
erkannten, deaktivierten Plugins mit vorhandener `plugin.json`. Die Antwort
enthaelt `names`, `count` und `restartRequired` (bei mindestens einer Aenderung
`true`). Fehlende Manifeste werden uebersprungen. Ein erneuter Aufruf ohne neue
deaktivierte Plugins liefert `count: 0` und veraendert die State-Datei nicht.

`GET /api/admin/plugins/settings` liefert `{ "mode": "safe" }`, `"prompt"`
oder `"auto"`. `PUT` auf denselben Pfad mit beispielsweise `{ "mode": "auto" }`
speichert den Modus fuer den naechsten Gameserver-Start. Andere Einstellungen,
auch weitere Schluessel unter `pluginDiscovery`, bleiben erhalten. Diese
Schreibzugriffe benoetigen wie die einzelne Freigabe `canConsole`.

`GET /api/admin/plugins` enthaelt zusaetzlich `runtimeStatus` pro Plugin:

- `starting`: Plugin-Start wurde initiiert
- `running`: Plugin laeuft
- `failed`: Start oder Laufzeitfehler erkannt
- `stopped`: Nicht gestartet (`startupEnabled=false`) oder sauber beendet

`runtimeStatus` kann `null` sein, wenn noch keine Laufzeitmeldung vorliegt.
Die gespeicherte Startfreigabe und der Laufzeitstatus sind unabhaengig: Ein
bereits laufendes Plugin kann bis zum naechsten Neustart weiterlaufen, obwohl
seine Startfreigabe inzwischen deaktiviert wurde.

Beispielauszug:

```json
{
  "name": "chat-server",
  "startupEnabled": true,
  "runtimeStatus": {
    "name": "chat-server",
    "status": "running",
    "pid": 12345,
    "updatedAt": 1760000000000
  }
}
```

## Migration vom monolithischen gamemode

1. Bisherige Module in einzelne Plugin-Ordner verschieben.
2. Pro Plugin ein `plugin.json` erstellen.
3. `gamemodePath` als Bootstrap/Haupt-Gamemode belassen.
4. Erst mit `pluginDiscovery.mode = safe` starten.
5. Neue Plugins einzeln freigeben (`startupEnabled=true`).
6. Optional Reihenfolge ueber `pluginsLoadOrder` festlegen.

## Was sich als Plugin umsetzen laesst

`gamemode`-Plugins laufen mit dem globalen `mp` im Gameserver und koennen die
vorhandenen Server-APIs nutzen. Beispiele fuer daraus entwickelbare Systeme:

- Rollen, Fraktionen, Berufe, Waehrungen und Fortschritt mit eigenen
  persistenten Properties (`mp.makeProperty`, `mp.get`, `mp.set`).
- Inventar-/Beuteregeln, Teleports, Spawnpunkte, Werte von Actors und eigene
  Wiederbelebungs- oder Respawnregeln innerhalb der angebotenen Hooks.
- Eigene Spielereignisse und Clientreaktionen ueber `mp.makeEventSource`,
  Property-Updates und die vorhandenen SkyrimPlatform-Funktionen.
- Protokollierung und externe Integrationen, sofern das Plugin die dafuer
  erforderliche Verbindung selbst implementiert.

`process`-Plugins eignen sich beispielsweise fuer Bots, Webhooks, Chat-Bridges
oder Hintergrunddienste. Sie erhalten **kein** gemeinsames `mp`-Objekt und
keinen automatischen RPC-/IPC-Kanal zum Gamemode. Fuer Zugriff auf Spielzustand
ist eine eigens implementierte, authentifizierte Schnittstelle erforderlich.

Das Plugin-System liefert keine neue Engine-Funktion, keine automatische
Dashboard-Oberflaeche pro Plugin und keine Verteilung beliebiger Clientdateien.
Neue Modelle, Welten, native Funktionen oder eigene Clientmodule brauchen die
passenden Skyrim-Mods beziehungsweise Clientpakete. Clientcode, der bereits
ueber die Property-/Event-API uebertragen werden kann, ist davon zu unterscheiden.

Gamemode-Plugins teilen denselben Prozess und globale Handler. Sie laufen
ohne Sandbox; ueberschriebene Handler oder blockierender Code koennen andere
Plugins und den Gameserver beeinflussen. Es gibt keine deklarative
Abhaengigkeits-/Versionspruefung und keinen automatischen Neustart eines
abgestuerzten `process`-Plugins. Die Ladereihenfolge allein prueft weder
Abhaengigkeiten noch Betriebsbereitschaft externer Dienste.

API-Details: [Serverside Scripting](docs/docs_serverside_scripting_reference.md),
[Properties](docs/docs_properties_system.md),
[Events](docs/docs_events_system.md) und
[Respawn](docs/docs_respawn_control_system.md).

## Voice Activity Adapters (für Lipsync & Proximity Chat)

**Stand 27. Oktober 2026: teilweise implementiert.** VAD-Vertrag,
Serververteilung und ein Client-Animationsversuch existieren. Durchgängiges
Voice-Lipsync ist noch nicht im Spiel nachgewiesen. Die neue lokale YACA-Bridge
aktiviert diesen Pfad im normalen Plugin-Einstieg nicht automatisch.

Der vollständige [Lipsync-Befund mit benötigten Angaben und Spieltest](docs/docs_voice_lipsync_status.md)
beschreibt die fehlende Anbindung, Actor-ID-Zuordnung, Meterumrechnung,
Timeouts und den Animationsreset.

### Adaptervertrag und aktuelle YACA-Bridge

Ein Voice-Adapter übersetzt echte Sprechereignisse eines Providers in
`VoiceActivityState` und meldet sie über seine beim
`VoiceActivityManager` registrierten Callbacks. Eine Datei unter `Plugins/`
registriert einen solchen Adapter nicht automatisch.

Das Servergerüst
[YacaTeamSpeakAdapter.ts](skymp5-server/ts/adapters/YacaTeamSpeakAdapter.ts)
stellt `handleYacaVoiceEvent(...)` bereit. Sein `initialize()` stellt aber
keine TeamSpeak-Verbindung her. Die neue lokale Bridge im separaten
`SkyMP-YACA-TS`-Repository verwendet CEF, `TALK_STATE`/`SOUND_STATE` und
`_yacaClient`. Sie benötigt dafür keine Papyrus-Quest. Ihr optionaler
`onVoiceActivity`-Callback ist im normalen Plugin-Einstieg nicht verbunden.

`voiceActivity.enabled: true` in `server-settings.json` startet den Manager;
es schließt diese Integrationslücke nicht. Der vorhandene
`voiceActivity`/`yaca:voiceActivity`-Custom-Packet-Eingang broadcastet direkt
und umgeht Registry und Inaktivitätstimer. Vor einer fertigen Anbindung müssen
Absenderzuordnung und Zustandsführung vereinheitlicht werden.

### Diagnose und Prüfgrenzen

- Implementiert sind `GET /api/admin/voice/status` und
  `GET /api/admin/voice/speakers`, jeweils mit Admin-Recht `canViewLogs`.
- Eine eigene Voice-Diagnoseansicht im Dashboard und
  `POST /api/admin/voice/range` sind nicht implementiert.
- Adapter-Health und ein bestandener Paketparser-Test belegen keine sichtbare
  Mundbewegung. Sprecherzahlen sind beim bisherigen Datenweg nur eingeschränkt
  aussagekräftig.
- Der bestehende Clientpfad überträgt „spricht / spricht nicht“ und versucht eine
  Dialoganimation. Audiopegel- oder Phonemsteuerung ist darin nicht enthalten.

Aktuelle Paketformate, Konfiguration und Grenzen stehen in der
[Voice-API-Referenz](docs/docs_voice_api.md). Offene Arbeit steht im
[Voice-Backlog](ROADMAP.md#voice--proximity-chat-sync-backlog-proposed).

## Plugin-Ladereihenfolge im Dashboard

Unter **Ressourcen → Server-Plugins** zeigen Positionsnummern die Reihenfolge fuer
den naechsten Gameserver-Start. Mit den Pfeilen nach oben/unten verschieben und
**Ladereihenfolge speichern** waehlen. Aktivierung bleibt eine getrennte Einstellung.
Ungespeicherte Aenderungen koennen verworfen werden. Suchfilter entfernen keine
Plugins aus der gespeicherten Liste. Gleichzeitige Aenderungen werden mit einem
Konflikthinweis abgewiesen.

Die Auswahl wird als Plugin-IDs in pluginsLoadOrder der server-settings.json
gespeichert; private Einstellungen, Mod-Reihenfolge und Discovery-State bleiben
erhalten. Dienste muessen vor ihren Verbrauchern stehen, beispielsweise
skymp-ui-core vor example-ui-consumer und second-ui-consumer. Ohne explizite
Reihenfolge greift weiterhin die alphabetische Sortierung des bestehenden Loaders.
Nicht aufgefuehrte neue Plugins folgen alphabetisch. Bereits konfigurierte,
voruebergehend fehlende Plugin-IDs bleiben erhalten. Keine automatische
Abhaengigkeitsaufloesung und kein einzelner Plugin-Hot-Reload.

GET /api/admin/plugins/load-order liefert Reihenfolge und Revision (canViewLogs).
PUT mit {revision, pluginsLoadOrder} speichert die vollstaendige Liste (canConsole).
Veraltete Revision: 409; ungueltige/unvollstaendige Liste: 400. Aenderungen gelten
ab dem naechsten Gameserver-Start. Fuer die Installation dieses neuen Dashboard-/
Backend-Builds einmal den Starter/Dashboarddienst neu starten; beim spaeteren
Umordnen genuegt ein Gameserver-Neustart.
