[Deutsch](../../de/docs/docs_respawn_control_system.md) · [English](../../en/docs/docs_respawn_control_system.md) · [Русский](docs_respawn_control_system.md)

<a id="custom-respawn-control-system"></a>

# Собственное управление возрождением

<a id="overview"></a>

## Обзор

Система позволяет администраторам и моддерам вводить сложные механики смерти, например воскрешение лекарем/врачом: мёртвые игроки не возрождаются автоматически до помощи другого игрока.

Основа — новое свойство **`canRespawn`**, управляющее автоматическим возрождением после настроенной задержки.

<a id="architecture"></a>

## Архитектура

<a id="core-components"></a>

### Основные компоненты

1. **Свойство `canRespawn`** — логическое значение актёра, по умолчанию `true`

   - `true`: игрок автоматически возрождается после `spawnDelay`.
   - `false`: остаётся мёртвым до ручного воскрешения через `isDead`.

2. **Привязка свойства** — `mp.set()`/`mp.get()` из TypeScript/gamemode

   ```typescript
   mp.set(actorId, 'canRespawn', false); // Disable auto-respawn
   mp.get(actorId, 'canRespawn'); // Check if respawn enabled
   ```

3. **Проверка смерти** — изменённый `DeathEvent.OnFireSuccess()` в C++
   - Проверяет `actor->GetCanRespawn()` перед `RespawnWithDelay()`.
   - При `canRespawn == false` таймер не запускается.

<a id="implementation-details"></a>

### Подробности реализации

**Файл: `DeathEvent.cpp`**

```cpp
void DeathEvent::OnFireSuccess(WorldState*)
{
  if (actor && actor->GetCanRespawn()) {
    actor->RespawnWithDelay();
  }
};
```

**Файл: `MpChangeForms.h`**

```cpp
bool canRespawn = true;  // Persisted in ChangeForm
```

**Файл: `CanRespawnBinding.h/cpp`**

- Привязка предоставляет `canRespawn` TypeScript через `mp.set()`/`mp.get()`.
- Регистрация в `PropertyBindingFactory::CreateStandardPropertyBindings()`.

<a id="usage-examples"></a>

## Примеры использования

<a id="example-1-basic-healer-revival-typescript-gamemode"></a>

### Пример 1: простое воскрешение лекарем (TypeScript gamemode)

```typescript
// When player dies, disable auto-respawn
export const onDeath = (dyingActorId: number, killerId: number) => {
  mp.set(dyingActorId, 'canRespawn', false);
  console.log(`Player ${dyingActorId} is downed. Waiting for healer...`);
};

// Healer casts revival spell
export const revivePlayer = (playerId: number, healerId: number) => {
  // Resurrect the player
  mp.set(playerId, 'isDead', false);

  // Re-enable respawn for next death
  mp.set(playerId, 'canRespawn', true);

  console.log(`Player ${playerId} revived by healer ${healerId}`);
};
```

<a id="example-2-delayed-revival-with-timeout"></a>

### Пример 2: отложенное воскрешение с таймаутом

```typescript
const downedPlayers = new Map<number, number>(); // playerId -> downTime

export const onDeath = (dyingActorId: number, killerId: number) => {
  mp.set(dyingActorId, 'canRespawn', false);
  downedPlayers.set(dyingActorId, Date.now());

  // Auto-revive after 5 minutes if not revived by healer
  setTimeout(() => {
    if (downedPlayers.has(dyingActorId)) {
      mp.set(dyingActorId, 'isDead', false);
      mp.set(dyingActorId, 'canRespawn', true);
      downedPlayers.delete(dyingActorId);
    }
  }, 300000); // 5 minutes
};

export const healerRevives = (playerId: number) => {
  mp.set(playerId, 'isDead', false);
  mp.set(playerId, 'canRespawn', true);
  downedPlayers.delete(playerId);
};
```

<a id="example-3-papyrus-side-implementation"></a>

### Пример 3: реализация Papyrus

Для Papyrus-скриптов, которым нужно читать/писать `canRespawn`:

```papyrus
; In your custom healing spell/power
Function RevivePlayer(Actor akTarget)
  ; Enable respawn
  mp_set(akTarget, "canRespawn", true)

  ; Resurrect
  mp_set(akTarget, "isDead", false)

  ; Optional: Restore health
  akTarget.RestoreActorValue("Health", 100)
EndFunction

; In your death handler
Function HandlePlayerDeath(Actor akPlayer)
  ; Disable auto-respawn
  mp_set(akPlayer, "canRespawn", false)

  ; Wait for healer to revive (or timeout)
  Utility.Wait(300.0)  ; 5 minute timeout

  ; Auto-revive if still downed
  if mp_get(akPlayer, "isDead") as bool
    mp_set(akPlayer, "canRespawn", true)
    mp_set(akPlayer, "isDead", false)
  endif
EndFunction
```

