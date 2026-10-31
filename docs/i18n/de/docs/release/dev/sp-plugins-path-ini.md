[Deutsch](sp-plugins-path-ini.md) · [English](../../../../en/docs/release/dev/sp-plugins-path-ini.md) · [Русский](../../../../ru/docs/release/dev/sp-plugins-path-ini.md)

<a id="add-pluginfolders-ini-setting"></a>

## INI-Einstellung `PluginFolders` ergänzt

Die Ordner zum Laden von SkyrimPlatform-Plugins lassen sich jetzt anpassen.

<a id="new-skyrimplatformini-settings"></a>

### Neue Einstellungen in SkyrimPlatform.ini

Liste der Ordner, aus denen Plugins geladen werden.

```
[Main]

PluginFolders = your_path_1;your_path_2
```

Leerzeichen sind erlaubt:

```
[Main]

PluginFolders = "your path with whitespace"
```

<a id="removed-the-hardcoded-skymp-path"></a>

### Fest vorgegebenen SkyMP-Pfad entfernt

Der zuvor fest vorgegebene Pfad `C:/projects/skymp/build/dist/client/Data/Platform/Plugins` wurde entfernt. Wenn dieser Ordner existierte, ersetzte er die Standardpfade, hauptsächlich für die SkyMP-Entwicklung.
