[Deutsch](../../../de/docs/release/sp-2.1.md) · [English](../../../en/docs/release/sp-2.1.md) · [Русский](sp-2.1.md)

<a id="sp-21-release-notes"></a>

# SP 2.1 Примечания к выпуску

Изменения после SP 2.0:

<a id="add-webpack-support"></a>

## Поддержка WebPack

Теперь SkyrimPlatform может загружать плагины, собранные WebPack. Обычный вывод TSC по-прежнему поддерживается; пример плагина не переведён на WebPack. Пример использования — [skymp5-client](https://github.com/skyrim-multiplayer/skymp/tree/479562345a1f6df4af42217936ccb3e2d3819f78/skymp5-client).

Благодаря WebPack в плагинах SkyrimPlatform теперь можно использовать пакеты NPM. Например, подтверждена работа [RxJS](https://rxjs.dev/guide/overview).

Примечание: пакеты, использующие таймеры (`setTimeout`, `setInterval` и т. д.), не заработают до реализации этих API. То же относится к другим API, специфичным для браузера или Node.

Также поддерживается написание плагинов на обычном JavaScript для тех, кому не нужны сборщики или TypeScript.

```js
// Data/Platform/Plugins/test.js
sp = skyrimPlatform;

sp.printConsole('Hello JS');
```

<a id="add-api-to-contact-back-to-game-from-browser"></a>

## API для сообщений из браузера в игру

Добавлена функция `window.skyrimPlatform.sendMessage` для отправки сообщений из браузера в игру. `sendMessage` принимает ноль или более значений, сериализуемых в JSON.

```js
window.skyrimPlatform.sendMessage({ foo: 'bar' });
window.skyrimPlatform.sendMessage(1, 2, 3, 'yay');
window.skyrimPlatform.sendMessage();
```

Функцию можно вызывать в любой момент, например из обработчика нажатия кнопки.

```html
<input
  type="button"
  value="Click me"
  onclick="window.skyrimPlatform.sendMessage({ foo: 'bar' });"
/>
```

Вызовы sendMessage вызывают на стороне SP событие browserMessage, которое обрабатывается как любое другое событие.

```ts
on('browserMessage', (event) => {
  printConsole(JSON.stringify(event.arguments));
});
```

<a id="add-enums-for-key-codes-and-menus"></a>

## Перечисления кодов клавиш и меню

Добавлены перечисления игровых меню (см. [UI Script](https://www.creationkit.com/index.php?title=UI_Script)).

```ts
// Before. Easy way to forget or add excess spaces
Ui.isMenuOpen('ContainerMenu');
Ui.isMenuOpen('InventoryMenu');
Ui.isMenuOpen('Crafting Menu');

// After
Ui.isMenuOpen(Menu.Container);
Ui.isMenuOpen(Menu.Inventory);
Ui.isMenuOpen(Menu.Crafting);
```

Также добавлены перечисления кодов DirectX (см. [Input Script](https://www.creationkit.com/index.php?title=Input_Script)).

```ts
// Before
Input.isKeyPressed(0x3c); // Sorry?

// After
Input.isKeyPressed(DxScanCode.F2);
```

<a id="enable-local-urls-in-browser"></a>

## Локальные URL в браузере

SkyrimPlatform теперь загружает `Data/Platform/UI/index.html`, если файл существует. Локальные URL можно загружать и во время выполнения.

```ts
// We were able to load only remote URLs. This feature was used in multiplayer but was completely useless for single-player mods.
browser.loadUrl('https://skymp.io');

// Now we can load paths from our local filesystem.
browser.loadUrl('file:///Data/Platform/UI/index.html');
```

<a id="hot-reload-strictly-in-non-game-context"></a>

## Горячая перезагрузка строго вне игрового контекста

Горячая перезагрузка теперь выполняется строго вне игрового контекста.

```ts
import { Game } from 'skyrimPlatform';

// This function call worked in 50% cases of hot reload:
Game.getPlayer();

// Now always throws as expected
```

<a id="add-menuopenmenuclose-events"></a>

## События menuOpen/menuClose

Добавлены события `menuOpen` и `menuClose`.

```ts
on('menuOpen', (e) => {
  printConsole(`The game opens menu: ${e.name}`);
});
```

<a id="other-changes"></a>

## Другие изменения

- Исправлена ошибка компиляции примера плагина SkyrimPlatform.
- Во всём проекте исправлена опечатка "agressor".
- Удалён флаг Chromium, позволявший JavaScript в браузере прослушивать устройства записи.
- Устранены предупреждения антивируса Nexus для исполняемых файлов в архиве.
