[Deutsch](../../../de/docs/skyrim_platform/native.md) · [English](../../../en/docs/skyrim_platform/native.md) · [Русский](native.md)

<a id="native-functions"></a>

# Нативные функции

У большинства типов есть нативные функции. Они делятся на статические функции (`Native Global` в Papyrus) и методы (`Native`).

Статические функции вызываются у типа:

```typescript
let sunX = Game.getSunPositionX();
let pl = Game.getPlayer();
Game.forceFirstPerson();
```

Методы вызываются у объекта:

```typescript
let isPlayerInCombat = pl.isInCombat();
```

Список исходных игровых типов с документацией: https://www.creationkit.com/index.php?title=Category:Script_Objects

**_ПРЕДУПРЕЖДЕНИЕ_**: Типы и методы Papyrus доступны только внутри [новых событий][NewEvents], добавленных Skyrim Platform (кроме `tick`), или в перехватчике `sendPapyrusEvent` (см. [перехватчики][Hooks]).

При попытке использовать их вне этих контекстов будет выброшено исключение.

<a id="native-functions-from-skse-plugins"></a>

# Нативные функции из SKSE-плагинов

Можно вызывать функции Papyrus, добавленные SKSE-плагинами.

Этот пример показывает использование PapyrusUtil в плагине Skyrim Platform:

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

<!-- TODO: Удалить, когда эта функциональность будет реализована на уровне движка. -->

Другой вариант — использовать [преобразованные определения библиотек][TsDefs] или создать их самостоятельно с помощью [Papyrus-2-Typescript][Papyrus2Ts]. После этого нативные функции SKSE можно вызывать так же, как в Papyrus:

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

# Асинхронное выполнение

Некоторые игровые функции требуют времени и выполняются в фоне. В SkyrimPlatform такие функции возвращают `Promise`:

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

При асинхронном вызове выполнение немедленно продолжается:

```typescript
Utility.wait(1);
printConsole(`Will be displayed immediately, not after a second`);
printConsole(`Should have used then`);
```

С помощью `async`/`await` код можно записать в синхронном стиле:

```typescript
let f = async () => {
  await Utility.wait(1);
  printConsole('1 second passed');
};
```

**_ПРЕДУПРЕЖДЕНИЕ_**: При использовании асинхронных функций внутри [новых событий][NewEvents] ссылки `Form` могут оказаться недействительными к моменту обращения к ним.

В таких случаях можно сохранить `FormId` и заново получить `Form` через [`Game.getFormEx`][GetFormEx].

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
