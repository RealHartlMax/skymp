[Deutsch](../../../de/docs/skyrim_platform/new_events.md) · [English](../../../en/docs/skyrim_platform/new_events.md) · [Русский](new_events.md)

<a id="events"></a>

# События

Помимо подписки на события Papyrus, Skyrim Platform добавляет собственные события.

Многие из них аналогичны уже существующим событиям Skyrim, но благодаря расширенной типизированной информации их проще использовать в TypeScript.

Skyrim Platform не прикрепляет скрипты к объектам, поэтому эти события доступны без такого прикрепления.

<a id="subscribing-to-events"></a>

## Подписка на события

С помощью `on` можно подписаться на событие постоянно.

```typescript
import { on } from 'skyrimPlatform';

on('equip', (event) => {
  printConsole(`actor: ${event.actor.getBaseObject().getName()}`);
  printConsole(`object: ${event.baseObj.getName()}`);
});
```

С помощью `once` можно добавить обработчик, который будет вызван один раз при следующем возникновении события.

```typescript
import { once } from 'skyrimPlatform';

once('equip', (event) => {
  printConsole(`actor: ${event.actor.getBaseObject().getName()}`);
  printConsole(`object: ${event.baseObj.getName()}`);
});
```

Обе функции, `on` и `once`, возвращают объект `EventHandle` с уникальным ID подписки и именем события: `{ uid, eventName }`.
Использование `EventHandle` необязательно, но он нужен, чтобы позднее отменить подписку в коде.

```typescript
import { on, unsubscribe } from 'skyrimPlatform';

const handle = on('equip', (event) => {
  printConsole(`actor: ${event.actor.getBaseObject().getName()}`);
  printConsole(`object: ${event.baseObj.getName()}`);
});

unsubscribe(handle);
```

Переменная `event` содержит данные, относящиеся к событию, на которое вы подписаны, _если они существуют_.

<a id="list-of-new-events"></a>

# Список новых событий

- [update](#update)
- [tick](#tick)
- [equip](#equip)
- [unequip](#unequip)
- [effectStart](#effectstart)
- [effectFinish](#effectfinish)
- [cellFullyLoaded](#cellFullyLoaded)
- [consoleMessage](#consoleMessage)
- [loadGame](#loadgame)
- [Другие события](#другие-события)

## update

Вызывается один раз на каждый кадр игры (60 раз в секунду при 60 FPS) после загрузки сохранения или начала новой игры.

```typescript
import { on } from 'skyrimPlatform';

on('update', () => {
  // At this stage, the methods of all imported
  // types are already available.
});
```

**_ПРИМЕЧАНИЕ_**: Выполнение кода на каждом кадре может быть затратным в зависимости от задачи.

По возможности используйте `once` вместо `on` для `update` и `tick`.

Прежде чем выполнять код на каждом кадре, также стоит рассмотреть события ниже или [перехватчики Papyrus][Events].

## tick

Вызывается один раз на каждый кадр сразу после запуска игры.

**_ПРЕДУПРЕЖДЕНИЕ_**: Это событие не имеет доступа к [игровым методам и объектам][Papyrus].

```typescript
import { on } from 'skyrimPlatform';

on('tick', () => {
  // No access to game methods here.
});
```

## equip

Вызывается каждый раз, когда любой `Actor` экипирует предмет.\
Аналог [OnObjectEquipped][OnObjectEquipped].

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

Вызывается каждый раз, когда любой `Actor` снимает предмет.\
Аналог [OnObjectUnequipped][OnObjectUnequipped].

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

Вызывается при начале любого магического эффекта.\
Аналог [OnEffectStart][OnEffectStart].

**_СОВЕТ_**: Если ваш мод применяет магические эффекты через cloak-эффекты, можно значительно повысить производительность: вместо них примените пустой магический эффект через [SPID][SPID], а выполнение настоящего кода поручите Skyrim Platform:

```typescript
import { on } from 'skyrimPlatform';

on('effectStart', (event) => {
  const fx = Game.getFormFromFile(0x800, 'my-mod.esp');
  if (fx?.getFormID() !== event.effect.getFormID()) return;

  DoSomething(event.target);
});
```

Подробнее см. [соответствующий рецепт][Cloaks].

## effectFinish

Вызывается при завершении любого магического эффекта.\
Аналог [OnEffectFinish][OnEffectFinish].

```typescript
import { on } from 'skyrimPlatform';

on('effectFinish', (event) => {
  printConsole(
    `${event.effect.getName()} finished on ${event.target.getName()}`,
  );
});
```

## cellFullyLoaded

Вызывается каждый раз после полной загрузки игровой ячейки.

```typescript
import { on } from 'skyrimPlatform';

on('cellFullyLoaded', (event) => {
  printConsole(`Cell "${event.cell.getName()}" was fully loaded`);
});
```

Из-за особенностей Skyrim это событие может срабатывать несколько раз при перемещении по открытому миру: обычно одновременно загружается несколько ячеек.

Для каждой только что загруженной ячейки событие вызывается один раз.

## consoleMessage

Вызывается каждый раз, когда игра выводит что-либо в консоль, включая вызовы `printConsole`.

Примечание: Текст сообщения может содержать любые символы, включая `'` `"` `\`.
Перед передачей текста браузеру через "browser.executeJavaScript" его нужно экранировать.

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

Вызывается при загрузке сохранённой игры.

**_ПРЕДУПРЕЖДЕНИЕ_**: Это событие не возникает при создании новой игры. Для этого используйте `newGame`.\
Другие идеи по инициализации плагина приведены в [этом рецепте][PluginInit].

<a id="other-events"></a>

## Другие события

Дополнительные сведения и примеры будут добавлены позже:

- события действий
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
- события ввода
  - `buttonEvent`
  - `mouseMove`
  - `thumbstickEvent`
  - `kinectEvent`
  - `deviceConnect`
- `cameraStateChanged`
- события ячеек
  - `cellAttach`
  - `cellDetach`
  - `cellFullyLoaded`
- `combatState`
- `containerChanged`
- `criticalHit`
- `crosshairRefChanged`
- события смерти
  - `deathStart`
  - `deathEnd`
- `destructionStageChanged`
- `disarmedEvent`
- `dragonSoulsGained`
- `enterBleedout`
- `fastTravelEnd`
- `footstep`
- события мебели
  - `furnitureEnter`
  - `furnitureExit`
- `grabRelease`
- `hit`
- `ipcMessage`
- `itemHarvested`
- `levelIncrease`
- события локаций
  - `locationChanged`
  - `locationDiscovery`
- `lockChanged`
- `magicEffectApply`
- события меню
  - `menuOpen`
  - `menuClose`
- SKSE
  - `modEvent`
  - `niNodeUpdate`
  - `skyrimLoaded`
- `moveAttachDetach`
- `objectLoaded`
- события открытия и закрытия
  - `open`
  - `close`
- события пакетов
  - `packageStart`
  - `packageEnd`
  - `packageChange`
- `perkEntryRun`
- `playerBowShot`
- `positionPlayer`
- события заданий
  - `questInit`
  - `questStart`
  - `questStop`
  - `questStage`
- `reset`
- события сохранения и загрузки
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
- события перемещения
  - `translationAlmostCompleted`
  - `translationCompleted`
  - `translationFailed`
- события триггеров
  - `trigger`
  - `triggerEnter`
  - `triggerLeave`
- `uniqueIdChange`
- события ожидания
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
