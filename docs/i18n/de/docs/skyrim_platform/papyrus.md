[Deutsch](papyrus.md) · [English](../../../en/docs/skyrim_platform/papyrus.md) · [Русский](../../../ru/docs/skyrim_platform/papyrus.md)

<a id="papyrus-types-from-the-original-game"></a>

# Papyrus-Typen aus dem ursprünglichen Spiel

Alle Typen haben in SkyrimPlatform denselben Namen wie in Papyrus, beispielsweise `Game`, `Actor`, `Form`, `Spell` oder `Perk`.

Um Papyrus-Typen und deren Methoden und statische Funktionen zu verwenden, musst du sie importieren:

```typescript
import { Actor, Game } from 'skyrimPlatform';
```

**_WARNUNG_**: Papyrus-Typen und -Methoden stehen nur innerhalb von [Hooks][Hooks] oder den von Skyrim Platform eingeführten [neuen Ereignissen][NewEvents] (außer `tick`) zur Verfügung.

Bei einer Verwendung außerhalb dieser Kontexte wird eine Ausnahme ausgelöst.

## Form

- Von Form (`Form`) erben die meisten Spieltypen mit Methoden, beispielsweise `Actor` und `Weapon`.
- Jede Form besitzt eine ID: eine vorzeichenlose 32-Bit-Zahl (`uint32_t`), in SkyrimPlatform als `number` dargestellt.
- Verwende `Game.getFormEx`, um eine Form anhand ihrer ID zu suchen.\
  Beachte: `Game.getFormEx`, nicht `Game.getForm`. Letzteres gibt für IDs oberhalb von 0x80000000 immer `null` zurück (Verhalten des ursprünglichen Spiels).
- Mit `getFormID` erhältst du die Form-ID. Sofern das Spiel die Form nicht zerstört hat, findet `Game.getFormEx` sie garantiert unter dieser ID wieder.

<a id="object-casting"></a>

## Objekte umwandeln

- Wenn ein `Form`-Objekt eine Waffe darstellt und du ein `Weapon`-Objekt benötigst, kannst du eine Typumwandlung verwenden:
  ```typescript
  let sword = Game.getFormEx(swordId); // Get Form
  let weapon = Weapon.from(sword); // Cast to Weapon
  ```
- Wenn die angegebene ID keine Waffe bezeichnet, ist die Variable `weapon` gleich `null`.
- Übergibst du `null` an eine Typumwandlungsfunktion, wird keine Ausnahme ausgelöst; sie gibt `null` zurück:
  ```typescript
  ObjectReference.from(null); // null
  ```
- Auch eine Umwandlung in einen Typ ohne Instanzen oder einen in der Vererbungshierarchie inkompatiblen Typ gibt `null` zurück:
  ```typescript
  Game.from(Game.getPlayer()); // null
  Spell.from(Game.getPlayer()); // null
  ```
- Mit einer Typumwandlung erhältst du auch ein Objekt des Basistyps, einschließlich `Form`:
  ```typescript
  let refr = ObjectReference.from(Game.getPlayer());
  let form = Form.from(refr);
  ```
- Die Umwandlung eines Objekts in seinen eigenen Typ gibt das ursprüngliche Objekt zurück:
  ```typescript
  let actor = Actor.from(Game.getPlayer());
  ```

<a id="safe-use-of-objects"></a>

# Objekte sicher verwenden

- Vergewissere dich nach dem Ermitteln eines Objekts, dass es nicht `null` ist:

  ```typescript
  let actor = Game.findClosestActor(x, y, z, radius);
  if (actor) {
    let isInCombat = actor.isInCombat();
  }
  ```

  Oder:

  ```typescript
  let actor = Game.findClosestActor(x, y, z, radius);
  if (!actor) return;
  let isInCombat = actor.isInCombat();
  ```

- `Game.getPlayer` gibt garantiert niemals `null` zurück.

<a id="compiler-checks"></a>

## Compiler-Prüfungen

- Die Option `strict` in `tsconfig.json` aktiviert oder deaktiviert Nullprüfungen und weitere Korrektheitsprüfungen des Compilers. \
  Weitere Informationen: https://www.typescriptlang.org/tsconfig#strict.
- Compiler-Prüfungen lassen sich auch gezielt für einzelne Fälle deaktivieren.

  Du kannst Prüfungen für eine ganze \*.ts-Datei deaktivieren, indem du sie mit folgendem Kommentar beginnst:

  ```typescript
  // @ts-nocheck
  ```

  Oder deaktiviere die Prüfung für eine einzelne Zeile mit folgendem Kommentar in der vorhergehenden Zeile:

  ```typescript
  // @ts-ignore
  ```

<a id="object-comparison"></a>

# Objekte vergleichen

Vergleiche in SkyrimPlatform die IDs der Objekte:

```typescript
if (object1.getFormId() === object2.getFormId()) {
  // ...
}
```

<a id="casting-objects-to-string"></a>

# Objekte in Zeichenfolgen umwandeln

Aus Papyrus übernommene Typen unterstützen typische JS-Objektoperationen wie `toString` und `toJSON` nur eingeschränkt.

```typescript
Game.getPlayer().ToString(); // '[object Actor]'
JSON.stringify(Game.getPlayer()); // `{}`
```

[Hooks]: events.md
[NewEvents]: new_events.md
