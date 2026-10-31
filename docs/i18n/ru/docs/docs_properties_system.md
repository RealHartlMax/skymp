[Deutsch](../../de/docs/docs_properties_system.md) · [English](../../en/docs/docs_properties_system.md) · [Русский](docs_properties_system.md)

<a id="properties-system"></a>

# Система свойств

Здесь приведены общие сведения о системе свойств API.

<a id="built-in-properties-list"></a>

## Встроенные свойства

Часть свойств встроена: их определяет сам сервер skymp, а не скрипты. С ними можно работать через `mp.get`/`mp.set`, как со свойствами, добавленными вашим кодом.

<a id="modifiable-properties"></a>

### Изменяемые свойства

Эти свойства скрипт может менять через `mp.set`.

- pos (`[0,0,0]`)
- angle (`[0,0,0]`)
- worldOrCellDesc (`"3c:Skyrim.esm"`)
- inventory
- appearance
- isOpen
- isDisabled
- isDead
- canRespawn
- actorValues

Объект `actorValues` поддерживает следующие числовые поля:

- health
- magicka
- stamina
- healRate
- magickaRate
- staminaRate
- healRateMult
- magickaRateMult
- staminaRateMult

<a id="readonly-properties"></a>

### Свойства только для чтения

Эти свойства скрипт НЕ может менять через `mp.set`.

- type (`"MpActor"/"MpObjectReference"`)
- baseDesc (`"12eb7:Skyrim.esm"`)
- formDesc (`"0"`, `"1"`, `"14:Skyrim.esm"`)
- equipment
- isOnline
- neighbors ([0xff000000, 0xff000001, ...])

<a id="migration-from-percentages-to-actorvalues"></a>

## Миграция с `percentages` на `actorValues`

Старое свойство `percentages` (`mp.set(id, 'percentages', { health, magicka, stamina })`) задаёт *отношение текущего значения к максимальному* для трёх основных характеристик. Для этой задачи оно остаётся действительным.

Если нужно также менять **базовые значения** (максимум здоровья, магии, выносливости), скорости или множители восстановления, используйте `actorValues`:

```js
// Old: only adjusts current % of health/magicka/stamina
mp.set(actorId, 'percentages', { health: 1.0, magicka: 1.0, stamina: 1.0 });

// New: set absolute base values and rates
mp.set(actorId, 'actorValues', {
  health: 250,
  magicka: 150,
  stamina: 200,
  healRateMult: 150,
});
```

Можно сочетать оба подхода: `actorValues` задаёт базовые максимумы, затем `percentages` — текущую долю от максимума.

<a id="related-docs"></a>

## Связанные документы

- Подробности воскрешения и возрождения: [Система управления возрождением](docs_respawn_control_system.md).
