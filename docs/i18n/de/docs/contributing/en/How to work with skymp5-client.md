1. Der Repository-Pfad muss für diesen historischen Ablauf `C:/projects/skymp` lauten. Die fest eingebaute Pfadannahme soll später entfallen.
2. Erzeuge im Ordner `build` das Projekt mit `cmake .. -DSWEETPIE=OFF -DSKYRIM_DIR="<folder path>"`. Das Abschalten von SweetPie erleichtert den Serverbeitritt. Der Skyrim-Pfad ist erforderlich, damit der Server seine Masterdateien findet und starten kann.
3. Baue das gesamte Projekt mit `cmake --build . --config Release`.
4. Rufe im Projektstamm `code .` auf. Gearbeitet wird hauptsächlich an `skymp5-client`; öffne trotzdem das ganze Projekt, um andere Komponenten einsehen zu können.
5. Starte `cd build/dist/server` und `launch_server.bat`.
6. Kopiere `build/dist/client` in den Spielstamm. Leere `Data/Platform/Plugins`. In diesem Entwicklungsablauf verwendet SP stattdessen `build/dist/client/Data/Platform/Plugins`. Das ist für Hot Reload erforderlich.
7. Öffne `skymp5-client/package.json` in VS Code. Klicke im Abschnitt scripts mit der rechten Maustaste auf watch und wähle RunScript. Änderungen bauen nun `skymp5-client` neu und laden ihn ins Spiel.
8. Starte das Spiel mit `skse64_loader.exe`.
9. Für Synchronisierungstests kann die eigene Kopie sichtbar gemacht werden: `"show-me": true` in `build/dist/client/skymp5-client-settings.txt`. Ein Neustart ist nicht nötig.
10. `"show-net-info": true` aktiviert die Paketdiagnose.
11. `"show-movement-debug": true` zeigt Interpolations- und Vorhersagemetriken in der HUD-Diagnose an.
12. `"send-movement-debug-telemetry": false` deaktiviert das regelmäßige Senden von Bewegungsdiagnosen an den Server.

Führe den CMake-Build und watch nicht gleichzeitig aus. Sonst kann `skymp5-client` beschädigt werden und unverständliche Ausnahmen in der Spielkonsole auslösen. Ein Aus- und Wiedereinschalten von watch behebt diesen Zustand.

TODO aus der historischen Anleitung: Diese Funktion war wegen des festen Pfads nur beim ursprünglichen Autor verfügbar. Der Pfad sollte konfigurierbar werden, etwa über die Plattformkonfiguration nach Zusammenführung des AE-Branches. Da der dist-Pfad beim Bauen bekannt ist, könnte er auch automatisch ermittelt werden.
