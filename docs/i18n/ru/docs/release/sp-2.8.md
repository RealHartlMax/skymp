[Deutsch](../../../de/docs/release/sp-2.8.md) · [English](../../../en/docs/release/sp-2.8.md) · [Русский](sp-2.8.md)

<a id="sp-280-release-notes"></a>

# SP 2.8.0 Примечания к выпуску

В документе перечислены изменения после SP 2.7.1

ПРЕДУПРЕЖДЕНИЕ: SP может повредить сохранения. Перед установкой сделайте резервные копии. См. https://github.com/skyrim-multiplayer/skymp/issues/796

SP поддерживает Steam-версию Skyrim SE (1.6.640) и старую версию 1.5.97.

<a id="added-option-to-enabledisable-chromium"></a>

## Переключатель включения и отключения Chromium

- `ChromiumEnabled = true` — определяет, включён ли Chromium.

<a id="improving-the-texts-api"></a>

## Улучшения API текстов

Теперь используется больше возможностей DirectXTK.
Можно менять размер текста, поворот, шрифт, глубину, эффекты и опорную точку.

<a id="new-added-methods"></a>

### Новые методы

- `setTextSize(textId: number, size: float)` — изменяет размер текста, не шрифта. Принимает ID текста и число с плавающей точкой для нужного размера.

- `setTextRotation(textId, rotation: float)` — поворачивает текст на заданный угол. Принимает ID текста и число с плавающей точкой для угла поворота.

- `setTextFont(textId, name: string)` — меняет шрифт текста. Шрифты доступны относительно "Data/Platform/Fonts/" по имени, например "Tavern".

- `setTextDepth(textId, depth: int)` — задаёт z-индекс и тем самым порядок отображения по оси z. Принимает ID текста и целочисленный z-индекс.

- `setTextEffect(textId, effect: skyrimPlatform.SpriteEffects)` — применяет эффект спрайта: None (0), FlipHorizontally (1) или FlipVertically (2).

- `setTextOrigin(textId, origin: [x,y])` — задаёт опорную или центральную точку текста. Принимает ID текста и массив координат x и y.

Чтобы использовать собственный шрифт, поместите его .sprite-версию в "/Data/Platform/Fonts/". При обращении указывайте имя без расширения.

Подробная инструкция по преобразованию шрифта в .sprite находится на [специальной странице документации](../skyrim_platform/texts.md).

```js
// this is a javascript example
sp = skyrimPlatform;

let textId = sp.createText(0, 0, 'Hello World!', [1, 1, 1, 1], 'Tavern');

sp.on('activate', () => {
  sp.setTextPos(textId, 200, 200);

  sp.setTextString(textId, 'Hello World!');

  sp.setTextColor(textId, [1, 1, 1, 1]);

  // new methods usage
  sp.setTextSize(textId, 3);

  sp.setTextRotation(textId, 45);

  sp.setTextFont(textId, 'Tavern');

  sp.setTextDepth(textId, 1);

  sp.setTextEffect(textId, sp.SpriteEffects.FlipHorizontally);

  sp.setTextOrigin(textId, [0, 0]);
});
```

<a id="embedded-console"></a>

## Встроенная консоль

Теперь можно включить cmd и получать все сведения игровой консоли в отдельном окне.

<a id="new-skyrimplatformini-settings"></a>

### Новые настройки SkyrimPlatform.ini

- `Cmd = false` — определяет, включена ли консоль.

- `CmdOffsetLeft = 0` — смещение окна консоли от левого края экрана.

- `CmdOffsetTop = 720` — смещение окна консоли от верхнего края экрана.

- `CmdWidth = 1900` — ширина окна консоли.

- `CmdHeight = 317` — высота окна консоли.
  > Значения по умолчанию рассчитаны на Full HD.

<a id="why-not-just-use-a-game-console"></a>

### Почему не использовать игровую консоль?

- Проще отлаживать журналы.
- При закрытии консоли игра завершается вместе со всеми фоновыми задачами.
- Можно копировать текст.
- В оконном режиме можно одновременно играть и следить за консолью.

<a id="other-changes"></a>

## Другие изменения

- Исправлен сбой, связанный со спригганами и TrueHUD.

- Исправлено отсутствие обработки вертикальных стрелок клавиатуры в Chromium.

- Исправлен сбой события combatState. См. [#1544 (комментарий)](https://github.com/skyrim-multiplayer/skymp/issues/1544#issuecomment-1628261524).

- Ускорены вызовы скриптовых функций. Тест производительности: https://github.com/skyrim-multiplayer/skymp/issues/508#issuecomment-1602846718

- Оптимизированы вызовы [API текстов](../skyrim_platform/texts.md).
