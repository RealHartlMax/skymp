# Client, SKSE und Address Library unabhängig vom Launcher aktualisieren

## Threadpool-Korrektur vom 25. Oktober 2026

Der lokale Crashreport `e2f0b649790b2ddcbdfc6ec41f4d1616` enthielt noch die alte
`SkyrimPlatformImpl.dll` mit SHA-256
`f60f3c5c8b4853a98988140578852430ce828f8ad90a21a36cf749a2d0acb295`.
Die vorhandene Quellkorrektur kapselt `BS::thread_pool` in einer einzigen
Übersetzungseinheit. So teilen C++20- und C++latest-Verbraucher kein unterschiedlich
aufgebautes Threadpool-Objekt mehr. Der Regressionstest im Fork prüft beide
Sprachmodi, parallele Initialisierung, 1400 Aufgaben, Futures und das Beenden:

```powershell
# Aus dem build-Verzeichnis mit installierten MSVC-x64-Werkzeugen:
../misc/tests/thread-pool-abi/Run-Regression.ps1
cmake --build . --config Release --target skyrim_platform skyrim_platform_entry SkyrimPlatformCEF --parallel 4
```

Die neue Auslieferung liegt separat unter
`build/client-delivery-2026-10-25-threadpool/`. Sie enthält ein neues, unveränderliches
Runtime-Verzeichnis `1.7.104.0/client-2026-10-25-threadpool` und dessen Katalog.
Zuerst dieses Verzeichnis vollständig hochladen, anschließend den Katalog
umstellen. Weitere Skyrim-Versionen im produktiven Katalog beim Zusammenführen
erhalten. Eine manuelle alte Clientquelle im Launcher hat weiterhin Vorrang und
muss entfernt oder auf das neue Paket geändert werden. Die Launcher-EXE und
die Steam-DLL werden dafür nicht ersetzt.

Serverrevision r10 allein tauscht keine Client-DLL auf Spielerrechnern aus.
Build-, Prüfsummen- und Regressionsergebnisse stehen neben dem Runtime-Paket in
`VALIDIERUNG.json`. Ein erfolgreicher nativer Build belegt keinen bestandenen
Skyrim-/CEF-Spieltest; der jüngste Report enthält keinen Dump, der dieselbe
Fehleradresse erneut nachweisen könnte.

## Bisheriges Steam-Paket

Serverrevision r5 benötigt ein neues `skymp5-client.js` für Steam-Pflicht und
Gastzugang sowie eine neue Launcher-EXE für den nativen Steam-Ticketabruf.
Das lokale Paket `build/client-delivery-2026-10-24/` enthält einen vollständigen
Katalog für Skyrim 1.7.104.0; siehe dessen README zur Upload-Reihenfolge.
Die native Spielkompatibilität ist dadurch nicht zusätzlich qualifiziert.
Details: [Steam und Ingame-Login](docs_ingame_login.md).

Die Launcher-EXE enthält keine SKSE-/SkyMP-DLLs. Sie startet den SKSE-Loader aus
dem ausgewählten Spieleordner, nachdem Client- und Serverdateien vorbereitet wurden.
Ein installiertes Skyrim genügt für die Ersteinrichtung. Ein vollständiges externes
Clientpaket kann SKSE, dessen Papyrus-Skripte und die Address Library bereitstellen.

## Versionskatalog statt festem lokalen Buildpfad

Im Serverprofil und in `launcherResources.runtimeSource` wird eine stabile URL
zu `catalog.json` eingetragen, beispielsweise:

```json
{
  "launcherResources": {
    "runtimeSource": "https://dein-dateihost/client-runtime/catalog.json"
  }
}
```

Der Launcher liest die echte Dateiversion aus `SkyrimSE.exe`, ohne sie auszuführen,
und wählt genau den dazu passenden Katalogeintrag. Ein neueres Paket für eine andere
Skyrim-Version wird nicht als Ersatz verwendet. Gibt es keine passende Freigabe,
bleiben die aktiven Spieldateien erhalten und das Spiel wird nicht gestartet.

Der Katalog wird vor jeder Vorbereitung erneut abgefragt. HTTP-Anfragen verlangen
eine Cache-Neuvalidierung. Der Katalog enthält den SHA-256 des ausgewählten Manifests;
dieses wiederum enthält Größe und SHA-256 jeder Datei. Bereits passende Dateien
werden aus dem lokalen Cache verwendet. Neue Prüfsummen führen zu neuen Downloads.
Die bisherige Sicherung und Wiederherstellung wird weiterverwendet.

Eine bewusst eingetragene manuelle Clientquelle hat weiter Vorrang. Für automatische
Serverupdates muss das Feld **SkyMP-Clientpaket** im erweiterten Launcher-Profil leer
bleiben. Ein lokaler `build/dist/client`-Pfad aktualisiert sich nicht über das Internet.

