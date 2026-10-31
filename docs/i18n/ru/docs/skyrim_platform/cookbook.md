[Deutsch](../../../de/docs/skyrim_platform/cookbook.md) · [English](../../../en/docs/skyrim_platform/cookbook.md) · [Русский](cookbook.md)

<a id="the-skyrim-platform-cook-book"></a>

# Сборник рецептов Skyrim Platform

Здесь собраны простые рецепты для распространённых задач и ответов на частые вопросы.

<a id="table-of-contents"></a>

## Содержание

- [Сохранение переменных](#сохранение-переменных)
- [Инициализация плагина](#инициализация-плагина)
- [Отказ от cloak-эффектов](#отказ-от-cloak-эффектов)

<a id="saving-variables"></a>

## Сохранение переменных

Одно из отличий Skyrim Platform (SP) от Papyrus: SP не записывает значения переменных в сохранения игры автоматически.

Это свойство системы, само по себе ни хорошее, ни плохое.\
В зависимости от задачи оно может быть удобным или неудобным.

В этом рецепте мы сохраним значения переменных, чтобы восстанавливать их при повторной загрузке сохранённой игры.

<a id="ingredients"></a>

### Ингредиенты

- [JContainers][]
- [JContainers Typescript definitions][TsTypings]

Можно использовать и [PapyrusUtil][], но здесь выбран JContainers, поскольку его обычно считают более сложным.

<a id="preparation"></a>

### Приготовление

1. Следуйте [инструкции по установке][Papyrus2Ts] определений TypeScript для JContainers.

2. Импортируйте `JDB` из JContainers.

```ts
import * as JDB from 'JContainers/JDB';
```

3. Создайте имя ключа `key` для своего мода.

```ts
const key = '.my-unique-mod-name';
```

**_ПРЕДУПРЕЖДЕНИЕ_**: Имя ключа ВСЕГДА должно начинаться с `.`, иначе рецепт не сработает.

Рекомендуется не использовать пробелы.

4. Сохраните нужные значения.

```ts
JDB.solveIntSetter(key + '.someInt', someInt, true);
JDB.solveFltSetter(key + '.someFlt', someFlt, true);
JDB.solveStrSetter(key + '.someStr', someStr, true);
```

5. Восстановите нужные значения.

```ts
someInt = JDB.solveInt(key + '.someInt');
someFlt = JDB.solveFlt(key + '.someFlt');
someStr = JDB.solveStr(key + '.someStr');
```

<a id="plugin-initialization"></a>

## Инициализация плагина

Переменные плагина нужно инициализировать при создании новой игры и загрузке сохранённой, однако после создания новой игры соответствующее событие не отправляется.

Этот рецепт инициализирует плагин, когда:

- Начинается новая игра.
- Плагин устанавливается впервые.
- Игра перезагружена.
- Выполняется [горячая перезагрузка][HotReload] Skyrim Platform.

<a id="ingredients-1"></a>

### Ингредиенты

Те же, что в [Сохранении переменных](#сохранение-переменных).\
Этот рецепт развивает показанные там приёмы.

<a id="preparation-1"></a>

### Приготовление

1. Создайте функции сохранения и загрузки `boolean`, чтобы определять, был ли плагин уже инициализирован.\
   Это можно рассматривать как проверку, прошёл ли плагин событие [`OnInit`][OnInit].

```ts
const initK = '.my-plugin.init';

const MarkInitialized = () => JDB.solveBoolSetter(initK, true, true);
const WasInitialized = () => JDB.solveBool(initK, false);
```

2. Добавьте [обработчики событий][NewEvents] `loadGame` и `update`.\
   \
   `once("update")` выполняет код один раз сразу после начала игры или горячей перезагрузки.

```ts
on('loadGame', () => {});

// IMPORTANT: we are using ONCE instead of on.
once('update', () => {});
```

3. Добавьте переменную `boolean`, чтобы определить, выполнил ли `loadGame` инициализацию плагина.\
   Это предотвращает двойную инициализацию при загрузке сохранения, но допускает её при горячей перезагрузке.

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

4. Проверьте, инициализировался ли плагин когда-либо.\
   \
   Обычно `loadGame` позволяет обработать установку плагина в уже начатую игру, а этот шаг обеспечивает инициализацию **при создании новой игры**.\
   \
   Здесь нужна Map [`storage`][NewMethods], чтобы значение `allowInit` сохранялось между горячими перезагрузками.

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

5. Инициализируйте плагин в соответствии с его задачами.\
   \
   `storage` необязателен, если сохранять `pluginVar1` на диск при каждом изменении значения (это в любом случае нужно для постоянного хранения), но здесь он используется для демонстрации.

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

Полный код:

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

## Отказ от cloak-эффектов

Cloak-эффекты [известны своей неэффективностью][Cloaks], но благодаря [новым событиям][NewEvents] SP необходимость в них постепенно исчезает.

Изначальная задача, для которой требовались cloak-эффекты:

> Для определённого `Actor` нужно выполнить некоторый код.

Если плагину всё ещё требуется такой подход, но ни одно новое событие не подходит, можно использовать более эффективный метод, показанный в этом рецепте.

<a id="ingredients-2"></a>

### Ингредиенты

- [SPID][]

<a id="preparation-2"></a>

### Приготовление

1. Создайте новый [магический эффект][MgFx] в CK.
   - Effect Archetype: Script
   - Casting Type: Constant
   - Delivery: Self
   - Остальные свойства заполните по необходимости.

Предположим, относительный FormId этого эффекта — `0x800`.

2. Создайте новое [заклинание][Spell].

   - Type: Ability
   - Casting Type: Constant effect.
   - Delivery: Self.
   - Effects: магический эффект из предыдущего шага.
   - Остальные свойства заполните по необходимости.

3. Распространите заклинание по инструкции SPID.
4. Перехватите применение магического эффекта через событие [`effectStart`][EffectStart].

```typescript
import { on } from 'skyrimPlatform';

on('effectStart', (event) => {
  const fx = Game.getFormFromFile(0x800, 'my-mod.esp');
  if (fx?.getFormID() !== event.effect.getFormID()) return;

  DoSomething(event.target);
});
```

5. При необходимости используйте событие [`effectFinish`][EffectFinish] для очистки.

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
