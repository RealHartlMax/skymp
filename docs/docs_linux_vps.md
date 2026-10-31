# Linux-VPS: Build und Betrieb

> **Neu:** Mods liegen jetzt in `data/mods/<Mod>/`; `client-resources` wird nicht mehr gelesen. Angaben dazu auf dieser Seite sind überholt. Siehe [Mods in data/mods](docs_mod_folders.md).

Diese Anleitung ergänzt den [Serverbetrieb](docs_running_a_server.md) für einen
**Ubuntu-26.04-VPS mit 12 vCores und 24 GB RAM**. Das ist eine Ausgangskonfiguration für
Build und Lasttests; eine belastbare Spielerzahl ergibt sich erst aus Messungen
mit deinem Gamemode, deinen Plugins und der tatsächlichen CPU-Leistung.

Für Portregeln und Protokolle siehe [VPS-Ports und Prozesssteuerung](docs_vps_ports_and_process_control.md):
direkter Test mit **7777/UDP** und **8080/TCP**, dauerhafter Webzugriff empfohlen
über **443/TCP** mit TLS-Reverse-Proxy. Dort ist auch beschrieben, welche
Verwaltung beim Stoppen des Game-Servers erreichbar bleibt.

## Aktueller Server-Testbuild vom 25. Oktober 2026

Die aktuelle Revision r9 liegt unter `build/releases/2026-10-25-server-r9/`:
`skymp-server-2026-10-25-r9-linux-x64-full.zip` für eine neue Installation und
`skymp-server-2026-10-25-r9-linux-x64-update.zip` zum Ersetzen der Programmdateien
eines bestehenden VPS. Das Update-ZIP lässt Konfiguration, Zugänge, `data/`
einschließlich PEX-Skripten, Welt, Mods, Clientressourcen und eigenen Gamemode aus.
Details und Entpackbefehl: [Update-Anleitung](docs_packaged_server_update.md).
Beide ZIPs enthalten dieselben aktuellen Backends und dasselbe Dashboard.

r8 ergänzt Auth-Policy v2 mit kompakter servergebundener Ticket-Kennung,
HTTP 409 / `STEAM_POLICY_CHANGED` bei veralteter Launcher-Kennung und der
Diagnose `STEAM_TICKET_AUDIENCE_MISMATCH`. Nach dem Dienstneustart im aktuellen
Launcher frisch verbinden und ein neues Ticket abrufen.
Enthalten bleibt die Steam-Fehlerdiagnose mit festen Codes und bei Ticketablehnung
eine gekürzte, bereinigte Valve-Erklärung im Serverprotokoll. Beim Austausch
den gesamten Starter einschließlich Dashboard neu starten; der HTTP-Login
läuft im Webprozess. Die Ursache der bisherigen VPS-Ablehnung ist damit noch
nicht bestätigt. Der neue Launcher kommt aus seinem eigenen Repository.

Ab r5 ist Steam für jeden Spielerlogin Pflicht. Den Steam Web API Key im
Browser-Assistenten oder unter CFG/Zugriff & Discord eintragen, Zugangsart
wählen und den Game-Server neu starten. Gastmodi benötigen kein Worlds-Konto.
Launcher-EXE und Clientpaket ebenfalls aktualisieren; siehe
[Steam und Legacy-Login](docs_ingame_login.md). Backend und Dashboard werden getrennt
gebaut; enthalten sind Browser-PIN-Ersteinrichtung, Mod-API v2, Master-Heartbeat
und die Launcher-Anbindung im Assistenten und Admin-Dashboard. Ab r4 läuft auch
der [Discord-Bot](docs_discord_bot.md) unabhängig vom Spiel im Webserver.
Die unveränderten
nativen Plattformmodule stammen aus dem bisherigen geprüften Serverstand;
ihre Herkunft ist im Manifest getrennt vom neuen Backend-/Frontend-Stand erfasst.

