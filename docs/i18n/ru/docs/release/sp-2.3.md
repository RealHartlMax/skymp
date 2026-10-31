[Deutsch](../../../de/docs/release/sp-2.3.md) · [English](../../../en/docs/release/sp-2.3.md) · [Русский](sp-2.3.md)

<a id="sp-23-release-notes"></a>

# SP 2.3 Примечания к выпуску

В документе перечислены изменения после SP 2.2.

SP регулярно обновляется. Это обновление, вероятно, не включает ВСЕ необходимые исправления.
Многое ещё предстоит реализовать или исправить. См. [задачи](https://github.com/skyrim-multiplayer/skymp/issues?q=is%3Aopen+is%3Aissue+label%3Aarea%3Askyrim-platform).

Обратите внимание: эта версия SP работает только со старой сборкой SE до обновления от 11.11.21.
Для отката Skyrim SE используйте [этот патч](https://www.nexusmods.com/skyrimspecialedition/mods/57618).

<a id="add-hookremove-method"></a>

## Метод `hook.remove`

Чтобы позднее удалить перехватчик, сохраните его ID при добавлении:

```typescript
const id = hooks.sendAnimationEvent.add({...});
//later...
hooks.sendAnimationEvent.remove(id);
```

Так можно динамически добавлять и удалять перехватчики на основе [новых событий](https://github.com/skyrim-multiplayer/skymp/blob/main/docs/skyrim_platform/new_events.md).

Например, можно перехватывать анимации игрока во время действия заклинания:

```typescript
let id;

export let main = () => {
  on('effectStart', () => {
    id = hooks.sendAnimationEvent.add({...});
  });

  on('effectFinish', () => {
    if (id) {
      hooks.sendAnimationEvent.remove(id);
    }
  });
};

```

<a id="fix-vulnerability-in-writelogs-method"></a>

## Исправлена уязвимость `writeLogs`

До исправления можно было записывать текстовые файлы в любое место системы:

```typescript
writeLogs('../foo', '111');
// or even:
writeLogs('../../foo', '111');
```

SP намеренно запрещает плагинам чтение и запись файлов вне каталога Data. Однако PapyrusUtil, JContainers и другие плагины могут предоставлять дополнительный доступ, и это допустимо.

<a id="other-changes"></a>

## Другие изменения

- `writeLogs` теперь пишет в `Data/Platform/Logs` вместо `Data/Platform/Plugins`.
- Добавлена загрузка плагинов из дополнительного каталога `Platform/PluginsDev`. Это обеспечивает горячую перезагрузку для пользователей MO2 с загруженными плагинами SP.
