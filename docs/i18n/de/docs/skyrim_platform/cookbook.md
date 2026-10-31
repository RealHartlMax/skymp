[Deutsch](cookbook.md) · [English](../../../en/docs/skyrim_platform/cookbook.md) · [Русский](../../../ru/docs/skyrim_platform/cookbook.md)

<a id="the-skyrim-platform-cook-book"></a>

# Das Skyrim-Platform-Kochbuch

Hier findest du einfache Rezepte für häufige Aufgaben und Fragen.

<a id="table-of-contents"></a>

## Inhaltsverzeichnis

- [Variablen speichern](#variablen-speichern)
- [Plugin-Initialisierung](#plugin-initialisierung)
- [Cloaks ersetzen](#cloaks-ersetzen)

<a id="saving-variables"></a>

## Variablen speichern

Ein wesentlicher Unterschied zwischen Skyrim Platform (SP) und Papyrus: SP schreibt Variablenwerte nicht automatisch in Spielstände.

Das ist weder gut noch schlecht, sondern eine Eigenschaft des Systems.\
Je nach Vorhaben kann dies praktisch oder unpraktisch sein.

In diesem Rezept speichern wir Variablenwerte, damit sie beim erneuten Laden eines Spielstands wiederhergestellt werden können.

<a id="ingredients"></a>

### Zutaten

- [JContainers][]
- [JContainers Typescript definitions][TsTypings]

Auch [PapyrusUtil][] ist möglich. Für dieses Rezept verwenden wir JContainers, da dessen Verwendung als schwieriger gilt.

<a id="preparation"></a>

### Zubereitung

1. Befolge die [Installationsanleitung][Papyrus2Ts] für die TypeScript-Definitionen von JContainers.

2. Importiere `JDB` aus JContainers.

```ts
import * as JDB from 'JContainers/JDB';
```

3. Erstelle einen Schlüsselnamen `key` für deinen Mod.

```ts
const key = '.my-unique-mod-name';
```

**_WARNUNG_**: Der Schlüsselname muss IMMER mit `.` beginnen, sonst funktioniert dieses Rezept nicht.

Vermeide nach Möglichkeit Leerzeichen.

4. Speichere die gewünschten Werte.

```ts
JDB.solveIntSetter(key + '.someInt', someInt, true);
JDB.solveFltSetter(key + '.someFlt', someFlt, true);
JDB.solveStrSetter(key + '.someStr', someStr, true);
```

5. Stelle die gewünschten Werte wieder her.

```ts
someInt = JDB.solveInt(key + '.someInt');
someFlt = JDB.solveFlt(key + '.someFlt');
someStr = JDB.solveStr(key + '.someStr');
```

<a id="plugin-initialization"></a>

## Plugin-Initialisierung

Plugin-Variablen müssen beim Erstellen eines neuen Spiels und beim Laden eines Spielstands initialisiert werden. Beim Erstellen eines neuen Spiels wird jedoch kein entsprechendes Ereignis gesendet.

Dieses Rezept initialisiert ein Plugin, wenn:

- Ein neues Spiel beginnt.
- Das Plugin erstmals installiert wird.
- Ein Spielstand erneut geladen wird.
- Die [Hot-Reload-Funktion][HotReload] von Skyrim Platform ausgeführt wird.

<a id="ingredients-1"></a>

### Zutaten

Dieselben wie unter [Variablen speichern](#variablen-speichern).\
Dieses Rezept erweitert die dort gezeigten Techniken.

<a id="preparation-1"></a>

### Zubereitung

1. Erstelle Funktionen zum Speichern und Laden eines `boolean`, um eine bereits erfolgte Plugin-Initialisierung zu erkennen.\
   Betrachte dies als Prüfung, ob das Plugin schon ein [`OnInit`][OnInit]-Ereignis durchlaufen hat.

```ts
const initK = '.my-plugin.init';

const MarkInitialized = () => JDB.solveBoolSetter(initK, true, true);
const WasInitialized = () => JDB.solveBool(initK, false);
```

2. Registriere [Ereignishandler][NewEvents] für `loadGame` und `update`.\
   \
   Mit `once("update")` wird der Code einmal ausgeführt, sobald das Spiel gestartet oder Hot Reload durchgeführt wurde.

```ts
on('loadGame', () => {});

// IMPORTANT: we are using ONCE instead of on.
once('update', () => {});
```

3. Verwende eine `boolean`-Variable, um festzustellen, ob `loadGame` das Plugin bereits initialisiert hat.\
   Dadurch erfolgt beim Laden eines Spielstands keine doppelte Initialisierung; bei Hot Reload bleibt sie möglich.

```ts
let allowInit = false;

on('loadGame', () => {
  allowInit = true;
});

once('update', () => {
  if (allowInit) {
    InitPlugin();
  }
});
```

4. Prüfe, ob dein Plugin überhaupt schon initialisiert wurde.\
   \
   Mit `loadGame` lässt sich normalerweise die Installation während eines laufenden Spiels behandeln; dieser Schritt ermöglicht die Initialisierung auch **beim Erstellen eines neuen Spiels**.\
   \
   Hier verwenden wir die [`storage`][NewMethods]-Map, damit `allowInit` über Hot Reload hinweg erhalten bleibt.

```ts
let allowInit = storage['my-plugin-init'] as boolean | false;

on('loadGame', () => {
  // Initialize when installed mid game and when loading a game
  // because this is always needed anyway.
  InitPlugin();
  allowInit = true;
  storage['my-plugin-init'] = true;
});

once('update', () => {
  // Has this plugin ever been initialized?
  // OnInit facsimile.
  if (allowInit || !WasInitialized()) {
    InitPlugin();
  }
});
```

5. Initialisiere dein Plugin entsprechend deinen Anforderungen.\
   \
   `storage` wäre nicht zwingend erforderlich, wenn `pluginVar1` bei jeder Änderung auf Datenträger gespeichert würde (für dauerhaft gespeicherte Werte ohnehin notwendig). Hier dient es zur Demonstration.

```ts
// Initialize with the value it had before hot reloading or default 0
let pluginVar1 = storage['my-plugin-var1'] as number | 0;

function InitPlugin() {
  const key = '.my-plugin.var1';

  // Initialize with the value it had before reloading the game or default 0
  pluginVar1 = JDB.solveFlt(key, 0);

  // Save values inmediately to both disk and storage, so they don't get lost.
  JDB.solveFltSetter(key, pluginVar1, true);
  storage['my-plugin-var1'] = pluginVar1;

  // Let's suppose this was OnInit.
  MarkInitialized();
}
```

Hier ist der vollständige Code:

```ts
import * as JDB from 'JContainers/JDB';
import { on, once } from 'skyrimPlatform';

const initK = '.my-plugin.init';

const MarkInitialized = () => JDB.solveBoolSetter(initK, true, true);
const WasInitialized = () => JDB.solveBool(initK, false);

export function main() {
  let allowInit = storage['my-plugin-init'] as boolean | false;

  on('loadGame', () => {
    // Initialize when installed mid game and when loading a game
    // because this is always needed anyway.
    InitPlugin();
    allowInit = true;
    storage['my-plugin-init'] = true;
  });

  // IMPORTANT: we are using ONCE instead of on.
  once('update', () => {
    // Has this plugin ever been initialized?
    // OnInit facsimile.
    if (allowInit || !WasInitialized()) {
      InitPlugin();
    }
  });

  // Initialize with the value it had before hot reloading or default 0
  let pluginVar1 = storage['my-plugin-var1'] as number | 0;

  function InitPlugin() {
    const key = '.my-plugin.var1';

    // Initialize with the value it had before reloading the game or default 0
    pluginVar1 = JDB.solveFlt(key, 0);

    // Save values inmediately to both disk and storage, so they don't get lost.
    JDB.solveFltSetter(key, pluginVar1, true);
    storage['my-plugin-var1'] = pluginVar1;

    // Let's suppose this was OnInit.
    MarkInitialized();
  }
}
```

<a id="getting-rid-of-cloaks"></a>

## Cloaks ersetzen

Cloaks sind [für ihre Ineffizienz bekannt][Cloaks]. Dank der [neuen Ereignisse][NewEvents] von SP werden sie jedoch immer seltener benötigt.

Die ursprüngliche Anforderung hinter Cloaks lautet:

> Bestimmter Code muss für einen bestimmten `Actor` ausgeführt werden.

Wenn dein Plugin dies weiterhin benötigt, aber keines der neuen Ereignisse passt, kannst du eine effizientere Methode verwenden. Diese zeigt das folgende Rezept.

<a id="ingredients-2"></a>

### Zutaten

- [SPID][]

<a id="preparation-2"></a>

### Zubereitung

1. Erstelle im CK einen neuen [magischen Effekt][MgFx].
   - Effect Archetype: Script
   - Casting Type: Constant
   - Delivery: Self
   - Ergänze die übrigen Eigenschaften nach Bedarf.

Angenommen, dieser magische Effekt hat die relative FormId `0x800`.

2. Erstelle einen neuen [Zauber][Spell].

   - Type: Ability
   - Casting Type: Constant effect.
   - Delivery: Self.
   - Effects: der im vorherigen Schritt erstellte magische Effekt.
   - Ergänze die übrigen Eigenschaften nach Bedarf.

3. Verteile den Zauber entsprechend der SPID-Anleitung.
4. Fange das Anwenden des magischen Effekts mit dem Ereignis [`effectStart`][EffectStart] ab.

```typescript
import { on } from 'skyrimPlatform';

on('effectStart', (event) => {
  const fx = Game.getFormFromFile(0x800, 'my-mod.esp');
  if (fx?.getFormID() !== event.effect.getFormID()) return;

  DoSomething(event.target);
});
```

5. Optional kannst du [`effectFinish`][EffectFinish] für Aufräumarbeiten verwenden.

```typescript
on('effectFinish', (event) => {
  const fx = Game.getFormFromFile(0x800, 'my-mod.esp');
  if (fx?.getFormID() !== event.effect.getFormID()) return;

  DoSomeCleaning(event.target);
});
```

[Cloaks]: https://www.reddit.com/r/skyrimmods/comments/4fgf3n/looking_for_deep_explanation_of_the_cloaking/
[EffectFinish]: new_events.md#effectfinish
[EffectStart]: new_events.md#effectstart
[HotReload]: features.md#hot-reload
[JContainers]: https://www.nexusmods.com/skyrimspecialedition/mods/16495
[MgFx]: https://www.creationkit.com/index.php?title=Magic_Effect
[NewEvents]: new_events.md
[OnInit]: https://www.creationkit.com/index.php?title=OnInit
[Papyrus2Ts]: https://www.nexusmods.com/skyrimspecialedition/mods/56916
[PapyrusUtil]: https://www.nexusmods.com/skyrimspecialedition/mods/13048
[Spell]: https://www.creationkit.com/index.php?title=Spell
[SPID]: https://www.nexusmods.com/skyrimspecialedition/mods/36869
[TsTypings]: https://www.nexusmods.com/skyrimspecialedition/mods/56916?tab=files
[NewMethods]: new_methods.md