Beide Archive wurden entpackt und mit echten Masterdateien auf PIN-Setup,
Admin-Anmeldung, Dashboard, Launcher-Einstellungen, Moddownload und UDP-Bindung
geprüft. Der neue Linux-Stand besteht zusätzlich den Starttest unter Ubuntu
26.04.1 mit Node 22.22.1. Das ist eine lokale Containerprüfung, keine neue
VPS-Abnahme oder Spielsitzung. `VALIDIERUNG.json` nennt den Umfang und die
weiterhin teilweise offene historische native Windows-Suite.

Für einen bestehenden Server nach Sicherung und Stopp Backend, Dashboard und
Setup-Helfer gemäß `UPDATE-VPS.md` neben den neuen Archiven übernehmen.
**Vorhandene Konfiguration, Admin-Zugänge, Daten, Mods und eigenen Gamemode
behalten.** Nur `dist_back/` auszutauschen aktualisiert das Dashboard nicht.

Revision r2 ergänzt die automatische Laufzeitprüfung beim Start: Eine fehlende
oder zu alte Node-Version wird als private, per SHA-256 geprüfte Node-22-LTS-
Laufzeit unter `.runtime/` installiert. Fehlende Ubuntu-/Debian-Systempakete
werden gezielt mit root oder nichtinteraktivem sudo installiert. Es erfolgt
kein vollständiges Betriebssystem-Upgrade und keine Änderung an globalem Node.
Eine vorhandene private Laufzeit prüft täglich auf Updates derselben LTS-Reihe.
Ab r3 läuft das vollständige Dashboard als eigener Prozess weiter, wenn der
Game-Server gestoppt oder neu gestartet wird oder abstürzt. Anmeldung,
Einstellungen, bisherige Logs und Moddownloads bleiben erhalten. Dashboard-PID
und WebSockets bleiben bestehen; nur die Game-PID ändert sich. Die Oberfläche
zeigt den Game-Zustand und bietet bei gestopptem Spiel Starten. Für diese Funktionen
`start-test-server.sh` oder den Alias `launch_server.sh` verwenden.

Das separate Launcher-Repository ist weiterhin für den Launcher maßgeblich:
`local-builds/current/` enthält dessen Launcher, versioniertes Clientpaket und
Webroot-ZIPs. Das neue Serverrelease enthält keine Launcher-EXE und ändert
dessen bisherige Ausgaben nicht automatisch. Der Steam-Launcher und das
aktualisierte Runtime-Paket werden getrennt zum r5-Server bereitgestellt.

Die aktuelle Launcher-Ersteinrichtung benötigt das installierte Spiel; ein
vollständiger Runtime-Katalog kann SKSE und Address Library bereitstellen.
Neue Client-DLLs und eigenständige Adressdatenbank-Probes liegen vor, ein echter
Skyrim-/CEF-Spieltest ist weiter offen. [Projektstand](docs_project_status.md),
[Versionskatalog](docs_launcher_runtime_updates.md) und
[SkyMP Worlds](docs_launcher_worlds.md) beschreiben die jeweiligen Grenzen.

## Browser-Ersteinrichtung und Modpakete

Browser-PIN-Einrichtung wurde am 20. Oktober eingeführt, die Mod-API am
21. Oktober. Frühere lokale Buildordner werden nach der r5-Validierung
entfernt. Die folgenden Schritte beziehen sich auf die aktuellen vollständigen
r9-Pakete. Bestehende Server nach der [Update-Anleitung](docs_packaged_server_update.md)
aktualisieren; nicht nur einzelne Backenddateien austauschen. Weitere Moddateien
unter `client-resources/Data/` bereitstellen; eigene Plugins bleiben in `data/`
und `loadOrder`. Siehe [Modpakete](docs_launcher_modpacks.md).

