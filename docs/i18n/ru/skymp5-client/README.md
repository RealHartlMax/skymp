# Создание первого плагина Skyrim Platform

- [Установка Skyrim Platform](#install-skyrim-platform)
- [Установка Node.js](#install-nodejs)
- [Установка VSCode](#install-vscode)
- [Копирование примера](#copy-example-plugin)
- [Открытие примера](#open-example-plugin)
- [Путь Skyrim](#configure-skyrim-path)
- [Имя плагина](#configure-plugin-name)
- [Компиляция](#compile-plugin)
- [Запуск в Skyrim](#view-plugin-running-in-skyrim)
- [Основной файл](#view-the-main-plugin-file)
- [Свои изменения](#make-your-own-changes-to-the-plugin)
- [Внешние библиотеки](#importing-third-party-libraries)
- [Распространение](#distributing-your-skyrim-platform-plugin)
- [Документация](#read-the-documentation)
- [Discord](#join-the-discord)
- [Лицензия](#license)

## Установка Skyrim Platform

Сначала установите Skyrim Platform любимым менеджером модов:

- https://www.nexusmods.com/skyrimspecialedition/mods/54909

## Установка Node.js

Также нужен Node.js:

- https://nodejs.org

> Подходит LTS или Current.

## Установка VSCode

Рекомендуется редактор с хорошим TypeScript. Если нет другого предпочтения, установите [VSCode](https://code.visualstudio.com/).

> Пример уже поддерживает VSCode.

## Копирование примера

В скачанном моде Skyrim Platform есть `plugin-example`. Выберите мод в менеджере и откройте файловую систему:

- Vortex: `Open in File Manager`.
- Mod Organizer 2: `Open in Explorer`.

В `Platform` найдите `plugin-example` и скопируйте **вне каталога Skyrim**.

> В отличие от обычных модов, чистый плагин не нужно помещать в MO2/Vortex, если он не содержит игровых текстур/моделей. Разрабатывать рекомендуется вне папок Skyrim и MO2-модов.

## Открытие примера

В VS Code дважды нажмите `example-plugin.code-workspace`. В другом редакторе/IDE откройте папку проекта.

## Настройка пути Skyrim

Откройте `skyrim.json` и задайте свою установку:

```js
{
    "skyrimFolder": "C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition"
}
```

> Можно использовать переменную `SKYRIMPATH`. Это удобно нескольким проектам/участникам с разными путями.

## Настройка имени

Все имена уникальны. Измените поле `"name"` в `package.json`, например:

```json
{
  "name": "my-cool-plugin",
  "version": "1.0.0",
```

> Только строчные буквы/дефисы, без пробелов.

## Компиляция плагина

Выберите `Terminal` → `Run Build Task...` либо Ctrl+Shift+B. Терминал автоматически:

- установит npm-зависимости,
- скомпилирует и объединит плагин,
- скопирует в каталог Skyrim Platform,
- начнёт следить за файлами и повторять шаги.

Вручную: `npm run dev`. В `[Skyrim Folder]\Data\Platform\PluginsDev` должен появиться `[your plugin name].js`.

## Просмотр в Skyrim

Запустите Skyrim с установленной платформой. В главном меню откройте консоль `~`. При правильной установке:

```
Hello SE
```

При работающем плагине:

```
[Script] Hello! You can view this in the Skyrim ~ console on the Main Menu when the game runs
```

Для быстрого игрового теста введите и нажмите Enter:

```
coc riverwood
```

После загрузки Riverwood появится диалог:

```
Hello! This will appear when a new game is started or an existing game is loaded
```

Теперь меняйте плагин. **Переключитесь Alt+Tab и редактируйте — изменения сразу действуют в игре.**

## Основной файл

В примере он находится в `src/`:

### `src/index.ts`

```ts
import { Debug, once, printConsole } from 'skyrimPlatform';

once('tick', () => {
  printConsole(
    'Hello! You can view this in the Skyrim ~ console on the Main Menu when the game runs',
  );
});

once('update', () => {
  Debug.messageBox(
    'Hello! This will appear when a new game is started or an existing game is loaded',
  );
});
```

## Собственные изменения

Замените текст в коде, например:

```ts
import { Debug, once, printConsole } from 'skyrimPlatform';

once('update', () => {
  Debug.messageBox('Hey look! I changed this! Yay!');
});
```

Пока работает `Run Build Task...`/`npm run dev`, изменения перекомпилируются автоматически. Вернувшись Alt+Tab, сразу увидите окно. Если нет, проверьте работающий терминал и ошибки.

## Импорт внешних библиотек

Установленные зависимости объединяет `webpack`: как свои, так и чужие. Частый пример — Skyrim-библиотеки [`PapyrusUtil`][PapyrusUtil]/[`JContainers`][JContainers].

Команда `npm i @skyrim-platform/papyrus-util` ставит TypeScript-обёртку нативных функций PapyrusUtil. Измените `src/index.ts`:

```ts
// Import the utility function from PapyrusUtil which can list folders in a file system path
import { FoldersInFolder } from '@skyrim-platform/papyrus-util/MiscUtil';
import { Debug, once } from '@skyrim-platform/skyrim-platform';

// When 'update' runs, show a messagebox listing all of the top-level folder names inside of the 'Data' folder
once('update', () => {
  const foldersInData = FoldersInFolder('.');
  if (foldersInData)
    Debug.messageBox(`Folders in Data directory: ${foldersInData.join('\n')}`);
});
```

Это простой пример одной функции. Полная документация внешней библиотеки — на npm/GitHub.

> Документация сторонних библиотек в README не включена.

## Распространение плагина

Готовый плагин упаковывается ZIP для сайтов вроде NexusMods:

```
npm run zip
```

В проекте появится `[your plugin name from package.json]-[your plugin version from package.json].zip`.

Для текстур/моделей можно архивировать вручную. Внутри `Platform/Plugins` должна лежать объединённая JavaScript-версия.

#### `myplugin-1.0.0.zip`

```
Platform\
  Plugins\
    plugin-file-1.0.0.js
```

> Не упаковывайте `.ts` или `.js` из `dist/`. Используйте объединённый для Skyrim Platform `.js` из `build/`.

## Чтение документации

Можно начинать работу. Документация:

- https://github.com/skyrim-multiplayer/skymp/blob/main/docs/docs_skyrim_platform.md

## Discord

Поддержка: https://discord.gg/P8yg7YKY2e

## Лицензия

Плагин — ваше ПО, лицензию выбираете сами. Skyrim Platform распространяется под [GNU GPL v3.0][GPLv3].

[PapyrusUtil]: https://www.nexusmods.com/skyrimspecialedition/mods/13048
[JContainers]: https://www.nexusmods.com/skyrimspecialedition/mods/16495
[GPLv3]: https://www.gnu.org/licenses/gpl-3.0.en.html
