[Deutsch](docs_serverside_scripting_reference.md) · [English](../../en/docs/docs_serverside_scripting_reference.md) · [Русский](../../ru/docs/docs_serverside_scripting_reference.md)

<a id="serverside-scripting-reference"></a>

# Referenz für serverseitige Skripte

Der Server stellt die globale Variable `mp` für den Zugriff auf die gesamte API bereit. Diese Seite listet die in Skripten verfügbaren Methoden von `mp`.

## mp.makeProperty()

Erstellt eine Eigenschaft für alle Instanzen von `MpActor` und `MpObjectReference`. Werte werden automatisch in der Datenbank gespeichert. Siehe [Eigenschaftensystem](docs_properties_system.md).

```typescript
/* Definition */
interface MakePropertyOptions {
  // If set to false, `updateOwner` would never be invoked
  // Player's client wouldn't see its own value of this property
  // Reasonable for passwords and other secret values
  isVisibleByOwner: boolean;

  // If set to false, `updateNeighbor` would never be invoked
  // Player's client wouldn't see values of neighbor Actors/ObjectReferences
  isVisibleByNeighbors: boolean;

  // Body of functions that would be invoked on client every update.
  updateOwner: string; // For the PlayerCharacter
  updateNeighbor: string; // For each synchronized Actor/ObjectReference
}

interface Mp {
  // ...
  makeProperty(propertyName: string, options: MakePropertyOptions): void;
  // ...
}

/* Usage */
mp.makeProperty('playerLevel', {
  isVisibleByOwner: true,
  isVisibleByNeighbors: false,
  updateOwner: 'ctx.sp.Game.setPlayerLevel(ctx.value)',
  updateNeighbor: '',
});
```

## mp.makeEventSource()

Erstellt eine Ereignisquelle, um bestimmte Spielsituationen zu erfassen und als Ereignisse an den Server zu senden. Siehe [Ereignissystem](docs_events_system.md).

Eigene Ereignisnamen beginnen mit einem Unterstrich, beispielsweise `_onLocalDeath`.

```typescript
/* Definition */
interface Mp {
  // ...
  makeEventSource(eventName: string, functionBody: string): void;
  // ...
}

/* Usage */
mp.makeEventSource(
  '_onLocalDeath',
  `
    ctx.sp.on("update", () => {
      const pl = ctx.sp.Game.getPlayer();
      const isDead = pl.getActorValuePercentage("health") === 0;
      if (ctx.state.wasDead !== isDead) {
        if (isDead) {
          ctx.sendEvent();
        }
        ctx.state.wasDead = isDead;
      }
    });
  `,
);
mp._onLocalDeath = function (pcFormId) {
  /* ... */
};
```

<a id="handling-custom-events"></a>

### Eigene Ereignisse behandeln

```typescript
mp.makeEventSource(
  '_onPlayerPulse',
  `
  ctx.sp.once("update", () => {
    ctx.sendEvent({ ok: true });
  });
`,
);

mp._onPlayerPulse = function (pcFormId, payload) {
  console.log('pulse', pcFormId, payload);
};
```

## mp.get()

Gibt den aktuellen Wert der angegebenen Eigenschaft zurück oder `undefined`, wenn kein Wert vorhanden ist.

```typescript
/* Definition */
interface Mp {
  // ...
  get(formId: number, propertyName: string): any;
  // ...
}

/* Usage */
mp.get(0xff000000, 'type');
mp.get(0xff000000, 'pos');
mp.get(0xff000000, 'myAwesomeProperty');
```

## mp.set()

Ändert den Wert der angegebenen Eigenschaft.

```typescript
/* Definition */
interface Mp {
  // ...
  set(formId: number, propertyName: string, newValue: any): void;
  // ...
}

/* Usage */
mp.set(0xff000000, 'pos', [0, 0, 0]);
```

## mp.clear()

Entfernt hinzugefügte Eigenschaften und Ereignisquellen.

```typescript
// Definition
clear(): void;
```

```typescript
// Usage
mp.clear();
```

<a id="built-in-pickup-hook-mponitempickupattempt"></a>

## Eingebauter Aufheb-Hook: mp.onItemPickupAttempt()

Bei `itemPickupMode: "minigame"` in `server-settings.json` ruft der Server diesen Hook auf, bevor er einen Weltgegenstand an einen Spieler übergibt.

