# Server-ZIPs für Ersteinrichtung und bestehende Installationen

Stand: 26. Oktober 2026, r12. Für Linux x64 und Windows x64 gibt es je zwei ZIPs mit
Dateien direkt im Archivwurzelverzeichnis:

- `skymp-server-2026-10-26-r12-<plattform>-full.zip`: vollständige neue Installation
  mit Standardkonfiguration, Gamemode, PEX-Skripten und Browser-PIN-Einrichtung.
  In ein leeres Verzeichnis entpacken und eigene Skyrim-Masterdateien ergänzen.
- `skymp-server-2026-10-26-r12-<plattform>-update.zip`: nur austauschbare
  Programmdateien, Dashboard und Startskripte. Für einen bereits eingerichteten
  Server; dessen Zugangsdaten, Konfiguration, Spielstände und eigene Dateien
  bleiben erhalten. Es ist keine erneute PIN-Einrichtung erforderlich.

Das Update-ZIP enthält keine `server-settings.json`, kein `data/` (auch keine
PEX-Skripte), `world/`, `client-resources/`, Mods, Plugins oder `gamemode.js`.
Eigene `package.json`, `package-lock.json`, `.runtime/`, `.env` und Logs bleiben
ebenfalls erhalten. Die mitgelieferte Dateiliste beschreibt nur die tatsächlich
enthaltenen Programmdateien. Beide ZIPs enthalten Linux-Ausführungsrechte für
die `.sh`-Starter (Linux). `<plattform>` ist `linux-x64` oder `windows-x64`.

**Neu in r12:** Dashboard-Übersicht mit Prozess-/Tickverlauf und dauerhafter
Abbruchstatistik, direkte Einstellungsreiter und Gameserver-Neustartplan mit
IANA-Zeitzone, Vorwarnungen und überspringbarem nächsten Termin. Die Anleitung
`DASHBOARD.md` liegt in Full- und Update-ZIPs. `server-settings.json` und das
gesamte `data/` inklusive Zeitplanstatus und Historie bleiben erhalten. Beide
Backends, Supervisor und Frontend gemeinsam ersetzen. Auf Smartphones ist die
Serversteuerung ausklappbar, damit die eigentliche Ansicht direkt erreichbar ist.

**Weiterhin enthalten aus r11:** Mod-Ladereihenfolge unter Ressourcen, aktive Plugin-Auswahl im
Launcher-Downloadmanifest und validierte Spielernamen aus der Steam-Anmeldung.
Die SteamID bleibt die serverseitig geprüfte Identität. Die Anleitung
`MOD-LOAD-ORDER.md` liegt auch im Update-ZIP. Beide Backends und das
Dashboard-Frontend gemeinsam aktualisieren.

**Neu in r10:** Servermetriken mit 24-Stunden-Verlauf und eigener Discord-Reiter
mit Status-Embed-Vorlagen, Vorschau und Live-Speichern. Beide Pakete enthalten
`server-assets/logo.png` und `server-assets/banner.png` als Standardbilder.
Eigene `logo.png` und `banner.png` neben der Konfiguration haben Vorrang und
werden vom Update-ZIP nicht überschrieben. Vollpakete enthalten beide Bilder
auch im Wurzelverzeichnis.

Die bekannte native Clientkorrektur für den Threadpool wird als **separates
Client-Runtime-Paket** ausgeliefert. Ein Serverupdate ersetzt keine DLL im Spiel.
Den neuen Runtime-Ordner zuerst, den zugehörigen Katalog zuletzt auf den bisherigen
Dateihost übertragen; siehe [Client-Runtime aktualisieren](docs_launcher_runtime_updates.md).

