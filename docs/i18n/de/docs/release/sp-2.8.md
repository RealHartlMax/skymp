[Deutsch](sp-2.8.md) · [English](../../../en/docs/release/sp-2.8.md) · [Русский](../../../ru/docs/release/sp-2.8.md)

<a id="sp-280-release-notes"></a>

# SP 2.8.0 Versionshinweise

Dieses Dokument enthält die Änderungen seit SP 2.7.1

WARNUNG: SP kann Spielstände beschädigen. Sichere deine Spielstände vor der Installation. Siehe https://github.com/skyrim-multiplayer/skymp/issues/796

SP unterstützt die Steam-Version von Skyrim SE (1.6.640) und die ältere Version 1.5.97.

<a id="added-option-to-enabledisable-chromium"></a>

## Option zum Aktivieren/Deaktivieren von Chromium

- `ChromiumEnabled = true` – steuert, ob Chromium aktiviert ist.

<a id="improving-the-texts-api"></a>

## Verbesserte Text-API

Die Möglichkeiten von DirectXTK werden jetzt umfassender genutzt.
Textgröße, Rotation, Schrift, Tiefe, Effekte und Ursprung lassen sich ändern.

<a id="new-added-methods"></a>

### Neue Methoden

- `setTextSize(textId: number, size: float)` – ändert die Größe des Textes, nicht der Schrift. Benötigt eine Text-ID und einen Gleitkommawert für die gewünschte Größe.

- `setTextRotation(textId, rotation: float)` – dreht den Text um einen bestimmten Winkel. Benötigt eine Text-ID und einen Gleitkommawert für den Rotationswinkel.

- `setTextFont(textId, name: string)` – ändert die Schrift. Schriften werden relativ zu "Data/Platform/Fonts/" anhand ihres Namens geladen, beispielsweise "Tavern".

- `setTextDepth(textId, depth: int)` – legt den z-Index und damit die Darstellungsreihenfolge auf der z-Achse fest. Benötigt eine Text-ID und einen ganzzahligen z-Index.

- `setTextEffect(textId, effect: skyrimPlatform.SpriteEffects)` – wendet einen Sprite-Effekt an: None (0), FlipHorizontally (1) oder FlipVertically (2).

- `setTextOrigin(textId, origin: [x,y])` – legt den Drehpunkt oder Mittelpunkt des Textes fest. Benötigt eine Text-ID und ein Array der x-/y-Koordinaten.

Eigene Schriften müssen als .sprite-Datei unter "/Data/Platform/Fonts/" liegen. Verwende beim Aufruf den Namen ohne Dateiendung.

Eine Anleitung zum Konvertieren von Schriften nach .sprite enthält die [entsprechende Dokumentationsseite](../skyrim_platform/texts.md).

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

## Eingebettete Konsole

Du kannst jetzt cmd aktivieren und alle Informationen der Spielkonsole in einem separaten Fenster anzeigen.

<a id="new-skyrimplatformini-settings"></a>

### Neue Einstellungen in SkyrimPlatform.ini

- `Cmd = false` – steuert, ob die Konsole aktiviert ist.

- `CmdOffsetLeft = 0` – Abstand des Konsolenfensters vom linken Bildschirmrand.

- `CmdOffsetTop = 720` – Abstand des Konsolenfensters vom oberen Bildschirmrand.

- `CmdWidth = 1900` – Breite des Konsolenfensters.

- `CmdHeight = 317` – Höhe des Konsolenfensters.
  > Die Standardwerte sind für Full HD vorgesehen.

<a id="why-not-just-use-a-game-console"></a>

### Warum nicht einfach die Spielkonsole verwenden?

- Einfacheres Untersuchen von Protokollen.
- Das Schließen der Konsole beendet auch das Spiel und alle Hintergrundaufgaben.
- Text kann kopiert werden.
- Im Fenstermodus lassen sich Spiel und Konsole gleichzeitig beobachten.

<a id="other-changes"></a>

## Weitere Änderungen

- Absturz im Zusammenhang mit Spriggans und TrueHUD behoben.

- Vertikale Pfeiltasten werden jetzt von Chromium korrekt erkannt.

- Absturz im Ereignis combatState behoben. Siehe [#1544 (Kommentar)](https://github.com/skyrim-multiplayer/skymp/issues/1544#issuecomment-1628261524).

- Skriptfunktionsaufrufe beschleunigt. Benchmark: https://github.com/skyrim-multiplayer/skymp/issues/508#issuecomment-1602846718

- Aufrufe der [Text-API](../skyrim_platform/texts.md) optimiert.
