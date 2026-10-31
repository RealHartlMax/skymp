[Deutsch](native.md) · [English](../../../en/docs/skyrim_platform/native.md) · [Русский](../../../ru/docs/skyrim_platform/native.md)

<a id="native-functions"></a>

# Native Funktionen

Die meisten Typen besitzen native Funktionen. Diese sind in statische Funktionen (`Native Global` in Papyrus) und Methoden (`Native`) unterteilt.

Statische Funktionen werden am Typ aufgerufen:

```typescript
let sunX = Game.getSunPositionX();
let pl = Game.getPlayer();
Game.forceFirstPerson();
```

Methoden werden am Objekt aufgerufen:

```typescript
let isPlayerInCombat = pl.isInCombat();
```

Eine Liste der ursprünglichen Spieltypen mit Dokumentation findest du hier: https://www.creationkit.com/index.php?title=Category:Script_Objects

**_WARNUNG_**: Papyrus-Typen und -Methoden stehen nur innerhalb der von Skyrim Platform eingeführten [neuen Ereignisse][NewEvents] (außer `tick`) oder des Hooks `sendPapyrusEvent` zur Verfügung (siehe [Hooks][Hooks]).

Wenn du sie außerhalb dieser Kontexte verwendest, wird eine Ausnahme ausgelöst.

<a id="native-functions-from-skse-plugins"></a>

# Native Funktionen aus SKSE-Plugins

Du kannst von SKSE-Plugins hinzugefügte Papyrus-Funktionen aufrufen.

Dieses Beispiel zeigt die Verwendung von PapyrusUtil in einem SkyrimPlatform-Plugin:

```typescript
import * as sp from 'skyrimPlatform';

sp.once('update', () => {
  const filePath = 'data/platform/plugins/plugin-example.js';

  // SkyrimPlatform doesn't contain PapyrusUtil typings so we cast to any to be able to call all functions.
  // Here we use 'MiscUtil.ReadFromFile' native. Of course, you can use any other function.
  const str = (sp as any).MiscUtil.readFromFile(filePath);

  sp.printConsole('Read', str.length, 'characters');
});
```

<!-- TODO: Entfernen, sobald diese Funktionalität auf Engine-Ebene implementiert ist. -->

Alternativ kannst du [konvertierte Bibliotheksdefinitionen][TsDefs] verwenden oder mit [Papyrus-2-Typescript][Papyrus2Ts] selbst erstellen. Danach kannst du native SKSE-Funktionen genauso wie in Papyrus verwenden:

```typescript
import * as MiscUtil from 'PapyrusUtil/MiscUtil';
import { once, printConsole } from 'skyrimPlatform';

once('update', () => {
  const filePath = 'data/platform/plugins/plugin-example.js';

  // PapyrusUtil typings are defined inside MiscUtil.ts
  const str = MiscUtil.readFromFile(filePath);

  printConsole('Read', str.length, 'characters');
});
```

<a id="asynchronous"></a>

# Asynchrone Ausführung

Einige Spielfunktionen benötigen Zeit und laufen im Hintergrund. Solche Funktionen geben in SkyrimPlatform ein `Promise` zurück:

```typescript
Game.getPlayer()
  .SetPosition(0, 0, 0)
  .then(() => {
    printConsole('Teleported to the center of the world');
  });
```

```typescript
Utility.wait(1).then(() => printConsole('1 second passed'));
```

Bei einem asynchronen Aufruf wird die Ausführung unmittelbar fortgesetzt:

```typescript
Utility.wait(1);
printConsole(`Will be displayed immediately, not after a second`);
printConsole(`Should have used then`);
```

Mit `async`/`await` kannst du den Code wie synchronen Code schreiben:

```typescript
let f = async () => {
  await Utility.wait(1);
  printConsole('1 second passed');
};
```

**_WARNUNG_**: Wenn du asynchrone Funktionen innerhalb [neuer Ereignisse][NewEvents] verwendest, können `Form`-Referenzen bereits ungültig sein, sobald du sie benötigst.

In diesen Fällen kannst du die `FormId` speichern und die `Form` erneut über [`Game.getFormEx`][GetFormEx] ermitteln.

```typescript
on('unequip', (event) => {
  // Define an async function.
  const f = async () => {
    const id = event.actor.getFormID();
    await Utility.wait(0.1);
    // event.actor is lost at this point. We need to get it again.
    const a = Game.getFormEx(id);
    printConsole(`${a?.getName()} unequipped something.`);
  };

  // Execute previosly defined async function
  f();
});
```

[GetFormEx]: papyrus.md#form
[Hooks]: events.md
[NewEvents]: new_events.md
[Papyrus2Ts]: https://www.nexusmods.com/skyrimspecialedition/mods/56916
[TsDefs]: https://github.com/CarlosLeyvaAyala/Papyrus-2-Typescript/tree/main/conversions
