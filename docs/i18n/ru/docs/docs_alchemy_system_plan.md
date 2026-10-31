[Deutsch](../../de/docs/docs_alchemy_system_plan.md) · [English](../../en/docs/docs_alchemy_system_plan.md) · [Русский](docs_alchemy_system_plan.md)

<a id="server-side-alchemy-system-implementation-plan"></a>

# План серверной системы алхимии

> План/исследование, проверено 22 октября 2026 года. Предложения и примеры внешних fork не означают реализацию в этом checkout. Подтверждённое выполнение см. в [статусе проекта](docs_project_status.md) и основной дорожной карте.

<a id="goal"></a>

## Цель

Реализовать готовую к эксплуатации алхимию, в которой игроки могут:

1. Сочетать ингредиенты на алхимических столах.
2. Динамически создавать зелья/яды по сочетаниям эффектов.
3. Постоянно хранить изученные эффекты каждого игрока.
4. Проверять и выполнять всю логику изготовления авторитетно на сервере.

Система должна противостоять подделкам клиента и соответствовать алхимии обычного Skyrim.

<a id="current-baseline"></a>

## Текущая основа

- **Ингредиенты**: записи `INGR` загружаются из ESM/ESP через `libespm`.
- **Чтение эффектов**: `INGR::Data` включает `effects` (вектор `Effects::Effect`).
- **Зелья**: `ALCH::Data` включает `effects`, `weight`, `isFood`, `isPoison`.
- **Изучение эффектов** (TypeScript): `effectsLearningSystem.ts` хранит изученные эффекты игрока в `private.learnedIngredientEffects`.
- **Употребление**: при употреблении зелья/ингредиента через `OnEquip` вызывается `EatItemEvent` и применяются магические эффекты.
- **Craft Service** (кузнечное дело): `CraftService` проверяет рецепты `COBJ`, удаляет входные предметы и добавляет результат.
- **Papyrus API**: есть базовые запросы, например `IsFood`, но полный интерфейс зелья не завершён.
- **Навыки**: алхимия есть в параметрах актёра (`espm::ActorValue::Alchemy`), но никогда не повышается.

<a id="scope"></a>

## Объём

<a id="in-scope-phase-1"></a>

### Входит (этап 1)

- Реализовать `AlchemyService` по архитектуре `CraftService`.
- Принимать запросы изготовления (ингредиенты + FormID зелья/яда).
- Определять пересечение изученных/доступных эффектов на сервере.
- Расходовать ингредиенты и создавать зелья.
- Повышать навык после успеха.
- Синхронизировать зелье с инвентарём.
- Вызывать `OnAlchemyItemCrafted` или общий `OnCraft`.

<a id="out-of-scope-future-phases"></a>

### Не входит (будущие этапы)

- Система перков (Alchemist, Physician, Concentrated Poison и другие).
- Масштабирование силы по навыку/перкам.
- Динамические стоимость/вес.
- Изучение эффектов при поедании ингредиентов.
- UI/клиентское алхимическое меню.
- Кривые повышения уровня алхимии.

<a id="architecture"></a>

## Архитектура

<a id="data-model"></a>

### Модель данных

<a id="per-player-alchemy-state"></a>

#### Алхимическое состояние игрока

Хранение через `mp.set(actorId, ...)`:

```typescript
private.learnedIngredientEffects: {
  [ingredientFormId: number]: number[] // indices of effects learned
}
```

Пример:
```json
{
  "0x3AD66": [0, 1],      // Blue Mountain Flower: effects 0 and 1 are known
  "0x06ABCB": [0]         // Salt Pile: only effect 0 is known
}
```

<a id="alchemy-craft-request"></a>

#### Запрос изготовления

Клиент отправляет custom packet или событие игры при попытке изготовления на столе:

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

### Серверные компоненты (C++)

<a id="1-alchemyservice-class"></a>

#### 1. Класс `AlchemyService`

Структура подобна `CraftService`:

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

#### 2. Определение стола

Алхимические столы отмечены специальными ключевыми словами в ESM/ESP:

```cpp
// In libespm or static constants
constexpr uint32_t kAlchemyKeywordId = 0x0010BB3D; // "AlchemyWorkbenchKeyword"
// or list of workbench base form IDs
```

Определение через:
- ключевые слова Furniture/Activator;
- либо явный список FormID, как `ArmorTable`/`SharpeningWheel` в `CraftService`.

<a id="3-effect-matching-logic"></a>

#### 3. Сопоставление эффектов

**Правило обычной алхимии**: зелье можно изготовить, если:
- Все эффекты являются **подмножеством** доступных эффектов ингредиентов.
- ИЛИ изученный эффект ингредиента доступен, даже если остальные неизвестны.

Пример:
- Ингредиент A: [Восстановить здоровье, Восстановить магию]
- Ингредиент B: [Восстановить здоровье, Повредить выносливость]
- Пересечение: [Восстановить здоровье]
- Игрок может создать зелья **только** с восстановлением здоровья.

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

### Серверная проверка

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

### События

Повторно использовать `CraftEvent` или создать новое:

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

Papyrus-скрипт может перехватить:
```papyrus
Event OnAlchemyCraft(Actor akActor, Form akPotion, Form[] akIngredients)
  ; Custom logic: teleport, logging, quest progression, etc.
EndEvent
```

