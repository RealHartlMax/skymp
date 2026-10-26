# SkyMP Server-Testversion

Windows und Linux enthalten denselben Backend-, Frontend- und Gamemode-Stand.
`build-manifest.json` nennt Quellstand, Plattform und SHA256 jeder Paketdatei.
Die native Erweiterung ist pro Betriebssystem separat gebaut.

## Vollinstallation oder Update

Das Linux-Archiv `*-full.zip` enthaelt alle Standards fuer die erste Einrichtung.
Nur in ein neues, leeres Verzeichnis entpacken. Fuer einen bestehenden Server
das Archiv `*-update.zip` verwenden: Es enthaelt nur Programmdateien und laesst
Konfiguration, Zugangsdaten, `data/`, Welt, Mods, Clientressourcen, eigene
Paketdateien und `gamemode.js` unangetastet. Nach Sicherung den gesamten Dienst
einschliesslich Dashboard stoppen, den ZIP-Inhalt mit Ersetzen vorhandener
Dateien in das Serververzeichnis entpacken und den Dienst wieder starten.
Die vorhandene Anmeldung bleibt erhalten; kein neues PIN-Setup.
Die vollstaendige Anleitung steht in `UPDATE-VPS.md`.

`DASHBOARD.md` beschreibt die direkte Einstellungsnavigation, Live-Metriken,
Abbruchhistorie und geplante Gameserver-Neustarts mit Zeitzone und Vorwarnungen.
Die Verwaltung bleibt beim Stoppen oder Neustarten des Gameservers erreichbar.

## Vorbereiten

1. Das passende Paket entpacken: Windows x64 oder Ubuntu 26.04 x86_64.
   Auf dem VPS zeigt `uname -m` die Architektur; fuer dieses Linux-Paket muss
   `x86_64` ausgegeben werden.
2. Die Startskripte pruefen die Laufzeit selbst. Eine vorhandene passende
   Node.js-x64-Version ab 22 wird verwendet. Fehlt sie oder ist sie zu alt,
   wird die aktuelle Node.js-22-LTS-Laufzeit von nodejs.org heruntergeladen,
   per SHA-256 geprueft und nur unter `.runtime/` dieses Servers installiert.
   Unter Ubuntu/Debian werden fehlende Systempakete gezielt installiert;
   dafuer sind root oder passende nichtinteraktive sudo-Rechte erforderlich.
   Unter Windows wird bei einem fehlgeschlagenen nativen Ladecheck die
   signierte Microsoft-C++-Laufzeit installiert/aktualisiert; Windows kann
   dafuer seine Administratorfreigabe anzeigen.
3. Die fuenf Dateien aus `data/SPIELDATEN.txt` aus deiner Skyrim-Installation
   nach `data/` kopieren. Die Pakete enthalten diese Spieldaten nicht.
4. Bei einem **Ersteinrichtungspaket mit Browser-Assistent** zeigt der erste Start
   nur die Browser-Adresse und einen zufaelligen **vierstelligen Einrichtungscode**;
   es gibt keine Eingabeaufforderungen im Terminal. Oeffne
   `http://VPS_IP:8080/admin` (lokal: `http://127.0.0.1:8080/admin`) und gib den
   Code dort ein. Servername, Ports, Spielerplaetze, Zugriffsart, oeffentliche
   IPv4-Adresse/Domain und eigenes Admin-Konto werden im Browser eingerichtet.
   Das Passwort wird ausschliesslich als scrypt-Hash gespeichert. Der Spielserver
   startet nach Abschluss automatisch. Der Assistent aendert keine Firewall.
5. `server-settings.json` pruefen. Ports: UDP **7777**, HTTP **8080**.
   Die Testkonfiguration verwendet Steam-Gastzugang und 16 Spielerplaetze.
   Steam Web API Key im Browser eintragen; ohne gueltigen Key ist kein Spielerlogin moeglich.
   Das ist eine Testeinstellung, keine ermittelte Lastgrenze.

## Starten

Linux, im entpackten Verzeichnis:

```sh
sh ./start-test-server.sh
```

Windows, im entpackten Verzeichnis:

```bat
start-test-server.bat
```

