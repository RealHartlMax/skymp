[Deutsch](sp-2.5.md) · [English](../../../en/docs/release/sp-2.5.md) · [Русский](../../../ru/docs/release/sp-2.5.md)

<a id="sp-250-release-notes"></a>

# SP 2.5.0 Versionshinweise

Dieses Dokument enthält die Änderungen seit SP 2.4.0

SP wird regelmäßig aktualisiert. Dieses Update enthält möglicherweise nicht ALLE erforderlichen Korrekturen.

Es gibt weiterhin vieles zu implementieren oder zu korrigieren. Siehe [Issues](https://github.com/skyrim-multiplayer/skymp/issues?q=is%3Aopen+is%3Aissue+label%3Aarea%3Askyrim-platform).

Beachte: Diese SP-Version funktioniert nur mit dem alten SE-Build vor dem Update vom 11.11.21.

Verwende [diesen Patch](https://www.nexusmods.com/skyrimspecialedition/mods/57618), um deine Skyrim-SE-Installation zurückzustufen.

<a id="add-win32exitprocess-method"></a>

## Methode `win32.exitProcess`

Diese Methode schließt das Spiel intern durch einen Aufruf von `std::exit`:

```typescript
import { once, win32 } from 'skyrimPlatform';

once('activate', () => {
  // Exit game on any activation
  win32.exitProcess();
});
```

<a id="add-more-events"></a>

## Weitere Ereignisse

Viele neue Ereignisse spiegeln die Möglichkeiten von Vanilla-Papyrus wider. Beispielsweise:

```typescript
// OnPlayerBowShot TypeScript equivalent
on('playerBowShot', (event) => {
  printConsole(event.weapon.getFormID());
  printConsole(event.ammo.getFormID());
  printConsole(event.power);
  printConsole(event.isSunGazing);
});
```

Die Schnittstellen der neuen Ereignisse findest du über IntelliSense in deiner IDE oder direkt in `skyrimPlatform.ts`.

Vollständige Liste neuer Ereignisse:

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

## Text-API

API zum Erstellen von Texten über ein DirectX-Overlay ergänzt.

```typescript
skyrimPlatform.createText(600, 600, 'Hello Skyrim', [1, 1, 0, 1]);
```

Dokumentation: [texts.md](https://github.com/skyrim-multiplayer/skymp/tree/main/docs/skyrim_platform/texts.md).