Diese Pakete enthalten **keinen vorbereiteten Admin-Zugang**. In ein neues
Verzeichnis entpacken, die fünf eigenen Masterdateien nach `data/` kopieren und
`sh ./start-test-server.sh` bzw. `start-test-server.cmd` starten. Im Terminal
erscheinen die Browser-Adresse und ein zufälliger **vierstelliger Code**.
Auf deinem VPS `http://87.106.58.116:8080/admin` öffnen und diesen Code eingeben.
Servername, Ports, Spielerplätze, Zugriffsart, öffentliche IPv4-Adresse/Domain
und eigenes Admin-Konto werden anschließend vollständig im Browser eingerichtet.
Das Passwort wird als scrypt-Hash gespeichert. Nachfolgende Starts
behalten die Einrichtung bei. Konfiguration und Weltdaten einer bestehenden
Installation nicht durch die Standarddateien des neuen Archivs ersetzen.

Die drei Zugriffsarten sind:

| Auswahl | UDP-Spielport | HTTP-Dashboard |
| --- | --- | --- |
| Lokal | `127.0.0.1` | `127.0.0.1` |
| VPS mit SSH-Tunnel | `0.0.0.0` | `127.0.0.1` |
| VPS mit öffentlichem Dashboard | `0.0.0.0` | `0.0.0.0` |

Für ein direkt im Internet erreichbares Dashboard **VPS · Dashboard und Spiel öffentlich erreichbar** verwenden und
`87.106.58.116` eintragen. Firewall-Regeln werden selbst
gesetzt. `VERBINDUNG.txt` nennt Adressen und Ports;
`skymp5-client-settings.example.txt` enthält eine Vorlage für einen Testspieler.
Die Konfiguration speichert keine Klartextpasswörter. Der Assistent erkennt
vorhandene Admin-Zugänge und setzt sie auch bei einem erneuten Aufruf nicht zurück.
Während der Einrichtung lauscht nur der Web-Assistent auf allen IPv4-Adressen,
standardmäßig TCP 8080. Diesen Port vor dem ersten Browser-Aufruf in der
VPS-/Provider-Firewall freigeben. Der Spielserver startet erst nach dem Abschluss,
wenn gültige Masterdateien vorhanden sind. Fehlende Dateien erscheinen im Browser;
nach dem Kopieren genügt „Dateien erneut prüfen“. Der vierstellige Code gilt
einmalig zehn Minuten; nach fünf Fehlversuchen folgt eine globale Pause von einer
Minute mit anschließend neuem Terminal-Code. Die Browser-Freigabe gilt 30 Minuten.
Es ist keine interaktive Terminal-Eingabe erforderlich, auch beim Dienststart;
der Code steht dann im Dienstprotokoll. Nur die Einrichtung starten:
`node setup-server.cjs`. HTTPS oder ein SSH-Tunnel schützt auch die Ersteinrichtung.

Die älteren lokalen Buildordner werden nach erfolgreicher r5-Prüfung auf
Benutzerwunsch entfernt. Die native Basisqualifikation bleibt als
`native-baseline-evidence.json` beim aktuellen Release erhalten; dessen
`cleanup.json` protokolliert die Bereinigung.
Eine bereits laufende VPS-Installation verwendet weiterhin ihre bestehenden
Einstellungen und Zugangsdaten; die neuen Standarddateien nicht darüber entpacken.

## Neuinstallation auf Ubuntu

Für den VPS zuerst `uname -m` prüfen: Dieses Linux-Paket benötigt `x86_64`.
Die Startskripte richten fehlendes Node.js 22+ automatisch ein; die fünf eigenen Skyrim-Masterdateien werden benötigt.
Die Masterdateien sind in den Archiven nicht enthalten. Unter Ubuntu 26.04:

```sh
mkdir ~/skymp-browser-test
unzip skymp-server-2026-10-25-r9-linux-x64-full.zip -d ~/skymp-browser-test
cd ~/skymp-browser-test
# Skyrim.esm, Update.esm, Dawnguard.esm, HearthFires.esm und Dragonborn.esm nach data/ kopieren.
sh ./start-test-server.sh
```

