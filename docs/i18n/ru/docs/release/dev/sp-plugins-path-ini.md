[Deutsch](../../../../de/docs/release/dev/sp-plugins-path-ini.md) · [English](../../../../en/docs/release/dev/sp-plugins-path-ini.md) · [Русский](sp-plugins-path-ini.md)

<a id="add-pluginfolders-ini-setting"></a>

## Добавлена INI-настройка `PluginFolders`

Теперь можно настраивать каталоги загрузки плагинов SkyrimPlatform.

<a id="new-skyrimplatformini-settings"></a>

### Новые настройки SkyrimPlatform.ini

Список каталогов, из которых загружаются плагины.

```
[Main]

PluginFolders = your_path_1;your_path_2
```

Пробелы разрешены:

```
[Main]

PluginFolders = "your path with whitespace"
```

<a id="removed-the-hardcoded-skymp-path"></a>

### Удалён жёстко заданный путь SkyMP

Удалён ранее жёстко заданный путь `C:/projects/skymp/build/dist/client/Data/Platform/Plugins`. При существовании этого каталога он заменял стандартные пути, в основном для разработки SkyMP.
