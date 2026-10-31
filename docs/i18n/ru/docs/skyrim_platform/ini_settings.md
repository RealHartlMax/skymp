[Deutsch](../../../de/docs/skyrim_platform/ini_settings.md) · [English](../../../en/docs/skyrim_platform/ini_settings.md) · [Русский](ini_settings.md)

<a id="skyrim-platform-settings"></a>

## Настройки SkyrimPlatform

В коде можно использовать собственные настройки SkyrimPlatform для чтения и изменения значений в `"Data/SKSE/Plugins/SkyrimPlatform.ini"`.

<a id="current-settings"></a>

### Текущие настройки

В этом разделе описаны INI-настройки, реализованные в текущей версии SkyrimPlatform.

#### [Main]

- `PluginFolders = Data/Platform/Plugins;Data/Platform/PluginsDev` — список каталогов, из которых загружаются плагины.

#### [Debug]

- `LogLevel = 2` — определяет уровень журналирования.
  > 0 — trace; 1 — debug; 2 — info; 3 — warn; 4 — error; 5 — critical; 6 — none
- `Cmd = false` — определяет, включена ли консоль.

- `CmdOffsetLeft = 0` — смещение окна консоли от левого края экрана.

- `CmdOffsetTop = 720` — смещение окна консоли от верхнего края экрана.

- `CmdWidth = 1900` — ширина окна консоли.

- `CmdHeight = 317` — высота окна консоли.
  > Значения по умолчанию рассчитаны на Full HD.

#### [Browser]

- `BackendName = auto` — используемый браузерный бэкенд.
  > `off` — отключить браузер; `tilted` — использовать Tilted UI (устаревший вариант); `nirnlab` — использовать NirnLab UI Platform; `auto` — автоматический выбор (сейчас возвращается к tilted).

<a id="contributing-new-settings"></a>

### Добавление новых настроек

Этот раздел предназначен для разработчиков, желающих добавить новые INI-настройки.

Чтобы создавать значение по умолчанию при запуске игры, найдите метод Settings::GetPlatformSettings() и используйте в нём:

- `SetInteger(section, key, value, comment)`
- `SetFloat(section, key, value, comment)`
- `SetBool(section, key, value, comment)`
- `SetString(section, key, value, comment)`

Значения полей файла также можно читать:

- `Int GetInteger(section, key, defaultValue)`
- `Float GetFloat(section, key, defaultValue)`
- `Bool GetBool(section, key, defaultValue)`
- `String GetString(section, key, defaultValue)`

<a id="example"></a>

### Пример

```c++
auto settings = Settings::GetPlatformSettings();

settings->SetInteger("Debug", "CmdHeight", 317, "; Set height for cmd");
settings->GetInteger("Debug", "LogLevel", spdlog::level::level_enum::info);
```
