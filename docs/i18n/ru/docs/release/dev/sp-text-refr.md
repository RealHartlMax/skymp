[Deutsch](../../../../de/docs/release/dev/sp-text-refr.md) · [English](../../../../en/docs/release/dev/sp-text-refr.md) · [Русский](sp-text-refr.md)

<a id="text-reference-attachment-api"></a>

## API привязки текста к ссылкам

Тексты, созданные через `createText`, теперь можно привязывать к ссылкам игрового мира (объектам, NPC, игроку); они автоматически следуют за ними на экране на каждом кадре.

<a id="new-functions"></a>

### Новые функции

```typescript
// Attach text to a reference. Pass 0 to detach and restore the original screen position.
setTextRefr(textId: number, refrFormId: number): void;

// Set the skeleton node to track (e.g. "NPC Head [Head]"). When empty the
// object's base position (GetPosition) is used instead of the NiNode transform.
setTextRefrNode(textId: number, nodeName: string): void;

// Apply a world-space offset (x, y, z) on top of the tracked position.
setTextRefrOffset(textId: number, offset: number[]): void;

// Apply a screen offset (x, y) on top of the tracked position and world-space offset.
setTextRefrScreenOffset(textId: number, offset: number[]): void;

// Read back the currently set values.
getTextRefr(textId: number): number;
getTextRefrNode(textId: number): string;
getTextRefrOffset(textId: number): number[];
getTextRefrScreenOffset(textId: number): number[];
```

<a id="behaviour"></a>

### Поведение

- Если `refrFormId` не равен нулю, экранная позиция текста пересчитывается на каждом обновлении проекцией мировой позиции через камеру игрока.
- Если `refrNodeName` пуст, используется позиция самого объекта (`GetPosition()`), поэтому текст работает даже без загруженного 3D у ссылки.
- Если указанный именованный узел не найден в текущем кадре, позиция текста в этом кадре не обновляется.
- Тексты позади камеры не перемещаются.
- Отвязка (`setTextRefr(id, 0)`) восстанавливает последнюю экранную позицию, заданную через `setTextPos`.
