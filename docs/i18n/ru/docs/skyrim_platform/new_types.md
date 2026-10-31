[Deutsch](../../../de/docs/skyrim_platform/new_types.md) · [English](../../../en/docs/skyrim_platform/new_types.md) · [Русский](new_types.md)

<a id="papyrus-types-added-by-skyrimplatform"></a>

# Типы Papyrus, добавленные SkyrimPlatform

Сейчас SkyrimPlatform добавляет только один тип: `TESModPlatform`. Как и у `Game`, экземпляров этого типа не существует. Его статические функции перечислены ниже.

- `moveRefrToPosition` — телепортирует объект в указанную локацию и позицию.
- `setWeaponDrawnMode` — заставляет актёра всегда держать оружие извлечённым или убранным.
- `getNthVtableElement` — получает смещение функции из виртуальной таблицы (для обратной разработки).
- `getSkinColor` — получает цвет кожи ActorBase.
- `createNpc` — создаёт новую форму типа ActorBase.
- `setNpcSex` — меняет пол ActorBase.
- `setNpcRace` — меняет расу ActorBase.
- `setNpcSkinColor` — меняет цвет кожи ActorBase.
- `setNpcHairColor` — меняет цвет волос ActorBase.
- `resizeHeadpartsArray` — меняет размер массива частей головы ActorBase.
- `resizeTintsArray` — меняет размер массива TintMasks главного персонажа.
- `setFormIdUnsafe` — меняет ID формы. Небезопасно; используйте на свой риск.
- `clearTintMasks` — удаляет TintMasks указанного актёра или персонажа игрока, если актёр не передан.
- `pushTintMask` — добавляет TintMask с заданными параметрами указанному актёру или персонажу игрока, если актёр не передан.
- `pushWornState`, `addItemEx` — добавляет или удаляет предметы с указанными ExtraData.
- `updateEquipment` — обновляет экипировку (нестабильно).
- `resetContainer` — очищает базовый контейнер.

<a id="enums-added-by-skyrim-platform"></a>

# Перечисления, добавленные Skyrim Platform

Skyrim Platform добавляет [перечисления TypeScript][Ts-Enum] для удобства и предотвращения ошибок.

Ниже перечислены значения enum, объявленные в `skyrimPlatform.ts`.

- `DxScanCode`: коды клавиш из [Input Script][].

  ```ts
  Input.isKeyPressed(DxScanCode.F2);
  ```

- `EquippedItemType`: типы из [`Actor.GetEquippedItemType()`][EquippedItemType].

  ```ts
  player.getEquippedItemType(0) === EquippedItemType.Sword;
  player.getEquippedItemType(0) === EquippedItemType.Torch;
  ```

  Боевые топоры и боевые молоты имеют одно и то же значение — так работает обычный Skyrim.

  **_ПРЕДУПРЕЖДЕНИЕ_**: Не путайте с перечислением `WeaponType`. Они похожи, но значения отличаются.

- `FormType`: типы форм из [`Form.GetType()`][FormType].

  ```ts
  cell.getNumRefs(FormType.NPC);
  myBook.getType() === FormType.Book;
  ```

- `Menu`: имена меню из [UI Script][].

  ```ts
  Ui.isMenuOpen(Menu.Container);
  Ui.isMenuOpen(Menu.Inventory);
  Ui.isMenuOpen(Menu.Crafting);
  ```

- `SlotMask`: [маски слотов][SlotMask] брони.

  ```ts
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

  **_ПРЕДУПРЕЖДЕНИЕ_**: Bethesda оставила некоторые слоты без названий, но это перечисление следует [соглашению моддеров][Biped] об их использовании.\
  При создании плагина учитывайте, что **некоторые авторы брони могут не соблюдать это соглашение**.

  Некоторые значения также являются синонимами, поэтому выбирайте наиболее подходящее для вашей задачи имя.

  Например, все эти значения одинаковы (`0x10000000`):

  ```ts
  // Consensus dictates slot 0x10000000 may be used for either...
  SlotMask.ArmLeft; // Left arm
  SlotMask.ArmUnder; // Arm undergarment
  SlotMask.ArmSecondary; // Secondary arm
  ```

- `WeaponType`: типы оружия из [`Weapon.GetWeaponType()`][WeaponType].

  ```ts
  weapon.getWeaponType() === WeaponType.WarAxe;
  weapon.setWeaponType(WeaponType.Greatsword);
  ```

  Боевые топоры и боевые молоты имеют одно и то же значение — так работает обычный Skyrim.

  **_ПРЕДУПРЕЖДЕНИЕ_**: Не путайте с перечислением `EquippedItemType`. Они похожи, но значения отличаются.

[Biped]: https://www.creationkit.com/index.php?title=Biped_Object
[EquippedItemType]: https://www.creationkit.com/index.php?title=GetEquippedItemType_-_Actor
[FormType]: https://www.creationkit.com/index.php?title=GetType_-_Form
[Input Script]: https://www.creationkit.com/index.php?title=Input_Script
[SlotMask]: https://www.creationkit.com/index.php?title=Slot_Masks_-_Armor
[Ts-Enum]: https://www.typescriptlang.org/docs/handbook/enums.html
[UI Script]: https://www.creationkit.com/index.php?title=UI_Script
[WeaponType]: https://www.creationkit.com/index.php?title=GetWeaponType_-_Weapon