```typescript
/* Definition */
interface Mp {
  onItemPickupAttempt?: (
    sourceRefrId: number,
    actorRefrId: number,
    itemBaseId: number,
    itemCount: number,
    isOwned: boolean,
    isQuestItem: boolean,
  ) => boolean;
}
```

`false` verweigert das Aufheben; `true` erlaubt es.

<a id="typescript-example"></a>

### TypeScript-Beispiel

```typescript
// gamemode.ts / gamemode.js
mp.onItemPickupAttempt = (
  sourceRefrId,
  actorRefrId,
  itemBaseId,
  itemCount,
  isOwned,
  isQuestItem,
) => {
  // Block theft and quest items outright
  if (isOwned || isQuestItem) return false;

  // Custom per-player gate: only allow pickup when the player has a perk flag set
  const hasPickupPerk = mp.get(actorRefrId, "allowedToLoot") === true;
  return hasPickupPerk;
};
```

<a id="papyrus-example"></a>

### Papyrus-Beispiel

Papyrus kann den synchronen Hook nicht direkt zurückrufen. Du kannst jedoch aus einem **SkyrimPlatform-Plugin** über `callPapyrusFunction` ein Papyrus-Questskript auslösen.

**Serverseite (TypeScript-Gamemode):**

```typescript
// 1. Set mode to minigame in server-settings.json:
//    "itemPickupMode": "minigame"

// 2. In the hook, send a custom packet to the client so Papyrus can react.
//    Store the pending decision server-side and resolve it asynchronously.
const pendingPickups = new Map<number, (allow: boolean) => void>();

mp.onItemPickupAttempt = (sourceRefrId, actorRefrId, itemBaseId, itemCount, isOwned, isQuestItem) => {
  // Synchronous fast-path: always block owned/quest items without roundtrip
  if (isOwned || isQuestItem) return false;

  // For a full async Papyrus minigame you would need an async-capable event
  // system. With the current synchronous hook, run the Papyrus logic ahead of
  // time and cache the result via a custom property:
  return mp.get(actorRefrId, "pickupAllowed") === true;
};

// Grant / revoke pickup permission from a server-side timer or another event:
mp.onPlayerConnect = (userId) => {
  const refrId = mp.getUserActor(userId);
  mp.set(refrId, "pickupAllowed", true);
};
```

**Clientseite (SkyrimPlatform-Plugin, TypeScript):**

```typescript
// skyrim-platform plugin (runs in Skyrim process via SP)
import { on, Game, Actor } from "skyrimPlatform";

// Listen for a custom server→client packet that signals pickup start/end
sp.on("customPacket", (packet: { type: string; allow: boolean }) => {
  if (packet.type !== "pickupResult") return;

  if (!packet.allow) {
    // Optionally run a Papyrus script to show a UI notification
    const player = Game.getPlayer() as Actor;
    // callPapyrusFunction("MyMod:PickupQuest", "OnPickupDenied", player, []);
    Debug.notification("You cannot pick that up.");
  }
});
```

**Papyrus-Skript (MyMod_PickupQuest.psc):**

```papyrus
Scriptname MyMod_PickupQuest extends Quest

; Called by SkyrimPlatform via callPapyrusFunction when a pickup is denied
Function OnPickupDenied()
  Debug.Notification("You cannot pick that up.")
  ; Play a sound, show a menu, start a minigame quest stage, etc.
EndFunction
```

<a id="frequently-used-built-in-properties"></a>

## Häufige eingebaute Eigenschaften

Häufig verwendete eingebaute Eigenschaften für `mp.get`/`mp.set`:

- `isDead` – Todeszustand des Actors (lesen/schreiben)
- `canRespawn` – automatische Respawn-Steuerung (lesen/schreiben)
- `pos`, `angle`, `worldOrCellDesc` – räumlicher Zustand
- `actorValues` – serverseitige Actor-Wertanpassung (lesen/schreiben):

```ts
const values = mp.get(refrId, 'actorValues');

mp.set(refrId, 'actorValues', {
  health: 120,
  magicka: 100,
  stamina: 110,
  healRate: 0.7,
  magickaRate: 3,
  staminaRate: 5,
  healRateMult: 100,
  magickaRateMult: 100,
  staminaRateMult: 100,
});
```

Eine umfassendere Liste steht unter [Eigenschaftensystem](docs_properties_system.md).
