[Deutsch](../../de/docs/docs_skyrim_platform.md) · [English](../../en/docs/docs_skyrim_platform.md) · [Русский](docs_skyrim_platform.md)

# Skyrim Platform

<a id="this-information-is-for-mod-creators-for-general-details-please-read-the-local-skyrim-platform-readmeskyrim-platformreadmemd"></a>

## **Эта информация предназначена создателям модов. Общие сведения см. в [локальном README Skyrim Platform](../skyrim-platform/README.md).**

Актуальное состояние runtime/сборки fork см. в [статусе проекта](docs_project_status.md). Справочник API или успешная сборка клиента не доказывает полную совместимость с новой runtime Skyrim; датированная игровая приёмка остаётся отдельной.

Skyrim Platform — инструмент модификации Skyrim, позволяющий писать скрипты на JavaScript/TypeScript.

```ts
printConsole('Hello Platform');

on('update', () => {
  const gold = Game.getForm(0xf);
  const target = Game.getDialogueTarget();
  const player = Game.getPlayer();
  if (target && player && player.getItemCount(gold) >= 100) {
    player.removeItem(gold, 100, true, target);
    Debug.notification('You have just paid to an NPC');
  }
});
```

Один из модов на Skyrim Platform — клиент SkyMP.\
То есть клиент Skyrim Multiplayer технически является модом Skyrim Special Edition, реализованным с помощью Skyrim Platform.

Здесь находится документация для создания собственных модов с Skyrim Platform.

Документация версионируется вместе со SkyrimPlatform. Если вы читаете страницу на GitHub, вероятно, она относится к последней ревизии SP. Обновления SkyrimPlatform выпускаются периодически. [Здесь](https://github.com/skyrim-multiplayer/skymp/tree/main/docs/release/dev) перечислено содержимое следующего обновления.

Skyrim Platform на Nexus: https://www.nexusmods.com/skyrimspecialedition/mods/54909

[Создайте первый плагин Skyrim Platform!](https://github.com/skyrim-multiplayer/skymp/tree/main/skyrim-platform/tools/plugin-example)

<a id="table-of-contents"></a>

## Содержание

- Интеграция Skyrim
  - [Объекты Papyrus][Papyrus]
  - [Нативные функции][Native]
  - [Перехватчики (события)][Events]
- Возможности Skyrim Platform
  - [Особые функции][Features]
  - [Новые методы и свойства][NewMethods]
  - [Новые типы][NewTypes]
  - [Новые события][NewEvents]
  - [Браузер/UI][Browser]
  - [HTTP][]
  - [Тексты][Texts]
  - [Win32][Win32]
  - [Настройки][Settings]
- [Сборник рецептов][Cookbook]

[Browser]: skyrim_platform/browser.md
[Cookbook]: skyrim_platform/cookbook.md
[Events]: skyrim_platform/events.md
[Features]: skyrim_platform/features.md
[HTTP]: skyrim_platform/http.md
[Native]: skyrim_platform/native.md
[NewEvents]: skyrim_platform/new_events.md
[NewMethods]: skyrim_platform/new_methods.md
[NewTypes]: skyrim_platform/new_types.md
[Papyrus]: skyrim_platform/papyrus.md
[Texts]: skyrim_platform/texts.md
[Win32]: skyrim_platform/win32.md
[Settings]: skyrim_platform/ini_settings.md

<a id="versioning-notes"></a>

## Версионирование

SP следует [Semantic Versioning](https://semver.org/) для JavaScript, но не TypeScript.

Обновления без изменения основной версии не должны ломать скомпилированные TypeScript-плагины и плагины JavaScript. Если это происходит, считайте это ошибкой SP.

Обновление `skyrimPlatform.ts`, напротив, может нарушить компиляцию TypeScript-плагинов. Обычно это легко исправить; можно попросить помощи в Discord или использовать `skyrimPlatform.ts` прежней версии.
