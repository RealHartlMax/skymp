[Deutsch](docs_alchemy_system_plan.md) · [English](../../en/docs/docs_alchemy_system_plan.md) · [Русский](../../ru/docs/docs_alchemy_system_plan.md)

<a id="server-side-alchemy-system-implementation-plan"></a>

# Implementierungsplan: serverseitiges Alchemiesystem

> Planungs-/Rechercheunterlage, geprüft am 22. Oktober 2026. Vorschläge und Beispiele externer Forks sind nicht automatisch in diesem Checkout implementiert. Bestätigte Fertigstellung steht im [aktuellen Projektstatus](docs_project_status.md) und der Haupt-Roadmap.

<a id="goal"></a>

## Ziel

Ein produktionsreifes Alchemie-Handwerkssystem, in dem Spieler:

1. Zutaten an Alchemiewerkbänken kombinieren.
2. Tränke/Gifte dynamisch aus kombinierten Zutateneffekten erzeugen.
3. Erlernte Zutateneffekte pro Spieler dauerhaft speichern.
4. Die gesamte Herstellung serverautoritativ prüfen und ausführen lassen.

Das System muss Manipulationen des Clients abwehren und die Alchemiemechanik von Vanilla-Skyrim abbilden.

<a id="current-baseline"></a>

## Aktuelle Grundlage

- **Grundlegende Zutatenunterstützung**: `INGR`-Datensätze werden über `libespm` aus ESM/ESP geladen.
- **Effekte auslesen**: `INGR::Data` enthält `effects` (Vektor von `Effects::Effect`).
- **Trankdatenstruktur**: `ALCH::Data` enthält `effects`, `weight`, `isFood`, `isPoison`.
- **Effektlernen** (TypeScript): `effectsLearningSystem.ts` verfolgt erlernte Zutateneffekte pro Spieler in `private.learnedIngredientEffects`.
- **Verbrauch**: Verzehr eines Tranks/einer Zutat über `OnEquip` löst `EatItemEvent` aus und wendet magische Effekte an.
- **Craft Service** (Schmieden): `CraftService` prüft `COBJ`-Rezepte, entfernt Eingaben und fügt das Ergebnis hinzu.
- **Papyrus-API**: Grundlegende Trankabfragen wie `IsFood` existieren; die vollständige Schnittstelle fehlt.
- **Fertigkeiten**: Alchemie existiert in Actor-Werten (`espm::ActorValue::Alchemy`), wird aber nie erhöht.

<a id="scope"></a>

## Umfang

<a id="in-scope-phase-1"></a>

### Enthalten (Phase 1)

- `AlchemyService` nach dem Muster von `CraftService` implementieren.
- Client-Herstellungsanfragen annehmen (Zutaten + Ziel-FormID des Tranks/Gifts).
- Serverseitige Effektschnittmenge: gelernte/verfügbare Effekte.
- Zutaten verbrauchen und Tränke erzeugen.
- Fertigkeit nach erfolgreicher Herstellung erhöhen.
- Ergebnis mit dem Actor-Inventar synchronisieren.
- Ereignis auslösen (`OnAlchemyItemCrafted` oder generisches `OnCraft`).

<a id="out-of-scope-future-phases"></a>

### Nicht enthalten (spätere Phasen)

- Perks wie Alchemist, Physician oder Concentrated Poison.
- Wirkungsstärke abhängig von Fertigkeit/Perks.
- Dynamische Berechnung von Wert und Gewicht.
- Effektentdeckung durch Zutatenverzehr.
- UI-/Clientlogik des Alchemiemenüs (clientgesteuert).
- Fortschrittskurven für Alchemiestufen.

<a id="architecture"></a>

## Architektur

<a id="data-model"></a>

### Datenmodell

<a id="per-player-alchemy-state"></a>

#### Alchemiezustand pro Spieler

Speicherung mit `mp.set(actorId, ...)`:

```typescript
private.learnedIngredientEffects: {
  [ingredientFormId: number]: number[] // indices of effects learned
}
```

Beispiel:
```json
{
  "0x3AD66": [0, 1],      // Blue Mountain Flower: effects 0 and 1 are known
  "0x06ABCB": [0]         // Salt Pile: only effect 0 is known
}
```

<a id="alchemy-craft-request"></a>

#### Herstellungsanfrage

Der Client sendet bei einem Herstellungsversuch an der Werkbank ein eigenes Paket oder Spielereignis:

