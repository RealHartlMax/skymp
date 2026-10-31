[Deutsch](docs_properties_system.md) · [English](../../en/docs/docs_properties_system.md) · [Русский](../../ru/docs/docs_properties_system.md)

<a id="properties-system"></a>

# Eigenschaftensystem

Diese Seite enthält allgemeine Informationen zum Eigenschaftensystem der API.

<a id="built-in-properties-list"></a>

## Eingebaute Eigenschaften

Einige Eigenschaften sind eingebaut und werden vom skymp-Server selbst statt durch Skripte definiert. Du kannst sie wie eigene Eigenschaften mit `mp.get`/`mp.set` verwenden.

<a id="modifiable-properties"></a>

### Änderbare Eigenschaften

Diese Eigenschaften lassen sich durch Skripte mit `mp.set` ändern.

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

Das Objekt `actorValues` unterstützt folgende numerische Felder:

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

### Schreibgeschützte Eigenschaften

Diese Eigenschaften können durch Skripte NICHT mit `mp.set` geändert werden.

- type (`"MpActor"/"MpObjectReference"`)
- baseDesc (`"12eb7:Skyrim.esm"`)
- formDesc (`"0"`, `"1"`, `"14:Skyrim.esm"`)
- equipment
- isOnline
- neighbors ([0xff000000, 0xff000001, ...])

<a id="migration-from-percentages-to-actorvalues"></a>

## Migration von `percentages` zu `actorValues`

Die ältere Eigenschaft `percentages` (`mp.set(id, 'percentages', { health, magicka, stamina })`) setzt die *Verhältnisse aktuell/maximal* der drei Hauptattribute und bleibt dafür gültig.

Wenn du auch **Basiswerte** (maximale Gesundheit, Magicka, Ausdauer) oder Regenerationsraten/-multiplikatoren ändern musst, verwende stattdessen `actorValues`:

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

Beides lässt sich kombinieren: Setze mit `actorValues` die Basismaxima und mit `percentages` den aktuellen Anteil des jeweiligen Maximums.

<a id="related-docs"></a>

## Weitere Dokumentation

- Details zu Wiederbelebung und Respawn stehen unter [Respawn-Steuerung](docs_respawn_control_system.md).