<a id="api-reference"></a>

## Справочник API

<a id="property-canrespawn"></a>

### Свойство `canRespawn`

**Тип:** `boolean`  
**По умолчанию:** `true`  
**Хранение:** В ChangeForm актёра

**Чтение:**

```typescript
const canRespawn = mp.get(actorId, 'canRespawn');
```

**Запись:**

```typescript
mp.set(actorId, 'canRespawn', false); // Disable auto-respawn
mp.set(actorId, 'canRespawn', true); // Enable auto-respawn
```

<a id="related-properties"></a>

### Связанные свойства

- **`isDead`** — `false` воскрешает мёртвого актёра.
- **`spawnDelay`** — задержка возрождения в секундах, по умолчанию 25.
- **`spawnPoint`** — место возрождения.

<a id="implementation-steps"></a>

## Этапы реализации

Для системы лекаря:

<a id="1-disable-respawn-on-death"></a>

### 1. Отключить возрождение при смерти

```typescript
export const onDeath = (dyingActorId: number, killerId: number) => {
  mp.set(dyingActorId, 'canRespawn', false);
};
```

<a id="2-create-healer-powerspell"></a>

### 2. Создать способность/заклинание лекаря

```typescript
export const castHealerRevival = (healerId: number, targetId: number) => {
  const healer = mp.getFormById(healerId);
  const target = mp.getFormById(targetId);

  if (!healer || !target) return;

  // Check distance, PvP restrictions, etc.
  const dx = target.pos[0] - healer.pos[0];
  const dy = target.pos[1] - healer.pos[1];
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > 20) {
    // 20 unit range
    console.log('Too far away to revive');
    return;
  }

  // Revive
  mp.set(targetId, 'isDead', false);
  mp.set(targetId, 'canRespawn', true);
};
```

<a id="3-optional-add-revival-restrictions"></a>

### 3. Необязательные ограничения

- Проверять профессию, например членство в гильдии лекарей.
- Проверять время восстановления.
- Требовать особые предметы: травы, зелья.
- Ограничивать воскрешение в PvP-зонах.

<a id="behavior-notes"></a>

## Поведение

1. **Первая смерть:** новые актёры имеют `canRespawn: true`.
2. **Хранение:** состояние сохраняется и восстанавливается с актёром.
3. **Применение:** изменение влияет на будущие смерти, не на текущий таймер.
4. **Воскрешение:** используйте `mp.set(actorId, "isDead", false)`.
5. **Здоровье:** по умолчанию после воскрешения 0 %. Задайте явно:
   ```typescript
   mp.set(actorId, 'percentages', { health: 0.25, magicka: 1.0, stamina: 1.0 });
   ```

<a id="backward-compatibility"></a>

## Обратная совместимость

- Существующие серверы: стандарт `true` сохраняет прежнее поведение.
- Нет несовместимых изменений API.
- Работает с `spawnDelay` и `spawnPoint`.

<a id="testing"></a>

## Тестирование

Для проверки системы:

```typescript
// Simulate player death without respawn
mp.set(playerId, 'isDead', true);
mp.set(playerId, 'canRespawn', false);

// Verify canRespawn is disabled
console.assert(mp.get(playerId, 'canRespawn') === false);

// Revive
mp.set(playerId, 'isDead', false);
mp.set(playerId, 'canRespawn', true);

// Verify player is alive and respawn enabled
console.assert(mp.get(playerId, 'isDead') === false);
console.assert(mp.get(playerId, 'canRespawn') === true);
```

<a id="performance-impact"></a>

## Влияние на производительность

- **Минимально:** одна логическая проверка в обработчике смерти.
- **Без дополнительной памяти:** используется существующая ChangeForm.
- **Без сетевых затрат:** свойство привязано локально на сервере.

<a id="see-also"></a>

## См. также

- [docs_server_configuration_reference.md](docs_server_configuration_reference.md) — настройки появления
- [docs_serverside_scripting_reference.md](docs_serverside_scripting_reference.md) — mp.set/mp.get
- [healer-revival-system.ts](../../../../skymp5-server/ts/examples/healer-revival-system.ts) — полный пример
