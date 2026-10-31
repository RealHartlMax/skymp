[Deutsch](sp-2.4.md) · [English](../../../en/docs/release/sp-2.4.md) · [Русский](../../../ru/docs/release/sp-2.4.md)

<a id="sp-240-release-notes"></a>

# SP 2.4.0 Versionshinweise

Dieses Dokument enthält die Änderungen seit SP 2.3.0

SP wird regelmäßig aktualisiert. Dieses Update enthält möglicherweise nicht ALLE erforderlichen Korrekturen.

Es gibt weiterhin vieles zu implementieren oder zu korrigieren. Siehe [Issues](https://github.com/skyrim-multiplayer/skymp/issues?q=is%3Aopen+is%3Aissue+label%3Aarea%3Askyrim-platform).

Beachte: Diese SP-Version funktioniert nur mit dem alten SE-Build vor dem Update vom 11.11.21.

Verwende [diesen Patch](https://www.nexusmods.com/skyrimspecialedition/mods/57618), um deine Skyrim-SE-Installation zurückzustufen.

<a id="add-browserisvisiblebrowserisfocused-methods"></a>

## Methoden `browser.isVisible`/`browser.isFocused`

Die tatsächlichen Sichtbarkeits- und Fokuswerte lassen sich jetzt abfragen, statt sie bei jedem Aufruf von `setVisible`/`setFocused` selbst zu speichern.

```typescript
printConsole('isVisible:', browser.isVisible());
printConsole('isFocused:', browser.isFocused());
```

<a id="support-opening-urls-in-the-system-default-browser"></a>

## URLs im Standardbrowser des Systems öffnen

Skyrim Platform unterstützte bereits einen spielinternen Browser für Benutzeroberflächen mit Webtechnologien.

Dieses Update ergänzt das Öffnen von URLs im Standardbrowser des Benutzers: Chrome, Firefox, Edge, Opera usw.

Du kannst Links, Schaltflächen, Tastenkombinationen oder andere Auslöser erstellen, die Mod-Benutzer zu deiner Nexus-, GitHub- oder Patreon-Seite oder deiner Website führen.

```typescript
win32.loadUrl('https://github.com/skyrim-multiplayer/skymp');
```

Derzeit sind nur URLs mit dem Präfix `https://` erlaubt.

<a id="add-spellcast-event"></a>

## Ereignis spellCast

spellCast-Ereignisse lassen sich jetzt abfangen.

```typescript
on('spellCast', (event) => {
  printConsole(event.caster.getFormID());
  printConsole(event.spell.getName());
});
```

Das Ereignisobjekt enthält `caster: ObjectReference` und `spell: Spell`.

<a id="support-array-return-values-in-scripting-functions"></a>

## Array-Rückgabewerte von Skriptfunktionen

Funktionen mit Array-Rückgabewerten lassen sich jetzt ohne die bisherigen Ausnahmen aufrufen.

```typescript
Utility.createStringArray(3, 'teststring');
// ["teststring", "teststring", "teststring"]
Utility.createBoolArray(3, true);
// [true, true, true]

const spell = player.getNthSpell(0);
browser.executeJavascript(
  `console.log(${JSON.stringify(s?.getEffectDurations())})`,
);
// prints numbers array to browser console [5, 5, 5];
const array = spell?.getMagicEffects();
// return array of PapyrusObjects
array?.forEach((element) => {
  printConsole(MagicEffect.from(element)?.getFormID());
  // create MagicEffect from PapyrusObject with static .from
  // print FormID for all MagicEffects from 1st spell
});
```

Bei Objektarrays wird derzeit immer `PapyrusObject[]` zurückgegeben.
Um Klassenmethoden verwenden zu können, musst du die Elemente mit der statischen Methode `from` umwandeln.

<a id="other-changes"></a>

## Weitere Änderungen

- Nicht existierende Methode `writeScript` aus `skyrimPlatform.ts` entfernt. Stattdessen kann `writePlugin` verwendet werden.
