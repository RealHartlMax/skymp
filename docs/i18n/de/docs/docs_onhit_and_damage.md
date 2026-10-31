[Deutsch](docs_onhit_and_damage.md) · [English](../../en/docs/docs_onhit_and_damage.md) · [Русский](../../ru/docs/docs_onhit_and_damage.md)

<a id="damage-calculation-and-hit-handling"></a>

# Schadensberechnung und Trefferverarbeitung

Bei einem lokalen Trefferereignis sendet der Client ein OnHit-Paket an den Server.

Es enthält folgende Felder:

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

## Schadensformel

Die Schnittstelle
[`IDamageFormula`](https://github.com/skyrim-multiplayer/skymp/blob/main/skymp5-server/cpp/server_guest_lib/formulas/IDamageFormula.h)
ermöglicht die Schadensberechnung anhand von Angreifer, Ziel und Trefferdaten.

Standardmäßig wird die Schadensformel von Vanilla-Skyrim verwendet (noch nicht vollständig implementiert, siehe unten):
[`TES5DamageFormula`](https://github.com/skyrim-multiplayer/skymp/blob/main/skymp5-server/cpp/server_guest_lib/formulas/TES5DamageFormula.cpp).
Die abstrakte Formel erlaubt eigenen Serverimplementierungen einen einfachen Austausch.

<a id="implemented-formula-components"></a>

### Implementierte Bestandteile

Derzeit konzentriert sich `TES5DamageFormula` auf die Kernfaktoren und bildet nicht jede Vanilla-Mechanik ab. Falls etwas fehlt und noch kein Issue existiert, erstelle eines. Mit C++-Kenntnissen freuen wir uns auch über [Beiträge](https://github.com/skyrim-multiplayer/skymp/blob/main/CONTRIBUTING.md)!

Eingehender Schaden:

```
incomingDamage = isUnarmed ? raceUnarmedDamage : baseWeaponDamage;
```

Schadensreduktion durch Rüstung:

```
armorRating = armorRating1 + armorRating2 + armorRating3 + ... + armorRatingN + magicArmorRating;
//fMaxArmorRating is [GMST:00037DEB], fArmorScalingFactor is [GMST:00021A72];
//fMaxArmorRating = 80 by default, fArmorScalingFactor = 0.12 by default
//magicArmorRating is sum of magnitudes of armors' enchantments with magic effect of damage resist
receivedDamage = incomingDamage * 0.01 * (100 - std::min(armorRating * fArmorScalingFactor, fMaxArmorRating));
```
