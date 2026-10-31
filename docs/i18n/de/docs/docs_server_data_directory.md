[Deutsch](docs_server_data_directory.md) · [English](../../en/docs/docs_server_data_directory.md) · [Русский](../../ru/docs/docs_server_data_directory.md)

<a id="server-data-directory"></a>

# Server-Datenordner

> **Neu:** Mods liegen jetzt in `data/mods/<Mod>/`; `client-resources` wird nicht mehr gelesen. Angaben dazu auf dieser Seite sind überholt. Siehe [Mods in data/mods](docs_mod_folders.md).

Der Datenordner des Servers (Standard `"./data"`) enthält verschiedene Spielressourcen, darunter Mods und UI.

Die Veröffentlichung von Clientmods verwendet den separaten Ordner `client-resources/Data/`. Der eigenständige Launcher prüft Downloads und installiert sie vor dem SKSE-Start. Siehe [Launcher-Modpakete](docs_launcher_modpacks.md).

<a id="vanilla-skyrim-se-mods"></a>

## Vanilla-Mods von Skyrim SE

Dateien gehören in den Stamm des Datenordners und in `"loadOrder"` in `server-settings.json`. Client-Assets können mit Creation Kit oder Community-Werkzeugen als .bsa verpackt oder als lose Dateien unter `client-resources/Data/` für den eigenständigen Launcher veröffentlicht werden. Das Archiv muss denselben Namen wie der zugehörige Mod tragen, etwa `"FooBar.bsa"` zu `"FooBar.esp"`. BSA-Archive werden derzeit nur clientseitig verwendet. Serverseitig benötigte Skripte gehören in den Unterordner `scripts`.

Die Skyrim-Kernmaster (`*.esm`) werden benötigt, aber nicht in Server-Releasearchiven verteilt. Kopiere sie aus `Data` deiner eigenen Skyrim-Installation in den Stamm dieses Server-Datenordners.

Für die Standardladereihenfolge erforderlich:

- `Skyrim.esm`
- `Update.esm`
- `Dawnguard.esm`
- `HearthFires.esm`
- `Dragonborn.esm`

Quellorte:

- Windows (Steam default): `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\`
- Linux/Proton (Steam default): `~/.steam/steam/steamapps/common/Skyrim Special Edition/Data/`

## UI

`ui`-Assets werden über den HTTP-UI-Listener (`uiPort`) bereitgestellt.

- In Produktionsbuilds werden Frontend-Artefakte gewöhnlich am Speicherort des Server-UI-Bundles installiert.
- Bei lokaler Frontend-Entwicklung können `/ui/*`-Anfragen an den erkannten Webpack-Devserver (`localhost:1234`) weitergereicht werden.

## Manifest

Der Server erzeugt beim Start `manifest.json`. Ändere diese Datei nicht; passe stattdessen `server-settings.json` an.

`"versionMajor"` bezeichnet die Hauptversion des Manifests, derzeit `1`.
`"mods"` ist ein Array aus Objekten mit `"crc32"`, `"filename"`, `"size"`.
`"loadOrder"` stammt direkt aus `server-settings.json`.

Dieses native Spielmanifest bleibt Version 1. Es unterscheidet sich vom Launcher-Manifest Version 2 unter `/api/launcher/manifest` und dem optionalen Runtime-`catalog.json`. Die Versionsnummern beschreiben verschiedene Verträge.

<a id="runtime-generated-adminstate-files"></a>

## Zur Laufzeit erzeugte Admin-/Zustandsdateien

Je nach Funktionen und Admin-Nutzung kann der Server weitere Dateien in `dataDir` erstellen, beispielsweise:

- `admin-auth.json` – sicherer Admin-Zugangsspeicher
- `admin-bans.json` – gespeicherte Sperren
- `admin-mutes.json` – gespeicherte Stummschaltungen
- `admin-history.json` – Moderationsverlauf
- `admin-player-stats.json` – erfasste Spielerstatistiken für Adminansichten
- `admin-menu-debug.log` – optionales Admin-Menü-Debuglog
- `.admin/server-performance.json` – privater rollierender 24-Stunden-Minutenverlauf; diesen versteckten Ordner beim Update erhalten. Siehe [Servermetriken](docs_server_metrics.md).

Diese Dateien verwaltet die Serverruntime. Bearbeite sie nicht manuell, während der Server läuft.

## changeForms

`changeForms` speichert serialisierte Zustands-Snapshots von Actors und Objekten. Einige Adminfunktionen, etwa Offline-Inventarsnapshots, lesen diesen Ordner.
