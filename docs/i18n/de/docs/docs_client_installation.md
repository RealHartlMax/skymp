[Deutsch](docs_client_installation.md) · [English](../../en/docs/docs_client_installation.md) · [Русский](../../ru/docs/docs_client_installation.md)

<a id="client-installation"></a>

# Clientinstallation

Mit lokalem Fork und Launcher am **22. Oktober 2026** abgeglichen.

<a id="install-with-the-standalone-launcher"></a>

## Installation mit dem eigenständigen Launcher

1. Installiere deine eigene Skyrim Special Edition/Anniversary Edition und wähle im Launcher den Ordner mit `SkyrimSE.exe`.
2. Wähle den Server und verwende **Dateien vorbereiten**, um ohne Skyrim-Start zu testen.
3. Der Launcher lädt das Modmanifest des Servers, prüft lokale Spielmaster und lädt veröffentlichte Moddateien mit Größen-/SHA-256-Prüfung herunter.
4. Bietet der Server einen vollständigen versionierten Clientkatalog an, wählt der Launcher die passende Skyrim-Version und kann SKSE und Address Library installieren. Ein manuell gewähltes Clientpaket hat Vorrang.
5. **Verbinden** startet SKSE erst nach erfolgreicher Vorbereitung. Fehlende oder inkonsistente Pakete verhindern den Start.

Spieler benötigen für vom Betreiber gehostete Dateien kein Nexus-/Vortex-Konto. Das Spiel und passende Bethesda-Master bleiben lokale Voraussetzungen. Siehe [Modpakete](docs_launcher_modpacks.md), [Clientversionskataloge](docs_launcher_runtime_updates.md) und [SkyMP Worlds](docs_launcher_worlds.md).

<a id="manual-or-legacy-installation"></a>

## Manuelle oder ältere Installation

Der Quellbuild erzeugt `build/dist/client`. Kopiere dessen Inhalt in den Skyrim-Ordner und erhalte `Data/...` sowie die Paketstruktur. Installiere SKSE passend zur **exakten Spielruntime** und dem Clientrelease; wähle keinen Download allein nach einer allgemeinen Bezeichnung wie „aktuelles SE“. Offizielle SKSE-Downloads: <https://skse.silverlock.org/>. Installiere die passende Address Library und die erforderlichen Mods/Ladereihenfolge des Servers.

Runtime-DLLs gehören an die im Clientpaket angegebenen Pfade, einschließlich `Data/SKSE/Plugins/` und `Data/Platform/Distribution/RuntimeDependencies/`. Verbindungseinstellungen liegen getrennt unter `Data/Platform/Plugins/skymp5-client-settings.txt`; persönliche Zugangsdaten gehören nicht in verteilbare Runtime-Pakete.

<a id="compatibility-and-test-boundary"></a>

## Kompatibilität und Prüfgrenze

Der lokale CommonLib-Port baut jetzt Client-DLLs und besteht unabhängige Address-Library-Prüfungen für Format 1/2/5, einschließlich einer 1.7.104-Datenbank. Das belegt **nicht**, dass jeder native Hook, CEF oder eine Multiplayer-Sitzung mit Skyrim 1.7.104 funktioniert. Alte native Drittanbieter-DLLs können schon bei SKSE-Initialisierung vor jeder Serververbindung ausfallen.

Der vollständige Spieltest bleibt offen. Datierten Nachweis findest du unter [aktueller Projektstatus](docs_project_status.md). Trenne die Installation/den Download eines Pakets von erfolgreichem Spielen.