`start-test-server.cmd` und `launch_server.bat` sind Windows-Aliasse;
`launch_server.sh` ist der Linux-Alias. Die Startskripte pruefen System,
Node-Version und Spieldaten. Die gebuendelten
Backend-Abhaengigkeiten sind enthalten; `npm install` ist zum Start nicht noetig.
Der Start beeinflusst keine anderen laufenden Serverprozesse.
Bei weiteren Starts wird die Einrichtung uebersprungen; der eigene Zugang bleibt
erhalten. Zum Einrichten ohne anschliessenden Serverstart:
`node setup-server.cjs`. Ein interaktives Terminal ist nicht erforderlich;
der Code steht auch im Dienstprotokoll, beispielsweise bei `journalctl`.

Die private Node-Laufzeit prueft hoechstens einmal in 24 Stunden auf neuere
Versionen derselben 22-LTS-Reihe. Ein fehlgeschlagenes Update behaelt die
vorhandene gepruefte Laufzeit bei. Eine passende globale Node-Installation
wird nicht automatisch ersetzt. `SKYMP_MANAGED_NODE=1` waehlt die private
Laufzeit auch bei vorhandenem globalem Node. `SKYMP_RUNTIME_OFFLINE=1`
verhindert Node-Downloads; eine vorhandene passende Laufzeit bleibt noetig.
Spiel-Masterdateien und eigene Modinhalte werden dadurch nicht installiert.

## Schnellaktionen und Prozesssteuerung

Die mitgelieferten Startskripte starten eine dauerhafte Verwaltung sowie
Dashboard und Game-Server als zwei getrennte Kindprozesse. **Stoppen** gibt
den UDP-Spielport frei; das vollstaendige Dashboard bleibt auf demselben
HTTP-Port mit derselben Anmeldung erreichbar. Einstellungen, bisherige
Game-Logs und Moddownloads bleiben verfuegbar. Dort kann der Betreiber den
Game-Server wieder starten. Bei Start/Neustart wird ausschliesslich der
Game-Prozess ersetzt; Dashboard-PID und WebSocket-Verbindungen bleiben erhalten.
Bestehende Konfiguration, Admin-Zugang und Weltdaten werden beibehalten.
Ein Absturz erzeugt keine unendliche automatische Neustartschleife: Die
Verwaltung bleibt mit Prozessstatus und erneutem Start erreichbar.

Das Dashboard verwendet die vorhandenen Konten und prueft deren Rechte auch
bei gestopptem Game-Server. **Alle Spieler kicken** ist nur mit
entsprechenden Rechten und verbundenen Spielern aktiv. Ankuendigungen und
Bestaetigungen verwenden eigene Browser-Dialoge. Ein direkter Aufruf von
`node dist_back/skymp5-server.js` umgeht die mitgelieferte Prozesssteuerung;
dann ist weiterhin ein passend konfigurierter externer Supervisor erforderlich.

Strg+C oder das Beenden des gesamten Startskripts beendet auch dessen eigenen
Game-Server. Andere Serverprozesse werden nicht gesucht oder beendet.
Aenderungen an HTTP-Port/Bind-Adresse benoetigen einen Neustart des gesamten
Starters; der Game-Server-Neustart im Dashboard wechselt nur den Kindprozess.

Das Dashboard zeigt den Game-Zustand und bietet bei gestopptem Spiel Starten.
Aktionen fuer verbundene Spieler benoetigen einen laufenden Game-Server.
Moddownloads benoetigen weiterhin ein gueltiges `data/manifest.json` fuer die
eingestellte Modliste. Die Steuerung verwendet private IPC-Kanaele und braucht
keinen weiteren oeffentlichen Port. Die ausfuehrliche Porttabelle mit HTTPS-
und Firewall-Beispielen liegt als `PORTS-VPS.md` auch im entpackten Paket.
Die fruehere r2-Version verwendete beim Game-Stopp eine separate Betreiberseite;
fuer Dashboard und Discord-Bot die r4-Dateien gemeinsam uebernehmen.

Waehrend der Ersteinrichtung lauscht ausschliesslich der kleine Web-Assistent
auf **allen IPv4-Adressen**, standardmaessig TCP 8080; der UDP-Spielport wird
noch nicht geoeffnet. Diesen TCP-Port fuer den ersten Browser-Zugriff auch in
der VPS-/Provider-Firewall freigeben. Ein SSH-Tunnel ist ebenfalls moeglich.
Die im Browser gewaehlte Zugriffsart gilt nach Abschluss fuer das Dashboard.
Bei einem Portwechsel die neue Adresse verwenden und auch den neuen Port erlauben.
Falls bereits ein anderer Dienst TCP 8080 belegt, vor dem Start `uiPort` in
`server-settings.json` auf einen freien TCP-Port aendern.

