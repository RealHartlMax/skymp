[Deutsch](sp-magic-api.md) · [English](../../../../en/docs/release/dev/sp-magic-api.md) · [Русский](../../../../ru/docs/release/dev/sp-magic-api.md)

<a id="added-api-for-magic-functions"></a>

## API für Magiefunktionen ergänzt

<a id="spell-casting-and-interrupting"></a>

### Zauber wirken und unterbrechen

```ts
function castSpellImmediate(
  actorCasterFormId: number,
  castingSource: SpellType,
  formIdSpell: number,
  formIdTarget: number,
  animationVariables: ActorAnimationVariables,
): void;

function interruptCast(
  actorCasterFormId: number,
  castingSource: SpellType,
  animationVariables: ActorAnimationVariables,
): void;
```

<a id="handling-animation-variables"></a>

### Animationsvariablen behandeln

```ts
function getAnimationVariablesFromActor(
  actorFormId: number,
): ActorAnimationVariables;
function applyAnimationVariablesToActor(
  actorFormId: number,
  animationVariables: ActorAnimationVariables,
): boolean;
```

<a id="spellcast-event-handling-improvments"></a>

### Verbesserte Verarbeitung des Ereignisses SpellCast

- `RE::TESSpellCastEvent` löst und verarbeitet `spellCast` jetzt zuverlässig, unabhängig davon, ob im Slot des Zaubers ein `MagicCaster` vorhanden ist.