<a id="papyrus-api-papyruspotion-completion"></a>

### Papyrus API (завершение `PapyrusPotion`)

Добавить недостающие методы `PapyrusPotion`:

```cpp
VarValue PapyrusPotion::IsPoison(VarValue self, ...);
VarValue PapyrusPotion::GetNumEffects(VarValue self, ...);
VarValue PapyrusPotion::GetNthEffectMagnitude(VarValue self, ...);
VarValue PapyrusPotion::GetNthEffectDuration(VarValue self, ...);
VarValue PapyrusPotion::GetNthEffectArea(VarValue self, ...);
VarValue PapyrusPotion::GetNthMagicEffect(VarValue self, ...);
```

Они оборачивают доступ к полям `ALCH::GetData(cache)`.

<a id="ingredient-effect-discovery-out-of-scope---phase-2"></a>

### Изучение ингредиентов (вне объёма, этап 2)

При употреблении ингредиента (`OnEquip` для INGR):

1. Первый эффект раскрывается всегда.
2. Остальные — при достаточном навыке или подходящих перках.
3. Обновить `private.learnedIngredientEffects`.
4. Отправить обновление клиенту для UI.

Сейчас частично реализовано, но применение эффектов закомментировано в `EatItemEvent.cpp`, строка 39.

<a id="client-server-communication"></a>

## Связь клиента и сервера

<a id="packet-structure-typescript"></a>

### Структура пакета (TypeScript)

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

Клиент определяет взаимодействие со столом и отправляет `mp.SendMessage(...)`.

<a id="security-rules-must-have"></a>

## Обязательные правила безопасности

1. **Стол**: проверить существование `workbenchRefId` и алхимическое ключевое слово базовой формы.
2. **Инвентарь**: до удаления проверить все ингредиенты и количества.
3. **Эффекты**: допустимое подмножество изученных/доступных эффектов ESM/ESP.
4. **Авторитет сервера**: не доверять вычисленным клиентом эффектам и ID результата; пересчитать на сервере.
5. **Навык**: повышать только после успеха через стандартный `RestoreActorValue`.
6. **Ключевые тесты**:
   - Неверный FormID зелья отклонён.
   - Нехватка одного ингредиента запрещает изготовление.
   - При неудаче инвентарь неизменен.
   - При успехе ингредиенты удаляются правильно.
   - Прогресс навыка соответствует формуле оригинала.

<a id="implementation-phases"></a>

## Этапы реализации

<a id="phase-1-core-alchemy-service"></a>

### Этап 1: основной сервис

1. Создать `AlchemyService` в `skymp5-server/cpp/server_guest_lib/`.
2. Определять столы по ключевым словам FURN/ACTI.
3. Реализовать `ComputeAvailableEffects()` из изученных эффектов и INGR.
4. Реализовать `DoEffectsMatch()`.
5. Подключить `ActionListener::OnAlchemyCraft()`.
6. Написать тесты по примеру `CraftTest.cpp`.
7. Вызывать `OnCraft` или новый `OnAlchemyCraft`.

<a id="phase-2-skill-advancement--ux"></a>

### Этап 2: навык и UX

1. Завершить API `PapyrusPotion`.
2. Реализовать формулу роста навыка, подобную оригиналу.
3. Добавить изучение эффектов при еде.
4. Интегрировать клиентское меню, если предусмотрено.

<a id="phase-3-perks--balance"></a>

### Этап 3: перки и баланс

1. Разбирать записи перков и применять модификаторы.
2. Масштабировать силу по алхимии.
3. Вычислять стоимость/вес.

<a id="testing-strategy"></a>

## Стратегия тестирования

Создать `AlchemyTest.cpp` по примеру `CraftTest.cpp`:

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

## Открытые вопросы

1. **Меню**: SpSnippet для обычного алхимического меню или собственный UI?
   - Рекомендация: SpSnippet к нативному меню, затем перехват слушателем gamemode.

2. **Количество**: можно ли использовать 2× Синий горноцвет?
   - Рекомендация: разрешить повторы, проверяя общее число по рецепту ESM.

3. **Хранение**: зелья создаются динамически при изготовлении.
   - Рекомендация: использовать существующий пул статических ALCH FormID, например 0x3CEAD для "Potion of Healing".
   - Для собственных зелий — схема имён, например "SKYMP_AlchemyPotion_<hash>".

4. **Постоянство**: отличаются ли созданные зелья от базовых?
   - Рекомендация: как в оригинале — все "Potion of Healing" FormID 0x3CEAD одинаковы; отличаются только эффекты.

5. **Рост навыка**: сколько за изготовление?
   - Рекомендация: по сложности зелья (число эффектов, величина).

<a id="references"></a>

## Источники

- [Skyrim UESP: Alchemy](https://en.uesp.net/wiki/Skyrim:Alchemy)
- [Алгоритм обычных рецептов](https://en.uesp.net/wiki/Skyrim:Alchemy#Recipe_Constraints)
- Существующие: `CraftService.cpp`, `EatItemEvent.cpp`, `effectsLearningSystem.ts`
- libespm: `INGR.h`, `ALCH.h`, `Effects.h`
