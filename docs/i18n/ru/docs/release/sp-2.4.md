[Deutsch](../../../de/docs/release/sp-2.4.md) · [English](../../../en/docs/release/sp-2.4.md) · [Русский](sp-2.4.md)

<a id="sp-240-release-notes"></a>

# SP 2.4.0 Примечания к выпуску

В документе перечислены изменения после SP 2.3.0

SP регулярно обновляется. Это обновление, вероятно, не включает ВСЕ необходимые исправления.

Многое ещё предстоит реализовать или исправить. См. [задачи](https://github.com/skyrim-multiplayer/skymp/issues?q=is%3Aopen+is%3Aissue+label%3Aarea%3Askyrim-platform).

Обратите внимание: эта версия SP работает только со старой сборкой SE до обновления от 11.11.21.

Для отката Skyrim SE используйте [этот патч](https://www.nexusmods.com/skyrimspecialedition/mods/57618).

<a id="add-browserisvisiblebrowserisfocused-methods"></a>

## Методы `browser.isVisible`/`browser.isFocused`

Теперь можно получать фактическое состояние видимости и фокуса, а не запоминать его при каждом вызове `setVisible`/`setFocused`.

```typescript
printConsole('isVisible:', browser.isVisible());
printConsole('isFocused:', browser.isFocused());
```

<a id="support-opening-urls-in-the-system-default-browser"></a>

## Открытие URL в системном браузере по умолчанию

Skyrim Platform уже поддерживала внутриигровой браузер для интерфейсов на веб-технологиях.

Это обновление добавляет открытие URL в браузере пользователя по умолчанию: Chrome, Firefox, Edge, Opera и т. д.

Можно создать ссылку, кнопку, сочетание клавиш или другой способ перехода пользователей мода на вашу страницу Nexus, GitHub, Patreon или сайт.

```typescript
win32.loadUrl('https://github.com/skyrim-multiplayer/skymp');
```

Сейчас разрешены только URL с префиксом `https://`.

<a id="add-spellcast-event"></a>

## Событие spellCast

Теперь можно перехватывать события spellCast.

```typescript
on('spellCast', (event) => {
  printConsole(event.caster.getFormID());
  printConsole(event.spell.getName());
});
```

Объект события содержит поля `caster: ObjectReference` и `spell: Spell`.

<a id="support-array-return-values-in-scripting-functions"></a>

## Возврат массивов из скриптовых функций

Теперь можно вызывать функции, возвращающие массивы, без прежних исключений.

```typescript
Utility.createStringArray(3, 'teststring');
// ["teststring", "teststring", "teststring"]
Utility.createBoolArray(3, true);
// [true, true, true]

const spell = player.getNthSpell(0);
browser.executeJavascript(
  `console.log(${JSON.stringify(s?.getEffectDurations())})`,
);
// prints numbers array to browser console [5, 5, 5];
const array = spell?.getMagicEffects();
// return array of PapyrusObjects
array?.forEach((element) => {
  printConsole(MagicEffect.from(element)?.getFormID());
  // create MagicEffect from PapyrusObject with static .from
  // print FormID for all MagicEffects from 1st spell
});
```

При возврате массива объектов сейчас всегда получается `PapyrusObject[]`.
Для использования методов класса элементы нужно преобразовать статическим методом `from`.

<a id="other-changes"></a>

## Другие изменения

- Несуществующий метод `writeScript` удалён из `skyrimPlatform.ts`. Вместо него можно использовать `writePlugin`.
