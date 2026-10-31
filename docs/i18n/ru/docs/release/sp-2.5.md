[Deutsch](../../../de/docs/release/sp-2.5.md) · [English](../../../en/docs/release/sp-2.5.md) · [Русский](sp-2.5.md)

<a id="sp-250-release-notes"></a>

# SP 2.5.0 Примечания к выпуску

В документе перечислены изменения после SP 2.4.0

SP регулярно обновляется. Это обновление, вероятно, не включает ВСЕ необходимые исправления.

Многое ещё предстоит реализовать или исправить. См. [задачи](https://github.com/skyrim-multiplayer/skymp/issues?q=is%3Aopen+is%3Aissue+label%3Aarea%3Askyrim-platform).

Обратите внимание: эта версия SP работает только со старой сборкой SE до обновления от 11.11.21.

Для отката Skyrim SE используйте [этот патч](https://www.nexusmods.com/skyrimspecialedition/mods/57618).

<a id="add-win32exitprocess-method"></a>

## Метод `win32.exitProcess`

Этот метод закрывает игру, вызывая внутри `std::exit`:

```typescript
import { once, win32 } from 'skyrimPlatform';

once('activate', () => {
  // Exit game on any activation
  win32.exitProcess();
});
```

<a id="add-more-events"></a>

## Дополнительные события

Добавлено множество событий, соответствующих возможностям обычного Papyrus. Например:

```typescript
// OnPlayerBowShot TypeScript equivalent
on('playerBowShot', (event) => {
  printConsole(event.weapon.getFormID());
  printConsole(event.ammo.getFormID());
  printConsole(event.power);
  printConsole(event.isSunGazing);
});
```

Интерфейсы новых событий можно изучить через IntelliSense в IDE или прямо в `skyrimPlatform.ts`.

Полный список новых событий:

- `open`
- `close`
- `questInit`
- `questStart`
- `questStop`
- `questStage`
- `trigger`
- `triggerEnter`
- `triggerLeave`
- `sleepStart`
- `sleepStop`
- `locationChanged`
- `bookRead`
- `sell`
- `furnitureEnter`
- `furnitureExit`
- `wardHit`
- `packageStart`
- `packageChange`
- `packageEnd`
- `enterBleedout`
- `destructionStageChanged`
- `sceneAction`
- `playerBowShot`
- `fastTravelEnd`
- `perkEntryRun`
- `translationFailed`
- `translationAlmostCompleted`
- `translationCompleted`
- `actionWeaponSwing`
- `actionBeginDraw`
- `actionEndDraw`
- `actionBowDraw`
- `actionBowRelease`
- `actionBeginSheathe`
- `actionEndSheathe`
- `actionSpellCast`
- `actionSpellFire`
- `actionVoiceCast`
- `actionVoiceFire`
- `cameraStateChanged`
- `crosshairRefChanged`
- `niNodeUpdate`
- `modEvent`
- `positionPlayer`
- `footstep`

<a id="add-texts-api"></a>

## API текстов

Добавлено API для создания текстов через DirectX-оверлей.

```typescript
skyrimPlatform.createText(600, 600, 'Hello Skyrim', [1, 1, 0, 1]);
```

Документация: [texts.md](https://github.com/skyrim-multiplayer/skymp/tree/main/docs/skyrim_platform/texts.md).
