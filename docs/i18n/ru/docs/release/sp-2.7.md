[Deutsch](../../../de/docs/release/sp-2.7.md) · [English](../../../en/docs/release/sp-2.7.md) · [Русский](sp-2.7.md)

<a id="sp-270-release-notes"></a>

# SP 2.7.0 Примечания к выпуску

В документе перечислены изменения после SP 2.6.0

ПРЕДУПРЕЖДЕНИЕ: SP может повредить сохранения. Перед установкой сделайте резервные копии. См. https://github.com/skyrim-multiplayer/skymp/issues/796

SP поддерживает Steam-версию Skyrim SE (1.6.640) и старую версию 1.5.97.

<a id="handle-attempts-to-call-non-native-papyrus-functions"></a>

## Обработка попыток вызова ненативных функций Papyrus

Сейчас Skyrim Platform поддерживает только вызовы ненативных функций. Изменение состоит в том, что теперь вместо сбоя выбрасывается исключение JavaScript.

```js
// JS example, in TS we already couldn't call non-natives :p
sp = skyrimPlatform;
sp.on('update', () => {
  sp.printConsole(sp.Game.getplayer().getActorValuePercentage('health'));
  // ^ "1"

  sp.printConsole(sp.Game.getplayer().getAVPercentage('health'));
  // ^ "[Exception] Function is not native 'Actor.getAVPercentage'"
  // No crash in the new version
});
```

<a id="other-changes"></a>

## Другие изменения

- Исправлено неожиданное создание каталогов в "overwrite" MO2.

- Добавлена поддержка Skyrim 1.6.640.

- Улучшено обнаружение плагинов: файлы с двойным расширением или расширением ".DS_Store" больше не интерпретируются как JavaScript.

- Chromium Embedded Framework обновлён до v105.

- Исправлен двойной курсор при видимом браузере в фокусе.

- Возвращён ошибочно удалённый `InstallApplyMasksToRenderTargetsHook`.

- Добавлен метод `setInventory`, предотвращающий вылеты при массовых операциях с инвентарём через `TESModPlatform.AddItemEx`.

- Исправлены частые зависания, связанные со скриптовыми функциями `removeAllItems`, `equipSpell` и другими.

- Исправлен CI-скрипт, добавлявший лишние файлы в архив SkyrimPlatform Anniversary Edition.

- Возвращено поле "a**g**ressor" события попадания для обратной совместимости скомпилированных плагинов. Ошибка затрагивала только 2.6. Эта опечатка будет полностью удалена из проекта в 3.0.0.