**Steam-Ticket-Kennung in r8:** Auth-Policy v2 verwendet eine kompakte,
servergebundene Kennung. Nach dem Update den gesamten Dienst neu starten und
im aktuellen Launcher frisch verbinden, damit Policy und Ticket zusammenpassen.
Eine veraltete zurückgegebene Kennung liefert `STEAM_POLICY_CHANGED` (HTTP 409);
die entsprechende Valve-Ticketablehnung erhält `STEAM_TICKET_AUDIENCE_MISMATCH`.
Steam-Freigaben, Kontobindungen und bestehende Daten werden erhalten.

**Steam-Diagnose ab r6, ergänzt in r7:** Die feste Fehlerklassifikation aus dem Launcher-Befund
`STEAM-FEHLER-2026-10-24.md` ist enthalten. r7 ergänzt eine auf 160 Zeichen
begrenzte, bereinigte Valve-Erklärung im Serverprotokoll; öffentliche Antworten
bleiben bei festen Codes und numerischen Diagnosewerten. Für die HTTP-Änderung den gesamten
Starter beziehungsweise Dienst mit Dashboard-Prozess neu starten. Nur den
Gameserver im Dashboard neu zu starten genügt dafür nicht. Der neue Code macht
den Prüfgrund sichtbar; die Ursache der bisherigen VPS-Ablehnung bleibt bis
zum erneuten Verbindungsversuch auf dem aktualisierten VPS offen.

## Vor dem Dateiaustausch

1. Bestehendes Serververzeichnis einschließlich `server-settings.json`,
   Admin-Konten, Weltdaten, Mods, Skripten und eigenem `gamemode.js` sichern.
2. Den gesamten Starter beziehungsweise systemd-Dienst stoppen. Ein Game-Stopp
   im Dashboard reicht zum Austauschen des Webservers nicht aus. Keine alte
   und neue Instanz parallel auf denselben Ports starten.
3. Die Prüfsumme des **Update-ZIPs** vergleichen. Dieses ZIP darf anschließend
   mit Ersetzen vorhandener Dateien direkt in das bestehende Serververzeichnis
   entpackt werden. Das vollständige ZIP ausschließlich für ein neues, leeres
   Verzeichnis verwenden; dessen Standarddateien würden vorhandene Einstellungen
   und eigene Dateien überschreiben.

Beispiel nach Sicherung und vollständigem Dienststopp; die Pfade anpassen:

```bash
unzip -o /pfad/skymp-server-2026-10-25-r11-linux-x64-update.zip -d /pfad/zum/bestehenden/server
```

Danach den vorhandenen systemd-Dienst wieder starten oder im Serververzeichnis
`sh ./start-test-server.sh` ausführen. Beim SFTP-Upload den **Inhalt** des
Update-ZIPs mit gleicher Ordnerstruktur übertragen und Dateien ersetzen.
Keine vorhandenen Datenverzeichnisse löschen. Es werden alle aktuellen
Programmdateien mitgeliefert, unabhängig davon, ob der Ausgangsstand r5–r10 ist;
eine bereits eingerichtete Installation mit unabhängigem Dashboard wird vorausgesetzt.

## Gemeinsam aktualisieren

Im Update-ZIP sind diese Dateien bereits ausgewählt. Bei einem manuellen
Dateiaustausch aus einem vollständigen Paket gemeinsam übernehmen:

- `dist_back/` vollständig, einschließlich `skymp5-server.js`, `skymp5-admin.js`
  und beider Source Maps
- `ui/` vollständig und das passende `scam_native.node`
- `server-supervisor.cjs`
- `setup-server.cjs`, `setup-web.cjs`, `launcher-connection.cjs`, `check-install.cjs`
- `setup-ui/` und `supervisor-ui/`
- `server-assets/` (Standardbilder; eigene Bilder im Wurzelverzeichnis behalten)
- Linux: `start-test-server.sh`, `launch_server.sh`, `bootstrap-runtime.sh`
- Windows: `start-test-server.bat`, `start-test-server.cmd`, `launch_server.bat`,
  `bootstrap-runtime.ps1`
