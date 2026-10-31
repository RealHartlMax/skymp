[Deutsch](docs_events_system.md) · [English](../../en/docs/docs_events_system.md) · [Русский](../../ru/docs/docs_events_system.md)

<a id="events-system"></a>

# Ereignissystem

Über das Ereignissystem reagiert dein Gamemode auf clientseitige Situationen:

1. Ereignisquelle mit `mp.makeEventSource(...)` definieren.
2. Ereignis auf dem Server mit `mp._eventName = (...) => { ... }` behandeln.

<a id="event-naming"></a>

## Ereignisnamen

Eigene Ereignisnamen müssen mit einem Unterstrich beginnen, beispielsweise `_onSomeEvent`.

<a id="basic-flow"></a>

## Grundlegender Ablauf

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

## Hinweise zum Ereignisquellkontext

Im Code einer Ereignisquelle (Inhalt von `makeEventSource`):

- `ctx.sendEvent(...)` steht zur Verfügung und sendet eigene Nutzdaten an den Server.
- `ctx.get(...)` steht nicht zur Verfügung.
- `ctx.respawn()` steht nicht zur Verfügung.

<a id="practical-example-death-pulse"></a>

## Praxisbeispiel (Todesimpuls)

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

Siehe auch:

- [Referenz für serverseitige Skripte](docs_serverside_scripting_reference.md)
- [Referenz für clientseitige Skripte](docs_clientside_scripting_reference.md)
- Eingebauter Aufheb-Hook `mp.onItemPickupAttempt(...)` (siehe serverseitige Skriptreferenz)
