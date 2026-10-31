[Deutsch](docs_respawn_control_system.md) · [English](../../en/docs/docs_respawn_control_system.md) · [Русский](../../ru/docs/docs_respawn_control_system.md)

<a id="custom-respawn-control-system"></a>

# Eigene Respawn-Steuerung

<a id="overview"></a>

## Überblick

Die eigene Respawn-Steuerung ermöglicht Admins und Modentwicklern erweiterte Todesmechaniken, beispielsweise ein Heiler-/Arztsystem: Tote Spieler erscheinen nicht automatisch neu, sondern müssen von anderen wiederbelebt werden.

Grundlage ist die neue Eigenschaft **`canRespawn`**. Sie steuert den automatischen Respawn eines toten Spielers nach der konfigurierten Verzögerung.

<a id="architecture"></a>

## Architektur

<a id="core-components"></a>

### Kernbestandteile

1. **Eigenschaft `canRespawn`** – boolescher Actor-Wert, Standard `true`

   - `true`: Tote Spieler respawnen nach der in `spawnDelay` konfigurierten Verzögerung.
   - `false`: Tote Spieler bleiben tot, bis `isDead` sie manuell wiederbelebt.

2. **Eigenschaftsbinding** – Zugriff über `mp.set()`/`mp.get()` aus TypeScript/Gamemode

   ```typescript
   mp.set(actorId, 'canRespawn', false); // Disable auto-respawn
   mp.get(actorId, 'canRespawn'); // Check if respawn enabled
   ```

3. **Todesereignisprüfung** – angepasstes `DeathEvent.OnFireSuccess()` in C++
   - Prüft `actor->GetCanRespawn()` vor `RespawnWithDelay()`.
   - Bei `canRespawn == false` wird kein Respawn-Timer gestartet.

<a id="implementation-details"></a>

### Implementierungsdetails

**Datei: `DeathEvent.cpp`**

```cpp
void DeathEvent::OnFireSuccess(WorldState*)
{
  if (actor && actor->GetCanRespawn()) {
    actor->RespawnWithDelay();
  }
};
```

**Datei: `MpChangeForms.h`**

```cpp
bool canRespawn = true;  // Persisted in ChangeForm
```

**Datei: `CanRespawnBinding.h/cpp`**

- Binding stellt `canRespawn` über `mp.set()`/`mp.get()` für TypeScript bereit.
- Registrierung in `PropertyBindingFactory::CreateStandardPropertyBindings()`.

<a id="usage-examples"></a>

## Anwendungsbeispiele

<a id="example-1-basic-healer-revival-typescript-gamemode"></a>

### Beispiel 1: Einfache Heiler-Wiederbelebung im TypeScript-Gamemode

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

### Beispiel 2: Verzögerte Wiederbelebung mit Timeout

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

### Beispiel 3: Papyrus-Implementierung

Für Papyrus-Skripte, die `canRespawn` lesen/schreiben müssen:

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

## API-Referenz

<a id="property-canrespawn"></a>

### Eigenschaft `canRespawn`

**Typ:** `boolean`  
**Standard:** `true`  
**Persistenz:** In der ChangeForm des Actors gespeichert

**Lesen:**

```typescript
const canRespawn = mp.get(actorId, 'canRespawn');
```

**Schreiben:**

```typescript
mp.set(actorId, 'canRespawn', false); // Disable auto-respawn
mp.set(actorId, 'canRespawn', true); // Enable auto-respawn
```

<a id="related-properties"></a>

### Verwandte Eigenschaften

- **`isDead`** – auf `false` setzen, um einen toten Actor wiederzubeleben.
- **`spawnDelay`** – Respawn-Verzögerung in Sekunden, Standard 25.
- **`spawnPoint`** – Respawn-Ort.

<a id="implementation-steps"></a>

## Implementierungsschritte

Für ein Heiler-Wiederbelebungssystem:

<a id="1-disable-respawn-on-death"></a>

### 1. Respawn beim Tod deaktivieren

```typescript
export const onDeath = (dyingActorId: number, killerId: number) => {
  mp.set(dyingActorId, 'canRespawn', false);
};
```

<a id="2-create-healer-powerspell"></a>

### 2. Heilerfähigkeit oder -zauber erstellen

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

### 3. Optionale Wiederbelebungsbeschränkungen

- Heilerberuf prüfen, beispielsweise Mitgliedschaft in der Heilergilde.
- Abklingzeiten prüfen.
- Besondere Gegenstände verlangen, etwa Heilkräuter oder Tränke.
- Wiederbelebung in PvP-Zonen einschränken.

<a id="behavior-notes"></a>

## Verhalten

1. **Erster Tod:** Neue Actors haben standardmäßig `canRespawn: true`.
2. **Persistenz:** `canRespawn` wird mit dem Actor gespeichert und geladen.
3. **Wirksamkeit:** Änderungen betreffen zukünftige Todesfälle, nicht den aktuellen Todestimer.
4. **Wiederbelebung:** Verwende `mp.set(actorId, "isDead", false)`.
5. **Gesundheit:** Wiederbelebte Actors haben standardmäßig 0 % Gesundheit. Setze sie ausdrücklich:
   ```typescript
   mp.set(actorId, 'percentages', { health: 0.25, magicka: 1.0, stamina: 1.0 });
   ```

<a id="backward-compatibility"></a>

## Abwärtskompatibilität

- Bestehende Server: Standard `true`, bisheriger Respawn bleibt erhalten.
- Keine inkompatiblen API-Änderungen.
- Funktioniert neben `spawnDelay` und `spawnPoint`.

<a id="testing"></a>

## Tests

So wird das System getestet:

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

## Leistungsauswirkung

- **Minimal:** Eine zusätzliche boolesche Prüfung im Todeshandler.
- **Kein zusätzlicher Speicher:** Bestehende ChangeForm-Struktur wird verwendet.
- **Kein Netzwerkmehraufwand:** Eigenschaft lokal am Server gebunden.

<a id="see-also"></a>

## Siehe auch

- [docs_server_configuration_reference.md](docs_server_configuration_reference.md) – Spawneinstellungen
- [docs_serverside_scripting_reference.md](docs_serverside_scripting_reference.md) – mp.set/mp.get
- [healer-revival-system.ts](../../../../skymp5-server/ts/examples/healer-revival-system.ts) – vollständiges Beispiel
