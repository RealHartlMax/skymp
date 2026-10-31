[Deutsch](events.md) · [English](../../../en/docs/skyrim_platform/events.md) · [Русский](../../../ru/docs/skyrim_platform/events.md)

<a id="hooks-events"></a>

# Hooks (Ereignisse)

Hooks ermöglichen das Abfangen von Beginn und Ende bestimmter Funktionen der Spiel-Engine.

Derzeit unterstützt: `sendAnimationEvent`, `sendPapyrusEvent`.

## sendPapyrusEvent

Verwende diesen Hook, um standardmäßige [Papyrus-Ereignisse][PapyrusEvents] abzufangen.

```typescript
import { hooks, printConsole } from "skyrimPlatform";

// Subscribe to ALL Papyrus events
hooks.sendPapyrusEvent.add({
  enter(ctx) {
    printConsole(ctx.papyrusEventName);
  }
});

// Subscribe to OnSleepStart on player
hooks.sendPapyrusEvent.add({
  enter(ctx) {
    printConsole("Player started sleeping");
  },
  0x14, 0x14,
  "OnSleepStart"
});
```

- `enter` wird vor Beginn der Funktion aufgerufen. `ctx` enthält die übergebenen Argumente.
- `ctx.papyrusEventName`: Name des vom Hook abgefangenen Papyrus-Ereignisses.

<a id="caveats"></a>

### Einschränkungen

Zum Zeitpunkt der Erstellung lassen sich Argumente von Papyrus-Ereignissen nicht auslesen. Dies ist ein [bekanntes Problem][NoPapyrusEventArgs].\
Verwende vorerst nach Möglichkeit die [neuen Ereignisse][NewEvents].

## sendAnimationEvent

```typescript
import { hooks, printConsole } from 'skyrimPlatform';

hooks.sendAnimationEvent.add({
  enter(ctx) {
    printConsole(ctx.animEventName);
  },
  leave(ctx) {
    if (ctx.animationSucceeded) {
      printConsole(ctx.selfId);
    }
  },
});
```

- `enter` wird vor Beginn der Funktion aufgerufen. `ctx` enthält die übergebenen Argumente und `storage` (siehe unten).
- `leave` wird vor Ende der Funktion aufgerufen. `ctx` enthält zusätzlich zu den nach `enter` vorhandenen Daten den Rückgabewert der Funktion.
- `ctx` ist bei `enter` und `leave` dasselbe Objekt.
- `ctx.storage` speichert Daten zwischen den Aufrufen von `enter` und `leave`.
- Skriptfunktionen stehen innerhalb der Handler `enter` und `leave` nicht zur Verfügung.

<a id="advanced-hooking"></a>

## Fortgeschrittene Hook-Verwendung

Hooks sind aufwendig: Bei jedem Eintritt in oder Austritt aus einer abgefangenen Funktion muss der JavaScript-Kontext betreten werden. SkyrimPlatform kann bestimmte Ereignisse filtern, bevor sie den JS-Code erreichen. Dadurch sind weniger teure JS-Aufrufe nötig. Je mehr vor dem JS-Callback geprüft wird, desto besser.

Gib deshalb nach Möglichkeit `minSelfId`, `maxSelfId` und `eventPattern` an, um unnötige Ereignisse auszufiltern und deinen Code zu beschleunigen.

```typescript
import { hooks, printConsole } from 'skyrimPlatform';

// Bad. Catches all animation events in the world when we only want to catch events from the player character.
hooks.sendAnimationEvent.add({
  enter(ctx) {
    if (ctx.selfId !== 0x14) return;
    printConsole("Player's anim:", ctx.animEventName);
  },
  leave(ctx) {},
});

// Good. No JS is triggered until selfId in range `[minSelfId..maxSelfId]` found and event name matches `"*"` wildcard.
// A maximum of one wildcard can be used: for example, the *Sleep* pattern won't work.
// Two or more wildcards are not supported and will result in an exception.
hooks.sendAnimationEvent.add(
  {
    enter(ctx) {
      printConsole("Player's anim:", ctx.animEventName);
    },
    leave(ctx) {},
  },
  /* minSelfId = */ 0x14,
  /* maxSelfId = */ 0x14,
  /*eventPattern = */ '*',
);
```

<a id="removing-a-hook"></a>

## Einen Hook entfernen

Wenn du einen Hook entfernen möchtest, speichere zunächst beim Hinzufügen seine ID:

```typescript
const id = hooks.sendAnimationEvent.add({...});
//later...
hooks.sendAnimationEvent.remove(id);
```

So lassen sich Hooks anhand [neuer Ereignisse](https://github.com/skyrim-multiplayer/skymp/blob/main/docs/skyrim_platform/new_events.md) dynamisch hinzufügen und entfernen.

Beispielsweise könntest du Spieleranimationen während eines Zaubers abfangen:

```typescript
var id;

export let main = () => {
  on('effectStart', () => {
    id = hooks.sendAnimationEvent.add({...});
  });

  on('effectFinish', () => {
    if (id) {
      hooks.sendAnimationEvent.remove(id);
    }
  });
};

```

Beachte: Verschachtelte Hooks sind **nicht** erlaubt.

<a id="contributing-new-hooks"></a>

## Neue Hooks beitragen

Du kannst die standardmäßigen SP-Hooks durch eigene Hooks in C++ erweitern.

1. Fange eine Funktion ab ([Link][FridaHooks]). `HOOK_SEND_ANIMATION_EVENT` ist ein gutes Beispiel. Damit ist der Hook bereits eingerichtet; im nächsten Schritt wird er zur TypeScript-API hinzugefügt.
2. Erstelle entsprechende Enter-/Leave-Methoden in EventsApi ([Link][EventsApi]).
3. Ergänze deinen Hook in der Hook-Liste ([Link][HooksList]).
4. Ergänze ihn in den TypeScript-Definitionen, damit er in skyrimPlatform.ts erscheint ([Link][HookTs]).
5. Erstelle einen Pull Request (siehe [CONTRIBUTING.md][]).

[CONTRIBUTING.md]: https://github.com/skyrim-multiplayer/skymp/blob/main/CONTRIBUTING.md
[EventsApi]: https://github.com/skyrim-multiplayer/skymp/blob/bf88abcc1922bbbfc12e177e522453f95eb60113/skyrim-platform/src/platform_se/skyrim_platform/EventsApi.cpp#L354
[FridaHooks]: https://github.com/skyrim-multiplayer/skymp/blob/bf88abcc1922bbbfc12e177e522453f95eb60113/skyrim-platform/src/platform_se/skyrim_platform/FridaHooks.cpp
[HooksList]: https://github.com/skyrim-multiplayer/skymp/blob/bf88abcc1922bbbfc12e177e522453f95eb60113/skyrim-platform/src/platform_se/skyrim_platform/EventsApi.cpp#L411
[HookTs]: https://github.com/skyrim-multiplayer/skymp/blob/bf88abcc1922bbbfc12e177e522453f95eb60113/skyrim-platform/src/platform_se/codegen/convert-files/Definitions.txt#L538
[NewEvents]: new_events.md
[NoPapyrusEventArgs]: https://github.com/skyrim-multiplayer/skymp/issues/405
[PapyrusEvents]: https://www.creationkit.com/index.php?title=Category:Events
