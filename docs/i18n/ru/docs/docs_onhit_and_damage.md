[Deutsch](../../de/docs/docs_onhit_and_damage.md) · [English](../../en/docs/docs_onhit_and_damage.md) · [Русский](docs_onhit_and_damage.md)

<a id="damage-calculation-and-hit-handling"></a>

# Расчёт урона и обработка попаданий

При локальном попадании клиент отправляет серверу пакет OnHit.

Он содержит следующие поля:

```c++
uint32_t aggressor = 0; // originating actor
bool isBashAttack = false;
bool isHitBlocked = false;
bool isPowerAttack = false;
bool isSneakAttack = false;
uint32_t projectile = 0;
uint32_t source = 0; // formId of weapon (or of bare hands)
uint32_t target = 0; // target actor
```

<a id="damage-formula"></a>

## Формула урона

Интерфейс
[`IDamageFormula`](https://github.com/skyrim-multiplayer/skymp/blob/main/skymp5-server/cpp/server_guest_lib/formulas/IDamageFormula.h)
позволяет рассчитывать урон по атакующему, цели и данным попадания.

По умолчанию используется формула обычного Skyrim (пока реализована не полностью, см. ниже):
[`TES5DamageFormula`](https://github.com/skyrim-multiplayer/skymp/blob/main/skymp5-server/cpp/server_guest_lib/formulas/TES5DamageFormula.cpp).
Абстрактный интерфейс позволяет собственным серверным реализациям легко заменить формулу.

<a id="implemented-formula-components"></a>

### Реализованные компоненты

Сейчас `TES5DamageFormula` учитывает основные факторы и не моделирует каждую механику оригинала. Если чего-то не хватает и задачи ещё нет, создайте её. Если знаете C++, будем рады [вашим изменениям](https://github.com/skyrim-multiplayer/skymp/blob/main/CONTRIBUTING.md)!

Входящий урон:

```
incomingDamage = isUnarmed ? raceUnarmedDamage : baseWeaponDamage;
```

Уменьшение урона бронёй:

```
armorRating = armorRating1 + armorRating2 + armorRating3 + ... + armorRatingN + magicArmorRating;
//fMaxArmorRating is [GMST:00037DEB], fArmorScalingFactor is [GMST:00021A72];
//fMaxArmorRating = 80 by default, fArmorScalingFactor = 0.12 by default
//magicArmorRating is sum of magnitudes of armors' enchantments with magic effect of damage resist
receivedDamage = incomingDamage * 0.01 * (100 - std::min(armorRating * fArmorScalingFactor, fMaxArmorRating));
```
