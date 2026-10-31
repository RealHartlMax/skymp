[Deutsch](../../../de/docs/skyrim_platform/events.md) · [English](../../../en/docs/skyrim_platform/events.md) · [Русский](events.md)

<a id="hooks-events"></a>

# Перехватчики (события)

Перехватчики позволяют перехватывать начало и конец некоторых функций игрового движка.

Сейчас поддерживаются: `sendAnimationEvent`, `sendPapyrusEvent`.

## sendPapyrusEvent

Используйте этот перехватчик для стандартных [событий Papyrus][PapyrusEvents].

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

- `enter` вызывается перед началом функции. `ctx` содержит переданные ей аргументы.
- `ctx.papyrusEventName`: имя события Papyrus, перехваченного обработчиком.

<a id="caveats"></a>

### Ограничения

На момент написания получить аргументы событий Papyrus невозможно. Это [известная проблема][NoPapyrusEventArgs].\
Пока по возможности используйте [новые события][NewEvents].

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

- `enter` вызывается перед началом функции. `ctx` содержит аргументы функции и `storage` (см. ниже).
- `leave` вызывается перед завершением функции. Помимо данных после `enter`, `ctx` содержит возвращаемое значение функции.
- В вызовах `enter` и `leave` используется один и тот же объект `ctx`.
- `ctx.storage` хранит данные между вызовами `enter` и `leave`.
- Скриптовые функции внутри обработчиков `enter` и `leave` недоступны.

<a id="advanced-hooking"></a>

## Расширенное использование перехватчиков

Перехват затратен: при каждом входе в перехваченную функцию и выходе из неё нужно входить в контекст JavaScript. SkyrimPlatform может отфильтровать часть событий до передачи в JS, уменьшая число дорогих вызовов. Чем больше проверок выполнено до JS-обработчика, тем лучше.

Поэтому по возможности задавайте `minSelfId`, `maxSelfId` и `eventPattern`, чтобы отфильтровать ненужные события и ускорить код.

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

## Удаление перехватчика

Чтобы удалить перехватчик, сначала сохраните его ID при добавлении:

```typescript
const id = hooks.sendAnimationEvent.add({...});
//later...
hooks.sendAnimationEvent.remove(id);
```

Это позволяет динамически добавлять и удалять перехватчики на основе [новых событий](https://github.com/skyrim-multiplayer/skymp/blob/main/docs/skyrim_platform/new_events.md).

Например, можно перехватывать анимации игрока во время действия заклинания:

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

Вложенные перехватчики **не** допускаются.

<a id="contributing-new-hooks"></a>

## Добавление новых перехватчиков

Стандартные возможности SP можно расширять собственными перехватчиками на C++.

1. Перехватите функцию ([ссылка][FridaHooks]). Хороший пример — `HOOK_SEND_ANIMATION_EVENT`. Этого достаточно для самого перехвата; затем его нужно добавить в TypeScript API.
2. Создайте методы Enter/Leave в EventsApi по образцу ([ссылка][EventsApi]).
3. Добавьте перехватчик в список ([ссылка][HooksList]).
4. Добавьте его в определения TypeScript, чтобы он появился в skyrimPlatform.ts ([ссылка][HookTs]).
5. Создайте Pull Request (см. [CONTRIBUTING.md][]).

[CONTRIBUTING.md]: https://github.com/skyrim-multiplayer/skymp/blob/main/CONTRIBUTING.md
[EventsApi]: https://github.com/skyrim-multiplayer/skymp/blob/bf88abcc1922bbbfc12e177e522453f95eb60113/skyrim-platform/src/platform_se/skyrim_platform/EventsApi.cpp#L354
[FridaHooks]: https://github.com/skyrim-multiplayer/skymp/blob/bf88abcc1922bbbfc12e177e522453f95eb60113/skyrim-platform/src/platform_se/skyrim_platform/FridaHooks.cpp
[HooksList]: https://github.com/skyrim-multiplayer/skymp/blob/bf88abcc1922bbbfc12e177e522453f95eb60113/skyrim-platform/src/platform_se/skyrim_platform/EventsApi.cpp#L411
[HookTs]: https://github.com/skyrim-multiplayer/skymp/blob/bf88abcc1922bbbfc12e177e522453f95eb60113/skyrim-platform/src/platform_se/codegen/convert-files/Definitions.txt#L538
[NewEvents]: new_events.md
[NoPapyrusEventArgs]: https://github.com/skyrim-multiplayer/skymp/issues/405
[PapyrusEvents]: https://www.creationkit.com/index.php?title=Category:Events
