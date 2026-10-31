[Deutsch](new_events.md) · [English](../../../en/docs/skyrim_platform/new_events.md) · [Русский](../../../ru/docs/skyrim_platform/new_events.md)

<a id="events"></a>

# Ereignisse

Neben dem Abonnieren von Papyrus-Ereignissen stellt Skyrim Platform eigene Ereignisse bereit.

Viele entsprechen bereits in Skyrim vorhandenen Ereignissen. Dank erweiterter und typisierter Informationen lassen sie sich in TypeScript jedoch einfacher verwenden.

Skyrim Platform hängt keine Skripte an Objekte an. Diese Ereignisse stehen deshalb ohne eine solche Bindung zur Verfügung.

<a id="subscribing-to-events"></a>

## Ereignisse abonnieren

Mit `on` abonnierst du ein Ereignis dauerhaft.

```typescript
import { on } from 'skyrimPlatform';

on('equip', (event) => {
  printConsole(`actor: ${event.actor.getBaseObject().getName()}`);
  printConsole(`object: ${event.baseObj.getName()}`);
});
```

Mit `once` registrierst du einen Handler, der beim nächsten Auftreten des Ereignisses einmal aufgerufen wird.

```typescript
import { once } from 'skyrimPlatform';

once('equip', (event) => {
  printConsole(`actor: ${event.actor.getBaseObject().getName()}`);
  printConsole(`object: ${event.baseObj.getName()}`);
});
```

Sowohl `on` als auch `once` geben ein `EventHandle` mit eindeutiger Abonnement-ID und Ereignisname zurück: `{ uid, eventName }`.
Die Verwendung von `EventHandle` ist optional, wird aber benötigt, um das Abonnement später im Code zu entfernen.

```typescript
import { on, unsubscribe } from 'skyrimPlatform';

const handle = on('equip', (event) => {
  printConsole(`actor: ${event.actor.getBaseObject().getName()}`);
  printConsole(`object: ${event.baseObj.getName()}`);
});

unsubscribe(handle);
```

Die Variable `event` enthält die zum abonnierten Ereignis gehörenden Variablen, _sofern vorhanden_.

<a id="list-of-new-events"></a>

# Liste neuer Ereignisse

