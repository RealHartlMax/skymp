# VPS: Ports, Protokolle und Game-Prozesssteuerung

Stand: **23. Oktober 2026**, Server-Testpaket **r3**. Die folgenden Werte
gelten für dessen Standardkonfiguration auf `87.106.58.116`; abweichende
Werte aus deiner `server-settings.json` haben Vorrang.

## Eingehende Regeln für den direkten Test

| Zielport am VPS | Protokoll | Zweck | Freigabe |
| --- | --- | --- | --- |
| **7777** | **UDP** | Spielverbindung und Synchronisierung | Für die Testspieler |
| **8080** | **TCP**, HTTP und WebSocket | Browser-Einrichtung, Dashboard, Launcher-Modpakete und Downloads | Für Browser und Launcher der Testspieler |
| Tatsächlicher SSH-Port, häufig 22 | TCP, SSH | Serveradministration und optionaler Tunnel | Möglichst nur eigene IP oder VPN |

Die Quellports der Clients bleiben beliebig. In den VPS-Portregeln den
**Zielport** und das jeweilige Protokoll wählen. Für den Spielport ist keine
zusätzliche TCP-Regel nötig. Dashboard-WebSockets verwenden denselben
TCP-Port wie HTTP, darunter `/ws/admin-updates` und `/ws/live-console`.

Direkte Testadressen:

- Dashboard und Einrichtung: `http://87.106.58.116:8080/admin`
- Launcher-Manifest: `http://87.106.58.116:8080/api/launcher/manifest`
- Spiel: Host `87.106.58.116`, Port `7777`, UDP

Der Launcher benötigt zusätzlich zur UDP-Spielverbindung die Webadresse,
um Modpakete vor dem Spielstart herunterzuladen. Eine auf die Betreiber-IP
begrenzte Freigabe des gesamten Webports würde diese Downloads für andere
Spieler ebenfalls sperren.

Auf einem VPS mit direkt zugewiesener öffentlicher Adresse werden normalerweise
Firewall-Freigaben benötigt. Eine zusätzliche NAT-Portweiterleitung ist nur
nötig, wenn dein Provider tatsächlich NAT vorschaltet. Provider-Firewall und
eine aktive lokale Firewall müssen die Verbindung beide erlauben.

Vorhandene Einstellungen um diese Werte ergänzen beziehungsweise abgleichen;
die Datei nicht durch dieses unvollständige Beispiel ersetzen:

```json
{
  "listenHost": "0.0.0.0",
  "port": 7777,
  "uiListenHost": "0.0.0.0",
  "uiPort": 8080,
  "publicHost": "87.106.58.116"
}
```

`listenHost` bindet den UDP-Spielport, `uiListenHost` den HTTP-Port.
`publicHost` veröffentlicht die Adresse und ersetzt die Bind-Einstellungen
nicht. `adminApi.externalUrl` ist ebenfalls keine Bind-Adresse.

Bei bereits aktiver UFW, mit unverändert passender SSH-Freigabe:

```sh
sudo ufw allow 7777/udp comment 'SkyMP game'
sudo ufw allow 8080/tcp comment 'SkyMP web test'
sudo ufw status verbose
```

