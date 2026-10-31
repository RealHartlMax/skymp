# Skyrim Platform

Skyrim-Mods in JavaScript/TypeScript erstellen. Diese Anleitung richtet sich an Entwickler solcher Mods und deren Nutzer.

## Unterstützte Spiele

Früher dokumentierte Release-Ziele:

- Skyrim SE/AE 1.6.1170.
- Skyrim SE/AE 1.6.640.
- Skyrim SE 1.5.97.0.8, veraltet; dafür werden keine Fehlerberichte mehr angenommen.

Lokaler Fork-Stand vom **22. Oktober 2026**: CommonLib wurde auf 7.5.4 portiert. Neue Client-Release-DLLs und unabhängige Address-Library-Prüfungen für Formate 1/2/5 einschließlich Skyrim 1.7.104 wurden erstellt. Vollständige SKSE-/CEF-/Spielabnahme bleibt offen. Steam-Version oder erfolgreicher Datenbanklesetest allein bestätigen keine Kompatibilität. Siehe [Projektstatus](../docs/docs_project_status.md) und [Client-Installation](../docs/docs_client_installation.md).

## Für Modentwickler

Vorteile:

- **JavaScript:** JSON, RegExp, Klassen, funktionale Programmierung und npm-Pakete.
- **Hot Reload:** SP beobachtet Plugins standardmäßig. Strg+S und Alt+Tab erlauben sofortiges Testen.
- **IDE-Unterstützung:** Viele Fehler fallen beim Kompilieren auf.
- **Promises/async/await:** Für asynchrone Papyrus-Aufrufe wie `Utility.wait`, `ObjectReference.setPosition` usw.
- **Sicherheit:** Schutz vor Nullzeigern, Threading-Problemen usw.
- **SKSE-Kompatibilität:** Fremde SKSE-Funktionen direkt aus JS/TS aufrufen.
- **Modmanager:** Keine Dateien im Skyrim-Hauptordner.
- **CEF:** Ingame-UI mit React, VueJS und ähnlichen Werkzeugen.

Nachteile:

- Begrenzte MCM-Unterstützung.
- Unzureichende Savegame-Unterstützung; Verwaltung des Spielzustands kann schwierig sein.
- Nutzer müssen Skyrim Platform installieren.
- Chromium-Animationen kosten FPS.
- Mehrere Chromium-Pluginoberflächen werden nicht ausreichend unterstützt; Umgehungslösungen sind nötig.

Besonders interessant ist Skyrim Platform für:

### JavaScript-Entwickler ohne Modding-Erfahrung

Dein vertrauter Technologiestapel ist auch für Skyrim verfügbar.

### Menschen mit ADHS

Hot Reload ermöglicht schnelle Prototypen und kurze Rückmeldeschleifen, deutlich schneller als Papyrus-/C++-Entwicklung.

Skyrim Platform eignet sich als Einstieg in Skyrim-Programmierung. Ein späterer Wechsel zu C++ bleibt möglich und wird häufig genutzt.

Siehe [Dokumentation](https://github.com/skyrim-multiplayer/skymp/blob/main/docs/docs_skyrim_platform.md) und [Plugin-Beispiel](https://github.com/skyrim-multiplayer/skymp/tree/main/skyrim-platform/tools/plugin-example). Viel Erfolg!

## Für Nutzer SP-basierter Mods

Die neueste Ausgabe steht auf der [Nexus-Mods-Seite](https://www.nexusmods.com/skyrimspecialedition/mods/54909). Die Nutzung hat einige Einschränkungen:

- **[SSE Engine Fixes](https://www.nexusmods.com/skyrimspecialedition/mods/17230) verwenden:** Sonst kann der Chromium-Prozess nach Spielende im Taskmanager verbleiben.
- **SkyrimPlatform führt Plugins aus:** FPS-Verlust liegt häufig an einem unoptimierten Plugin; auf Plattformseite ist das nur begrenzt behebbar.
- **Konflikte mit vielen Mods:** Kompatibilität beachten.
- Für SkyrimPlatform 1.5.97 werden keine Fehlerberichte mehr angenommen.
- **Update/Entfernung kann vorhandene Spielstände beschädigen:** Ein neues Spiel ist erforderlich.
- **Oft lassen sich Spielstände reparieren:** Siehe [angeheftete Nexus-Beiträge](https://www.nexusmods.com/skyrimspecialedition/mods/54909?tab=posts).

## Geplante Arbeit

- **Fehler und Kompatibilität:** Projekt und Entwickler investieren verfügbare Zeit in SP-Korrekturen.
- **NodeJS-Migration:** Aktuell treibt [ChakraCore](https://github.com/chakra-core/ChakraCore) den Mod an.
- **Schnellere Spielaufrufe:** Interne ES6-Proxies sollen wegoptimiert werden.
- **Dokumentation:** Unbeschriebene APIs dokumentieren; Beiträge willkommen.
- **SkyMP als Spiel:** Der Multiplayer-Mod benötigt eigene Skript-APIs; deshalb wird ein Teil der SkyrimPlatform-APIs auf dem SkyMP-Server implementiert.

## SkyMP

Es entsteht ein FiveM-/TES3MP-artiger Mod für Skyrim. Eine Ankündigung erfolgt nach ausreichender Fertigstellung.

## Häufige Fragen

**Wie verteile ich Plugins?** Als kompilierte JavaScript-Dateien, siehe `tsconfig.json` im Beispiel. Verteile `your-plugin-name.js`; Nutzer legen sie nach `Data/Platform/Plugins`.

**Wie konfigurieren Nutzer mein Plugin wie bei SKSE-INI-Dateien?** Über die Settings-API. Dateien liegen ebenfalls in `Data/Platform/Plugins`, enden auf `-settings.txt` und heißen etwa `your-plugin-name-settings.txt`.

**Wie erstelle ich ein Plugin?** Im Archiv liegt `Data/Platform/plugin-example` mit einer README zur Verwendung des Beispiels.

**Wie funktioniert Hot Reload?** Nach Befolgen von `Data/Platform/plugin-example/README.md` genügt Strg+S im Editor.
