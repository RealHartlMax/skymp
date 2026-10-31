1. Starte die Aktion SP Release: https://github.com/skyrim-multiplayer/skymp/actions/workflows/sp-release.yml. Sie erstellt gewöhnlich innerhalb einer Minute einen Pull Request.
2. Öffne den erzeugten Pull Request und prüfe Grammatik, Stil und Logik. Er soll mehrere Textdateien zusammenfassen und die Versionsnummer überall ändern.
3. Nimm den geprüften Pull Request an. Der historische Ablauf geht davon aus, dass die Änderungen bei Bedarf leicht zurückgerollt werden können.
4. Starte SP Types Update: https://github.com/skyrim-multiplayer/skymp/actions/workflows/trigger-sp-types-update.yml. Die Aktion dauert gewöhnlich weniger als eine Minute.
5. Prüfe, ob der Commit im Hauptbranch unter https://github.com/skyrim-platform/skyrim-platform angekommen ist.
6. Warte auf die Builds PR Windows und PR Windows AE im Hauptbranch.
7. Lade `Skyrim Platform 2.X.0 (Anniversary Edition).zip` und `Skyrim Platform 2.X.0 (Special Edition).zip` aus den Artefakten herunter.
8. Öffne die Dateiverwaltung auf Nexus: https://www.nexusmods.com/skyrimspecialedition/mods/edit/?id=54909&game_id=1704&step=files. Gehe zu „Add a new file“ und fülle die Felder aus:

Dateiname: `Skyrim Platform 2.X.0 (Anniversary Edition)`

Dateiversion: `2.X.0`

Neueste Modversion: `✔️`

Dateikategorie: `Main files`

Neue Version einer vorhandenen Datei, optional: `Yes it is!`

Beschreibung:

```
THIS IS FOR ANNIVERSARY EDITION (1.6.x)!

Please backup your saves before updating. There are issues with some modlists.

Changelog: https://github.com/skyrim-multiplayer/skymp/blob/main/docs/release/sp-2.XXXXXXXXX.md
For questions: https://discord.gg/k39uQ9Yudt
```

9. Hänge die Datei an und wähle „Save your file“.
10. Öffne erneut die Dateiverwaltung auf Nexus: https://www.nexusmods.com/skyrimspecialedition/mods/edit/?id=54909&game_id=1704&step=files. Gehe zu „Add a new file“ und fülle aus:

Dateiname: `Skyrim Platform 2.X.0 (Special Edition)`

Dateiversion: `2.X.0`

Neueste Modversion: `✔️`

Dateikategorie: `Main files`

Neue Version einer vorhandenen Datei, optional: `❌`

Beschreibung:

```
THIS IS FOR SPECIAL EDITION (1.5.x)!

Please backup your saves before updating. There are issues with some modlists.

Changelog: https://github.com/skyrim-multiplayer/skymp/blob/main/docs/release/sp-2.XXXXXXXXX.md
For questions: https://discord.gg/k39uQ9Yudt
```

11. Hänge die Datei an und wähle „Save your file“.