Vor dem Start den bisherigen SkyMP-Prozess bzw. seinen Dienst beenden, damit
TCP 8080 und UDP 7777 frei sind. Für parallele Tests zunächst `uiPort` in der
neuen `server-settings.json` auf einen freien Port setzen und im Browser einen
anderen UDP-Spielport wählen. Die bisherige Installation, ihre Konfiguration
und Weltdaten dabei separat behalten.

Dann `http://87.106.58.116:8080/admin` öffnen, den angezeigten vierstelligen
Code eingeben und die vier Browser-Schritte abschließen. Standardwerte sind
UDP 7777, TCP 8080, Offline-Modus und 16 Spielerplätze; die Plätze sind keine
gemessene Kapazitätsgrenze. Die Laufzeitabhängigkeiten sind gebündelt,
`npm install` ist zum Start nicht nötig. Die Pakete enthalten keinen
Skyrim-/CEF-Client und keinen vorgegebenen Admin-Zugang.

Build- und Prüfumgebung sowie Ergebnisse stehen im
[Abnahmeprotokoll](docs_native_validation_2026_10_19.md). Das vom Benutzer am
20. Oktober bereitgestellte VPS-Protokoll bestätigt den nativen Serverstart
unter Linux x64 mit fünf Masterdateien und vorhandenem Admin-Auth-Store.
Der öffentliche Aufruf von `/admin` wurde anschließend mit HTTP 200 und der
echten Anmeldeseite geprüft; `/api/admin/setup/status` meldet einen eingerichteten
Admin-Zugang. Entfernte Spielverbindung und Lasttest stehen noch aus; die
VPS-Konfiguration wurde nicht aus der lokalen Umgebung geändert.

## Vorhandene VPS-Installation im Internet erreichbar machen

Die relevante Datei ist **`server-settings.json` im entpackten Serververzeichnis**.
In der vorhandenen Datei diese Werte anpassen, andere Einstellungen beibehalten:

```json
{
  "listenHost": "0.0.0.0",
  "port": 7777,
  "uiListenHost": "0.0.0.0",
  "uiPort": 8080
}
```

Anschließend den laufenden Server beenden und mit dem bisherigen Launcher bzw.
dem bereits eingerichteten systemd-Dienst neu starten. Danach ist das Dashboard
unter `http://DEINE_VPS_IP:8080/admin` erreichbar, sobald die Firewalls den Zugriff
erlauben. `0.0.0.0` ist die Bind-Adresse; im Browser wird die öffentliche IP
verwendet. `adminApi.externalUrl` ändert keine Bind-Adresse und kann bei direktem
IP-Zugriff ohne eigenen Wert bleiben. Bestehende Zugangsdaten in
`data/admin-auth.json` bleiben gültig.

Bei aktiver UFW-Firewall:

```sh
sudo ufw allow 7777/udp
sudo ufw allow 8080/tcp
sudo ufw status verbose
ss -lnup
ss -lntp
```

