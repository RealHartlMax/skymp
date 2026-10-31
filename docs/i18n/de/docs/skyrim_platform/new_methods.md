[Deutsch](new_methods.md) · [English](../../../en/docs/skyrim_platform/new_methods.md) · [Русский](../../../ru/docs/skyrim_platform/new_methods.md)

<a id="custom-skyrim-platform-methods-and-properties"></a>

# Eigene Methoden und Eigenschaften von Skyrim Platform

Methoden wie `printConsole ()` lassen sich unmittelbar nach dem Import aufrufen. Sie gehören keinem Spieltyp an.

<a id="table-of-contents"></a>

## Inhaltsverzeichnis

- [browser](#browser)
- [on/once](#ononce)
- [printConsole](#printconsole)
- [settings](#settings)
- [writeLogs](#writelogs)
- [Weitere Methoden und Eigenschaften](#weitere-methoden-und-eigenschaften)

## printConsole

`printConsole (... arguments: unknown[]): void`

Ausgabe in der Spielkonsole, die mit der Taste `~` geöffnet wird.

Allen Konsolennachrichten wird die Zeichenfolge `[Script]` hinzugefügt.

```typescript
import { Game, once, printConsole } from 'skyrimPlatform';

once('update', () => {
  printConsole(`player id = ${Game.getPlayer().getFormID()}`);
});
```

## writeLogs

`writeLogs(pluginName: string, ...arguments: unknown[]): void`

Schreibt in eine Protokolldatei.\
Die Funktion erstellt eine Datei namens `Data/Platform/Plugins/pluginName-logs.txt`.

Die Funktion erzwingt kein bestimmtes Format und schreibt beispielsweise Zeitstempel nicht automatisch.\
Dadurch kannst du selbst bestimmen, welche Informationen dein Protokoll enthält und wie sie dargestellt werden.

Verwende beispielsweise `Date().toLocaleString()`, um einen Zeitstempel entsprechend den regionalen Einstellungen des Spielcomputers zu schreiben:

```typescript
import { writeLogs } from 'skyrimPlatform';

const t = new Date().toLocaleString();
writeLogs('your-mod', `${t}: some message`);
```

**_WARNUNG_**: Diese Datei wird jedes Mal überschrieben, wenn das Spiel beendet wird.\
Wenn du mehrere Protokolle aufbewahren möchtest, musst du deren Dateinamen ausdrücklich selbst verwalten.

## settings

`settings`

Ein Objekt, das Zugriff auf Plugin-Einstellungen gewährt:

```typescript
import { printConsole, settings } from 'skyrimPlatform';

let option = settings['plugin-name']['my-option'];
printConsole(option);
```

Die Einstellungsdatei heißt `plugin-settings.txt` und gehört in den Ordner `Data/Platform/Plugins`.\
Das Dateiformat ist JSON; die Endung `.txt` erleichtert Benutzern die Bearbeitung.

Änderungen an einer Einstellungsdatei lösen [Hot Reload][Features] aus.

## on/once

`on (eventName: string, callback: any): void`

`once (eventName: string, callback: any): void`

[Abonniert][NewEvents] ein Ereignis namens `eventName`.

## browser

Ein Objekt für den [Zugriff auf das Chromium Embedded Framework][Browser].

<a id="other-methods-and-properties"></a>

## Weitere Methoden und Eigenschaften

Weitere Informationen und Beispiele hierzu folgen später:

- `worldPointToScreenPoint` – wandelt ein Array von Punkten der Spielwelt in Bildschirmpunkte um. Ein Bildschirmpunkt wird durch drei Zahlen von -1 bis 1 dargestellt.
- `callNative (className: string, functionName: string, self ?: object, ... args: any): any` – ruft eine Funktion des ursprünglichen Spiels anhand ihres Namens auf.
- `getJsMemoryUsage (): number` – ermittelt den vom eingebetteten JS-Modul verwendeten Arbeitsspeicher in Byte.
- `storage` – speichert Daten zwischen Skript-Neuladevorgängen. Ein Beispiel findest du im Rezept [Plugin-Initialisierung][PluginInit].
- `getExtraContainerChanges` – ermittelt ExtraContainerChanges der angegebenen ObjectReference.
- `getContainer` – ermittelt alle Gegenstände des Basiscontainers.
- `disableCtrlPrtScnHotkey` – deaktiviert die Tastenkombination, welche die Spielgeschwindigkeit an die Bildrate statt an die reale Zeit koppelt.

[Browser]: browser.md
[Features]: features.md
[NewEvents]: new_events.md
[PluginInit]: cookbook.md#plugin-initialization
