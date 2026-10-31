[Deutsch](../../de/docs/docs_serverside_scripting_reference.md) · [English](../../en/docs/docs_serverside_scripting_reference.md) · [Русский](docs_serverside_scripting_reference.md)

<a id="serverside-scripting-reference"></a>

# Справочник серверных скриптов

Сервер объявляет глобальную переменную `mp` для доступа ко всему API. Здесь перечислены методы `mp`, доступные в скриптах.

## mp.makeProperty()

Создаёт свойство для всех экземпляров `MpActor` и `MpObjectReference`. Значения автоматически сохраняются в базе. См. [систему свойств](docs_properties_system.md).

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

Создаёт источник событий для отслеживания игровых ситуаций и передачи их серверу как событий. См. [систему событий](docs_events_system.md).

Имена пользовательских событий начинаются с подчёркивания, например `_onLocalDeath`.

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

### Обработка пользовательских событий

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

Возвращает текущее значение свойства или `undefined`, если значения нет.

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

Меняет значение указанного свойства.

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

Удаляет добавленные свойства и источники событий.

```typescript
// Definition
clear(): void;
```

```typescript
// Usage
mp.clear();
```

<a id="built-in-pickup-hook-mponitempickupattempt"></a>

## Встроенный перехватчик подбора: mp.onItemPickupAttempt()

При `itemPickupMode: "minigame"` в `server-settings.json` сервер вызывает этот перехватчик до передачи предмета мира игроку.

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

`false` блокирует подбор, `true` разрешает.

<a id="typescript-example"></a>

### Пример TypeScript

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

### Пример Papyrus

Papyrus не может напрямую ответить синхронному перехватчику. Однако из **плагина SkyrimPlatform** можно запустить Papyrus-скрипт задания через `callPapyrusFunction`.

**Сервер (TypeScript gamemode):**

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

**Клиент (плагин SkyrimPlatform, TypeScript):**

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

**Скрипт Papyrus (MyMod_PickupQuest.psc):**

```papyrus
Scriptname MyMod_PickupQuest extends Quest

; Called by SkyrimPlatform via callPapyrusFunction when a pickup is denied
Function OnPickupDenied()
  Debug.Notification("You cannot pick that up.")
  ; Play a sound, show a menu, start a minigame quest stage, etc.
EndFunction
```

<a id="frequently-used-built-in-properties"></a>

## Часто используемые встроенные свойства

Некоторые встроенные свойства для `mp.get`/`mp.set`:

- `isDead` — состояние смерти актёра (чтение/запись)
- `canRespawn` — управление автоматическим возрождением (чтение/запись)
- `pos`, `angle`, `worldOrCellDesc` — пространственное состояние
- `actorValues` — настройка параметров актёра на сервере (чтение/запись):

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

Более полный список — в [системе свойств](docs_properties_system.md).
