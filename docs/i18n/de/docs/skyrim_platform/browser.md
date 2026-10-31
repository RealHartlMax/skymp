[Deutsch](browser.md) · [English](../../../en/docs/skyrim_platform/browser.md) · [Русский](../../../ru/docs/skyrim_platform/browser.md)

<a id="browser-basics"></a>

# Browser-Grundlagen

Erstelle zum Testen `Data/Platform/UI/index.html` mit folgendem Inhalt:

```html
<font color="white"><h1>Hello SP</h1></font>
```

SkyrimPlatform lädt `Data/Platform/UI/index.html`, wenn die Datei existiert. URLs lassen sich auch zur Laufzeit laden.

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

#### Nachrichten zurück an das Spiel

Verwende auf der Browserseite `window.skyrimPlatform.sendMessage`, um Nachrichten an das Spiel zurückzusenden. `sendMessage` akzeptiert null oder mehr JSON-serialisierbare Werte.

```js
window.skyrimPlatform.sendMessage({ foo: 'bar' });
window.skyrimPlatform.sendMessage(1, 2, 3, 'yay');
window.skyrimPlatform.sendMessage();
```

Du kannst diese Funktion jederzeit aufrufen, beispielsweise als Callback einer Schaltfläche.

```html
<input
  type="button"
  value="Click me"
  onclick="window.skyrimPlatform.sendMessage({ foo: 'bar' });"
/>
```

Aufrufe von `sendMessage` lösen auf der SP-Seite ein `browserMessage`-Ereignis aus. Du kannst diese Ereignisse wie alle anderen behandeln.

```ts
on('browserMessage', (event) => {
  printConsole(JSON.stringify(event.arguments));
});
```

„Ping-Pong“-Beispiel: Der SP-Kontext kommuniziert über `executeJavaScript` mit dem Browserkontext; dieser antwortet über `window.skyrimPlatform.sendMessage`.

```ts
once('tick', () => {
  browser.executeJavaScript("window.skyrimPlatform.sendMessage('yay')");
});

on('browserMessage', (event) => {
  printConsole(JSON.stringify(event.arguments));
  browser.executeJavaScript("window.skyrimPlatform.sendMessage('yay')");
});
```
