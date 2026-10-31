[Deutsch](../../../de/docs/skyrim_platform/texts.md) · [English](../../../en/docs/skyrim_platform/texts.md) · [Русский](texts.md)

<a id="texts-api"></a>

# API текстов

Skyrim Platform поддерживает отображение текстов и предоставляет методы для управления ими.

В качестве шрифта используется `Data/Platform/Fonts/Tavern.spritefont`.
`*.spritefont` — специальный формат библиотеки DirectXTK.
Преобразовать `*.ttf` в этот формат можно утилитой MakeSpriteFont
из DirectXTK. Подробнее см. [Компиляция шрифта](#компиляция-шрифта).

<a id="example"></a>

## Пример

```typescript
skyrimPlatform.createText(0, 0, "Hello World!", [1, 1, 1, 1], "Tavern"),; // 0,0 is top left. Non-ASCII character are not yet supported.
skyrimPlatform.browser.setVisible(true); // Texts API takes visibility flag from the browser
```

<a id="complex"></a>

## Сложные варианты

Это простое API позволяет создавать динамические тексты, привязанные к 3D-точкам, объектам и даже костям актёров.
Например, SkyMP использует его для отображения имён у узла `NPC Head [Head]`
([#783](https://github.com/skyrim-multiplayer/skymp/pull/783/files)).

<a id="colors"></a>

## Цвета

Цвета задаются RGBA-массивами со значениями от 0 до 1.

```typescript
const white = [1, 1, 1, 1];
```

<a id="api-methods"></a>

## Методы API

- `skyrimPlatform.createText(xpos, ypos, "string", ["array of RGBA colors"], fontName: string)` — создаёт текст.
  Возвращает ID.

- `skyrimPlatform.destroyText(textId)` — удаляет текст по ID.
- `skyrimPlatform.destroyAllTexts()` — удаляет все тексты.

<a id="setters"></a>

### Методы изменения

- `skyrimPlatform.setTextPos(textId, xpos: float, ypos: float)` — задаёт позицию текста по ID.

- `skyrimPlatform.setTextString(textId, text: string)` — задаёт текст по ID.

- `skyrimPlatform.setTextColor(textId, ["array of RBGA colors 0-1"])` — задаёт цвет текста.

- `skyrimPlatform.setTextSize(textId: number, size: float)` — задаёт размер текста (не шрифта).

- `skyrimPlatform.setTextRotation(textId, rotation: float)` — задаёт угол поворота текста.

- `skyrimPlatform.setTextFont(textId, name: string)` — задаёт шрифт по имени, например "Tavern", относительно "Data/Platform/Fonts/".

- `skyrimPlatform.setTextDepth(textId, depth: int)` — задаёт z-индекс текста.

- `skyrimPlatform.setTextEffect(textId, effect: skyrimPlatform.SpriteEffects)` — задаёт эффект спрайта [None = 0, FlipHorizontally = 1, FlipVertically = 2].

- `skyrimPlatform.setTextOrigin(textId, origin [x,y])` — задаёт опорную точку (центр) текста.

<a id="getters"></a>

### Методы получения

- `skyrimPlatform.getTextPos(textId)` — возвращает координаты (позицию) текста массивом.

- `skyrimPlatform.getTextString(textId)` — возвращает строку.

- `skyrimPlatform.getTextColor(textId)` — возвращает массив цвета RGBA.

- `skyrimPlatform.getTextSize(textId)` — возвращает размер текста.

- `skyrimPlatform.getTextRotation(textId)` — возвращает угол поворота текста.

- `skyrimPlatform.getTextFont(textId)` — возвращает путь к шрифту.

- `skyrimPlatform.getTextDepth(textId)` — возвращает z-индекс текста.

- `skyrimPlatform.getTextEffect(textId)` — возвращает значение перечисления эффектов.

- `skyrimPlatform.getTextOrigin(textId)` — возвращает опорную точку (центр) текста.

- `skyrimPlatform.getNumCreatedTexts()` — возвращает количество созданных текстов.

<a id="compiling-font"></a>

## Компиляция шрифта

Для компиляции нужна утилита `MakeSpriteFont.exe` из выпусков DirectXTK
и установленный в системе шрифт `*.ttf`.

```
./MakeSpriteFont.exe "Typey McTypeface" Tavern.spritefont /FontSize:20 /CharacterRegion:32-126 /CharacterRegion:1040-1103 /CharacterRegion:1025 /CharacterRegion:1105 /DefaultCharacter:63
```

- `"Typey McTypeface"` — внутреннее имя `Tavern.ttf` (исходного шрифта).
- `Tavern.spritefont` — имя выходного файла шрифта.
- `/CharacterRegion:32-126 /DefaultCharacter:63` — стандартный диапазон ASCII с резервным символом 63 (`?`).
- `/CharacterRegion:1040-1103 /CharacterRegion:1025 /CharacterRegion:1105` — русский алфавит.

Для определения кодов символов можно использовать Python или любой другой инструмент, включая
[веб-сервисы](https://onlineutf8tools.com/convert-utf8-to-code-points):

```
$ python3
>>> ord('Ё')
1025
>>> chr(1105)
'ё'
```

Дополнительные сведения и загрузки:

- [Вики DirectXTK](https://github.com/microsoft/DirectXTK/wiki/MakeSpriteFont)
- [Скачать `MakeSpriteFont.exe` на странице выпусков DirectXTK](https://github.com/microsoft/DirectXTK/releases)