Die Anleitung aktiviert UFW nicht automatisch und ändert keine SSH-Regeln.
Siehe die [Ubuntu-Firewall-Dokumentation](https://ubuntu.com/server/docs/how-to/security/firewalls/).

## Empfehlung für dauerhaften öffentlichen Betrieb

Die UDP-Spielverbindung bleibt auf **7777/UDP**. Für Webzugriffe einen
Reverse Proxy mit gültigem TLS-Zertifikat auf **443/TCP** einsetzen:

| Listener | Erreichbarkeit | Aufgabe |
| --- | --- | --- |
| 7777/UDP | Öffentlich | Spielverbindung |
| 443/TCP | Öffentlich | HTTPS-Dashboard, Launcher-Downloads und WSS |
| 80/TCP | Falls benötigt öffentlich | HTTP-Weiterleitung und/oder ACME HTTP-01 |
| 127.0.0.1:8080/TCP | Nur intern | HTTP zwischen Reverse Proxy und SkyMP-Verwaltung |

Nach funktionierender Proxy-Einrichtung `uiListenHost` auf `127.0.0.1` setzen
und den gesamten SkyMP-Starter neu starten. Danach ist keine öffentliche
8080-Freigabe nötig. Den Launcher auf die öffentliche HTTPS-Basisadresse
umstellen. Das reine Ändern von `uiPort` auf 443 oder eine Portweiterleitung
von 443 nach 8080 aktiviert keine Verschlüsselung.

HTTP-01-Zertifikatsprüfungen benötigen Port 80; bei anderen Prüfverfahren
kann die Anforderung abweichen. Siehe
[Let's Encrypt: Challenge Types](https://letsencrypt.org/docs/challenge-types/).

Ein Nginx-Proxy muss den öffentlichen `Host` einschließlich eines eventuell
abweichenden Ports erhalten und WebSocket-Upgrades weitergeben. Die
Schreibzugriffe zur Prozesssteuerung prüfen den Ursprung der Anfrage.
Beispiel-Fragmente für eine bereits eingerichtete HTTPS-Konfiguration:

```nginx
# Im http-Kontext:
map $http_upgrade $skymp_connection_upgrade {
    default upgrade;
    ''      close;
}

# Im vorhandenen HTTPS-server-Block:
location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $skymp_connection_upgrade;
    proxy_read_timeout 300s;
}
```

Zertifikat, Domain/IP-Zuordnung und TLS-Listener sind separat einzurichten;
dieses Fragment ist kein vollständiger HTTPS-VHost. Das Upgrade-Verhalten
beschreibt die [Nginx-WebSocket-Dokumentation](https://nginx.org/en/docs/http/websocket.html).
Für diese HTTP/1.1-Konfiguration ist keine Freigabe von 443/UDP erforderlich.

## Was die Dashboard-Prozesssteuerung beeinflusst

`start-test-server.sh`, `start-test-server.bat` und ihre Aliasse starten eine
dauerhafte Verwaltung mit öffentlichem HTTP-Listener. Sie startet das
vollständige Dashboard und den Game-Server als **zwei getrennte Kindprozesse**.
Das Dashboard lädt keine native Spiel-Erweiterung. Befehle laufen über **Node-IPC**, ohne einen
weiteren öffentlich erreichbaren Steuerungsport.

| Aktion | Game-Server | Öffentlicher HTTP-Listener |
| --- | --- | --- |
| Stoppen im Dashboard | Eigener Kindprozess endet, UDP-Port wird frei | Läuft auf demselben Port weiter |
| Starten in der Betreiberverwaltung | Neuer Kindprozess startet | Läuft weiter |
| Neustart im Dashboard | Eigener Kindprozess wird ersetzt | Läuft weiter |
| Game-Absturz | Kindprozess endet; erneuter Start durch Betreiber | Bleibt erreichbar |
| Strg+C, Starter beenden oder gesamten systemd-Dienst stoppen | Eigener Kindprozess endet | Endet ebenfalls |

**Ab r3 bleibt das vollständige Dashboard erhalten:** Anmeldung, Einstellungen,
Admin-Verwaltung, bisherige Game-Logs und Moddownloads funktionieren auch bei
gestopptem oder abgestürztem Game-Server. Die Seite wird beim Game-Stopp nicht
neu geladen; Dashboard-PID und WebSocket-Verbindungen bleiben bestehen.
Die Oberfläche zeigt den Game-Zustand und bietet bei gestopptem Spiel **Starten**.
Live-Aktionen wie Spieler kicken oder Ankündigungen benötigen einen laufenden
Game-Server; die API meldet andernfalls `GAME_NOT_RUNNING` mit HTTP 409.
Moddownloads setzen weiterhin ein gültiges `data/manifest.json` passend zur
konfigurierten `loadOrder` voraus. Nach Änderungen der Modliste muss das
Spielemanifest gegebenenfalls durch einen Game-Start neu erzeugt werden.

Das ältere r2-Paket behält sein bisheriges Verhalten mit separater
Betreiberseite bei. Die vollständige Trennung erfordert die neuen r3-Dateien,
einschließlich `dist_back/skymp5-admin.js`, Game-Backend, Dashboard-Frontend
und `server-supervisor.cjs`.

Ein vorgeschalteter Nginx-/Caddy-Dienst wird von den Dashboard-Aktionen nicht
beendet. Die Verwaltung beendet ausschließlich ihren eigenen Kindprozess;
sie sucht keine fremden Node- oder Webserver-Prozesse. Beim vollständigen
Beenden des Starters werden beide eigenen Kindprozesse beendet.

Für einen systemd-Dienst den mitgelieferten Starter als Startkommando verwenden.
`systemctl stop` oder `systemctl restart` dieses gesamten Dienstes betrifft
auch die Verwaltung. Für einen reinen Game-Neustart die Dashboard-Aktion
verwenden. Änderungen an HTTP-Port oder Bind-Adresse erfordern dagegen einen
Neustart des gesamten Starters. Ein direkter Aufruf von
`node dist_back/skymp5-server.js` umgeht die mitgelieferte Verwaltung.

## Interne Ports und ausgehende Verbindungen

Ab r4 bleibt auch der [Discord-Bot](docs_discord_bot.md) im Dashboard-Prozess
verbunden. Er erhält Game-Zustandswechsel über private IPC und kann Start,
Stopp, Neustart und Absturz melden. Ein vollständiger Stopp des Starters beendet
erst den Game-Prozess und danach Bot/Dashboard. Dafür wird kein öffentlicher
zusätzlicher Listener benötigt.

- Dashboard und Game-Prozess verwenden je einen dynamischen
  **TCP-Port auf 127.0.0.1** für die interne HTTP-Weiterleitung. Diese Ports
  und auch keinen dynamischen Portbereich öffentlich freigeben.
- **1234/TCP** ist ein Entwicklungsserver für das Frontend. Im verwalteten
  Paketbetrieb wird dessen Erkennung übersprungen. Auf dem VPS nicht öffnen.
- **9000/TCP** gehört zu CEF-DevTools auf dem Spielerrechner und ist kein
  benötigter VPS-Port.
- Voice-/TeamSpeak- oder weitere Plugin-Dienste benötigen nur dann zusätzliche
  Regeln, wenn du diese tatsächlich separat betreibst.
- Falls ausgehende Verbindungen eingeschränkt sind: HTTPS auf **443/TCP**
  für Node-Laufzeitdownloads, Discord-API/Gateway (HTTPS/WSS) und gegebenenfalls Master-/Online-Anmeldung
  zulassen. Paketquellen benötigen je nach Mirror **80/TCP oder 443/TCP**.
  DNS zum verwendeten Resolver benötigt üblicherweise **53/UDP und 53/TCP**.
  Antworten auf erlaubte Verbindungen müssen ebenfalls durchkommen.

Der Master-Heartbeat ist eine ausgehende Verbindung; er benötigt keinen
zusätzlichen eingehenden Port. Eine externe Client-Runtime-Downloadadresse
erzeugt ebenfalls keinen zusätzlichen SkyMP-Listener.

## Erreichbarkeit prüfen

```sh
ss -lnup
ss -lntp
curl -I http://127.0.0.1:8080/admin
```

HTTP zusätzlich von einem anderen Rechner aufrufen. Ein erfolgreicher HTTP-
Aufruf oder TCP-Porttest bestätigt keine funktionierende UDP-Spielverbindung;
diese muss separat mit einem kompatiblen Spielclient geprüft werden.
Die Paketprüfung kontrolliert UDP-Bindung und Freigabe bei Stop sowie neue
Game-PIDs bei Start/Neustart. Der zusätzliche Dashboard-Vertragstest prüft
Einstellungen, Logs, Downloads, dieselbe Dashboard-PID und unveränderte
WebSocket-Verbindungen auch nach einem Game-Absturz. Die Nachweise liegen
beim jeweiligen Release; lokale Tests ersetzen keine VPS-Prüfung oder Spielsitzung.

Siehe auch [Linux-VPS und Browser-Einrichtung](docs_linux_vps.md),
[Serverkonfiguration](docs_server_configuration_reference.md) und
[Launcher-Modpakete](docs_launcher_modpacks.md).