## Ein vollständiges Paket erzeugen

Die folgenden Befehle werden im Launcher-Repository ausgeführt. Voraussetzung sind
ein für die Zielversion gebauter SkyMP-Client, ein entpacktes passendes SKSE-Archiv
und die passende Address-Library-Datei. Für jede freigegebene Skyrim-Version wird
ein eigenes unveränderliches Verzeichnis angelegt:

```powershell
node launcher/scripts/create-runtime-manifest.mjs `
  --source D:/GitHub/skymp/build/dist/client `
  --output ./publish/client-runtime/1.7.104.0/client-2026-10-21 `
  --game-version 1.7.104.0 `
  --skse-version 2.3.1 `
  --skse-source C:/Pakete/skse64_2_03_01 `
  --address-library C:/Pakete/AddressLibrary/SKSE/Plugins/versionlib-1-7-104-0.bin

node launcher/scripts/create-runtime-catalog.mjs `
  --root ./publish/client-runtime `
  --manifest 1.7.104.0/client-2026-10-21/runtime-manifest.json
```

Für mehrere Skyrim-Versionen `--manifest` pro freigegebenem Paket wiederholen.
Ein Katalog darf pro Skyrim-Version genau einen aktuellen Eintrag enthalten.
Beim gezielten Aktualisieren eines bestehenden Katalogs wird `--replace` ergänzt.
Bestehende Paketverzeichnisse werden nicht überschrieben.

Das Paketwerkzeug übernimmt die passenden SKSE-Loader-/Runtime-Dateien und die
Skripte aus dem angegebenen SKSE-Archiv. Andere SKSE-Runtime-DLLs und unpassende
Adressdatenbanken werden aus einem versionsgebundenen Paket ausgelassen.
Bethesda-Masterdateien, Kontodaten und persönliche Verbindungseinstellungen
werden nicht veröffentlicht.

Vor der Aktivierung prüft der Launcher zusätzlich die deklarierte Skyrim-Version,
die eingebetteten Versionen beider SKSE-Binärdateien und das Adressdatenbankformat.
Alte Clientmanifeste ohne Versionsangaben bleiben für vorhandene Server nutzbar;
für sie kann keine automatische Kompatibilitätszusage abgeleitet werden.

## Eine neue Ausgabe veröffentlichen

1. SkyMP-Client, SKSE und Address Library als zusammenpassende Kombination bauen,
   bereitstellen und prüfen. Ein neues Skyrim-Update kann auch Änderungen an den
   nativen SkyMP-DLLs erfordern; eine neue Adressdatei allein ersetzt diese nicht.
2. Ein neues Paketverzeichnis erzeugen und vollständig auf den Dateihost hochladen.
3. Den Katalog auf dieses Paket umstellen und **zuletzt** die neue `catalog.json`
   hochladen. Frühere Pakete zunächst für laufende Downloads verfügbar lassen.
4. Spieler erhalten bei der nächsten Vorbereitung die neue kompatible Freigabe.
   Für reine Paketupdates ist kein neuer Launcher-Build nötig.

Für den Katalog kurze Cache-Zeiten oder `Cache-Control: no-cache` konfigurieren.
Unveränderliche Paketpfade dürfen langfristig gecacht werden. Ein Release-Job kann
die beiden Werkzeuge nach bestandenem Client-Build automatisch ausführen und
anschließend diese Upload-Reihenfolge einhalten.

## Warum die vorhandene neue Address Library trotzdem nicht geöffnet wurde

Bei der Diagnose vom 21. Oktober 2026 waren Skyrim **1.7.104.0**, SKSE **2.3.1** und
`versionlib-1-7-104-0.bin` vorhanden. Die alte CommonLib in
`skymp_mod_research.dll` erkannte aber nur den Versionszweig 1.6 als AE. Version 1.7
fiel in den alten SE-Zweig: Die DLL suchte dadurch nach `version-1-7-104-0.bin`.
Zusätzlich fehlte ihrem Reader die Unterstützung für Datenformat 5.

Diese Dateisuche geschieht innerhalb des nativen Plugins, nachdem SKSE es lädt.
Der Launcher hat dabei keine andere Adressdatei ausgewählt. Die Datei umzubenennen
würde die fehlende Format- und Laufzeitunterstützung nicht ergänzen.
Das zusätzliche Research-Plugin gehört nicht zum SkyMP-Clientpaket und muss für
Skyrim 1.7 ebenfalls aktualisiert oder gezielt deaktiviert werden.

Die Launcher-Downloadtests und der eigenständige native Adressdatenbank-Test ersetzen
keinen vollständigen Skyrim-/SKSE-Spieltest. Dessen Ergebnis muss je Clientfreigabe
separat ausgewiesen werden.
