[Deutsch](docs_clientside_scripting_reference.md) · [English](../../en/docs/docs_clientside_scripting_reference.md) · [Русский](../../ru/docs/docs_clientside_scripting_reference.md)

<a id="clientside-scripting-reference"></a>

# Referenz für clientseitige Skripte

Skyrim Multiplayer besitzt keine separaten clientseitigen Skripte. Clientseitig ausgeführte Codeabschnitte werden als Zeichenfolgen an `makeProperty`, `updateOwner` und `updateNeighbor` übergeben; siehe [serverseitige Skriptreferenz](docs_serverside_scripting_reference.md).

Zusätzlich gibt es Ereignisquellcode über `mp.makeEventSource(...)`.

<a id="context-overview"></a>

## Kontextübersicht

Die Struktur des `ctx`-Objekts wird in unterschiedlichen Ausführungskontexten verwendet, aber nicht jedes Mitglied steht überall zur Verfügung.

- `updateOwner`: Code aus `makeProperty(...).updateOwner`
- `updateNeighbor`: Code aus `makeProperty(...).updateNeighbor`
- `eventSource`: Code aus `makeEventSource(...)`

## ctx.sp

Verweist auf die Skyrim-Platform-API. Siehe [Skyrim Platform](docs_skyrim_platform.md).

```typescript
// Print to console
ctx.sp.printConsole('Hello Skyrim Platform!');
// Kill player character (locally)
ctx.sp.Game.getPlayer().kill();
```

## ctx.refr

In `makeProperty` immer `undefined`.

In `updateOwner` ähnlich wie `ctx.sp.Game.getPlayer()`.

In `updateNeighbor` die synchronisierte `ObjectReference` oder der `Actor` des Nachbarn.

In `eventSource` normalerweise `undefined`, sofern dein Skript es nicht manuell in `ctx.state` zuweist.

```typescript
const pos = [
  ctx.refr.getPositionX(),
  ctx.refr.getPositionY(),
  ctx.refr.getPositionZ(),
];
```

## ctx.value

In `makeProperty` immer `undefined`.

In `updateOwner`/`updateNeighbor` der Wert der aktuell verarbeiteten Eigenschaft; `undefined`, wenn kein Wert vorhanden oder er aufgrund der Flags nicht sichtbar ist.

In `eventSource` standardmäßig `undefined`.

```typescript
ctx.sp.Game.setPlayerLevel(ctx.value || 1);
```

## ctx.state

Beschreibbares Objekt zum Speichern von Daten zwischen `updateOwner`-/`updateNeighbor`-Aufrufen oder `makeProperty`-Initialisierungen.

`state` wird derzeit zwischen Eigenschaften geteilt.

Bei Ereignisquellen besitzt jede Quelle ein eigenes `ctx.state`, das zwischen Callback-Aufrufen erhalten bleibt.

```typescript
ctx.state.x = 'y';
```

## ctx.get()

Liest den Wert der angegebenen Eigenschaft. Eingebaute Eigenschaften werden nicht korrekt unterstützt; deren Abruf führt zu undefiniertem Verhalten.

`ctx.get(...)` steht im Kontext `eventSource` nicht zur Verfügung.

```typescript
const v = ctx.get('myAwesomeProperty');
```

## ctx.getFormIdInServerFormat()

Ermittelt die serverseitige formId aus einer clientseitigen formId oder `0`, falls nicht gefunden.

```typescript
const serversideFormId = ctx.getFormIdInServerFormat(0xff00016a);
```

## ctx.getFormIdInClientFormat()

Gegenstück zu `getFormIdInServerFormat`: ermittelt die clientseitige formId aus einer serverseitigen formId oder 0, falls nicht gefunden.

```typescript
const clientsideFormId = ctx.getFormIdInClientFormat(0xff000000);
```

## ctx.respawn()

Entfernt in `updateNeighbor` den aktuellen synchronisierten Nachbaransichtseintrag.

`ctx.respawn()` steht in `updateOwner` und `eventSource` nicht zur Verfügung.

```typescript
ctx.respawn();
```

## ctx.sendEvent()

Nur in `eventSource` verfügbar. Sendet ein Ereignis an den Server.

```typescript
ctx.sendEvent({ foo: 'bar' });
```

<a id="quick-availability-matrix"></a>

## Verfügbarkeitsübersicht

- `updateOwner`: `sp`, `refr`, `value`, `state`, `get`, Form-ID-Konverter
- `updateNeighbor`: `sp`, `refr`, `value`, `state`, `get`, Form-ID-Konverter, `respawn`
- `eventSource`: `sp`, `state`, Form-ID-Konverter, `sendEvent`

Siehe auch [Ereignissystem](docs_events_system.md).
