[Deutsch](ini_settings.md) · [English](../../../en/docs/skyrim_platform/ini_settings.md) · [Русский](../../../ru/docs/skyrim_platform/ini_settings.md)

<a id="skyrim-platform-settings"></a>

## SkyrimPlatform-Einstellungen

Du kannst eigene SkyrimPlatform-Einstellungen im Code verwenden, um Werte aus `"Data/SKSE/Plugins/SkyrimPlatform.ini"` auszulesen und zu ändern.

<a id="current-settings"></a>

### Aktuelle Einstellungen

Dieser Abschnitt beschreibt die in der aktuellen SkyrimPlatform-Version implementierten INI-Einstellungen.

#### [Main]

- `PluginFolders = Data/Platform/Plugins;Data/Platform/PluginsDev` – Liste der Ordner, aus denen Plugins geladen werden.

#### [Debug]

- `LogLevel = 2` – Steuert die Protokollierungsstufe.
  > 0 – trace; 1 – debug; 2 – info; 3 – warn; 4 – error; 5 – critical; 6 – none
- `Cmd = false` – Steuert, ob die Konsole aktiviert ist.

- `CmdOffsetLeft = 0` – Abstand des Konsolenfensters vom linken Bildschirmrand.

- `CmdOffsetTop = 720` – Abstand des Konsolenfensters vom oberen Bildschirmrand.

- `CmdWidth = 1900` – Breite des Konsolenfensters.

- `CmdHeight = 317` – Höhe des Konsolenfensters.
  > Die Standardwerte sind für Full HD vorgesehen.

#### [Browser]

- `BackendName = auto` – Zu verwendendes Browser-Backend.
  > `off` – Browser deaktivieren; `tilted` – Tilted UI verwenden (Legacy); `nirnlab` – NirnLab UI Platform verwenden; `auto` – automatische Auswahl (fällt derzeit auf tilted zurück).

<a id="contributing-new-settings"></a>

### Neue Einstellungen beitragen

Dieser Abschnitt richtet sich an Entwickler, die neue INI-Einstellungen beitragen möchten.

Um beim Spielstart einen Standardwert anzulegen, suche die Methode Settings::GetPlatformSettings() und verwende dort:

- `SetInteger(section, key, value, comment)`
- `SetFloat(section, key, value, comment)`
- `SetBool(section, key, value, comment)`
- `SetString(section, key, value, comment)`

Du kannst Werte auch aus den Dateifeldern auslesen:

- `Int GetInteger(section, key, defaultValue)`
- `Float GetFloat(section, key, defaultValue)`
- `Bool GetBool(section, key, defaultValue)`
- `String GetString(section, key, defaultValue)`

<a id="example"></a>

### Beispiel

```c++
auto settings = Settings::GetPlatformSettings();

settings->SetInteger("Debug", "CmdHeight", 317, "; Set height for cmd");
settings->GetInteger("Debug", "LogLevel", spdlog::level::level_enum::info);
```
