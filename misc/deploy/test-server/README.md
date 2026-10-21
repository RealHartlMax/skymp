# SkyMP Server-Testversion

Windows und Linux enthalten denselben Backend-, Frontend- und Gamemode-Stand.
`build-manifest.json` nennt Quellstand, Plattform und SHA256 jeder Paketdatei.
Die native Erweiterung ist pro Betriebssystem separat gebaut.

## Vorbereiten

1. Das passende Paket entpacken: Windows x64 oder Ubuntu 26.04 x86_64.
   Auf dem VPS zeigt `uname -m` die Architektur; fuer dieses Linux-Paket muss
   `x86_64` ausgegeben werden.
2. Node.js 22 oder neuer bereitstellen. Unter Ubuntu 26.04:
   `sudo apt-get update` und `sudo apt-get install nodejs`.
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
   Die Testkonfiguration verwendet Offline-Anmeldung und 16 Spielerplaetze.
   Das ist eine Testeinstellung, keine ermittelte Lastgrenze.

## Starten

Linux, im entpackten Verzeichnis:

```sh
sh ./start-test-server.sh
```

Windows, im entpackten Verzeichnis:

```bat
start-test-server.cmd
```

Die Startskripte pruefen System, Node-Version und Spieldaten. Die gebuendelten
Backend-Abhaengigkeiten sind enthalten; `npm install` ist zum Start nicht noetig.
Der Start beeinflusst keine anderen laufenden Serverprozesse.
Bei weiteren Starts wird die Einrichtung uebersprungen; der eigene Zugang bleibt
erhalten. Zum Einrichten ohne anschliessenden Serverstart:
`node setup-server.cjs`. Ein interaktives Terminal ist nicht erforderlich;
der Code steht auch im Dienstprotokoll, beispielsweise bei `journalctl`.

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

Im installierten SkyMP-Client liegt die JSON-Konfiguration unter
`Data/Platform/Plugins/skymp5-client-settings.txt`. Die erzeugte
`skymp5-client-settings.example.txt` dient als Vorlage. Fuer den direkten
Testzugang sind `server-ip`, `server-port`, `server-info-ignore: true` und
`gameData.profileId` relevant. Jeder Spieler benoetigt eine **andere positive
profileId** (1, 2, 3, ...), damit getrennte Charaktere verwendet werden.
Die Offline-Anmeldung kann auch ueber das Internet genutzt werden; sie ist
fuer eine vertraute Testgruppe gedacht und bietet keine verifizierten
oeffentlichen Spielerkonten. Eine Masterserver-Registrierung ist fuer diese
direkte Verbindung nicht erforderlich. Die Modlisten-Abfrage des Clients
verwendet weiterhin den Gateway; der direkte Spielsocket wird dadurch nicht
zu einem eigenen Gateway.

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
erfolgreicher Vorbereitung startet er SKSE. Die benoetigte eigene Skyrim-/SKSE-
Installation bleibt Voraussetzung; Spieler brauchen keinen Nexus-/Vortex-Account.

## Daten und Updates

Persistente Testdaten entstehen in `data/` und `world/`. Vor einem Austausch
Konfiguration, Admin-Auth-Store und Weltdaten sichern. Bei Browser-Setup-Paketen
besitzt jede Installation ihr selbst gewaehltes Konto. Es handelt sich um eine Server-Testversion;
der Skyrim-/CEF-Client ist nicht Teil dieser Pakete.
