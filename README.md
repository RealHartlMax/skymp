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

[Deutsch](#deutsch) · [English](#english) · [Русский](#русский) ·
[Español](#español) · [Français](#français) · [Italiano](#italiano)

## Deutsch

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

## English

### Join a server

1. Have your own Skyrim SE/AE installation on Windows. Your exact `SkyrimSE.exe`
   version needs a matching client runtime.
2. Get the [global launcher](https://github.com/RealHartlMax/skymp-client-launcher)
   and select your Skyrim folder in settings.
3. Discover a server and choose **Connect**, or use a direct connection for a test server.
4. The launcher checks local game requirements, downloads missing or changed mods,
   verifies sizes and SHA-256, and applies the load order. A complete version catalog
   also supplies the matching SkyMP client, SKSE, Address Library and in-game UI.
   SKSE starts after preparation succeeds. Incomplete runtime packages require the
   missing matching components to be installed separately.
5. Run Steam and sign in. The updated launcher obtains a Steam ticket and the server
   verifies the Steam ID. Guest-open needs no in-game account; approval mode waits
   for an administrator. Account mode additionally uses the **in-game login**.
   See [Steam and login modes](docs/docs_ingame_login.md).

Operator-hosted downloads need no Nexus/Vortex account. Skyrim and required Bethesda/DLC
files must already be available locally. The launcher EXE contains no SkyMP/SKSE DLLs;
operators publish the runtime separately. Preparation without launching and restoration
of original files are also available. See the
[connection guide](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md).

### Host a server

1. Extract a complete **Linux x64 or Windows x64 server package from this fork** into a
   new directory. See [releases](https://github.com/RealHartlMax/skymp/releases) and
   [local build status](docs/docs_project_status.md). Launcher packages are separate.
2. Put your own `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`
   and `Dragonborn.esm` in `data/`.
3. Run `start-test-server.bat` on Windows or `sh ./start-test-server.sh` on Linux
   from the directory containing `server-settings.json`. The `launch_server` aliases use the same flow.
4. Allow **7777/UDP** for gameplay and **8080/TCP** for HTTP/WebSockets/downloads;
   use **443/TCP** through a TLS reverse proxy for HTTPS.
5. Open `http://<server>:8080/admin`, enter the random **four-digit terminal code**,
   and configure the server and your own admin account in the browser.
6. Configure Launcher integration in the dashboard. Public discovery requires a
   registered, active server and a valid heartbeat.

Starters can install a private Node 22 runtime and missing Ubuntu/Debian system packages
with suitable permissions and internet access. JavaScript dependencies are bundled.
No admin credentials or Skyrim masters are shipped. Game stop/restart/crash leaves the
full dashboard, logs, downloads and configured Discord bot running in the web process.
For updates, preserve configuration, accounts, world data, mods and custom gamemodes.

[Server setup](docs/docs_linux_vps.md) · [Safe updates](docs/docs_packaged_server_update.md) ·
[Server owner guide](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.en.md)

## Русский

### Подключение к серверу

1. Нужна собственная установленная Skyrim SE/AE под Windows. Для точной версии
   `SkyrimSE.exe` должен быть доступен совместимый клиентский пакет.
2. Установите [глобальный лаунчер](https://github.com/RealHartlMax/skymp-client-launcher)
   и выберите папку Skyrim в настройках.
3. Найдите сервер и нажмите **Подключиться**. Для тестового сервера доступно прямое подключение.
4. Лаунчер проверяет локальные игровые файлы, загружает недостающие или изменённые моды,
   проверяет размеры и SHA-256 и применяет порядок загрузки. Полный каталог версий
   также предоставляет подходящие SkyMP-клиент, SKSE, Address Library и игровой интерфейс.
   SKSE запускается после успешной подготовки. Для неполного пакета недостающие
   совместимые компоненты необходимо установить отдельно.
5. Запустите Steam и войдите в аккаунт. Новый лаунчер получает билет Steam, а сервер
   проверяет SteamID. Гостям игровой аккаунт не нужен; при режиме одобрения требуется
   разрешение администратора. Режим аккаунта дополнительно требует **входа в игре**.
   [Steam и варианты входа](docs/docs_ingame_login.md).

Для файлов, предоставленных оператором сервера, аккаунт Nexus/Vortex не нужен.
Skyrim и необходимые файлы Bethesda/DLC должны быть установлены локально.
EXE лаунчера не содержит DLL SkyMP/SKSE: оператор публикует клиентский пакет отдельно.
Доступны подготовка без запуска игры и восстановление исходных файлов. Подробнее:
[подключение](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md).

### Создание сервера

1. Распакуйте полный **серверный пакет этого форка для Linux x64 или Windows x64**
   в новую папку. См. [релизы](https://github.com/RealHartlMax/skymp/releases) и
   [состояние локальных сборок](docs/docs_project_status.md). Лаунчер поставляется отдельно.
2. Скопируйте собственные `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`,
   `HearthFires.esm` и `Dragonborn.esm` в `data/`.
3. Из папки с `server-settings.json` запустите `start-test-server.bat` под Windows
   или `sh ./start-test-server.sh` под Linux. Скрипты `launch_server` используют тот же запуск.
4. Откройте **7777/UDP** для игры и **8080/TCP** для HTTP/WebSocket/загрузок;
   для HTTPS используйте TLS reverse proxy на **443/TCP**.
5. Откройте `http://<server>:8080/admin`, введите случайный **четырёхзначный код
   из терминала** и настройте сервер и собственную учётную запись администратора в браузере.
6. Настройте интеграцию с лаунчером в панели. Публичный список требует
   зарегистрированный активный сервер и действующий heartbeat.

Скрипты запуска могут установить приватную среду Node 22 и недостающие системные
пакеты Ubuntu/Debian при наличии прав и интернета. JavaScript-зависимости включены.
Готовые пароли и мастер-файлы Skyrim не поставляются. Остановка, перезапуск или сбой
игрового процесса сохраняют полную панель, журналы, загрузки и настроенного Discord-бота
в веб-процессе. При обновлении сохраняйте настройки, учётные записи, миры, моды и свой gamemode.

[Установка сервера](docs/docs_linux_vps.md) · [Обновление](docs/docs_packaged_server_update.md) ·
[Руководство оператора](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/SERVER_OWNER_GUIDE.ru.md)

## Español

Un único [launcher global](https://github.com/RealHartlMax/skymp-client-launcher)
permite conectarse a diferentes servidores de SkyMP Worlds.

1. Instala tu propia copia de Skyrim SE/AE en Windows y selecciona su carpeta en el launcher.
2. Elige un servidor y pulsa **Conectar**, o utiliza la conexión directa para pruebas.
3. El launcher verifica los archivos locales, descarga los mods, comprueba tamaños y SHA-256
   y aplica el orden de carga. Un catálogo completo aporta el cliente SkyMP, SKSE,
   Address Library y la interfaz del juego compatibles con tu versión exacta de Skyrim.
4. Inicia sesión en Steam. El launcher actualizado obtiene un ticket y el servidor verifica
   tu SteamID antes de iniciar el juego. El acceso de invitado no necesita cuenta del juego;
   el modo con aprobación espera al administrador. Solo el modo de cuenta añade el login
   dentro del juego. [Steam y modos de acceso](docs/docs_ingame_login.md).

Las descargas del operador no requieren una cuenta Nexus/Vortex. Skyrim y sus archivos
Bethesda/DLC deben estar instalados. Las DLL se distribuyen en un paquete separado del launcher.

**Servidor:** extrae un paquete completo de este fork para Linux x64 o Windows x64 en una
carpeta nueva y copia los cinco archivos maestros indicados en [English](#english) a `data/`.
Ejecuta `start-test-server.bat` o `sh ./start-test-server.sh` desde la carpeta del servidor.
Abre `http://<server>:8080/admin`, introduce el **código aleatorio de cuatro dígitos**
del terminal y configura el servidor y tu administrador en el navegador. El inicio puede
instalar Node 22 y las dependencias de sistema Ubuntu/Debian necesarias con permisos e internet.

Puertos: **7777/UDP** y **8080/TCP**, o **443/TCP** mediante proxy TLS. La lista pública
requiere un registro activo y heartbeat válido. El panel completo, las descargas y el bot
Discord configurado siguen activos al detener o reiniciar el juego, incluso tras un fallo.
Para actualizar, conserva configuración, cuentas, mundos, mods y gamemode.

[Instalación](docs/docs_linux_vps.md) · [Actualización](docs/docs_packaged_server_update.md) ·
[Conexión](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md)

## Français

Le même [launcher global](https://github.com/RealHartlMax/skymp-client-launcher)
permet de rejoindre différents serveurs SkyMP Worlds.

1. Installez votre propre Skyrim SE/AE sous Windows et sélectionnez son dossier dans le launcher.
2. Choisissez un serveur et cliquez sur **Connexion**, ou utilisez la connexion directe pour un test.
3. Le launcher vérifie les fichiers locaux, télécharge les mods, contrôle tailles et SHA-256
   et applique l'ordre de chargement. Un catalogue complet fournit le client SkyMP, SKSE,
   Address Library et l'interface du jeu adaptés à la version exacte de Skyrim.
4. Connectez-vous à Steam. Le launcher actualisé obtient un ticket et le serveur vérifie
   votre SteamID avant le lancement. L’accès invité ne demande aucun compte de jeu ;
   le mode avec approbation attend l’administrateur. Seul le mode compte ajoute
   la connexion dans le jeu. [Steam et modes d’accès](docs/docs_ingame_login.md).

Les téléchargements fournis par l'opérateur ne nécessitent aucun compte Nexus/Vortex.
Skyrim et les fichiers Bethesda/DLC doivent être installés. Les DLL sont distribuées séparément du launcher.

**Serveur :** extrayez un paquet complet de ce fork pour Linux x64 ou Windows x64 dans
un nouveau dossier et copiez les cinq fichiers maîtres indiqués dans [English](#english) vers `data/`.
Lancez `start-test-server.bat` ou `sh ./start-test-server.sh` depuis le dossier du serveur.
Ouvrez `http://<server>:8080/admin`, saisissez le **code aléatoire à quatre chiffres**
du terminal, puis configurez le serveur et votre administrateur dans le navigateur.
Le démarrage peut installer Node 22 et les paquets système Ubuntu/Debian manquants avec les droits et internet nécessaires.

Ports : **7777/UDP** et **8080/TCP**, ou **443/TCP** via un reverse proxy TLS. La liste
publique exige un serveur enregistré actif et un heartbeat valide. Le tableau de bord complet,
les téléchargements et le bot Discord configuré restent disponibles lorsque le jeu s'arrête,
redémarre ou plante. Lors des mises à jour, conservez configuration, comptes, mondes, mods et gamemode.

[Installation](docs/docs_linux_vps.md) · [Mise à jour](docs/docs_packaged_server_update.md) ·
[Connexion](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md)

## Italiano

Un solo [launcher globale](https://github.com/RealHartlMax/skymp-client-launcher)
permette di collegarsi a diversi server SkyMP Worlds.

1. Installa la tua copia di Skyrim SE/AE su Windows e seleziona la cartella nel launcher.
2. Scegli un server e premi **Connetti**, oppure usa la connessione diretta per i test.
3. Il launcher verifica i file locali, scarica le mod, controlla dimensioni e SHA-256
   e applica l'ordine di caricamento. Un catalogo completo fornisce client SkyMP, SKSE,
   Address Library e interfaccia di gioco compatibili con la versione esatta di Skyrim.
4. Accedi a Steam. Il launcher aggiornato ottiene un ticket e il server verifica lo SteamID
   prima dell’avvio. L’accesso ospite non richiede un account di gioco; la modalità con
   approvazione attende l’amministratore. Solo la modalità account aggiunge il login
   nel gioco. [Steam e modalità di accesso](docs/docs_ingame_login.md).

I download dell'operatore non richiedono un account Nexus/Vortex. Skyrim e i file
Bethesda/DLC devono essere installati. Le DLL vengono distribuite separatamente dal launcher.

**Server:** estrai un pacchetto completo di questo fork per Linux x64 o Windows x64 in
una nuova cartella e copia i cinque file master indicati in [English](#english) in `data/`.
Esegui `start-test-server.bat` oppure `sh ./start-test-server.sh` dalla cartella del server.
Apri `http://<server>:8080/admin`, inserisci il **codice casuale di quattro cifre**
del terminale e configura server e amministratore nel browser. L'avvio può installare
Node 22 e i pacchetti di sistema Ubuntu/Debian mancanti con i permessi e internet necessari.

Porte: **7777/UDP** e **8080/TCP**, oppure **443/TCP** tramite reverse proxy TLS. L'elenco
pubblico richiede un server registrato attivo e un heartbeat valido. Dashboard completo,
download e bot Discord configurato restano attivi quando il gioco viene fermato,
riavviato o termina in modo imprevisto. Negli aggiornamenti conserva configurazione, account, mondi, mod e gamemode.

[Installazione](docs/docs_linux_vps.md) · [Aggiornamenti](docs/docs_packaged_server_update.md) ·
[Connessione](https://github.com/RealHartlMax/skymp-client-launcher/blob/main/docs/CONNECTING.md)

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
  `client-resources/Data/` bereitstellen, etwa Texturen, Meshes oder `Scripts/*.pex`.
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
| Geprüfter Stand, Grenzen, erledigte und offene Aufgaben | [Projektstatus](docs/docs_project_status.md) · [Frontend-Roadmap](ROADMAP_FRONTEND.md) |
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
[Server](skymp5-server/LICENSE), [Client](skymp5-client/LICENSE),
[Frontend](skymp5-front/LICENSE) und [Skyrim Platform](skyrim-platform/LICENSE).
Weitere Hinweise: [TERMS.md](TERMS.md) und [THIRD_PARTY_LICENSES](THIRD_PARTY_LICENSES).
Skyrim und Bethesda-Spieldateien sind nicht Bestandteil der bereitgestellten Pakete.
