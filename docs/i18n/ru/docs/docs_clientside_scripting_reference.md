[Deutsch](../../de/docs/docs_clientside_scripting_reference.md) · [English](../../en/docs/docs_clientside_scripting_reference.md) · [Русский](docs_clientside_scripting_reference.md)

<a id="clientside-scripting-reference"></a>

# Справочник клиентских скриптов

В Skyrim Multiplayer нет отдельных клиентских скриптов. Клиентские фрагменты передаются строками в `makeProperty`, `updateOwner`, `updateNeighbor`, описанные в [серверном справочнике](docs_serverside_scripting_reference.md).

Также доступен код источников событий через `mp.makeEventSource(...)`.

<a id="context-overview"></a>

## Обзор контекстов

Одинаковая структура объекта `ctx` используется в разных контекстах, но не все члены доступны везде.

- `updateOwner`: код `makeProperty(...).updateOwner`
- `updateNeighbor`: код `makeProperty(...).updateNeighbor`
- `eventSource`: код `makeEventSource(...)`

## ctx.sp

Ссылается на API Skyrim Platform. См. [Skyrim Platform](docs_skyrim_platform.md).

```typescript
// Print to console
ctx.sp.printConsole('Hello Skyrim Platform!');
// Kill player character (locally)
ctx.sp.Game.getPlayer().kill();
```

## ctx.refr

В `makeProperty` всегда `undefined`.

В `updateOwner` аналогичен `ctx.sp.Game.getPlayer()`.

В `updateNeighbor` — синхронизируемая соседняя `ObjectReference` или `Actor`.

В `eventSource` обычно `undefined`, если скрипт не назначает его вручную в `ctx.state`.

```typescript
const pos = [
  ctx.refr.getPositionX(),
  ctx.refr.getPositionY(),
  ctx.refr.getPositionZ(),
];
```

## ctx.value

В `makeProperty` всегда `undefined`.

В `updateOwner`/`updateNeighbor` равен значению текущего свойства или `undefined`, если значения нет либо флаги скрывают его.

В `eventSource` по умолчанию `undefined`.

```typescript
ctx.sp.Game.setPlayerLevel(ctx.value || 1);
```

## ctx.state

Изменяемый объект хранения данных между вызовами `updateOwner`/`updateNeighbor` или инициализациями `makeProperty`.

Сейчас `state` общий для свойств.

У каждого источника события собственный `ctx.state`, сохраняющийся между обратными вызовами.

```typescript
ctx.state.x = 'y';
```

## ctx.get()

Получает значение указанного свойства. Встроенные свойства поддерживаются некорректно; их чтение ведёт к неопределённому поведению.

`ctx.get(...)` недоступен в `eventSource`.

```typescript
const v = ctx.get('myAwesomeProperty');
```

## ctx.getFormIdInServerFormat()

Получает серверный formId по клиентскому или `0`, если не найден.

```typescript
const serversideFormId = ctx.getFormIdInServerFormat(0xff00016a);
```

## ctx.getFormIdInClientFormat()

Обратная операция к `getFormIdInServerFormat`: получает клиентский formId по серверному или 0, если не найден.

```typescript
const clientsideFormId = ctx.getFormIdInClientFormat(0xff000000);
```

## ctx.respawn()

В `updateNeighbor` удаляет текущую запись синхронизированного соседнего представления.

`ctx.respawn()` недоступен в `updateOwner` и `eventSource`.

```typescript
ctx.respawn();
```

## ctx.sendEvent()

Доступен только в `eventSource`. Отправляет событие серверу.

```typescript
ctx.sendEvent({ foo: 'bar' });
```

<a id="quick-availability-matrix"></a>

## Краткая матрица доступности

- `updateOwner`: `sp`, `refr`, `value`, `state`, `get`, преобразователи ID форм
- `updateNeighbor`: `sp`, `refr`, `value`, `state`, `get`, преобразователи ID форм, `respawn`
- `eventSource`: `sp`, `state`, преобразователи ID форм, `sendEvent`

См. также [систему событий](docs_events_system.md).
