[Deutsch](docs_skyrim_platform.md) · [English](../../en/docs/docs_skyrim_platform.md) · [Русский](../../ru/docs/docs_skyrim_platform.md)

# Skyrim Platform

<a id="this-information-is-for-mod-creators-for-general-details-please-read-the-local-skyrim-platform-readmeskyrim-platformreadmemd"></a>

## **Diese Informationen richten sich an Modentwickler. Allgemeine Informationen stehen in der [lokalen Skyrim-Platform-README](../skyrim-platform/README.md).**

Den aktuellen Runtime-/Buildstatus des Forks findest du unter [Projektstatus](docs_project_status.md). Eine API-Referenz oder ein erfolgreicher Clientbuild belegt keine vollständige Kompatibilität mit neueren Skyrim-Runtimes; die datierte Spielabnahme bleibt getrennt.

Skyrim Platform ist ein Modding-Werkzeug für Skyrim, mit dem sich Skripte in JavaScript/TypeScript schreiben lassen.

```ts
printConsole('Hello Platform');

on('update', () => {
  const gold = Game.getForm(0xf);
  const target = Game.getDialogueTarget();
  const player = Game.getPlayer();
  if (target && player && player.getItemCount(gold) >= 100) {
    player.removeItem(gold, 100, true, target);
    Debug.notification('You have just paid to an NPC');
  }
});
```

Ein auf Skyrim Platform basierender Mod ist der SkyMP-Client.\
Der Skyrim-Multiplayer-Client ist technisch also ein mit Skyrim Platform implementierter Mod für Skyrim Special Edition.

Hier findest du Dokumentation zum Erstellen eigener Mods mit Skyrim Platform.

Die Dokumentation wird zusammen mit SkyrimPlatform versioniert. Auf GitHub entspricht diese Seite wahrscheinlich der neuesten SP-Revision. SkyrimPlatform-Updates erscheinen in Abständen. [Hier](https://github.com/skyrim-multiplayer/skymp/tree/main/docs/release/dev) stehen die Inhalte des nächsten Updates.

Skyrim Platform auf Nexus: https://www.nexusmods.com/skyrimspecialedition/mods/54909

[Erstelle dein erstes Skyrim-Platform-Plugin!](https://github.com/skyrim-multiplayer/skymp/tree/main/skyrim-platform/tools/plugin-example)

<a id="table-of-contents"></a>

## Inhaltsverzeichnis

- Skyrim-Integration
  - [Papyrus-Objekte][Papyrus]
  - [Native Funktionen][Native]
  - [Hooks (Ereignisse)][Events]
- Von Skyrim Platform ergänzte Inhalte
  - [Besondere Funktionen][Features]
  - [Neue Methoden und Eigenschaften][NewMethods]
  - [Neue Typen][NewTypes]
  - [Neue Ereignisse][NewEvents]
  - [Browser/UI][Browser]
  - [HTTP][]
  - [Texte][Texts]
  - [Win32][Win32]
  - [Einstellungen][Settings]
- [Kochbuch][Cookbook]

[Browser]: skyrim_platform/browser.md
[Cookbook]: skyrim_platform/cookbook.md
[Events]: skyrim_platform/events.md
[Features]: skyrim_platform/features.md
[HTTP]: skyrim_platform/http.md
[Native]: skyrim_platform/native.md
[NewEvents]: skyrim_platform/new_events.md
[NewMethods]: skyrim_platform/new_methods.md
[NewTypes]: skyrim_platform/new_types.md
[Papyrus]: skyrim_platform/papyrus.md
[Texts]: skyrim_platform/texts.md
[Win32]: skyrim_platform/win32.md
[Settings]: skyrim_platform/ini_settings.md

<a id="versioning-notes"></a>

## Hinweise zur Versionierung

SP folgt [Semantic Versioning](https://semver.org/) für JavaScript, aber nicht für TypeScript.

Updates ohne Änderung der Hauptversion sollen kompilierte TypeScript- oder in JavaScript geschriebene Plugins nicht beschädigen. Falls doch, handelt es sich um einen SP-Fehler.

Eine Aktualisierung von `skyrimPlatform.ts` kann dagegen die Kompilierung deiner TypeScript-Plugins beeinträchtigen. Meist lassen sich diese Probleme leicht beheben. Alternativ kannst du im Discord um Hilfe bitten oder `skyrimPlatform.ts` einer früheren Version verwenden.
