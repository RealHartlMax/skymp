# Dein erstes Skyrim-Platform-Plugin erstellen

- [Skyrim Platform installieren](#install-skyrim-platform)
- [Node.js installieren](#install-nodejs)
- [VSCode installieren](#install-vscode)
- [Beispiel kopieren](#copy-example-plugin)
- [Beispiel öffnen](#open-example-plugin)
- [Skyrim-Pfad einstellen](#configure-skyrim-path)
- [Plugin benennen](#configure-plugin-name)
- [Plugin kompilieren](#compile-plugin)
- [Plugin in Skyrim ansehen](#view-plugin-running-in-skyrim)
- [Hauptdatei ansehen](#view-the-main-plugin-file)
- [Eigene Änderungen](#make-your-own-changes-to-the-plugin)
- [Bibliotheken importieren](#importing-third-party-libraries)
- [Plugin verteilen](#distributing-your-skyrim-platform-plugin)
- [Dokumentation lesen](#read-the-documentation)
- [Discord beitreten](#join-the-discord)
- [Lizenz](#license)

## Skyrim Platform installieren

Installiere zuerst Skyrim Platform mit deinem bevorzugten Modmanager:

- https://www.nexusmods.com/skyrimspecialedition/mods/54909

## Node.js installieren

Außerdem brauchst du Node.js:

- https://nodejs.org

> Sowohl LTS als auch Current sind möglich.

## VSCode installieren

Ein Editor mit guter TypeScript-Unterstützung wird empfohlen. Wenn du keinen anderen bevorzugst, installiere [VSCode](https://code.visualstudio.com/).

> Das Beispiel enthält VSCode-Unterstützung.

## Beispiel-Plugin kopieren

Im heruntergeladenen Skyrim-Platform-Mod liegt `plugin-example`. Wähle Skyrim Platform im Modmanager und öffne ihn im Dateisystem:

- Vortex: `Open in File Manager`.
- Mod Organizer 2: `Open in Explorer`.

Im Ordner `Platform` findest du `plugin-example`. Kopiere diesen Unterordner an einen Ort **außerhalb des Skyrim-Ordners**.

> Anders als klassische Mods müssen reine Skyrim-Platform-Plugins nicht in den MO2-/Vortex-Modordner, solange sie keine Spielassets wie Texturen oder Modelle enthalten. Lege das Entwicklungsprojekt möglichst weder in einem MO2-Modordner noch unter Skyrim ab.

## Beispiel öffnen

Öffne in VS Code `example-plugin.code-workspace` per Doppelklick. In anderen Editoren/IDEs öffnest du den Plugin-Ordner.

## Skyrim-Pfad einstellen

Öffne `skyrim.json` und setze den Pfad auf deinen Skyrim-Ordner:

```js
{
    "skyrimFolder": "C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition"
}
```

> Alternativ die Umgebungsvariable `SKYRIMPATH` setzen. Das ist bei mehreren Projekten oder Teammitgliedern mit unterschiedlichen Installationspfaden praktisch.

## Plugin-Namen einstellen

Jedes Plugin braucht einen eindeutigen Namen. Ändere `"name"` in `package.json`, beispielsweise:

```json
{
  "name": "my-cool-plugin",
  "version": "1.0.0",
```

> Keine Leerzeichen, nur Kleinbuchstaben und Bindestriche verwenden.

## Plugin kompilieren

Wähle `Terminal` → `Run Build Task...` oder drücke Strg+Umschalt+B. Das Terminal:

- installiert npm-Abhängigkeiten,
- kompiliert und bündelt das Plugin,
- kopiert es in das Skyrim-Platform-Pluginverzeichnis,
- beobachtet Änderungen und wiederholt diese Schritte automatisch.

Manuell: `npm run dev`. Unter `[Skyrim Folder]\Data\Platform\PluginsDev` muss `[your plugin name].js` erscheinen.

## Plugin in Skyrim ansehen

Starte Skyrim mit installiertem Skyrim Platform. Öffne im Hauptmenü mit `~` die Konsole. Bei erfolgreicher Installation erscheint:

```
Hello SE
```

Bei laufendem Plugin:

```
[Script] Hello! You can view this in the Skyrim ~ console on the Main Menu when the game runs
```

Für einen schnellen Spieltest eingeben und Enter drücken:

```
coc riverwood
```

Nach dem Laden von Riverwood erscheint ein Dialog:

```
Hello! This will appear when a new game is started or an existing game is loaded
```

Jetzt kannst du das Plugin ändern. **Mit Alt+Tab aus dem Spiel wechseln und bearbeiten; Änderungen werden direkt im Spiel wirksam.**

## Hauptdatei ansehen

Die Hauptdatei des Beispiels liegt unter `src/`:

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

## Eigene Änderungen am Plugin

Ersetze im Code den Text, beispielsweise:

```ts
import { Debug, once, printConsole } from 'skyrimPlatform';

once('update', () => {
  Debug.messageBox('Hey look! I changed this! Yay!');
});
```

Solange `Run Build Task...` beziehungsweise `npm run dev` läuft, wird automatisch neu kompiliert. Nach Alt+Tab zurück ins Spiel sollte der Dialog sofort erscheinen. Sonst prüfen, ob das Terminal noch läuft und keine Fehler meldet.

## Fremde Bibliotheken importieren

Als Abhängigkeiten installierte Bibliotheken werden mit `webpack` eingebündelt, egal ob eigene oder fremde. Häufig sind Skyrim-Hilfsbibliotheken wie [`PapyrusUtil`][PapyrusUtil] oder [`JContainers`][JContainers].

Installiere beispielsweise mit `npm i @skyrim-platform/papyrus-util` die TypeScript-Bibliothek zum Aufruf nativer PapyrusUtil-Funktionen. Passe `src/index.ts` an:

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

Das zeigt eine Funktion einer üblichen Skyrim-Bibliothek. Weitere Dokumentation steht auf deren npm-Seite oder im GitHub-Repository.

> Die Dokumentation fremder Bibliotheken ist nicht Teil dieser README.

## Skyrim-Platform-Plugin verteilen

Ein fertiges Plugin lässt sich als ZIP über Modseiten wie NexusMods verteilen. Paket erstellen:

```
npm run zip
```

Im Projekt erscheint `[your plugin name from package.json]-[your plugin version from package.json].zip`.

Mit Texturen/Modellen kannst du selbst archivieren. Das Archiv enthält `Platform/Plugins` mit der gebündelten JavaScript-Ausgabe.

#### `myplugin-1.0.0.zip`

```
Platform\
  Plugins\
    plugin-file-1.0.0.js
```

> Keine `.ts`-Quelldateien oder `.js` aus `dist/` paketieren. Verwende die für Skyrim Platform gebündelte `.js` aus `build/`.

## Dokumentation lesen

Du kannst nun beginnen. Skyrim-Platform-Dokumentation:

- https://github.com/skyrim-multiplayer/skymp/blob/main/docs/docs_skyrim_platform.md

## Discord beitreten

Weitere Hilfe: https://discord.gg/P8yg7YKY2e

## Lizenz

Dein Plugin ist deine Software; die Lizenz wählst du selbst. Skyrim Platform wird unter [GNU GPL v3.0][GPLv3] verteilt.

[PapyrusUtil]: https://www.nexusmods.com/skyrimspecialedition/mods/13048
[JContainers]: https://www.nexusmods.com/skyrimspecialedition/mods/16495
[GPLv3]: https://www.gnu.org/licenses/gpl-3.0.en.html
