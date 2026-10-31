[Deutsch](../../../de/docs/skyrim_platform/papyrus.md) · [English](../../../en/docs/skyrim_platform/papyrus.md) · [Русский](papyrus.md)

<a id="papyrus-types-from-the-original-game"></a>

# Типы Papyrus из исходной игры

Все типы SkyrimPlatform называются так же, как в Papyrus, например: `Game`, `Actor`, `Form`, `Spell`, `Perk` и т. д.

Для использования типов Papyrus, включая вызов их методов и статических функций, их необходимо импортировать:

```typescript
import { Actor, Game } from 'skyrimPlatform';
```

**_ПРЕДУПРЕЖДЕНИЕ_**: Типы и методы Papyrus доступны только внутри [перехватчиков][Hooks] или [новых событий][NewEvents], добавленных Skyrim Platform (кроме `tick`).

При использовании вне этих контекстов будет выброшено исключение.

## Form

- От формы (`Form`) наследуется большинство игровых типов с методами, например `Actor`, `Weapon` и т. д.
- У каждой формы есть ID — 32-битное беззнаковое число (`uint32_t`). В SkyrimPlatform оно представлено типом `number`.
- Чтобы найти форму по ID, используйте `Game.getFormEx`.\
  Именно `Game.getFormEx`, а не `Game.getForm`: последний всегда возвращает `null` для ID выше 0x80000000 (поведение исходной игры).
- Получить ID формы можно методом `getFormID`. Гарантируется, что `Game.getFormEx` найдёт форму по этому ID, если игра её не уничтожила.

<a id="object-casting"></a>

## Приведение объектов к типам

- Если объект `Form` является оружием и вам нужен объект `Weapon`, используйте приведение типа:
  ```typescript
  let sword = Game.getFormEx(swordId); // Get Form
  let weapon = Weapon.from(sword); // Cast to Weapon
  ```
- Если указанный ID относится не к оружию, переменная `weapon` будет равна `null`.
- Передача `null` в функцию приведения не вызывает исключение, а возвращает `null`:
  ```typescript
  ObjectReference.from(null); // null
  ```
- Попытка приведения к типу, у которого нет экземпляров или который несовместим в иерархии наследования, также возвращает `null`:
  ```typescript
  Game.from(Game.getPlayer()); // null
  Spell.from(Game.getPlayer()); // null
  ```
- Приведение позволяет получить и объект базового типа, включая `Form`:
  ```typescript
  let refr = ObjectReference.from(Game.getPlayer());
  let form = Form.from(refr);
  ```
- Приведение объекта к его собственному типу возвращает исходный объект:
  ```typescript
  let actor = Actor.from(Game.getPlayer());
  ```

<a id="safe-use-of-objects"></a>

# Безопасное использование объектов

- Получив объект, убедитесь, что он не равен `null`:

  ```typescript
  let actor = Game.findClosestActor(x, y, z, radius);
  if (actor) {
    let isInCombat = actor.isInCombat();
  }
  ```

  Или:

  ```typescript
  let actor = Game.findClosestActor(x, y, z, radius);
  if (!actor) return;
  let isInCombat = actor.isInCombat();
  ```

- Гарантируется, что `Game.getPlayer` никогда не возвращает `null`.

<a id="compiler-checks"></a>

## Проверки компилятора

- Параметр `strict` в `tsconfig.json` включает или отключает проверки на null и другие проверки корректности компилятора. \
  Подробнее: https://www.typescriptlang.org/tsconfig#strict.
- Можно также отключать проверки для отдельных случаев.

  Чтобы отключить проверки для всего файла \*.ts, начните его следующим комментарием:

  ```typescript
  // @ts-nocheck
  ```

  Чтобы отключить проверку одной строки, поместите следующий комментарий перед ней:

  ```typescript
  // @ts-ignore
  ```

<a id="object-comparison"></a>

# Сравнение объектов

Для сравнения объектов в SkyrimPlatform нужно сравнивать их ID:

```typescript
if (object1.getFormId() === object2.getFormId()) {
  // ...
}
```

<a id="casting-objects-to-string"></a>

# Преобразование объектов в строку

Типы, перенесённые из Papyrus, имеют ограниченную поддержку привычных для JS-объектов операций, например `toString` и `toJSON`.

```typescript
Game.getPlayer().ToString(); // '[object Actor]'
JSON.stringify(Game.getPlayer()); // `{}`
```

[Hooks]: events.md
[NewEvents]: new_events.md