Der Code gilt einmalig fuer zehn Minuten. Nach fuenf Fehlversuchen gilt eine
globale Pause von einer Minute, danach erscheint ein neuer Code im Terminal.
Die Browser-Freigabe gilt 30 Minuten. Ein Neustart vor dem Abschluss erzeugt
einen neuen Code und speichert keine unvollstaendige Einrichtung. Die Seite
prueft fehlende/ungueltige Masterdateien erneut, ohne einen Neustart zu verlangen.
Bei HTTP werden auch Einrichtung und Anmeldung unverschluesselt uebertragen;
fuer dauerhaften Zugriff HTTPS oder einen SSH-Tunnel verwenden.

Der Assistent erzeugt eine Sicherung der bisherigen `server-settings.json`,
`VERBINDUNG.txt` und `skymp5-client-settings.example.txt`. Letztere ist eine
JSON-Vorlage fuer einen einzelnen Testspieler, kein fertig installierter Client.
Er erkennt vorhandene Admin-Zugaenge und setzt sie nicht zurueck. Ein neues
Ersteinrichtungspaket immer in ein **neues Verzeichnis** entpacken; ein bestehendes
Paket beim Aktualisieren nicht mit dessen Standardkonfiguration ueberschreiben.

## Admin-Panel auf dem VPS

Bei Testpaketen mit vorbereitetem Zugang stehen die Zugangsdaten in
`TEST-ZUGANG.txt`; bei Ersteinrichtungspaketen gilt das selbst gewaehlte Konto.
Die Zugriffsart "Lokal" bindet HTTP und UDP an Loopback, "VPS mit SSH-Tunnel"
bindet UDP an alle IPv4-Adressen und HTTP an Loopback, "VPS mit oeffentlichem
Dashboard" bindet beide Dienste an alle IPv4-Adressen. Lokal:
`http://127.0.0.1:8080/admin`.

Vom eigenen Rechner einen SSH-Tunnel zum VPS oeffnen:

```sh
ssh -L 18081:127.0.0.1:8080 DEIN_BENUTZER@DEINE_VPS_IP
```

Danach `http://127.0.0.1:18081/admin` im Browser oeffnen. Den SSH-Tunnel fuer
die Dauer des Zugriffs geoeffnet lassen. UDP 7777 muss fuer spaetere Spieltests
erreichbar sein. Die HTTP-Erreichbarkeit fuer entfernte Skyrim-Clients und ein
oeffentlicher HTTPS-Zugang werden separat ueber die Serverkonfiguration bzw.
einen Reverse Proxy eingerichtet.

Fuer ein direkt erreichbares Dashboard in der vorhandenen `server-settings.json`
`uiListenHost` auf `"0.0.0.0"` setzen und den Server neu starten. `listenHost`
steuert den UDP-Spielport und sollte fuer entfernte Spieler ebenfalls
`"0.0.0.0"` sein. Der Browser verwendet dann `http://VPS_IP:8080/admin`.
`adminApi.externalUrl` ist keine Bind-Adresse; im direkten IP-Betrieb kann es
ohne eigenen Wert bleiben, der Server ermittelt die Adresse aus der Anfrage.

Bei aktiver UFW-Firewall die verwendeten Ports erlauben:

```sh
sudo ufw allow 7777/udp
sudo ufw allow 8080/tcp
sudo ufw status verbose
ss -lnup
ss -lntp
```

Auch eine vorgeschaltete Provider-Firewall muss diese Ports durchlassen.
UFW nicht allein wegen dieser Anleitung aktivieren; vorhandene SSH-Regeln
muessen zum tatsaechlichen SSH-Port passen. Fuer dauerhaften Admin-Zugriff
HTTPS ueber eine Domain einrichten oder den SSH-Tunnel verwenden, denn HTTP
verschluesselt die Anmeldung nicht.

## Verbindung fuer Testspieler

Den aktualisierten Windows-Launcher und das passende Clientpaket verwenden.
Steam muss laufen und angemeldet sein. Der Launcher fordert ein Steam-Ticket
an; der Server bestaetigt die SteamID und stellt eine private Sitzung aus.
Die Verbindungseinstellungen unter `Data/Platform/Plugins/skymp5-client-settings.txt`
werden vom Launcher mit Sicherung und Wiederherstellung verwaltet. Die erzeugte
`skymp5-client-settings.example.txt` zeigt nur Adressen, keine Zugangssitzung.
Frei gewaehlte `gameData.profileId`-Werte werden nicht mehr zur Anmeldung akzeptiert.
Offener Gastzugang braucht kein Worlds-/skymp.net-Konto; optional ist die
Steam-Freigabe im Dashboard erforderlich. Kontozugang und Discord-Regeln bleiben
als eigene Auswahl verfuegbar. Details und API-Key-Einrichtung: `INGAME-LOGIN.md`.