- [update](#update)
- [tick](#tick)
- [equip](#equip)
- [unequip](#unequip)
- [effectStart](#effectstart)
- [effectFinish](#effectfinish)
- [cellFullyLoaded](#cellFullyLoaded)
- [consoleMessage](#consoleMessage)
- [loadGame](#loadgame)
- [Weitere Ereignisse](#weitere-ereignisse)

## update

Wird nach dem Laden eines Spielstands oder Starten eines neuen Spiels einmal pro Bild aufgerufen (bei 60 FPS also 60-mal pro Sekunde).

```typescript
import { on } from 'skyrimPlatform';

on('update', () => {
  // At this stage, the methods of all imported
  // types are already available.
});
```

**_HINWEIS_**: Die Ausführung von Code in jedem Bild kann abhängig von der Aufgabe aufwendig sein.

Verwende für `update` und `tick` möglichst `once` statt `on`.

Prüfe außerdem zuerst die folgenden Ereignisse oder [Papyrus-Hooks][Events], bevor du Code in jedem Bild ausführst.

## tick

Wird unmittelbar nach Spielstart einmal pro Bild aufgerufen.

**_WARNUNG_**: Dieses Ereignis hat keinen Zugriff auf [Spielmethoden und -objekte][Papyrus].

```typescript
import { on } from 'skyrimPlatform';

on('tick', () => {
  // No access to game methods here.
});
```

## equip

Wird jedes Mal aufgerufen, wenn ein `Actor` einen Gegenstand ausrüstet.\
Entspricht [OnObjectEquipped][OnObjectEquipped].

```typescript
import { on } from 'skyrimPlatform';

on('equip', (event) => {
  const b = event.actor.getBaseObject();
  const armor = Armor.from(event.baseObj);

  if (!armor || armor.getSlotMask() !== 0x4 || !b) return;

  printConsole(
    `ActorBase ${b.getName()} equipped this cuirass: ${armor.getName()}`,
  );
});
```

## unequip

Wird jedes Mal aufgerufen, wenn ein `Actor` einen Gegenstand ablegt.\
Entspricht [OnObjectUnequipped][OnObjectUnequipped].

```typescript
import { on } from 'skyrimPlatform';

on('unequip', (event) => {
  if (event.actor.getFormID() !== Game.getPlayer()?.getFormID()) return;

  const w = Weapon.from(event.baseObj);

  if (w) {
    printConsole('Player unequipped a weapon');
  }
});
```

## effectStart

Wird beim Beginn eines magischen Effekts aufgerufen.\
Entspricht [OnEffectStart][OnEffectStart].

**_TIPP_**: Falls dein Mod Cloaks zum Anwenden magischer Effekte verwendet, lässt sich die Leistung stark verbessern: Verteile stattdessen mit [SPID][SPID] einen leeren magischen Effekt und lasse Skyrim Platform den eigentlichen Code ausführen:

```typescript
import { on } from 'skyrimPlatform';

on('effectStart', (event) => {
  const fx = Game.getFormFromFile(0x800, 'my-mod.esp');
  if (fx?.getFormID() !== event.effect.getFormID()) return;

  DoSomething(event.target);
});
```

Weitere Informationen enthält das entsprechende [Rezept][Cloaks].

## effectFinish

Wird am Ende eines magischen Effekts aufgerufen.\
Entspricht [OnEffectFinish][OnEffectFinish].

```typescript
import { on } from 'skyrimPlatform';

on('effectFinish', (event) => {
  printConsole(
    `${event.effect.getName()} finished on ${event.target.getName()}`,
  );
});
```

## cellFullyLoaded

Wird jedes Mal aufgerufen, wenn eine Spielzelle vollständig geladen wurde.

```typescript
import { on } from 'skyrimPlatform';

on('cellFullyLoaded', (event) => {
  printConsole(`Cell "${event.cell.getName()}" was fully loaded`);
});
```

Da Skyrim beim Durchstreifen der Wildnis üblicherweise mehrere Zellen gleichzeitig lädt, kann dieses Ereignis dort mehrmals auftreten.

Es wird für jede gerade geladene Zelle einmal aufgerufen.

## consoleMessage

Wird bei jeder Ausgabe des Spiels in die Konsole aufgerufen, einschließlich Aufrufen von `printConsole`.

Hinweis: Der Nachrichtentext kann beliebige Zeichen enthalten, einschließlich `'` `"` `\`.
Bevor du ihn mit "browser.executeJavaScript" an den Browser übergibst, musst du ihn korrekt maskieren.

```typescript
import { browser, on } from 'skyrimPlatform';

const htmlEscapes: Record<string, string> = {
  '"': '\\"',
  "'": "\\'",
  '\\': '\\\\',
  '<': '\\<',
  '>': '\\>',
};

const htmlEscaper = /[&<>"'\\\/]/g;

// On every print to the game console, console.log it to the browser
on('consoleMessage', (e) => {
  const msg = e.message.replace(htmlEscaper, (match) => htmlEscapes[match]);
  browser.executeJavaScript('console.log("' + msg + '")');
});
```

## loadGame

Wird beim Laden eines gespeicherten Spiels aufgerufen.

**_WARNUNG_**: Beim Erstellen eines neuen Spiels tritt dieses Ereignis nicht auf. Verwende dafür `newGame`.\
Weitere Ansätze für die Plugin-Initialisierung stehen in [diesem Rezept][PluginInit].

<a id="other-events"></a>

## Weitere Ereignisse

Weitere Informationen und Beispiele hierzu folgen später:

- Aktionsereignisse
  - `actionBeginDraw`
  - `actionBeginSheathe`
  - `actionBowDraw`
  - `actionBowRelease`
  - `actionEndDraw`
  - `actionEndSheathe`
  - `actionSpellCast`
  - `actionSpellFire`
  - `actionVoiceCast`
  - `actionVoiceFire`
  - `actionWeaponSwing`
- `activate`
- `actorKill`
- `bookRead`
- `browserMessage`
- Eingabeereignisse
  - `buttonEvent`
  - `mouseMove`
  - `thumbstickEvent`
  - `kinectEvent`
  - `deviceConnect`
- `cameraStateChanged`
- Zellenereignisse
  - `cellAttach`
  - `cellDetach`
  - `cellFullyLoaded`
- `combatState`
- `containerChanged`
- `criticalHit`
- `crosshairRefChanged`
- Todesereignisse
  - `deathStart`
  - `deathEnd`
- `destructionStageChanged`
- `disarmedEvent`
- `dragonSoulsGained`
- `enterBleedout`
- `fastTravelEnd`
- `footstep`
- Möbelereignisse
  - `furnitureEnter`
  - `furnitureExit`
- `grabRelease`
- `hit`
- `ipcMessage`
- `itemHarvested`
- `levelIncrease`
- Ortsereignisse
  - `locationChanged`
  - `locationDiscovery`
- `lockChanged`
- `magicEffectApply`
- Menüereignisse
  - `menuOpen`
  - `menuClose`
- SKSE
  - `modEvent`
  - `niNodeUpdate`
  - `skyrimLoaded`
- `moveAttachDetach`
- `objectLoaded`
- Öffnen-/Schließen-Ereignisse
  - `open`
  - `close`
- Package-Ereignisse
  - `packageStart`
  - `packageEnd`
  - `packageChange`
- `perkEntryRun`
- `playerBowShot`
- `positionPlayer`
- Quest-Ereignisse
  - `questInit`
  - `questStart`
  - `questStop`
  - `questStage`
- `reset`
- Speichern-/Laden-Ereignisse
  - `saveGame`
  - `loadGame`
  - `postLoadGame`
  - `preLoadGame`
  - `deleteGame`
  - `newGame`
- `sceneAction`
- `scriptInit`
- `sell`
- `shoutAttack`
- `skillIncrease`
- `sleepStart`
- `sleepStop`
- `soulsTrapped`
- `spellCast`
- `spellsLearned`
- `switchRaceComplete`
- `trackedStats`
- Translationsereignisse
  - `translationAlmostCompleted`
  - `translationCompleted`
  - `translationFailed`
- Trigger-Ereignisse
  - `trigger`
  - `triggerEnter`
  - `triggerLeave`
- `uniqueIdChange`
- Warteereignisse
  - `waitStart`
  - `waitStop`
- `wardHit`

[Cloaks]: cookbook.md#getting-rid-of-cloaks
[Events]: events.md
[OnEffectFinish]: https://www.creationkit.com/index.php?title=OnEffectFinish_-_ActiveMagicEffect
[OnEffectStart]: https://www.creationkit.com/index.php?title=OnEffectStart_-_ActiveMagicEffect
[OnObjectEquipped]: https://www.creationkit.com/index.php?title=OnObjectEquipped_-_Actor
[OnObjectUnequipped]: https://www.creationkit.com/index.php?title=OnObjectUnequipped_-_Actor
[Papyrus]: papyrus.md
[PluginInit]: cookbook.md#plugin-initialization
[SPID]: https://www.nexusmods.com/skyrimspecialedition/mods/36869
