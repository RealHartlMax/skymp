[Deutsch](sp-2.2.md) · [English](../../../en/docs/release/sp-2.2.md) · [Русский](../../../ru/docs/release/sp-2.2.md)

<a id="sp-22-release-notes"></a>

# SP 2.2 Versionshinweise

Dieses Dokument enthält die Änderungen seit SP 2.1.

SP wird regelmäßig aktualisiert. Dieses Update enthält möglicherweise nicht ALLE erforderlichen Korrekturen.
Es gibt weiterhin vieles zu implementieren oder zu korrigieren. Siehe [Issues](https://github.com/skyrim-multiplayer/skymp/issues?q=is%3Aopen+is%3Aissue+label%3Aarea%3Askyrim-platform).

Beachte: Diese SP-Version funktioniert nur mit dem alten SE-Build vor dem Update vom 11.11.21.
Verwende [diesen Patch](https://www.nexusmods.com/skyrimspecialedition/mods/57618), um deine Skyrim-SE-Installation zurückzustufen.

<a id="add-new-enums"></a>

## Neue Enums

- `EquippedItemType`: Typen für [Actor.GetEquippedItemType()][EquippedItemType].

  ```ts
  // Before
  player.getEquippedItemType(0) === 1;
  player.getEquippedItemType(0) === 11;

  // After
  player.getEquippedItemType(0) === EquippedItemType.Sword;
  player.getEquippedItemType(0) === EquippedItemType.Torch;
  ```

  Streitäxte und Kriegshämmer haben denselben Wert; so funktioniert Vanilla-Skyrim.

- `FormType`: Formtypen aus [`Form.GetType()`][FormType].

  ```ts
  // Before
  cell.getNumRefs(43);
  myBook.getType() === 27;

  // After
  cell.getNumRefs(FormType.NPC);
  myBook.getType() === FormType.Book;
  ```

- `SlotMask`: Rüstungs-[Slotmasken][SlotMask].

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

- `WeaponType`: Waffentypen aus [`Weapon.GetWeaponType()`][WeaponType].

  ```ts
  // Before
  weapon.getWeaponType() === 3;
  weapon.setWeaponType(5);

  // After
  weapon.getWeaponType() === WeaponType.WarAxe;
  weapon.setWeaponType(WeaponType.Greatsword);
  ```

  Streitäxte und Kriegshämmer haben denselben Wert; so funktioniert Vanilla-Skyrim.

[EquippedItemType]: https://www.creationkit.com/index.php?title=GetEquippedItemType_-_Actor
[FormType]: https://www.creationkit.com/index.php?title=GetType_-_Form
[SlotMask]: https://www.creationkit.com/index.php?title=Slot_Masks_-_Armor
[WeaponType]: https://www.creationkit.com/index.php?title=GetWeaponType_-_Weapon

<a id="add-consolemessage-event"></a>

## Ereignis consoleMessage

Wird bei jeder Konsolenausgabe des Spiels aufgerufen, einschließlich `printConsole`.

Hinweis: Der Nachrichtentext kann beliebige Zeichen enthalten, einschließlich `'` `"` `\`.
Vor der Übertragung an den Browser mit "browser.executeJavaScript" muss er maskiert werden.

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

## Funktion zum Deaktivieren von Strg + Druck

Diese Tastenkombination koppelt die Spielgeschwindigkeit an die Bildrate statt an die reale Zeit. Bei 30 FPS läuft das Spiel normal, darüber zu schnell (2-fach bei 60 FPS, 4-fach bei 120 usw.) und darunter langsamer. Da nicht jeder dauerhaft 60 FPS halten kann (Einbrüche in Riften sind häufig), ist diese Tastenkombination nicht erlaubt.

[Quelle](https://www.thegamer.com/skyrim-tricks-work-banned/)

SP bietet jetzt eine Methode zum Deaktivieren dieser Tastenkombination:

```ts
import * as sp from 'skyrimPlatform';

sp.disableCtrlPrtScnHotkey();
```

<a id="other-changes"></a>

## Weitere Änderungen

- `PapyrusObject` wird jetzt aus `skyrimPlatform.ts` exportiert.