```cpp
struct AlchemyCraftRequest {
  uint32_t actorId;           // Actor performing craft
  uint32_t workbenchRefId;    // Reference ID of alchemy workbench
  uint32_t resultPotionFormId; // The potion/poison FormID to create (must exist in ESM/ESP)
  std::vector<uint32_t> ingredientFormIds; // Ingredient FormIDs used (with counts)
  // or:
  Inventory inputItems;       // Full inventory entry list of inputs
};
```

<a id="server-components-c"></a>

### Serverkomponenten (C++)

<a id="1-alchemyservice-class"></a>

#### 1. Klasse `AlchemyService`

Struktur ähnlich `CraftService`:

```cpp
class AlchemyService {
public:
  explicit AlchemyService(PartOne& partOne_);
  
  // Main craft entry point from action listener
  void OnAlchemyCraft(const RawMessageData& rawMsgData,
                      const Inventory& inputItems,
                      uint32_t workbenchRefId,
                      uint32_t resultPotionFormId);

private:
  PartOne& partOne;
  std::vector<espm::LookupResult> allIngredients; // cached
  
  // Validate workbench is actually an alchemy station
  bool IsValidAlchemyWorkbench(uint32_t baseId) const;
  
  // Check if player has access to workbench (location, faction, quest)
  bool CanUseWorkbench(MpActor* actor, uint32_t workbenchRefId) const;
  
  // Get all effects from ingredients that player has learned/has access to
  std::vector<espm::Effects::Effect> ComputeAvailableEffects(
    MpActor* actor,
    const std::vector<uint32_t>& ingredientFormIds,
    bool knownEffectsOnly = true // true = player must have discovered it
  ) const;
  
  // Get effects from the target potion FormID
  std::vector<espm::Effects::Effect> GetPotionEffects(
    uint32_t potionFormId
  ) const;
  
  // Check if crafted potion matches expected effects
  bool DoEffectsMatch(
    const std::vector<espm::Effects::Effect>& availableFromIngredients,
    const std::vector<espm::Effects::Effect>& expectedFromPotion
  ) const;
  
  // Apply skill advancement for alchemy
  void AdvanceAlchemySkill(MpActor* actor, float skillGain);
};
```

<a id="2-workbench-detection"></a>

#### 2. Werkbankerkennung

Alchemiewerkbänke sind in ESM/ESP über bestimmte Schlüsselwörter markiert:

```cpp
// In libespm or static constants
constexpr uint32_t kAlchemyKeywordId = 0x0010BB3D; // "AlchemyWorkbenchKeyword"
// or list of workbench base form IDs
```

Erkennung über:
- Schlüsselwörter von Furniture/Activator
- Oder ausdrückliche FormID-Liste, ähnlich `ArmorTable`/`SharpeningWheel` in `CraftService`

<a id="3-effect-matching-logic"></a>

#### 3. Effektabgleich

**Vanilla-Alchemieregel**: Ein Trank kann hergestellt werden, wenn:
- Alle Effekte eine **Teilmenge** der verfügbaren Zutateneffekte sind.
- ODER ein erlernter Effekt dieser Zutat verfügbar ist, selbst wenn andere Effekte unbekannt sind.

Beispiel:
- Zutat A: [Gesundheit wiederherstellen, Magicka wiederherstellen]
- Zutat B: [Gesundheit wiederherstellen, Ausdauer schädigen]
- Schnittmenge: [Gesundheit wiederherstellen]
- Der Spieler kann Tränke mit **ausschließlich** Gesundheit wiederherstellen erzeugen.

```cpp
bool AlchemyService::DoEffectsMatch(...) {
  // Simplified: check if all expected potion effects 
  // are present in available ingredient effects
  for (const auto& expectedEffect : expectedFromPotion) {
    bool found = false;
    for (const auto& availableEffect : availableFromIngredients) {
      if (availableEffect.effectId == expectedEffect.effectId) {
        found = true;
        break;
      }
    }
    if (!found) return false; // Effect not available
  }
  return true;
}
```

<a id="server-side-validation-flow"></a>

### Serverseitiger Prüfablauf

