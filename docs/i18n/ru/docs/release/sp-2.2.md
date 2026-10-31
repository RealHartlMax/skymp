[Deutsch](../../../de/docs/release/sp-2.2.md) · [English](../../../en/docs/release/sp-2.2.md) · [Русский](sp-2.2.md)

<a id="sp-22-release-notes"></a>

# SP 2.2 Примечания к выпуску

В документе перечислены изменения после SP 2.1.

SP регулярно обновляется. Это обновление, вероятно, не включает ВСЕ необходимые исправления.
Многое ещё предстоит реализовать или исправить. См. [задачи](https://github.com/skyrim-multiplayer/skymp/issues?q=is%3Aopen+is%3Aissue+label%3Aarea%3Askyrim-platform).

Обратите внимание: эта версия SP работает только со старой сборкой SE до обновления от 11.11.21.
Для отката Skyrim SE используйте [этот патч](https://www.nexusmods.com/skyrimspecialedition/mods/57618).

<a id="add-new-enums"></a>

## Новые перечисления

- `EquippedItemType`: типы для [Actor.GetEquippedItemType()][EquippedItemType].

  ```ts
  // Before
  player.getEquippedItemType(0) === 1;
  player.getEquippedItemType(0) === 11;

  // After
  player.getEquippedItemType(0) === EquippedItemType.Sword;
  player.getEquippedItemType(0) === EquippedItemType.Torch;
  ```

  Боевые топоры и боевые молоты имеют одно и то же значение — так работает обычный Skyrim.

- `FormType`: типы форм из [`Form.GetType()`][FormType].

  ```ts
  // Before
  cell.getNumRefs(43);
  myBook.getType() === 27;

  // After
  cell.getNumRefs(FormType.NPC);
  myBook.getType() === FormType.Book;
  ```

- `SlotMask`: [маски слотов][SlotMask] брони.

  ```ts
  // Before
  armor.getSlotMask() === 0x2000000;
  NiOverride.AddSkinOverrideString(a, true, false, 0x4, 9, 0, diffuseTex, true);

  // After
  armor.getSlotMask() === SlotMask.Jewelry;
  NiOverride.AddSkinOverrideString(
    a,
    true,
    false,
    SlotMask.Body,
    9,
    0,
    diffuseTex,
    true,
  );
  ```

- `WeaponType`: типы оружия из [`Weapon.GetWeaponType()`][WeaponType].

  ```ts
  // Before
  weapon.getWeaponType() === 3;
  weapon.setWeaponType(5);

  // After
  weapon.getWeaponType() === WeaponType.WarAxe;
  weapon.setWeaponType(WeaponType.Greatsword);
  ```

  Боевые топоры и боевые молоты имеют одно и то же значение — так работает обычный Skyrim.

[EquippedItemType]: https://www.creationkit.com/index.php?title=GetEquippedItemType_-_Actor
[FormType]: https://www.creationkit.com/index.php?title=GetType_-_Form
[SlotMask]: https://www.creationkit.com/index.php?title=Slot_Masks_-_Armor
[WeaponType]: https://www.creationkit.com/index.php?title=GetWeaponType_-_Weapon

<a id="add-consolemessage-event"></a>

## Событие consoleMessage

Вызывается при любом выводе игры в консоль, включая `printConsole`.

Примечание: текст может содержать любые символы, включая `'` `"` `\`.
Перед передачей в браузер через "browser.executeJavaScript" его нужно экранировать.

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

<a id="add-function-to-disable-ctrl--prtscn-hotkey"></a>

## Функция отключения Ctrl + PrtScn

Это сочетание привязывает скорость игры к частоте кадров вместо реального времени. При 30 FPS скорость обычная, выше — ускоренная (2× при 60 FPS, 4× при 120 и т. д.), ниже — замедленная. Не все могут поддерживать стабильные 60 FPS (просадки в Рифтене обычны), поэтому это сочетание не разрешено.

[Источник](https://www.thegamer.com/skyrim-tricks-work-banned/)

Теперь в SP есть метод отключения этого сочетания:

```ts
import * as sp from 'skyrimPlatform';

sp.disableCtrlPrtScnHotkey();
```

<a id="other-changes"></a>

## Другие изменения

- `PapyrusObject` теперь экспортируется из `skyrimPlatform.ts`.
