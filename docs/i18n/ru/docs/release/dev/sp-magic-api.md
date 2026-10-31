[Deutsch](../../../../de/docs/release/dev/sp-magic-api.md) · [English](../../../../en/docs/release/dev/sp-magic-api.md) · [Русский](sp-magic-api.md)

<a id="added-api-for-magic-functions"></a>

## Добавлено API магических функций

<a id="spell-casting-and-interrupting"></a>

### Применение и прерывание заклинаний

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

### Работа с переменными анимации

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

### Улучшена обработка события SpellCast

- `RE::TESSpellCastEvent` теперь последовательно вызывает и обрабатывает событие `spellCast` независимо от наличия `MagicCaster` в слоте заклинания.