Ein kompatibler Windows-Client mit passenden SKSE-/Address-Library-Versionen
und passenden Skyrim-Masterdateien ist erforderlich. Die Serverarchive
enthalten keine Client-DLLs und beheben keine Client-Runtime-Inkompatibilitaet.

## Modpakete im Launcher vorbereiten

Zusaetzliche Clientdateien unter `client-resources/Data/` ablegen, mit derselben
Verzeichnisstruktur wie im Skyrim-Ordner. Eigene Plugins gehoeren nach `data/`
und in `loadOrder`; passende BSA-Archive werden automatisch angeboten.
Die Details stehen in `client-resources/README.md` und im Quellarchiv unter
`docs/docs_launcher_modpacks.md`.

Der aktualisierte eigenstaendige Launcher liest `/api/launcher/manifest`,
laedt die erforderlichen Dateien und prueft Groesse und SHA-256. Erst nach
erfolgreicher Vorbereitung startet er SKSE. Die eigene Skyrim-Installation bleibt
Voraussetzung. Der aktuelle Launcher kann SKSE aus einem vollstaendigen
versionierten Clientpaket installieren; aeltere Pakete setzen eine vorbereitete
SKSE-Installation voraus. Spieler brauchen keinen Nexus-/Vortex-Account.

## Discord-Bot und Statusmeldungen

Ab r4 laeuft der Bot im unabhaengigen Webserver. Game-Stopp, Neustart und
Absturz lassen seine Discord-Verbindung bestehen. Im Dashboard unter
Einstellungen/Discord-Einstellungen oder CFG/Discord Token, Server-ID und
Statuskanal eintragen (bis r9 unter Zugriff & Discord). Ab r10 bietet der Reiter
JSON-Vorlagen und eine Vorschau. Den Bot aktivieren.
Die Verbindung wird beim Speichern uebernommen; der aktuelle
Zustand erscheint im Formular. Statusmeldungen funktionieren auch im
Offline-Spielmodus. Einzelheiten, Rollenpruefung und Kanalrechte stehen in
`DISCORD-BOT.md`. Der vollstaendige Starter ist weiterhin erforderlich.

## Mod-Ladereihenfolge ab r11

Im Dashboard unter **Ressourcen** ESM-/ESP-/ESL-Dateien neu einlesen,
aktivieren und in Abhaengigkeitsreihenfolge speichern. Das aendert nur
`loadOrder`; danach den Game-Server neu starten. Die Dateien muessen im
Spielserver-Datenordner liegen; fuer Spieler-Downloads passende Kopien auch
unter `client-resources/Data/` bereitstellen. Deaktivierte Plugins werden aus
dem modernen Downloadmanifest ausgelassen. Einzelheiten: `MOD-LOAD-ORDER.md`.

## Serverlogo und Banner

Logo und Banner liegen als `logo.png` und `banner.png` direkt neben
`server-settings.json`. Neue vollstaendige Pakete enthalten beide Bilder
aus der Repository-Wurzel. Eigene Bilder werden beim naechsten Heartbeat erkannt;
im Web sind dafuer keine Bildadressen einzutragen. Updatepakete ersetzen keine
eigenen Logos oder Banner. Ab r10 liefern Voll- und Updatepakete beide Standards
zusaetzlich unter `server-assets/`. Diese werden nur verwendet, wenn das jeweilige
Bild im Wurzelverzeichnis fehlt.

Empfohlen: Logo **512 x 512 Pixel** (1:1), Banner **1920 x 320 Pixel** (6:1).
PNG, maximal 8 MiB pro Bild. Wichtige Inhalte mittig platzieren, da Banner je
Ansicht beschnitten werden. Die Bilder des Forks werden unveraendert mitgeliefert.

## Daten und Updates

Persistente Testdaten entstehen in `data/` und `world/`. Vor einem Austausch
Konfiguration, Admin-Auth-Store und Weltdaten sichern. Bei Browser-Setup-Paketen
besitzt jede Installation ihr selbst gewaehltes Konto. Es handelt sich um eine Server-Testversion;
der Skyrim-/CEF-Client ist nicht Teil dieser Pakete.
