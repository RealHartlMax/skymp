[Deutsch](../../../de/docs/skyrim_platform/new_methods.md) · [English](../../../en/docs/skyrim_platform/new_methods.md) · [Русский](new_methods.md)

<a id="custom-skyrim-platform-methods-and-properties"></a>

# Собственные методы и свойства Skyrim Platform

Методы наподобие `printConsole ()` можно вызывать сразу после импорта. Они не принадлежат ни одному игровому типу.

<a id="table-of-contents"></a>

## Содержание

- [browser](#browser)
- [on/once](#ononce)
- [printConsole](#printconsole)
- [settings](#settings)
- [writeLogs](#writelogs)
- [Другие методы и свойства](#другие-методы-и-свойства)

## printConsole

`printConsole (... arguments: unknown[]): void`

Вывод в игровую консоль, открываемую клавишей `~`.

Ко всем сообщениям консоли добавляется строка `[Script]`.

```typescript
import { Game, once, printConsole } from 'skyrimPlatform';

once('update', () => {
  printConsole(`player id = ${Game.getPlayer().getFormID()}`);
});
```

## writeLogs

`writeLogs(pluginName: string, ...arguments: unknown[]): void`

Запись в файл журнала.\
Функция создаёт файл `Data/Platform/Plugins/pluginName-logs.txt`.

Эта функция не задаёт форматирование и не добавляет автоматически, например, метки времени.\
Вы сами выбираете, какие сведения включить в журнал и как их отобразить.

Например, `Date().toLocaleString()` позволяет добавить метку времени в соответствии с региональными настройками компьютера, на котором запущена игра:

```typescript
import { writeLogs } from 'skyrimPlatform';

const t = new Date().toLocaleString();
writeLogs('your-mod', `${t}: some message`);
```

**_ПРЕДУПРЕЖДЕНИЕ_**: Этот файл перезаписывается каждый раз при закрытии игры.\
Чтобы сохранять несколько журналов, необходимо явно управлять именами файлов.

## settings

`settings`

Объект, предоставляющий доступ к настройкам плагина:

```typescript
import { printConsole, settings } from 'skyrimPlatform';

let option = settings['plugin-name']['my-option'];
printConsole(option);
```

Файл настроек плагина называется `plugin-settings.txt` и должен находиться в каталоге `Data/Platform/Plugins`.\
Формат файла — JSON, расширение `.txt` выбрано для удобства пользователей.

Изменение содержимого файла настроек запускает [горячую перезагрузку][Features].

## on/once

`on (eventName: string, callback: any): void`

`once (eventName: string, callback: any): void`

[Подписка][NewEvents] на событие с именем `eventName`.

## browser

Объект для [доступа к Chromium Embedded Framework][Browser].

<a id="other-methods-and-properties"></a>

## Другие методы и свойства

Дополнительные сведения и примеры будут добавлены позже:

- `worldPointToScreenPoint` — преобразует массив точек игрового мира в массив точек экрана пользователя. Точка на экране задаётся тремя числами от -1 до 1.
- `callNative (className: string, functionName: string, self ?: object, ... args: any): any` — вызывает функцию исходной игры по имени.
- `getJsMemoryUsage (): number` — получает объём оперативной памяти, используемой встроенным JS-движком, в байтах.
- `storage` — сохраняет данные между перезагрузками скриптов. Пример использования приведён в рецепте [Инициализация плагина][PluginInit].
- `getExtraContainerChanges` — получает ExtraContainerChanges указанной ObjectReference.
- `getContainer` — получает все предметы базового контейнера.
- `disableCtrlPrtScnHotkey` — отключает сочетание клавиш, которое привязывает скорость игры к частоте кадров вместо реального времени.

[Browser]: browser.md
[Features]: features.md
[NewEvents]: new_events.md
[PluginInit]: cookbook.md#plugin-initialization