Die Provider-Firewall benötigt ebenfalls UDP 7777 und TCP 8080. UFW nicht blind
einschalten: Vor dem Aktivieren müssen die Regeln den tatsächlichen SSH-Port
erhalten. Die [Ubuntu-Firewall-Anleitung](https://ubuntu.com/server/docs/how-to/security/firewalls/)
erläutert Status und Regeln. HTTP überträgt die Anmeldung unverschlüsselt;
für dauerhaften Admin-Zugriff HTTPS mit einer Domain oder den SSH-Tunnel verwenden.

Für einen direkten Spieltest die bestehende JSON-Datei
`Data/Platform/Plugins/skymp5-client-settings.txt` der Client-Installation anpassen:

```json
{
  "gameData": { "profileId": 1 },
  "master": "",
  "server-info-ignore": true,
  "server-ip": "DEINE_VPS_IP",
  "server-port": 7777,
  "server-master-key": "MASTERKEY_AUS_SERVER_SETTINGS"
}
```

Pro Spieler eine eigene positive `profileId` vergeben, etwa 1, 2 und 3.
`offlineMode: true` bedeutet lokale Testanmeldung und verhindert keine
Internetverbindung. Diese Anmeldung ist für eine vertraute Testgruppe geeignet;
Profile sind dabei keine verifizierten öffentlichen Konten. Der direkte UDP-Zugang
benötigt keine Masterserver-Veröffentlichung. Die Modlisten-Abfrage des Clients
wendet sich weiterhin an den Gateway; das HTTP-Panel ersetzt diesen Dienst nicht.
Vorhandene weitere Client-Einstellungen erhalten. Benötigt werden ein zur Skyrim-
Runtime passender Windows-Client und passende Spieldaten. Die Serverpakete lösen
die zurückgestellte Skyrim-1.7-/CEF-Kompatibilität nicht.

## Plattform und eigene Builds

Der Server benötigt eine **Linux-Version von `scam_native.node`**. Die unter
Windows erzeugte Datei funktioniert auf dem VPS nicht. Baue auf dem Zielsystem
oder in einer zum Zielsystem passenden Linux-Umgebung; auch Architektur und
Systembibliotheken müssen zum VPS passen. Prüfe die Architektur mit `uname -m`.

Compiler, CMake, Ninja, Node und vcpkg-Voraussetzungen stehen in
[CONTRIBUTING.md](../CONTRIBUTING.md). Die distributionsspezifischen Helfer liegen
unter `misc/deps_linux/`; verwende den zur installierten Distribution passenden
Helfer. Der aktuelle Repository-Dockerfile verwendet Node 22. Diese Anleitung
installiert und aktualisiert keine Systempakete automatisch.

## Eigenen Fork bauen

Übertrage zuerst deinen gewünschten Quellstand auf die Linux-Buildmaschine.
Noch nicht committete lokale Änderungen sind in einem normalen Git-Clone nicht
enthalten. Windows-Build-Verzeichnisse und `node_modules` werden nicht übertragen.

Nach Einrichtung der Build-Voraussetzungen, aus dem Repository-Verzeichnis:

```sh
mkdir -p build
cd build
npm --prefix ../skymp5-front ci
npm --prefix ../skymp5-front test
npm --prefix ../skymp5-front run build

../build.sh --configure \
  -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_CLIENT=OFF \
  -DBUILD_SKYRIM_PLATFORM=OFF \
  -DBUILD_SCRIPTS=OFF \
  -DBUILD_UNIT_TESTS=OFF \
  -DBUILD_GAMEMODE=OFF \
  -DDOWNLOAD_SKYRIM_DATA=OFF \
  -DOFFLINE_MODE=OFF

cmake --build . --target skymp5-server --parallel 6
```

Sechs parallele Build-Jobs sind ein vorsichtiger Startwert für 24 GB RAM.
Passe ihn an den gemessenen Speicherbedarf an. Die vcpkg-Abhängigkeiten können
beim ersten Build zusätzlich Zeit und Speicher benötigen.

Das Ergebnis liegt in `build/dist/server/`, einschließlich `ui/build.js`,
`dist_back/skymp5-server.js`, der nativen Erweiterung und des Launchers.
Das vorab gebaute Frontend wird vom CMake-Kopierschritt übernommen.
`BUILD_FRONT` muss dafür nicht eingeschaltet sein.

Die Änderungen am In-Game-Widget werden zusätzlich mit dem **Windows-Client**
ausgeliefert. Sein Plugin wird aus dem jeweiligen Quellstand separat gebaut:
`npm --prefix ../skymp5-client run build` aus dem Build-Verzeichnis.
Der Linux-Server-Build ersetzt keine Client-Installation.

## Erststart und Konfiguration

Lege das komplette Linux-Serverpaket beispielsweise unter `/opt/skymp/server`
ab und verwende einen eigenen Benutzer `skymp`, der dieses Verzeichnis schreiben
kann. Ergänze die benötigten Spieldaten in `data/`, deine Plugins und deinen
Gamemode entsprechend dem [Serverbetrieb](docs_running_a_server.md).

Bearbeite die vorhandene `server-settings.json`; ersetze sie nicht durch eine
minimale Beispielkonfiguration. Relevante Werte sind:

- `port`: UDP-Spielport, standardmäßig `7777`.
- `uiPort`: HTTP-Port für UI und API; ohne eigene Angabe gleich `port`.
- `listenHost`: Bind-Adresse für UDP.
- `uiListenHost`: Bind-Adresse für HTTP.
- `masterKey`: muss zur Client-Konfiguration passen.
- `adminApi.externalUrl`: öffentliche HTTPS-Adresse, falls explizit gesetzt.

HTTP und UDP auf derselben Portnummer sind unterschiedliche Netzwerkdienste.
Das HTTP-Panel und seine API verwenden den HTTP-Port; der installierte Client
lädt seine CEF-Oberfläche lokal aus `Data/Platform/UI/`. Bei einem
Reverse Proxy kann HTTP auf Loopback gebunden werden, wenn der Proxy alle
benötigten UI-/API-Pfade erreichbar macht. Ein Proxy muss auch WebSocket-Upgrades
für `/ws/admin-updates` weiterreichen. Details:
[Ports](docs_server_ports_usage.md),
[Konfiguration](docs_server_configuration_reference.md) und
[Discord OAuth](docs_admin_discord_oauth.md).

Einmalig als Serverbenutzer im Paketverzeichnis:

```sh
cd /opt/skymp/server
./launch_server.sh
```

Der Launcher prüft Node und installiert bei Bedarf Laufzeitabhängigkeiten aus dem
Paket. Richte diese vor dem automatischen Dienststart ein. Prüfe danach `/admin`:
Ersteinrichtung, Anmeldung und Whitelist sollten mit den echten Endpunkten
funktionieren. Ein echter OAuth-Callback benötigt die öffentliche Domain und
die dazu passende Discord-Konfiguration.

## Als systemd-Dienst starten

Nach erfolgreichem Erststart und Einrichtung der Laufzeitabhängigkeiten kann
folgende Unit als `/etc/systemd/system/skymp.service` verwendet werden. Passe
Benutzer, Pfad und Node-Pfad an deine Installation an:

```ini
[Unit]
Description=SkyMP server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=skymp
Group=skymp
WorkingDirectory=/opt/skymp/server
ExecStart=/usr/bin/node /opt/skymp/server/dist_back/skymp5-server.js
Restart=on-failure
RestartSec=5
KillSignal=SIGINT
TimeoutStopSec=60
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

Beende den manuell gestarteten Server, bevor du den Dienst aktivierst:

```sh
sudo systemd-analyze verify /etc/systemd/system/skymp.service
sudo systemctl daemon-reload
sudo systemctl enable --now skymp
sudo systemctl status skymp
sudo journalctl -u skymp -f
```

Bei Updates den Dienst anhalten, `data/`, Einstellungen und persistente
Weltdaten sichern und den [Update-Playbook](docs_server_update_playbook.md)
anwenden. Danach den Dienst wieder starten. Ein laufender systemd-Dienst sollte
nicht parallel über den Update-Helfer mit `--start-after` gestartet werden.

## Lasttest und Abnahme

Prüfe CPU, Prozessspeicher und freien RAM mit den Admin-Metriken, `top` und
`free -h`, zunächst mit wenigen Spielern und anschließend unter realistischer
Last. Die 12 vCores bedeuten nicht, dass jeder Teil der Spielsimulation über
alle Kerne skaliert.

Die lokalen Browserprüfungen testen den echten Frontend-/Widget-Code mit
simulierten API- und Client-Ereignissen. Der Linux-Nativbuild und seine vollständigen
Unit-Tests wurden zusätzlich im Linux-Container ausgeführt. Die separate
Ubuntu-26.04-Laufzeit prüft den echten nativen Server und seine Admin-Endpunkte.
Vor dem produktiven Einsatz bleiben Client-Verbindung, Discord-Callback,
Skyrim-/CEF-Darstellung und der Betrieb auf dem tatsächlichen VPS zu prüfen.
