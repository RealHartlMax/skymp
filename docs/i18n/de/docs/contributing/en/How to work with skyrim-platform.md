1. Erzeuge im Ordner `build` das Projekt mit `cmake .. -DSWEETPIE=OFF`. Das Abschalten von SweetPie erleichtert den Serverbeitritt.
2. Baue das gesamte Projekt mit `cmake --build . --config Release`.
3. Öffne `skymp.sln` im Ordner `build` per Doppelklick in Visual Studio.
4. Wechsle in `cmd` nach `skyrim-platform/tools/dev_service` und führe `npm run dev` aus.
