[Deutsch](../../../de/docs/skyrim_platform/features.md) · [English](../../../en/docs/skyrim_platform/features.md) · [Русский](features.md)

<a id="hot-reload"></a>

# Горячая перезагрузка

- SkyrimPlatform поддерживает горячую перезагрузку плагинов. Изменение содержимого `Data/Platform/Plugins` или `Data/Platform/PluginsDev` перезагружает все плагины без перезапуска игры.
- Чтобы использовать все возможности, включая горячую перезагрузку по Ctrl+S, возьмите за основу пример плагина: https://github.com/skyrim-multiplayer/skymp/tree/main/skyrim-platform/tools/plugin-example. Пример также находится в архиве на Nexus Mods (Data/Platform/plugin-example).
- При перезагрузке удаляются добавленные обработчики событий и перехватчики, прерываются асинхронные операции и сбрасываются все переменные, кроме `storage` и его свойств.

<a id="changing-game-console-commands"></a>

# Изменение команд игровой консоли

- SkyrimPlatform позволяет менять реализацию любой команды игровой консоли. Для этого получите объект команды через `findConsoleCommand (commandName)`, передав короткое или полное имя команды.

  ```typescript
  let getAV = findConsoleCommand("GetActorValueInfo");
  let getAV = findConsoleCommand("GetAVInfo");
  ```

- У полученного объекта можно изменить короткое (`shortName`) или полное (`longName`) имя команды, число принимаемых аргументов (`numArgs`) и функцию (`execute`), выполняемую при вызове команды из игровой консоли.

  ```typescript
  getAV.longName = 'printArg';
  getAV.shortName = '';
  getAV.execute = (refrId: number, arg: string) => {
    printConsole(arg);
    return false;
  };
  ```

- Возвращаемое вашей реализацией значение определяет, будет ли выполнена исходная функция команды.
- Первый аргумент — FormId объекта, к которому применяется команда, или 0, если объект не указан.
- Остальные параметры — аргументы, переданные при вызове команды, типа `string` или `number`.
- Игровые функции в этом контексте недоступны. Поэтому для их вызова при выполнении консольной команды нужно зарегистрировать обработчик события `update` через `once`:

```typescript
getAV.longName = 'ShowMessageBox';
getAV.shortName = '';

getAV.execute = (refrId: number, arg: string) => {
  once('update', () => {
    Debug.messageBox(arg);
  });
  return false;
};
```

# DumpFunctions

- SkyrimPlatform умеет выводить сведения об игровых функциях в файл `Data / Platform / Output / DumpFunctions.txt` (сочетание клавиш 9 + O + L). Пока работает DumpFunctions, игра приостанавливается на несколько секунд.

<a id="unhandled-exceptions"></a>

# Необработанные исключения

- Необработанные исключения JS записываются в консоль вместе со стеком вызовов.
- Необработанные отклонения Promise также выводятся в консоль.
- Не выпускайте плагины с известными необработанными ошибками. При необработанных исключениях корректная работа SkyrimPlatform не гарантируется.
