[Deutsch](../../de/docs/docs_events_system.md) · [English](../../en/docs/docs_events_system.md) · [Русский](docs_events_system.md)

<a id="events-system"></a>

# Система событий

Система событий позволяет gamemode реагировать на клиентские ситуации:

1. Определите источник через `mp.makeEventSource(...)`.
2. Обработайте событие на сервере через `mp._eventName = (...) => { ... }`.

<a id="event-naming"></a>

## Имена событий

Имена пользовательских событий должны начинаться с подчёркивания, например `_onSomeEvent`.

<a id="basic-flow"></a>

## Основной поток

```typescript
// 1) Register a client-side event source
mp.makeEventSource(
  '_onSomeEvent',
  `
  ctx.sp.once("update", () => {
    ctx.sendEvent({ foo: "bar" });
  });
`,
);

// 2) Register a server-side handler
mp._onSomeEvent = (pcFormId, payload) => {
  console.log('handled for', pcFormId, payload);
};
```

<a id="event-source-context-notes"></a>

## Примечания о контексте источника

В коде источника события (теле `makeEventSource`):

- `ctx.sendEvent(...)` доступен и отправляет собственные данные серверу.
- `ctx.get(...)` недоступен.
- `ctx.respawn()` недоступен.

<a id="practical-example-death-pulse"></a>

## Практический пример (импульс смерти)

```typescript
mp.makeEventSource(
  '_onLocalDeath',
  `
  ctx.sp.on("update", () => {
    const pl = ctx.sp.Game.getPlayer();
    const isDead = pl.getActorValuePercentage("health") === 0;

    if (ctx.state.wasDead !== isDead) {
      if (isDead) {
        ctx.sendEvent({ reason: "health_zero" });
      }
      ctx.state.wasDead = isDead;
    }
  });
`,
);

mp._onLocalDeath = (pcFormId, payload) => {
  console.log('downed', pcFormId, payload);
};
```

См. также:

- [Справочник серверных скриптов](docs_serverside_scripting_reference.md)
- [Справочник клиентских скриптов](docs_clientside_scripting_reference.md)
- Встроенный перехватчик подбора `mp.onItemPickupAttempt(...)` (см. серверный справочник)
