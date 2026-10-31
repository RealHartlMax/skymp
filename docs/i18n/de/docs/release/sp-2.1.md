[Deutsch](sp-2.1.md) · [English](../../../en/docs/release/sp-2.1.md) · [Русский](../../../ru/docs/release/sp-2.1.md)

<a id="sp-21-release-notes"></a>

# SP 2.1 Versionshinweise

Änderungen seit SP 2.0:

<a id="add-webpack-support"></a>

## WebPack-Unterstützung

SkyrimPlatform kann jetzt mit WebPack erstellte Plugins laden. Unveränderte TSC-Ausgaben werden weiterhin unterstützt; das Beispiel-Plugin wurde nicht umgestellt. Ein Anwendungsbeispiel ist [skymp5-client](https://github.com/skyrim-multiplayer/skymp/tree/479562345a1f6df4af42217936ccb3e2d3819f78/skymp5-client).

Dank WebPack lassen sich jetzt NPM-Pakete in SkyrimPlatform-Plugins verwenden. Beispielsweise wurde [RxJS](https://rxjs.dev/guide/overview) erfolgreich getestet.

Hinweis: Pakete mit Timer-Funktionen (`setTimeout`, `setInterval` usw.) funktionieren erst, wenn wir diese APIs implementiert haben. Dasselbe gilt für andere browser- oder Node-spezifische APIs.

Plugins können außerdem jetzt in reinem JavaScript geschrieben werden, wenn du weder Bundler noch TypeScript verwenden möchtest.

```js
// Data/Platform/Plugins/test.js
sp = skyrimPlatform;

sp.printConsole('Hello JS');
```

<a id="add-api-to-contact-back-to-game-from-browser"></a>

## API für Nachrichten vom Browser an das Spiel

`window.skyrimPlatform.sendMessage` wurde hinzugefügt, um browserseitig Nachrichten an das Spiel zurückzusenden. `sendMessage` akzeptiert null oder mehr JSON-serialisierbare Werte.

```js
window.skyrimPlatform.sendMessage({ foo: 'bar' });
window.skyrimPlatform.sendMessage(1, 2, 3, 'yay');
window.skyrimPlatform.sendMessage();
```

Du kannst die Funktion jederzeit aufrufen, beispielsweise als Callback einer Schaltfläche.

```html
<input
  type="button"
  value="Click me"
  onclick="window.skyrimPlatform.sendMessage({ foo: 'bar' });"
/>
```

Aufrufe von sendMessage lösen auf der SP-Seite ein browserMessage-Ereignis aus, das wie andere Ereignisse behandelt werden kann.

```ts
on('browserMessage', (event) => {
  printConsole(JSON.stringify(event.arguments));
});
```

<a id="add-enums-for-key-codes-and-menus"></a>

## Enums für Tastencodes und Menüs

Enums für Spielmenüs ergänzt (siehe [UI Script](https://www.creationkit.com/index.php?title=UI_Script)).

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

Außerdem Enums für DirectX-Scancodes (siehe [Input Script](https://www.creationkit.com/index.php?title=Input_Script)).

```ts
// Before
Input.isKeyPressed(0x3c); // Sorry?

// After
Input.isKeyPressed(DxScanCode.F2);
```

<a id="enable-local-urls-in-browser"></a>

## Lokale URLs im Browser

SkyrimPlatform lädt jetzt `Data/Platform/UI/index.html`, wenn die Datei existiert. Lokale URLs lassen sich auch zur Laufzeit laden.

```ts
// We were able to load only remote URLs. This feature was used in multiplayer but was completely useless for single-player mods.
browser.loadUrl('https://skymp.io');

// Now we can load paths from our local filesystem.
browser.loadUrl('file:///Data/Platform/UI/index.html');
```

<a id="hot-reload-strictly-in-non-game-context"></a>

## Hot Reload ausschließlich außerhalb des Spielkontexts

Hot Reload findet jetzt ausschließlich außerhalb des Spielkontexts statt.

```ts
import { Game } from 'skyrimPlatform';

// This function call worked in 50% cases of hot reload:
Game.getPlayer();

// Now always throws as expected
```

<a id="add-menuopenmenuclose-events"></a>

## Ereignisse menuOpen/menuClose

Neue Ereignisse: `menuOpen` und `menuClose`.

```ts
on('menuOpen', (e) => {
  printConsole(`The game opens menu: ${e.name}`);
});
```

<a id="other-changes"></a>

## Weitere Änderungen

- Kompilierungsfehler im Beispiel-Plugin von SkyrimPlatform korrigiert.
- Schreibfehler "agressor" im gesamten Projekt korrigiert.
- Chromium-Schalter entfernt, der browserseitigem JavaScript Zugriff auf Aufnahmegeräte erlaubte.
- Nexus-Virenscannerwarnungen für ausführbare Dateien im Archiv behoben.
