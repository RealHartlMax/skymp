[Deutsch](../../../../de/docs/release/dev/sp-plugins-path-override-folder.md) · [English](../../../../en/docs/release/dev/sp-plugins-path-override-folder.md) · [Русский](sp-plugins-path-override-folder.md)

Новый необязательный аргумент `overrideFolder` для `writePlugin` и `getPluginSourceCode`: этот каталог может находиться вне списка `PluginFolders`. Он доступен для чтения и записи, но SkyrimPlatform не следит за ним и не загружает из него плагины. `overrideFolder` задаётся относительно `Data/Platform`.
