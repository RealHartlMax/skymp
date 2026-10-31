[Deutsch](docs_mod_folders.md) · [English](../../en/docs/docs_mod_folders.md) · [Русский](../../ru/docs/docs_mod_folders.md)

# Mods in `data/mods` bereitstellen

Jede Mod liegt auf dem Server in einem eigenen Ordner. Das ersetzt `client-resources`, das nicht mehr gelesen wird. Auf dem PC der Spieler ändert sich nichts: Skyrim und SKSE laden nur aus `Data/`, deshalb installiert der Launcher die Dateien weiter dorthin.

## Aufbau

```text
data/
  Skyrim.esm
  mods/
    RaceMenu/
      RaceMenu.esp
      RaceMenuPlugin.esp
      RaceMenu.bsa
      SKSE/Plugins/skee64.dll
      SKSE/Plugins/skee64.ini
```

Beim Spieler landet `data/mods/RaceMenu/SKSE/Plugins/skee64.ini` als `Data/SKSE/Plugins/skee64.ini`.

## Regeln

- Ein Ordner wird verteilt, wenn eines seiner Plugins aktiv ist oder er gar keine Plugins enthält.
- Plugins werden im Dashboard aktiviert und als `mods/RaceMenu/RaceMenu.esp` in `loadOrder` gespeichert. Plugins direkt in `data/` funktionieren weiter.
- Enthalten zwei Mods dieselbe Datei, gewinnt der später eingeordnete Ordner. Die Reihenfolge steht in `modFolders`, sonst gilt die alphabetische Reihenfolge. Das Dashboard zeigt Konflikte an.
- Nicht verteilbare Dateien werden übersprungen und im Dashboard aufgelistet. Quell- und Debugdateien (`.pdb`, `.h`, `.psc`) sowie die Ordner `fomod`, `ModderResource` und `Source` werden still ignoriert.
- Der Server liest `Scripts` und `Strings` aus den Mod-Ordnern ebenfalls. Bei gleichen Skripten gewinnt auch hier der später eingeordnete Ordner.

## SKSE-DLLs

DLLs sind ausführbarer Code und passen nur zu einer bestimmten Skyrim-Version. Sie werden daher nur verteilt, wenn alle Bedingungen erfüllt sind:

1. Der Betreiber aktiviert die DLLs des Ordners im Dashboard. Gespeichert wird das in `launcherResources.skseFolders`.
2. Der Betreiber trägt die Skyrim-Version in `launcherResources.skseGameVersion` in vierteiliger Form ein, zum Beispiel `1.6.1170.0`.
3. Der Spieler bestätigt im Launcher jede DLL. Die Freigabe gilt pro Server und Datei-Hash; ändert sich die Datei, fragt der Launcher erneut.
4. Die installierte Skyrim-Version stimmt überein. Sonst bricht der Launcher ab.

Die Runtime-DLLs `SkyrimPlatform.dll` und `MpClientPlugin.dll` können nicht ersetzt werden. Das Manifest hat mit DLLs die Version 4; ältere Launcher lehnen es ab, statt die DLLs still zu überspringen. Spieler brauchen dafür also einen aktuellen Launcher.

## Umstieg von `client-resources`

Der Server veröffentlicht `client-resources` nicht mehr und warnt beim Start, wenn dort noch Dateien liegen. Verschiebe den Inhalt von `client-resources/Data/` nach `data/mods/<Mod>/` und starte den Server neu. Updates löschen den alten Ordner nicht. Das Feld `launcherResources.directory` wird nicht mehr verwendet.

Client-Runtime und Plugin-Runtimes bleiben davon unberührt.

## Sicherheit

Das Verzeichnis `data/` wird nicht mehr öffentlich ausgeliefert. Über HTTP ist daraus nur noch `/manifest.json` erreichbar; Mod-Dateien laufen über die Launcher-Downloads.

## Prüfstand

Die Server-Seite ist durch Tests abgedeckt. Die Launcher-Änderungen sind noch nicht gebaut und nicht mit `cargo test` geprüft, und im Spiel wurde noch nichts abgenommen.
