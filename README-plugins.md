# Plugin-System fuer den SkyMP-Server

Dieses Dokument beschreibt Einrichtung, Betrieb und Migration fuer das Plugin-System.

## Zweck

Das Plugin-System trennt den monolithischen Gamemode in kleinere Addons auf.

- Plugins werden beim Start aus `Plugins/` erkannt.
- Erkennung erfolgt ueber `plugin.json` (nicht ueber Ordnernamen).
- Neue Plugins werden nie automatisch aktiviert.
- Aktivierung erfolgt per Admin-Entscheidung (Prompt oder Panel-Workflow).

## Pfade (Windows/Linux)

Der Pfad ist immer relativ zum Server-Arbeitsverzeichnis (`process.cwd()`).

- Windows Beispiel: `Server\\Plugins\\ChatServer\\plugin.json`
- Linux Beispiel: `Server/Plugins/ChatServer/plugin.json`

Konvention:

- Ordnername ist exakt `Plugins` (Gross-/Kleinschreibung beibehalten).
- Es werden nur direkte Unterordner von `Plugins` gescannt.

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

- `name`: Eindeutiger Schluessel
- `version`: Versionsstring (empfohlen SemVer)
- `kind`: `gamemode` oder `process`
- `displayName`: Anzeigename fuer Operatoren
- `description`: Kurzbeschreibung fuer Entscheidung/Review
- `main`: Relativer Einstiegspunkt (Default im Loader: `index.cjs`)

Optionale Felder:

- `optional`: Bei Fehler nicht als kritischer Startfehler behandeln
- `startupDefault`: Dokumentationshinweis, wird bei neuen Plugins bewusst ignoriert
- `command`: Nur fuer `kind: process`, auszufuehrender Befehl
- `args`: Nur fuer `kind: process`, Argumentliste

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
    "mode": "safe"
  },
  "pluginsLoadOrder": ["core", "chat-server", "emotewheel"],
  "abortOnPluginError": true
}
```

`pluginDiscovery.mode`:

- `safe`: Kein Prompt, neue Plugins bleiben deaktiviert
- `prompt`: Bei interaktivem Start Ja/Nein-Prompt fuer neu entdeckte Plugins

`abortOnPluginError` (default `false`):

- `true`: Server bricht den Start ab, wenn ein nicht-`optional` Plugin einen Fehler wirft. Empfohlen fuer Produktivumgebungen.
- `false`: Plugin-Fehler werden geloggt, Server startet dennoch.

Hinweis fuer Daemon-Betrieb:

- Mit `safe` starten und Freigabe per Panel/State-Workflow machen.

## Minimalbeispiele

### Minimal: gamemode-Plugin

Dateien:

- `Plugins/HelloPlugin/plugin.json`
- `Plugins/HelloPlugin/index.cjs`

`index.cjs`:

```js
mp.registerEvent("onInit", () => {
  console.log("[HelloPlugin] loaded");
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

## Migration vom monolithischen gamemode

1. Bisherige Module in einzelne Plugin-Ordner verschieben.
2. Pro Plugin ein `plugin.json` erstellen.
3. `gamemodePath` als Bootstrap/Haupt-Gamemode belassen.
4. Erst mit `pluginDiscovery.mode = safe` starten.
5. Neue Plugins einzeln freigeben (`startupEnabled=true`).
6. Optional Reihenfolge ueber `pluginsLoadOrder` festlegen.
