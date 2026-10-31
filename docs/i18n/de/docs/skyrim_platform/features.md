[Deutsch](features.md) · [English](../../../en/docs/skyrim_platform/features.md) · [Русский](../../../ru/docs/skyrim_platform/features.md)

# Hot Reload

- Hot Reload für SkyrimPlatform-Plugins wird unterstützt. Änderungen in `Data/Platform/Plugins` oder `Data/Platform/PluginsDev` laden alle Plugins ohne Neustart des Spiels neu.
- Verwende unser Beispiel-Plugin als Grundlage, um alle Funktionen einschließlich Hot Reload mit Strg+S zu nutzen: https://github.com/skyrim-multiplayer/skymp/tree/main/skyrim-platform/tools/plugin-example. Das Beispiel befindet sich auch im auf Nexus Mods veröffentlichten Archiv (Data/Platform/plugin-example).
- Beim Neuladen werden hinzugefügte Ereignis- und Hook-Handler entfernt, asynchrone Vorgänge unterbrochen und alle Variablen außer `storage` und dessen Eigenschaften zurückgesetzt.

<a id="changing-game-console-commands"></a>

# Spielkonsolenbefehle ändern

- SkyrimPlatform erlaubt das Ändern der Implementierung jedes Spielkonsolenbefehls. Rufe dazu `findConsoleCommand (commandName)` mit dem kurzen oder langen Befehlsnamen auf, um das Befehlsobjekt zu erhalten.

  ```typescript
  let getAV = findConsoleCommand("GetActorValueInfo");
  let getAV = findConsoleCommand("GetAVInfo");
  ```

- An diesem Objekt kannst du den kurzen (`shortName`) oder langen (`longName`) Befehlsnamen, die Zahl akzeptierter Argumente (`numArgs`) sowie die beim Konsolenaufruf ausgeführte Funktion (`execute`) ändern.

  ```typescript
  getAV.longName = 'printArg';
  getAV.shortName = '';
  getAV.execute = (refrId: number, arg: string) => {
    printConsole(arg);
    return false;
  };
  ```

- Der Rückgabewert deiner Implementierung bestimmt, ob die ursprüngliche Funktion des Befehls ausgeführt wird.
- Das erste Argument ist die FormId des Objekts, auf das sich der Konsolenbefehl bezieht, oder 0, falls keines angegeben ist.
- Die übrigen Parameter sind die beim Befehlsaufruf übergebenen Argumente vom Typ `string` oder `number`.
- Da Spielfunktionen in diesem Kontext nicht verfügbar sind, musst du einen `update`-Ereignishandler mit `once` registrieren, wenn du beim Konsolenaufruf eine Spielfunktion verwenden möchtest:

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

- SkyrimPlatform kann Informationen über Spielfunktionen in `Data / Platform / Output / DumpFunctions.txt` ausgeben (Tastenkombination 9 + O + L). Während DumpFunctions läuft, pausiert das Spiel einige Sekunden.

<a id="unhandled-exceptions"></a>

# Unbehandelte Ausnahmen

- Unbehandelte JS-Ausnahmen werden zusammen mit dem Aufrufstapel in der Konsole protokolliert.
- Unbehandelte Promise-Ablehnungen werden ebenfalls in der Konsole ausgegeben.
- Veröffentliche keine Plugins mit bekannten, unbehandelten Fehlern. Bei unbehandelten Ausnahmen ist die ordnungsgemäße Funktion von SkyrimPlatform nicht gewährleistet.