```
1. Client sends AlchemyCraftRequest
   └─> ActionListener::OnAlchemyCraft() receives it
       
2. AlchemyService::OnAlchemyCraft():
   a) Validate workbench exists and is alchemy type
   b) Validate player has all ingredients in inventory
   c) Get learned effects from `private.learnedIngredientEffects`
   d) Compute available effects from those ingredients
   e) Get effects from target potion FormID
   f) Validate effects match (DoEffectsMatch)
   g) If valid:
      - Remove ingredients from inventory (Inventory::RemoveItems)
      - Add potion to inventory (Inventory::AddItem)
      - Fire OnCraft event (reuse CraftEvent or new OnAlchemyItemCrafted)
      - Advance alchemy skill
      - Save actor state
   h) If invalid:
      - Log error
      - Send failure message to client
      - Inventory unchanged
```

<a id="events"></a>

### Ereignisse

Bestehendes `CraftEvent` wiederverwenden oder neu anlegen:

```cpp
class AlchemyCraftEvent : public GamemodeEvent {
public:
  AlchemyCraftEvent(MpActor* actor_, uint32_t potionFormId_,
                    const std::vector<uint32_t>& ingredientFormIds_);
  
  const char* GetName() const override { return "onAlchemyCraft"; }
  
private:
  MpActor* actor;
  uint32_t potionFormId;
  std::vector<uint32_t> ingredientFormIds;
};
```

Ein Papyrus-Skript kann dies abfangen:
```papyrus
Event OnAlchemyCraft(Actor akActor, Form akPotion, Form[] akIngredients)
  ; Custom logic: teleport, logging, quest progression, etc.
EndEvent
```

<a id="papyrus-api-papyruspotion-completion"></a>

### Papyrus-API (`PapyrusPotion` vervollständigen)

Fehlende Methoden in `PapyrusPotion` ergänzen:

```cpp
VarValue PapyrusPotion::IsPoison(VarValue self, ...);
VarValue PapyrusPotion::GetNumEffects(VarValue self, ...);
VarValue PapyrusPotion::GetNthEffectMagnitude(VarValue self, ...);
VarValue PapyrusPotion::GetNthEffectDuration(VarValue self, ...);
VarValue PapyrusPotion::GetNthEffectArea(VarValue self, ...);
VarValue PapyrusPotion::GetNthMagicEffect(VarValue self, ...);
```

Diese kapseln den Zugriff auf `ALCH::GetData(cache)`.

<a id="ingredient-effect-discovery-out-of-scope---phase-2"></a>

### Zutatenentdeckung (nicht enthalten, Phase 2)

Beim Verzehr einer Zutat (`OnEquip` für INGR):

1. Ersten Effekt immer aufdecken.
2. Weitere Effekte nur bei ausreichender Alchemiefertigkeit oder passenden Perks aufdecken.
3. `private.learnedIngredientEffects` aktualisieren.
4. Aktualisierung für UI-Rückmeldung an den Client senden.

Derzeit teilweise implementiert, aber die Effektanwendung in `EatItemEvent.cpp`, Zeile 39, ist auskommentiert.

<a id="client-server-communication"></a>

## Client-Server-Kommunikation

<a id="packet-structure-typescript"></a>

### Paketstruktur (TypeScript)

```typescript
interface AlchemyCraftMessage extends IMessageBase {
  customPacketType: 'alchemyCraft';
  actorId: number;
  workbenchRefId: number;
  resultPotionFormId: number;
  ingredientFormIds: number[]; // or full inventory entries
}

interface AlchemyCraftResultMessage extends IMessageBase {
  customPacketType: 'alchemyCraftResult';
  success: boolean;
  reason?: string; // "invalid-workbench", "missing-effects", etc.
}
```

Der Client erkennt die Alchemiewerkbank und sendet über `mp.SendMessage(...)`.

<a id="security-rules-must-have"></a>

## Verbindliche Sicherheitsregeln

1. **Werkbank**: `workbenchRefId` muss existieren und die Basisform das Alchemieschlüsselwort besitzen.
2. **Inventar**: Vor dem Entfernen alle Zutaten und Mengen prüfen.
3. **Effekte**: Nur gültige Teilmengen erlernter/verfügbarer ESM-/ESP-Effekte zulassen.
4. **Serverautorität**: Clientberechneten Effekten und Ergebnis-IDs nie vertrauen, stets serverseitig neu berechnen.
5. **Fertigkeit**: Nur nach Erfolg über die Standard-API `RestoreActorValue` erhöhen.
6. **Kernprüfungen** in Unit-Tests:
   - Ungültige Trank-FormID wird verweigert.
   - Eine fehlende Zutat verhindert die Herstellung.
   - Bei Fehler bleibt das Inventar unverändert.
   - Bei Erfolg werden Zutaten korrekt entfernt.
   - Fertigkeitsfortschritt entspricht der Vanilla-Formel.

