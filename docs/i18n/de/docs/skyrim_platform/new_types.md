[Deutsch](new_types.md) · [English](../../../en/docs/skyrim_platform/new_types.md) · [Русский](../../../ru/docs/skyrim_platform/new_types.md)

<a id="papyrus-types-added-by-skyrimplatform"></a>

# Von SkyrimPlatform hinzugefügte Papyrus-Typen

SkyrimPlatform fügt derzeit nur einen Typ hinzu: `TESModPlatform`. Wie bei `Game` existieren davon keine Instanzen. Nachfolgend stehen seine statischen Funktionen.

- `moveRefrToPosition` – teleportiert das Objekt an den angegebenen Ort und die Position.
- `setWeaponDrawnMode` – zwingt den Actor, die Waffe stets gezogen oder weggesteckt zu halten.
- `getNthVtableElement` – ermittelt den Funktionsoffset aus der virtuellen Tabelle (für Reverse Engineering).
- `getSkinColor` – ermittelt die Hautfarbe der ActorBase.
- `createNpc` – erstellt eine neue Form vom Typ ActorBase.
- `setNpcSex` – ändert das Geschlecht der ActorBase.
- `setNpcRace` – ändert die Rasse der ActorBase.
- `setNpcSkinColor` – ändert die Hautfarbe der ActorBase.
- `setNpcHairColor` – ändert die Haarfarbe der ActorBase.
- `resizeHeadpartsArray` – ändert die Größe des Kopfteil-Arrays der ActorBase.
- `resizeTintsArray` – ändert die Größe des TintMasks-Arrays der Hauptfigur.
- `setFormIdUnsafe` – ändert die Form-ID. Unsicher; Verwendung auf eigene Gefahr.
- `clearTintMasks` – entfernt TintMasks des angegebenen Actors oder der Spielerfigur, falls kein Actor übergeben wurde.
- `pushTintMask` – fügt eine TintMask mit den angegebenen Parametern für den Actor oder, ohne Actor, die Spielerfigur hinzu.
- `pushWornState`, `addItemEx` – fügt Gegenstände mit den angegebenen ExtraData hinzu oder entfernt sie.
- `updateEquipment` – aktualisiert die Ausrüstung (instabil).
- `resetContainer` – leert den Basiscontainer.

<a id="enums-added-by-skyrim-platform"></a>

# Von Skyrim Platform hinzugefügte Enums

Skyrim Platform ergänzt [TypeScript-Enums][Ts-Enum], um die Verwendung zu erleichtern und Fehler zu vermeiden.

Nachfolgend stehen die in `skyrimPlatform.ts` definierten Enums.

- `DxScanCode`: Tastenbelegungen aus [Input Script][].

  ```ts
  Input.isKeyPressed(DxScanCode.F2);
  ```

- `EquippedItemType`: Typen für [`Actor.GetEquippedItemType()`][EquippedItemType].

  ```ts
  player.getEquippedItemType(0) === EquippedItemType.Sword;
  player.getEquippedItemType(0) === EquippedItemType.Torch;
  ```

  Streitäxte und Kriegshämmer haben denselben Wert; so funktioniert Vanilla-Skyrim.

  **_WARNUNG_**: Nicht mit dem Enum `WeaponType` verwechseln. Beide erscheinen ähnlich, verwenden aber unterschiedliche Werte.

- `FormType`: Formtypen aus [`Form.GetType()`][FormType].

  ```ts
  cell.getNumRefs(FormType.NPC);
  myBook.getType() === FormType.Book;
  ```

- `Menu`: Menünamen aus [UI Script][].

  ```ts
  Ui.isMenuOpen(Menu.Container);
  Ui.isMenuOpen(Menu.Inventory);
  Ui.isMenuOpen(Menu.Crafting);
  ```

- `SlotMask`: Rüstungs-[Slotmasken][SlotMask].

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

  **_WARNUNG_**: Bethesda hat einige Slots nicht benannt. Dieses Enum folgt für deren Nutzung dem [Konsens der Modding-Community][Biped].\
  Beachte bei deinem Plugin, dass **einige Rüstungsersteller diesem Konsens möglicherweise nicht folgen**.

  Einige Werte sind außerdem Synonyme; du kannst den für deinen Zweck passendsten Namen verwenden.

  Diese Werte sind beispielsweise alle gleich (`0x10000000`):

  ```ts
  // Consensus dictates slot 0x10000000 may be used for either...
  SlotMask.ArmLeft; // Left arm
  SlotMask.ArmUnder; // Arm undergarment
  SlotMask.ArmSecondary; // Secondary arm
  ```

- `WeaponType`: Waffentypen aus [`Weapon.GetWeaponType()`][WeaponType].

  ```ts
  weapon.getWeaponType() === WeaponType.WarAxe;
  weapon.setWeaponType(WeaponType.Greatsword);
  ```

  Streitäxte und Kriegshämmer haben denselben Wert; so funktioniert Vanilla-Skyrim.

  **_WARNUNG_**: Nicht mit dem Enum `EquippedItemType` verwechseln. Beide erscheinen ähnlich, verwenden aber unterschiedliche Werte.

[Biped]: https://www.creationkit.com/index.php?title=Biped_Object
[EquippedItemType]: https://www.creationkit.com/index.php?title=GetEquippedItemType_-_Actor
[FormType]: https://www.creationkit.com/index.php?title=GetType_-_Form
[Input Script]: https://www.creationkit.com/index.php?title=Input_Script
[SlotMask]: https://www.creationkit.com/index.php?title=Slot_Masks_-_Armor
[Ts-Enum]: https://www.typescriptlang.org/docs/handbook/enums.html
[UI Script]: https://www.creationkit.com/index.php?title=UI_Script
[WeaponType]: https://www.creationkit.com/index.php?title=GetWeaponType_-_Weapon
