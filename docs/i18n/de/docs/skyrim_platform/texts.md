[Deutsch](texts.md) · [English](../../../en/docs/skyrim_platform/texts.md) · [Русский](../../../ru/docs/skyrim_platform/texts.md)

<a id="texts-api"></a>

# Text-API

Skyrim Platform unterstützt das Darstellen von Texten und bietet Methoden zu deren Bearbeitung.

Als Schrift wird `Data/Platform/Fonts/Tavern.spritefont` verwendet.
`*.spritefont` ist ein eigenes Format der DirectXTK-Bibliothek.
Mit deren Dienstprogramm MakeSpriteFont kannst du `*.ttf` in dieses Format umwandeln.
Einzelheiten stehen unter [Schrift kompilieren](#schrift-kompilieren).

<a id="example"></a>

## Beispiel

```typescript
skyrimPlatform.createText(0, 0, "Hello World!", [1, 1, 1, 1], "Tavern"),; // 0,0 is top left. Non-ASCII character are not yet supported.
skyrimPlatform.browser.setVisible(true); // Texts API takes visibility flag from the browser
```

<a id="complex"></a>

## Komplexe Anwendungen

Mit dieser einfachen API lassen sich dynamische Texte an 3D-Punkten, Objekten oder sogar Actor-Knochen befestigen.
SkyMP zeichnet damit beispielsweise Spielernamen am Knoten `NPC Head [Head]`
([#783](https://github.com/skyrim-multiplayer/skymp/pull/783/files)).

<a id="colors"></a>

## Farben

Farben werden als RGBA-Arrays mit Werten von 0 bis 1 dargestellt.

```typescript
const white = [1, 1, 1, 1];
```

<a id="api-methods"></a>

## API-Methoden

- `skyrimPlatform.createText(xpos, ypos, "string", ["array of RGBA colors"], fontName: string)` – erstellt einen Text.
  Gibt die ID zurück.

- `skyrimPlatform.destroyText(textId)` – löscht einen Text anhand der ID.
- `skyrimPlatform.destroyAllTexts()` – löscht alle Texte.

<a id="setters"></a>

### Setter

- `skyrimPlatform.setTextPos(textId, xpos: float, ypos: float)` – legt die Position eines Textes anhand seiner ID fest.

- `skyrimPlatform.setTextString(textId, text: string)` – legt den Text anhand seiner ID fest.

- `skyrimPlatform.setTextColor(textId, ["array of RBGA colors 0-1"])` – legt die Textfarbe fest.

- `skyrimPlatform.setTextSize(textId: number, size: float)` – legt die Textgröße (nicht die Schriftgröße) fest.

- `skyrimPlatform.setTextRotation(textId, rotation: float)` – legt die Textrotation fest.

- `skyrimPlatform.setTextFont(textId, name: string)` – wählt die Schrift anhand ihres Namens, beispielsweise "Tavern", relativ zu "Data/Platform/Fonts/".

- `skyrimPlatform.setTextDepth(textId, depth: int)` – legt den z-Index des Textes fest.

- `skyrimPlatform.setTextEffect(textId, effect: skyrimPlatform.SpriteEffects)` – legt den Sprite-Effekt fest [None = 0, FlipHorizontally = 1, FlipVertically = 2].

- `skyrimPlatform.setTextOrigin(textId, origin [x,y])` – legt den Drehpunkt (Mittelpunkt) des Textes fest.

<a id="getters"></a>

### Getter

- `skyrimPlatform.getTextPos(textId)` – gibt die Koordinaten (Position) des Textes als Array zurück.

- `skyrimPlatform.getTextString(textId)` – gibt eine Zeichenfolge zurück.

- `skyrimPlatform.getTextColor(textId)` – gibt ein RGBA-Farbarray zurück.

- `skyrimPlatform.getTextSize(textId)` – gibt die Größe des Textes zurück.

- `skyrimPlatform.getTextRotation(textId)` – gibt die Textrotation zurück.

- `skyrimPlatform.getTextFont(textId)` – gibt den Pfad zur Schrift zurück.

- `skyrimPlatform.getTextDepth(textId)` – gibt den z-Index des Textes zurück.

- `skyrimPlatform.getTextEffect(textId)` – gibt das Effekt-Enum zurück.

- `skyrimPlatform.getTextOrigin(textId)` – gibt den Drehpunkt (Mittelpunkt) des Textes zurück.

- `skyrimPlatform.getNumCreatedTexts()` – gibt die Anzahl erstellter Texte zurück.

<a id="compiling-font"></a>

## Schrift kompilieren

Zum Kompilieren benötigst du `MakeSpriteFont.exe` aus den DirectXTK-Releases
und eine im System installierte `*.ttf`-Schrift.

```
./MakeSpriteFont.exe "Typey McTypeface" Tavern.spritefont /FontSize:20 /CharacterRegion:32-126 /CharacterRegion:1040-1103 /CharacterRegion:1025 /CharacterRegion:1105 /DefaultCharacter:63
```

- `"Typey McTypeface"` ist der interne Name von `Tavern.ttf` (Eingabeschrift).
- `Tavern.spritefont` ist der Dateiname der Ausgabeschrift.
- `/CharacterRegion:32-126 /DefaultCharacter:63` – Standard-ASCII-Bereich mit 63 (`?`) als Ersatzzeichen.
- `/CharacterRegion:1040-1103 /CharacterRegion:1025 /CharacterRegion:1105` – russisches Alphabet.

Du kannst Python oder ein anderes Werkzeug, einschließlich
[Webdiensten](https://onlineutf8tools.com/convert-utf8-to-code-points),
verwenden, um die Zeichencodes zu ermitteln:

```
$ python3
>>> ord('Ё')
1025
>>> chr(1105)
'ё'
```

Weitere Informationen und Downloads:

- [DirectXTK-Wiki](https://github.com/microsoft/DirectXTK/wiki/MakeSpriteFont)
- [`MakeSpriteFont.exe` von der DirectXTK-Releaseseite herunterladen](https://github.com/microsoft/DirectXTK/releases)