- `build-manifest.json`, `release-info.json`, `QUELLSTAND.txt`, `README-TEST.md`,
  `DISCORD-BOT.md`, `INGAME-LOGIN.md`, `MOD-LOAD-ORDER.md`, `PORTS-VPS.md`, `UPDATE-VPS.md` und Lizenzdateien

Die nativen **Servermodule** der lokalen Revision r11 sind gegenüber r10 inhaltlich unverändert.
Bei späteren Releases oder anderen Ausgangsständen immer das passende Modul
aus demselben vollständigen Plattformpaket verwenden.

**Behalten und nicht durch Standarddateien ersetzen:**

- `server-settings.json` und eigene Umgebungs-/Dienstkonfiguration
- eigene `logo.png` und `banner.png` im Wurzelverzeichnis
- `data/` einschließlich Masterdateien, `admin-auth.json`, `player-access.json`, Moderation und
  Spielerstatistiken sowie eigener Skripte
- `world/` und weitere konfigurierte Speicherverzeichnisse
- `client-resources/`, eigene Mods, Plugins und `gamemode.js`
- vorhandene Logs sowie eigene Paket-/Abhängigkeitsdateien

Die private `.runtime/` darf erhalten bleiben. Der Starter prüft sie weiterhin.
Neue mitgelieferte Standardskripte nur nach Vergleich gezielt übernehmen,
statt eigene Skriptverzeichnisse zu ersetzen. Der Launcher wird im separaten
Repository aktualisiert; die Serverarchive enthalten keine Launcher-EXE.

**r5 verlangt Steam bei jedem Spielerlogin.** Den Steam Web API Key unter
CFG/Zugang & Anmeldung ergänzen und den gewünschten Zugang wählen. Die neue
Launcher-EXE und das zugehörige Clientpaket ebenfalls bereitstellen. Alte
Clients können die Pflichtprüfung nicht erfüllen. Gastprofile sind eigenständige
Profile; vorhandene Kontoprofile werden nicht automatisch migriert. Siehe
[Steam und Ingame-Login](docs_ingame_login.md).

## Start und Kontrolle

Im Serververzeichnis `sh ./start-test-server.sh` beziehungsweise
`start-test-server.bat` ausführen. Ein systemd-Dienst muss den Starter mit dem
richtigen Arbeitsverzeichnis aufrufen, beispielsweise
`ExecStart=/bin/sh /opt/skymp/start-test-server.sh`. Nach Änderungen an einer
Dienstdatei `sudo systemctl daemon-reload` ausführen.

Ein direkter Aufruf von `node dist_back/skymp5-server.js` umgeht die
unabhängige Verwaltung und deren Discord-Bot.

1. Die vorhandene Anmeldung prüfen. Falls unerwartet der Erstassistent erscheint,
   zuerst Arbeitsverzeichnis und bestehende `data/admin-auth.json` prüfen.
2. Game stoppen: Dashboard, Logs, Einstellungen und Moddownloads müssen
   erreichbar bleiben. Starten und Neustarten dürfen nur den Game-Prozess ersetzen.
3. Unter Einstellungen/CFG/Discord den Bot einrichten beziehungsweise
   die bestehende Konfiguration prüfen und einen Statuskanal eintragen.
   Speichern übernimmt den Bot sofort. Die Verbindungsanzeige und echte
   Start-/Stopp-/Neustartmeldungen im eigenen Discord kontrollieren.
4. Die Spielverbindung und Launcher-Downloads mit einem kompatiblen Client
   separat prüfen. Lokale Paket-/SDK-Tests ersetzen diese VPS-Abnahme nicht.

Es werden keine neuen eingehenden Ports benötigt: direkter Test weiterhin
`7777/UDP` und `8080/TCP`; bei HTTPS gilt die vorhandene Proxy-Konfiguration.
Discord benötigt ausgehendes HTTPS/WSS über TCP 443 und Namensauflösung.
Weitere Details stehen in `PORTS-VPS.md` und `DISCORD-BOT.md`.
