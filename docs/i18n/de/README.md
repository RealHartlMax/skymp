# SkyMP Worlds

Skyrim-Multiplayer mit einem globalen Launcher, eigenen Community-Servern und einer
Verwaltung im Browser. Dieser Fork von [SkyMP](https://github.com/skyrim-multiplayer/skymp)
enthält den Gameserver, den nativen Spielclient und das Admin-Dashboard.

Der **[globale SkyMP-Worlds-Launcher](https://github.com/RealHartlMax/skymp-client-launcher)**
wird in einem eigenen Repository entwickelt. Spieler verwenden denselben Launcher
für verschiedene Server; er bereitet deren Mods und passende Clientdateien vor dem Spielstart vor.

**Stand: 26. Oktober 2026 · Testversion / WIP.** Der aktuelle Quellstand und die
Prüfgrenzen stehen im [Projektstatus](docs/docs_project_status.md).
Veröffentlichte Releases und lokale Testbuilds haben jeweils ihren eigenen Stand und Prüfnachweis.

Das [Admin-Dashboard](docs/docs_dashboard_operations.md) bietet eine gemeinsame
Einstellungsnavigation, Live-Metriken, Abbruchhistorie und tägliche
Gameserver-Neustarts mit Zeitzone. Die Webverwaltung bleibt beim Game-Stopp
erreichbar. Full- und Update-ZIPs bleiben getrennt.

| Dein Ziel | Einstieg |
| --- | --- |
| Als Spieler verbinden | [Globaler Launcher](https://github.com/RealHartlMax/skymp-client-launcher) · [Verbindungsanleitung](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md) |
| Eigenen Server einrichten | [Browser-Ersteinrichtung und Linux-VPS](docs/docs_linux_vps.md) · [Releases dieses Forks](https://github.com/RealHartlMax/skymp/releases) |
| Bestehenden Server aktualisieren | [Update-Anleitung mit Erhalt der eigenen Daten](docs/docs_packaged_server_update.md) |
| Am Projekt mitarbeiten | [Entwicklung](#entwicklung) · [Offene und erledigte Aufgaben](docs/docs_project_status.md) |



### Als Spieler verbinden

1. Eine eigene Skyrim-SE-/AE-Installation unter Windows bereithalten. Für die konkrete
   Version von `SkyrimSE.exe` muss ein passendes Clientpaket verfügbar sein.
2. Den [globalen Launcher](https://github.com/RealHartlMax/skymp-client-launcher) beziehen
   und unter **Einstellungen** den Skyrim-Spielordner auswählen.
3. Unter **Server entdecken** einen Server auswählen und **Verbinden** drücken.
   Für eigene Testserver steht **Direktverbindung** zur Verfügung.
4. Der Launcher prüft die lokalen Spieldateien, lädt fehlende oder geänderte Mods,
   prüft Dateigrößen und SHA-256 und aktiviert die Ladereihenfolge. Ein vollständiger
   Versionskatalog liefert außerdem den passenden SkyMP-Client samt SKSE, Address Library
   und Ingame-Oberfläche. Erst nach erfolgreicher Vorbereitung startet SKSE.
5. Steam starten und anmelden. Der aktualisierte Launcher übermittelt ein Steam-Ticket;
   der Server prüft die SteamID. Offene Gastserver benötigen kein Ingame-Konto,
   Freigabeserver warten auf die Dashboard-Freigabe. Nur im Kontomodus folgt der
   **Ingame-Login**. [Zugangsarten und Steam-Einrichtung](docs/docs_ingame_login.md).

Für die vom Betreiber bereitgestellten Dateien ist kein Nexus-/Vortex-Konto nötig.
Skyrim und benötigte Bethesda-/DLC-Dateien bleiben lokale Voraussetzungen.
Die Launcher-EXE enthält selbst keine SkyMP-/SKSE-DLLs; der Betreiber stellt ein
zur Spielversion passendes Runtime-Paket bereit. Bei einem unvollständigen Paket
müssen die fehlenden Komponenten bereits passend installiert sein.
Der Launcher bietet auch Vorbereitung ohne Spielstart und Wiederherstellung der Originaldateien.
Details: [Spielerverbindung](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md)
und [Client-Installation](docs/docs_client_installation.md).

### Eigenen Server einrichten

1. Ein vollständiges **Serverpaket dieses Forks** für **Linux x64** oder **Windows x64**
   in einen neuen Ordner entpacken. Veröffentlichte Pakete stehen unter
   [Releases](https://github.com/RealHartlMax/skymp/releases), lokale Testbuilds im
   [Projektstatus](docs/docs_project_status.md). Server- und Launcherpakete sind getrennte Ausgaben.
2. Die fünf eigenen Masterdateien nach `data/` kopieren:
   `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`, `Dragonborn.esm`.
3. Im Ordner mit `server-settings.json` unter Windows **`start-test-server.bat`**,
   unter Linux **`sh ./start-test-server.sh`** starten. Die Aliase
   `launch_server.bat` und `launch_server.sh` verwenden denselben Startablauf.
4. Die benötigten [Ports freigeben](docs/docs_vps_ports_and_process_control.md).
   Für einen direkten Test sind das **7777/UDP** für das Spiel und **8080/TCP**
   für Dashboard, WebSockets und Launcher-Downloads. Für HTTPS den Webzugriff über
   einen TLS-Reverse-Proxy auf **443/TCP** bereitstellen.
5. Die ausgegebene Browser-Adresse öffnen, standardmäßig **`http://<server>:8080/admin`**.
   Den zufälligen **vierstelligen Terminal-Code** im Browser eingeben. Dort Server,
   öffentliche Adresse, Ports und ein eigenes Admin-Konto einrichten.
6. Für die globale Serverliste unter **Einstellungen → Launcher-Anbindung**
   Master, öffentliche Server-ID, privaten Schlüssel und öffentliche Spieladresse
   hinterlegen. Ein registrierter, aktiver Servereintrag mit gültigem Heartbeat
   ist für die öffentliche Liste erforderlich. Siehe [SkyMP Worlds](docs/docs_launcher_worlds.md).

Die Startskripte prüfen Node.js 22+ und richten bei Bedarf eine private, geprüfte
Node-22-Laufzeit ein. JavaScript-Abhängigkeiten sind im Paket gebündelt; ein
`npm install` ist zum Start nicht erforderlich. Unter Ubuntu/Debian können fehlende
Systempakete mit passenden Rechten automatisch installiert werden. Die automatische
Einrichtung benötigt Internetzugriff; ein vollständiges System-Upgrade erfolgt nicht.
Es werden weder Admin-Zugangsdaten noch Skyrim-Masterdateien mitgeliefert.

**Das vollständige Dashboard bleibt bei Game-Stopp, Neustart und Absturz erreichbar.**
Die Prozesssteuerung im Dashboard betrifft den Gameserver. Anmeldung, Einstellungen,
Logs, Launcher-Downloads und der konfigurierte Discord-Bot laufen im Webserver weiter.
Dazu den mitgelieferten Starter verwenden.

Bestehende Installationen nach der [Update-Anleitung](docs/docs_packaged_server_update.md)
aktualisieren: Konfiguration, Admin-Konten, Weltdaten, Mods und eigenen Gamemode erhalten.

## Komponenten und Zuständigkeiten

| Komponente | Aufgabe | Quellcode |
| --- | --- | --- |
| Gameserver | Native Spielsimulation, Welt, Papyrus, Spieler und Synchronisierung unter Linux/Windows x64 | `skymp5-server/` in diesem Repository |
| Webserver und Admin-Dashboard | Browser-Setup, Konten, Einstellungen, Moderation, Konsole, Logs und Game-Prozesssteuerung | `skymp5-server/`, `skymp5-front/`, `misc/deploy/test-server/` |
| Discord-Bot | Game-Statusmeldungen, Warnungen und konfigurierte Rollenprüfung; läuft im Webserver | [Discord-Anleitung](docs/docs_discord_bot.md) |
| Nativer Spielclient und Ingame-UI | Skyrim-Integration, Verbindung, Anmeldung und Spieloberfläche | `skymp5-client/`, `skyrim-platform/`, `skymp5-front/` |
| Globaler Windows-Launcher | Server entdecken, Profile, Downloads, Dateiaktivierung, Wiederherstellung und SKSE-Start; Tauri, React und Rust | [Launcher-Repository](https://github.com/RealHartlMax/skymp-client-launcher) |
| SkyMP-Worlds-Webdienste | Zentrale Serverliste, Konten, Serververwaltung und Veröffentlichung von Clientpaketen; PHP-Webroots | [Webhosting im Launcher-Repository](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/PHP_HOSTING.md) |

Ein eigener Spielserver nutzt die gemeinsamen Webdienste oder eine entsprechend
betriebene Infrastruktur. Die Webdienste gehören zum separaten Launcher-Repository.
Ein Serverpaket enthält keine Launcher-EXE. Modmanifest und Runtime-Katalog sind
getrennte Schnittstellen: Servermods und native Clientkomponenten lassen sich so
unabhängig vom Launcher aktualisieren.

### Mods und Clientpakete veröffentlichen

- Eigene `.esp`-/`.esm`-/`.esl`-Plugins nach `data/` legen und in `loadOrder`
  aufnehmen. Zugehörige BSA-Dateien werden ebenfalls angeboten.
- Zusätzliche Clientdateien mit fertiger Skyrim-Verzeichnisstruktur unter
  `data/mods/<Mod>/` bereitstellen, etwa Texturen, Meshes, `Scripts/*.pex` und `SKSE/`.
- Serverseitige Papyrus-Dateien unter `data/scripts/` werden dadurch nicht automatisch
  beim Spieler installiert. Benötigte Clientskripte zusätzlich als Clientressourcen bereitstellen.
- `GET /api/launcher/manifest` liefert Zielpfade, Größen, SHA-256, lokale Voraussetzungen,
  Downloadadressen und Ladereihenfolge. Der Launcher verarbeitet die veröffentlichten Dateien vor dem Start.
- SkyMP, SKSE, Address Library und Ingame-UI als vollständigen, zur Spielversion passenden
  Runtime-Katalog veröffentlichen und unter **Launcher-Anbindung** im Feld
  **Clientpaket / Versionskatalog** hinterlegen.
  Die Zielpfade stammen aus dem Manifest, unter anderem `Data/Platform/Plugins`,
  `Data/SKSE/Plugins` und der Spielhauptordner.

Die Modpakete bestehen aus vorbereiteten Dateien; FOMOD-Installationsdialoge werden
nicht beim Spieler ausgeführt. Bethesda-/DLC-/Creation-Club-Dateien und private
Serverdaten gehören nicht in das Downloadpaket. Details und Veröffentlichungsschritte:
[Modpakete](docs/docs_launcher_modpacks.md) und [Runtime-Kataloge](docs/docs_launcher_runtime_updates.md).

### Netzwerk und unabhängige Verwaltung

| Verbindung | Standard | Verwendung |
| --- | --- | --- |
| Spiel | `7777/UDP` | Öffentliche Spielverbindung und Synchronisierung |
| Direkter Webzugriff | `8080/TCP` | Browser-Setup, Dashboard, HTTP-Downloads und WebSockets |
| Webzugriff mit TLS-Proxy | `443/TCP` öffentlich, `127.0.0.1:8080/TCP` intern | HTTPS/WSS; öffentliche 8080-Freigabe entfällt nach entsprechender Proxy-Einrichtung |
| Discord | Ausgehend `443/TCP` | HTTPS/WSS; kein zusätzlicher eingehender Bot-Port |
| Interne Prozesssteuerung | Loopback und private Node-IPC | Keine öffentliche Portfreigabe |

Die Werte sind konfigurierbar. Die öffentliche Spieladresse und die Downloadadresse
müssen für die Spieler erreichbar sein. Nur den Adminzugriff zu ermöglichen reicht
für Launcher-Downloads nicht aus. WebSockets verwenden denselben Webport wie HTTP.
Der mitgelieferte Starter verwaltet Web- und Game-Prozess getrennt; ein direkter Aufruf
des Game-Bundles umgeht diese Verwaltung. Details: [Ports und Prozesssteuerung](docs/docs_vps_ports_and_process_control.md).

Der Discord-Bot meldet bei passender Konfiguration Start, Stopp, Neustart, Bereitschaft,
Startfehler und unerwartetes Prozessende. Er bleibt bei gestopptem Gameserver verbunden.
Ein Ausfall des gesamten Webservers/VPS kann von diesem Bot nicht mehr gemeldet werden.
Ein automatischer Neustart des Gameservers nach einem Absturz ist derzeit nicht enthalten.

## Dokumentation

| Thema | Anleitung |
| --- | --- |
| Geprüfter Stand, Grenzen, erledigte und offene Aufgaben | [Projektstatus](docs/docs_project_status.md) · [Frontend-Roadmap](../../../ROADMAP_FRONTEND.md) |
| Server-Ersteinrichtung und Ubuntu-VPS | [Linux-VPS und Browser-Setup](docs/docs_linux_vps.md) |
| Bestehende Installation aktualisieren | [Paket-Updates](docs/docs_packaged_server_update.md) |
| Firewall, öffentliche Adressen und Prozesssteuerung | [VPS-Ports](docs/docs_vps_ports_and_process_control.md) |
| Mods für Spieler bereitstellen | [Launcher-Modpakete](docs/docs_launcher_modpacks.md) |
| Native Clientdateien und Updates veröffentlichen | [Runtime-Kataloge](docs/docs_launcher_runtime_updates.md) |
| Globale Serverliste, Master und Online-Anbindung | [SkyMP Worlds](docs/docs_launcher_worlds.md) |
| Steam, Gastzugang und Legacy-Login | [Spielerzugang](docs/docs_ingame_login.md) |
| Discord-Bot und Game-Überwachung | [Discord-Betrieb](docs/docs_discord_bot.md) |
| Konfiguration und Admin-Konsole | [Konfigurationsreferenz](docs/docs_server_configuration_reference.md) · [Konsolenbefehle](docs/docs_admin_console_commands.md) |
| Client-Installation und manueller Entwicklungsweg | [Client-Installation](docs/docs_client_installation.md) |
| Launcher-Verbindung und Serververwaltung | [Verbindung](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md) · [DE](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.de.md) / [EN](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.en.md) / [RU](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.ru.md) |
| PHP-Webdienste und Hosting | [Hosting im Launcher-Repository](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/PHP_HOSTING.md) |
| Quellcode-Aufbau | [Repository-Struktur](docs/docs_repository_structure.md) |

## Entwicklung

Den Fork einschließlich seiner Submodule auschecken:

```sh
git clone --recurse-submodules https://github.com/RealHartlMax/skymp.git
cd skymp
```

Toolchain, Konfiguration und Beiträge beschreibt [CONTRIBUTING.md](CONTRIBUTING.md).
Die für diesen Fork geprüfte Linux-Umgebung und Server-Buildschritte stehen in
[Linux-VPS → Eigenen Fork bauen](docs/docs_linux_vps.md#eigenen-fork-bauen).
Nach der CMake-Konfiguration Build und Tests **im Verzeichnis `build/`** ausführen:

```sh
cmake --build .
ctest --verbose
```

Ausgaben liegen unter `build/dist/server/` beziehungsweise `build/dist/client/`.
Lokale Server-Testpakete und Prüfnachweise liegen getrennt davon unter
`build/releases/`. Launcher, Runtime-Veröffentlichung und PHP-Webpakete
werden im [Launcher-Repository](https://github.com/RealHartlMax/skymp-client-launcher) gebaut.

### Prüfstand und Kompatibilität

Der Server wurde als Paket unter Windows x64 und Ubuntu 26.04.1 x64 geprüft:
Browser-PIN-Setup, Admin-Anmeldung, native Serverbereitschaft, Launcher-Downloads,
UDP-Bindung und unabhängige Dashboard-/Game-Prozesse. Discord wurde lokal mit
SDK-Testfällen geprüft; echte Zustellung in einem Discord-Server ist separat zu prüfen.

Ein erfolgreicher Download oder gestarteter Skyrim-Prozess bestätigt keine vollständige
Spielsitzung. Echte Skyrim-/SKSE-/CEF-Anmeldung, Multiplayer, VPS-Betrieb und Lasttests
bleiben eigene Prüfschritte. Die Windows-Native-Suite hat weiterhin den offenen
`Activate torch`-Fehler. Eine pauschale Kompatibilität mit jeder SE-/AE-Version oder
beliebigen Mods wird nicht zugesagt. Maßgeblich sind die Versionen und Prüfnachweise
des jeweils verwendeten Server- und Clientpakets; siehe [Projektstatus](docs/docs_project_status.md).

## Herkunft und Lizenzen

Dieser Fork baut auf [skyrim-multiplayer/skymp](https://github.com/skyrim-multiplayer/skymp)
auf. Der globale Launcher und die zugehörigen Webdienste werden separat in
[RealHartlMax/skymp-client-launcher](https://github.com/RealHartlMax/skymp-client-launcher) entwickelt.

Die jeweiligen Komponenten haben eigene Lizenzen, unter anderem für
[Server](../../../skymp5-server/LICENSE), [Client](../../../skymp5-client/LICENSE),
[Frontend](../../../skymp5-front/LICENSE) und [Skyrim Platform](../../../skyrim-platform/LICENSE).
Weitere Hinweise: [TERMS.md](TERMS.md) und [THIRD_PARTY_LICENSES](../../../THIRD_PARTY_LICENSES).
Skyrim und Bethesda-Spieldateien sind nicht Bestandteil der bereitgestellten Pakete.
