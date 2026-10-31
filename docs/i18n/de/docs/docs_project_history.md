[Deutsch](docs_project_history.md) · [English](../../en/docs/docs_project_history.md) · [Русский](../../ru/docs/docs_project_history.md)

<a id="project-history"></a>

# Projektgeschichte

21. November 2015: Wir beschlossen den Projektstart und begannen mit der Entwicklung.

### SkyMP 0.0.1 Pre Alpha

In C++ geschrieben; enthielt nur grundlegende Bewegungssynchronisierung. Bei der Erstellung existierte noch kein eigenes Git-Repository.

Erstmals am 17. September 2016 getestet.

- [plugin_example (skymp dll)](https://github.com/Pospelove/plugin_example-skymp-dll)

### SkyMP ???

Einige Versionen gingen verloren, weil ich Git nicht verwendete!

### SkyMP 0.9, 1.0+

In C++ geschrieben, inspiriert von GTA SA-MP und TES3MP. März 2017 bis Juni 2018.

Erstmals im September 2017 getestet.

Besitzt ein Lua-Skriptsystem.

- [SkyMP Client](https://bitbucket.org/skymp_team/skymp-client)
- [SkyMP Dedicated Server](https://bitbucket.org/skymp_team/skymp-dedicated-server)
- [SkyMP Official GameMode](https://bitbucket.org/skymp_team/skymp-official-gamemode) – Lua-Gamemode namens Secunda.
- [Reman](https://bitbucket.org/skymp_team/reman) – Python-Werkzeug zum entfernten Serverstart.
- [Secunda World](https://bitbucket.org/skymp_team/secunda-world) – Weltsicherung der offenen Beta 2018.

### SkyMP 2.0+

In C++ und JavaScript geschrieben. Juni 2018 bis März 2019.

Zustandsloser Server, alle Daten in MongoDB.

Besitzt ein clientseitiges Lua-Skriptsystem.

Zum Zeitpunkt dieser Veröffentlichung die beliebteste Version: über 30.000 Downloads zum Start der offenen Beta 2019, 1000/1000 Spieler online. Wegen technischer Probleme mussten wir die Beta beenden; den Server online zu halten war sehr aufwendig.

- [skymp2](https://gitlab.com/pospelov/skymp2)
- [skymp2-installer](https://gitlab.com/pospelov/skymp2-installer)
- [secunda2](https://gitlab.com/pospelov/secunda2)
- [skymp2-binaries](https://gitlab.com/pospelov/skymp2-binaries)
- [skymp2-cellhost](https://gitlab.com/pospelov/skymp2-cellhost)
- [skymp2-node](https://gitlab.com/pospelov/skymp2-node)
- [skymp2-scripts](https://gitlab.com/pospelov/skymp2-scripts)
- [skymp2-server](https://gitlab.com/pospelov/skymp2-server)
- [skymp2-loadtest](https://gitlab.com/pospelov/skymp2-loadtest)
- [skymp2-monitor](https://gitlab.com/pospelov/skymp2-monitor)

### SkyMP 3

In C++ geschrieben. März 2019 bis Januar 2020.

Skriptsystem auf NodeJS-Basis.

Führte asynchrones Multiplayer-Framework, Masterserver, zustandslose Gamemodes auf entfernten Rechnern und parallele Zellverarbeitung auf dem Server ein.

Papyrus VM und lib_espm entstanden, aber die VM wurde noch nicht verwendet.

Ich integrierte CEF, genauer CEFSharp.

Leider funktionierte es nicht zuverlässig; es gab viele Fehler und Abstürze.

- [skymp](https://gitlab.com/pospelov/skymp)
- [skymp3](https://gitlab.com/pospelov/skymp3)
- [skymp20](https://gitlab.com/pospelov/skymp20)

### SkyMP 20 / SKYRIM ROYALE

In C++ auf Basis von SkyMP 3. Januar bis April 2020.

Unit-Tests im Spiel mit Abdeckung.

Serverstart aus der Spieloberfläche.

Dynamische Feuerwand.

Auf SkyMP 20 basierend. Wir behielten dies als Aprilscherz und veröffentlichten es nie.

https://youtu.be/8ccDfIxCLlc

### Skyrim Multiplayer / SkyMP 5

In C++ und TypeScript geschrieben. April 2020 bis heute.

[Skyrim Platform](https://github.com/skyrim-multiplayer/skymp/tree/main/skyrim-platform) entstand als TypeScript-Umgebung für Skyrim SE. Damit lassen sich Skyrim-Plugins sehr schnell entwickeln; Hot Reload eignet sich besonders für Prototypen.

2020 und 2021 umfangreich getestet, maximale gleichzeitige Spielerzahl jedoch ungefähr 70.

- [skymp](https://github.com/skyrim-multiplayer/skymp)
- [skymp-master-api](https://github.com/skyrim-multiplayer/skymp-master-api)
- [papyrus-compiler](https://github.com/skyrim-multiplayer/papyrus-compiler)
