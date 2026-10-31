[Deutsch](../../../de/docs/skyrim_platform/browser.md) · [English](../../../en/docs/skyrim_platform/browser.md) · [Русский](browser.md)

<a id="browser-basics"></a>

# Основы работы с браузером

Для проверки создайте `Data/Platform/UI/index.html` со следующим содержимым:

```html
<font color="white"><h1>Hello SP</h1></font>
```

SkyrimPlatform загружает `Data/Platform/UI/index.html`, если файл существует. Также можно загружать URL во время выполнения.

```typescript
import { browser } from 'skyrimPlatform';

// Enable/disable browser visibility
browser.setVisible(true);

// Open cursor and redirect mouse and keyboard events to the browser
browser.setFocused(true);

// Read visibility/focus flags that were set before
const visible = browser.isVisible();
const focused = browser.isFocused();

// Load a specified URL. The current implementation loads URLs only after the user moves the mouse, except the default URL.
// CAUTION! Do not call this function with local URLs if you want your mod to work under MO2.
browser.loadUrl('file:///Data/Platform/UI/index.html'); // Default one
browser.loadUrl(''); // Same effect for empty URL
browser.loadUrl('file:///Data/Platform/UI/another-file.html'); // Load another page from Data
browser.loadUrl('https://google.com'); // Open websites
browser.loadUrl('http://localhost:9000'); // Open remote dev tools. You better open them in normal browser
browser.loadUrl('http://localhost:1234'); // Your favorite dev server in watch mode

// Execute JavaScript code in browser context
browser.executeJavaScript("console.log('Hello CEF')");

// SkyrimPlatform generates a unique token every game start
// In browser context, it appears in `window.spBrowserToken` after some time from page load moment
const str = browser.getToken();
```

<a id="talking-back-to-the-game"></a>

#### Передача сообщений обратно в игру

На стороне браузера используйте `window.skyrimPlatform.sendMessage`, чтобы отправлять сообщения обратно в игру. `sendMessage` принимает ноль или более значений, сериализуемых в JSON.

```js
window.skyrimPlatform.sendMessage({ foo: 'bar' });
window.skyrimPlatform.sendMessage(1, 2, 3, 'yay');
window.skyrimPlatform.sendMessage();
```

Эту функцию можно вызывать в любой момент, например как обработчик нажатия кнопки.

```html
<input
  type="button"
  value="Click me"
  onclick="window.skyrimPlatform.sendMessage({ foo: 'bar' });"
/>
```

Вызовы `sendMessage` вызывают событие `browserMessage` на стороне SP. Его можно обрабатывать так же, как любые другие события.

```ts
on('browserMessage', (event) => {
  printConsole(JSON.stringify(event.arguments));
});
```

Пример «пинг-понг»: контекст SP обращается к контексту браузера через `executeJavaScript`, а контекст браузера отвечает через `window.skyrimPlatform.sendMessage`.

```ts
once('tick', () => {
  browser.executeJavaScript("window.skyrimPlatform.sendMessage('yay')");
});

on('browserMessage', (event) => {
  printConsole(JSON.stringify(event.arguments));
  browser.executeJavaScript("window.skyrimPlatform.sendMessage('yay')");
});
```
