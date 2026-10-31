[Deutsch](docs_running_a_server.md) · [English](../../en/docs/docs_running_a_server.md) · [Русский](../../ru/docs/docs_running_a_server.md)

<a id="running-a-server"></a>

# Einen Server betreiben

Skyrim Multiplayer veröffentlicht fertige Serverpakete auf GitHub Releases. **Für einen eigenen Server musst du das Repository weder herunterladen noch selbst bauen.**

<a id="current-fork-test-packages-and-browser-setup"></a>

## Aktuelle Fork-Testpakete und Browser-Einrichtung

Am **22. Oktober 2026** am lokalen Checkout geprüft: Linux-/Windows-Testarchive unter `build/releases/2026-10-21-modsync/`, mit Mod-API v2 und Browser-Ersteinrichtung, zufälligem vierstelligem Terminal-PIN und eigenem Admin-Konto. Keine vorgegebenen Zugangsdaten/Bethesda-Masterdateien. Node.js 22+ separat installieren und `start-test-server.sh`/`start-test-server.cmd` verwenden.

Siehe [Linux/VPS und Einrichtung](docs_linux_vps.md), [Projektstatus](docs_project_status.md), [Modverteilung](docs_launcher_modpacks.md). Bei Updates `server-settings.json`, `data/`, `world/` und eigene veröffentlichte Dateien erhalten; `UPDATE-VPS.md` des Releases beschreibt Backend-Update. Spätere Worlds-Heartbeat-Anpassung: [Launcher und Online-Master](docs_launcher_worlds.md).

Die folgenden Quellbuild-/Release-Launcher (`launch_server.*`) verwenden einen anderen Bootstrap. Ein Upstream-Download enthält nicht automatisch die lokalen Browser-/Launcher-Anpassungen dieses Forks.

<a id="source-build-and-upstream-release-package-conventions"></a>

## Konventionen für Quellbuilds und Upstream-Releases

Vorgebaute Pakete:

**<https://github.com/skyrim-multiplayer/skymp/releases>**

<a id="windows-pre-built"></a>

### Windows (vorgebaut)