<a id="implementation-phases"></a>

## Implementierungsphasen

<a id="phase-1-core-alchemy-service"></a>

### Phase 1: Alchemie-Kernservice

1. `AlchemyService` unter `skymp5-server/cpp/server_guest_lib/` anlegen.
2. Werkbankerkennung über FURN-/ACTI-Schlüsselwörter implementieren.
3. `ComputeAvailableEffects()` aus erlernten Effekten und INGR-Datensätzen implementieren.
4. `DoEffectsMatch()` prüfen.
5. In `ActionListener::OnAlchemyCraft()` integrieren.
6. Unit-Tests nach `CraftTest.cpp` schreiben.
7. `OnCraft` oder neues `OnAlchemyCraft` auslösen.

<a id="phase-2-skill-advancement--ux"></a>

### Phase 2: Fertigkeitsfortschritt und Bedienung

1. `PapyrusPotion`-API vervollständigen.
2. Fertigkeitsformel ähnlich Vanilla implementieren.
3. Effektentdeckung durch Zutatenverzehr ergänzen.
4. Clientmenü integrieren, sofern Client-UI vorgesehen.

<a id="phase-3-perks--balance"></a>

### Phase 3: Perks und Balance

1. Perk-Datensätze auslesen und Modifikatoren anwenden.
2. Wirkungsstärke nach Alchemiefertigkeit skalieren.
3. Wert und Gewicht berechnen.

<a id="testing-strategy"></a>

## Teststrategie

`AlchemyTest.cpp` nach dem Muster von `CraftTest.cpp` erstellen:

```cpp
TEST_CASE("Player crafts potion with known effects", "[Alchemy]") {
  // Setup: create actor with blue mountain flower + canis root
  // Both have "Restore Health" as first effect
  // Attempt to craft "Healing Potion" which uses "Restore Health"
  // Expect: success, potion added, ingredients removed, skill advanced
}

TEST_CASE("Player crafts invalid potion", "[Alchemy]") {
  // Setup: actor has only Restore Health known from ingredients
  // Attempt to craft "Damage Health" potion
  // Expect: failure, inventory unchanged
}

TEST_CASE("Workbench validation", "[Alchemy]") {
  // Attempt craft at non-alchemy workbench
  // Expect: failure
}
```

<a id="open-questions--tbd"></a>

## Offene Fragen

1. **Clientmenü**: Vanilla-Alchemiemenü über SpSnippet oder eigene UI?
   - Empfehlung: SpSnippet zum nativen Menü, anschließend Gamemode-Ereignislistener.

2. **Zutatenmengen**: Darf ein Spieler zweimal Blaue Bergblume verwenden?
   - Empfehlung: Duplikate erlauben und Gesamtmenge gegen das ESM-Rezept prüfen.

3. **Trankspeicherung**: Ergebnisse werden während der Herstellung erzeugt.
   - Empfehlung: Bestehenden statischen ALCH-FormID-Pool verwenden, etwa 0x3CEAD für "Potion of Healing".
   - Für eigene Tränke ein Namensschema wie "SKYMP_AlchemyPotion_<hash>" anlegen.

4. **Persistenz**: Unterscheiden sich erzeugte Tränke vom Basistrank?
   - Empfehlung: Wie Vanilla – alle "Potion of Healing" mit FormID 0x3CEAD sind identisch; nur Effekte unterscheiden sich.

5. **Alchemiefortschritt**: Wie viel Fertigkeit pro Herstellung?
   - Empfehlung: Nach Komplexität des Tranks (Effektanzahl, Stärke) berechnen.

<a id="references"></a>

## Referenzen

- [Skyrim UESP: Alchemy](https://en.uesp.net/wiki/Skyrim:Alchemy)
- [Vanilla-Rezeptalgorithmus](https://en.uesp.net/wiki/Skyrim:Alchemy#Recipe_Constraints)
- Bestehend: `CraftService.cpp`, `EatItemEvent.cpp`, `effectsLearningSystem.ts`
- libespm: `INGR.h`, `ALCH.h`, `Effects.h`