1. `running_server_files_windows_server_dist.zip` aus neuestem Release laden.
2. In eigenes Verzeichnis, etwa `C:\skymp-server`, entpacken.
3. `launch_server.bat` starten; installiert beim Erststart Node.js per `winget` und npm-Abhängigkeiten.
4. Name/Ports/Ladereihenfolge in `server-settings.json` einstellen, siehe [Konfiguration](#configuration).
5. `http://localhost:8080/admin` öffnen (Standard-`uiPort`).

<a id="linux-pre-built"></a>

### Linux (vorgebaut)

1. `running_server_files_linux_server_dist.tar.gz` laden.
2. Entpacken: `tar -xzf running_server_files_linux_server_dist.tar.gz -C /opt/skymp`.
3. `./launch_server.sh` starten; installiert Node über Paketmanager und npm-Abhängigkeiten.
4. `server-settings.json` bearbeiten.
5. `http://localhost:8080/admin` öffnen.

<a id="required-skyrim-master-files-esm"></a>

### Benötigte Skyrim-Masterdateien (`*.esm`)

Serverarchive enthalten bewusst **keine** Bethesda-Master (`Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm`, `Dragonborn.esm`).

Aus eigener legaler Skyrim-Installation ins Wurzelverzeichnis der Serverdaten (Standard `data/`) kopieren; gleiche Namen in `loadOrder` erhalten.

- Windows typischerweise: `C:\Program Files (x86)\Steam\steamapps\common\Skyrim Special Edition\Data\`
- Linux/Proton: `~/.steam/steam/steamapps/common/Skyrim Special Edition/Data/`

Beispielstruktur im Serverordner:

```text
data/Skyrim.esm
data/Update.esm
data/Dawnguard.esm
data/HearthFires.esm
data/Dragonborn.esm
```

<a id="updating-an-existing-installation"></a>

### Vorhandene Installation aktualisieren

Archiv in Paketwurzel ablegen, dann Updatehelfer ausführen; `data/` und `server-settings.json` bleiben erhalten:

**Windows:**
```powershell
.\update_server.ps1 -PackagePath C:\Downloads\running_server_files_windows_server_dist.zip
```

**Linux:**
```sh
./update_server.sh --package /path/to/running_server_files_linux_server_dist.tar.gz
```

`-StartAfter` unter Windows bzw. `--start-after` unter Linux startet danach automatisch.

Vollständiger Ablauf mit Sicherung: [Server-Update-Playbook](docs_server_update_playbook.md).

---

<a id="building-from-source-advanced--contributors"></a>

## Aus Quellen bauen (Fortgeschrittene/Beiträge)

Für Beiträge/eigene Builds [CMake-Arbeitsablauf](docs_cmake_workflow.md) und [CONTRIBUTING.md](../CONTRIBUTING.md) nutzen. Ausgabe `build/dist/server`, zusätzliche Starthelfer `build/launch_server.bat`/`build/launch_server.sh`.

---

## Installation

### Windows

64-Bit-Windows mit Unterstützung für die vom Paket benötigte Node-Version verwenden. Aktuelle Fork-Testarchive verlangen Node.js 22+. Lokale Starttests belegen keine älteren Windows-Versionen.

Der Server ist ein 64-Bit-Programm und benötigt entsprechend 64-Bit-Windows.

Gesamtprojekt aus Quellen baubar; Server in `build/dist/server`, Start mit `launch_server.bat`, zusätzlicher Helfer `build/launch_server.bat`.

Downloads in eigenen Serverordner entpacken. Spätere Updates aus Paketwurzel mit `update_server.ps1`, unter Erhalt von `data`/`server-settings.json`.

`update_server.ps1 -StartAfter` startet das mitgelieferte `launch_server.bat`, einschließlich Neustartschutz und Runtime-Bootstrap.

`launch_server.bat` erkennt vor neuem Start laufende `dist_back/skymp5-server.js`-Prozesse und beendet sie automatisch.

Es prüft zudem Abhängigkeiten: fehlendes `node` möglichst per `winget` installieren, bei fehlenden `node_modules` Runtime-Pakete nachinstallieren.

### Linux

Für einen eigenen Linux-VPS gibt es zusätzlich die Anleitung
[Linux-VPS: Build und Betrieb](docs_linux_vps.md), einschließlich Linux-Nativbuild,
Frontend-Paketierung und systemd-Beispiel für 12 vCores / 24 GB RAM.

Linux unterstützt native Quellbuilds. Gepaarte lokale Ubuntu-26.04-x86_64-/Windows-x64-Testpakete mit Browser-Owner-Konto: [Linux-VPS-Build/Betrieb](docs_linux_vps.md).

Nach erfolgreichem Build `build/dist/server/launch_server.sh`, zusätzlich `build/launch_server.sh`.

In-place-Update aus Paketwurzel: `update_server.sh --package /path/to/release.tar.gz`, sichert/erhält `data` und `server-settings.json`.

`--start-after` startet das mitgelieferte `launch_server.sh`, gleicher Runtime-Bootstrap nach Dateiaustausch.

`launch_server.sh` prüft Node, versucht bei Fehlen Paketmanagerinstallation; fehlende `node_modules` werden automatisch installiert.

Client bleibt vorrangig Windows; Linux-Server separat bauen. Lokales Testziel Ubuntu 26.04 x86_64. Umgebungen/Grenzen: [native Abnahme](docs_native_validation_2026_10_19.md).

## Admin-Dashboard

Erreichbar unter `http://<host>:<uiPort>/admin`.

Sicherer Owner-Speicher: `<dataDir>/admin-auth.json`, bei Browserpaketen per PIN-Assistent erstellt. Dashboardrechte und Benutzer-/Discord-Zuordnung: `adminUiUsers`; Spielzugang separat über [`joinAccess`](docs_server_configuration_reference.md#joinaccess).

<a id="admin-session-api"></a>

### Admin-Sitzungs-API

| Endpunkt | Verhalten |
| --- | --- |
| `POST /api/admin/session/login` | JSON `{ "user": "owner", "password": "..." }`, setzt Sitzungscookie; falsche Daten 401 |
| `GET /api/admin/session` | `authenticated`, `user`, `idleTimeoutMs`, `remainingMs`; fehlend/abgelaufen 401 |
| `POST /api/admin/session/touch` | Nach Dashboardaktion verlängern; abgelaufen 401 |
| `POST /api/admin/session/logout` | Serversitzung und Cookie löschen |

`skymp_admin_session`-Cookie (`HttpOnly`, `SameSite=Lax`, Pfad `/`), **zehn Minuten Inaktivität**. Dashboard meldet Interaktion; unbeaufsichtigtes Polling zählt nicht. Sitzung im Speicher: Serverneustart verlangt neue Anmeldung, Owner-Passwort bleibt. Alte Klartext-Bootstrap-Werte können nach scrypt migriert werden; vorhandener Owner wird nicht überschrieben.

Hinter Proxy `Host`, `X-Forwarded-Proto` und Cookies konsistent weiterreichen, öffentliche HTTPS-Origin nutzen. `uiListenHost` bindet, `adminApi.externalUrl` erzeugt nur URLs. Optionaler Admin-[Discord-OAuth](docs_admin_discord_oauth.md) ist separat; lokaler Passworttest bestätigt keinen Livecallback.

r2-Testpakete vom 23. Oktober enthalten Prozessmanager in `start-test-server.sh`/`start-test-server.bat` und Aliassen `launch_server.sh`/`launch_server.bat`. Installiert fehlendes/altes Node, erlaubt Stop/Restart ohne externe Befehle. Beim Spielstop bleibt Owner-Seite `/admin` zum Starten mit bestehendem Konto, keine neuen Zugangsdaten. Private Node-22-LTS-Downloads SHA-256-geprüft, tägliche Updates, bei Fehler alter Stand. Backend braucht kein npm install. [Linux-VPS](docs_linux_vps.md), `README-TEST.md`.

Direkter Backendaufruf umgeht Manager; Stop/Restart benötigen dann expliziten externen Supervisor. Generische CMake-Launcher bleiben getrennt von r2-Startern. HTTP-Port/Bind-Änderung erfordert gesamten Starterneustart statt nur Spiel. Steuerungs-POST verlangt berechtigte Sitzung und Same-Origin-JSON.

<a id="server-logs"></a>

## Serverlogs

Ausgabe in Konsole und rotierende Dateien in `logs/` neben dem Serverprozess.

- Muster: `server-<ISO timestamp>.log`
- Älter als 14 Tage: beim Start entfernen
- Höchstens neueste 30 Logdateien beim Start behalten

Bei aktivierter Client-Bewegungstelemetrie periodische `[MovementDebug]`-JSON-Zeilen, etwa `profileId`, Bewegungsintervall, Extrapolation, Korrekturzähler.

<a id="runtime-readiness-api-international-support"></a>

### Runtime-Bereitschafts-API (internationale Unterstützung)

Zur Fehlersuche bei Neuinstallationen:

- `GET /api/admin/runtime-readiness`

Antwort mit sprachneutralen `code` und `overall` (`ok`, `warn`, `error`) für automatische Prüfungen unabhängig von UI-Sprache.

Typische Erststartvoraussetzungen:

- Launcher `launch_server.bat`/`launch_server.sh`
- `package.json`, Entry `dist_back/skymp5-server.js`
- `node`/`npm`
- Bootstrap von `node_modules`
- Gültige `release-info.json`

<a id="configuration"></a>

## Konfiguration

Defaults sind lokaler Teststart. Öffentliche Sichtbarkeit hängt von `offlineMode`, Master, registrierter Identität und Heartbeats ab. [SkyMP Worlds](docs_launcher_worlds.md): aktueller PHP-Master; Offline-Start registriert nicht.

Für externen Zugang Bind-/Listen-Einstellungen und Firewall/Routerports konfigurieren.

```json5
{
  dataDir: 'data',
  loadOrder: [
    'Skyrim.esm',
    'Update.esm',
    'Dawnguard.esm',
    'HearthFires.esm',
    'Dragonborn.esm',
  ],
  listenHost: '0.0.0.0',
  uiListenHost: '0.0.0.0',
  port: 7777,
  uiPort: 8080,
  name: 'My Server',
  adminApi: {
    enabled: true,
    externalUrl: '',
  },
  supervisor: {
    enabled: false,
    stopCommand: '',
    restartCommand: '',
  },
}
```

- Öffentliche IP: http://api.ipify.org
- Portfreigabe ggf. mit Provider klären; Status: https://www.yougetsignal.com/tools/open-ports/. [Ports](docs_server_ports_usage.md), [Konfiguration](docs_server_configuration_reference.md).
- Bei `LogMeIn Hamachi` o.ä. zugeteilte IP verwenden: nur Freunde im gemeinsamen virtuellen Lokalnetz können verbinden, keine übrigen Internetspieler.

<a id="ubuntu-2404-production-setup"></a>

## Ubuntu 24.04: Produktionseinrichtung

Empfohlenes Muster:

1. Server bauen, stabil etwa `/opt/skymp` installieren.
2. [systemd-Vorlage](../../../../misc/systemd/skymp.service) installieren.
3. Eigenen Dienstbenutzer `skymp` anlegen.
4. `systemctl enable --now skymp.service`.
5. Spiel-/Adminports in `ufw`/Provider-Firewall öffnen.

Beispiel-Supervisor-Konfiguration des Dashboards:

```json5
{
  supervisor: {
    enabled: true,
    stopCommand: '/opt/skymp/misc/systemd/skymp-supervisorctl.sh stop',
    restartCommand: '/opt/skymp/misc/systemd/skymp-supervisorctl.sh restart',
  },
}
```

Helfervorlage [misc/systemd/skymp-supervisorctl.sh](../../../../misc/systemd/skymp-supervisorctl.sh). Unter Ubuntu 24.04 gewöhnlich Dienstbenutzer per `sudoers` zu `systemctl stop skymp.service`/`systemctl restart skymp.service` ohne Passwort berechtigen.

Nginx/andere Proxys müssen `Host` und `X-Forwarded-Proto` weitergeben, damit externe Admin-URLs korrekt erzeugt werden.
