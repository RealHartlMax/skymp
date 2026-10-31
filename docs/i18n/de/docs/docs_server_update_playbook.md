[Deutsch](docs_server_update_playbook.md) · [English](../../en/docs/docs_server_update_playbook.md) · [Русский](../../ru/docs/docs_server_update_playbook.md)

<a id="server-update-playbook-no-progress-loss"></a>

# Serverupdate ohne Fortschrittsverlust

Fork-Prüfstand: **23. Oktober 2026**. Die Befehle `update_server.*` gelten für Quellbuild-/Releasepakete, die diese Helfer tatsächlich enthalten. Lokale Browser-Einrichtungsarchive verwenden stattdessen `start-test-server.*`; befolge deren `UPDATE-VPS.md` und erhalte Konfiguration/Daten. Seit r4 stellt auch der GitHub-Releaseworkflow die vollständige Erststartruntime mit unabhängigem Dashboard/Bot und plattformspezifischen Quellarchiven bereit. Siehe [Paketupdates](docs_packaged_server_update.md), [VPS-Leitfaden](docs_linux_vps.md), [Worlds-Heartbeat-Update](docs_launcher_worlds.md) und [aktuellen Status](docs_project_status.md). Native Client-/Runtime-Pakete und Desktop-Launcher-Updates sind vom Austausch des Spielserverbackends getrennt.

Diese Anleitung richtet sich an Betreiber, die ohne Neuinstallation und Verlust von Spielerfortschritt aktualisieren möchten.

<a id="update-goal"></a>

## Updateziel

- Laufzeitprogramme und Skripte ersetzen.
- Persistenten Zustand erhalten: Fortschritt, Moderation, Konfiguration, Dateien.
- Rollback bereithalten.

<a id="what-must-persist"></a>

## Unbedingt erhalten

Halte diese Daten außerhalb wegwerfbarer Releaseordner und beziehe sie in Sicherungen ein.

- `server-settings.json`
- `dataDir` (Standard `./data`) mit:
  - `changeForms`
  - `admin-auth.json`
  - `admin-bans.json`
  - `admin-mutes.json`
  - `admin-history.json`
  - `admin-player-stats.json`
  - eigenen Mods/Skripten/UI-Assets
- Datenbankdateien und Dumps, sofern nicht rein im Speicher

Referenzen:

- [Server-Datenordner](docs_server_data_directory.md)
- [Konfigurationsreferenz](docs_server_configuration_reference.md)
- [Server betreiben](docs_running_a_server.md)

<a id="release-classification-policy"></a>

## Releaseklassifizierung

Damit lässt sich das Betreiberrisiko verständlich vermitteln.

- `patch` (`fix`) – keine Migration erwartet, niedriges Risiko
- `minor` (`feat`) – neue Funktion, normalerweise kompatibel
- `major` (`major`, `breaking`, `!`, `BREAKING CHANGE`) – Migration oder Kompatibilitätsrisiko

<a id="commit-message-convention-release-trigger"></a>

## Commit-Nachrichten als Releaseauslöser

Ein automatisches Serverrelease entsteht nur, wenn seit dem letzten Release mindestens ein Commit einen erlaubten Auslöser erfüllt:

- `fix(...)` → Patchrelease
- `feat(...)` → Minorrelease
- `major(...)`, `breaking(...)`, `type!:` oder `BREAKING CHANGE` → Majorrelease

Ohne passenden Commit überspringt der Workflow das Release.

Verhalten der Versionshinweise:

- Alle Commits seit dem letzten Releasetag werden aufgenommen.
- Gruppen: Major, Features, Fixes and Improvements, Other Changes.
- Auch Commits ohne Auslöser erscheinen, sobald ein Release ausgelöst wird.

Beispiele:

- `fix(auth): handle expired admin session token`
- `fix: prevent crash on empty player list`
- `feat(admin): add update banner in dashboard`
- `feat: support separate release metadata file`
- `major(server): switch default data layout`
- `feat(api)!: remove legacy endpoint format`

<a id="operator-procedure"></a>

## Betreiberablauf

1. Versionshinweise lesen und Risiko bewerten (`patch`/`minor`/`major`).
2. Wartungsfenster ankündigen.
3. Verpflichtend sichern:
   - `server-settings.json`
   - vollständiges `dataDir`
   - Datenbanksnapshot/-dump
4. Server sauber stoppen.
5. Neue Serverdateien installieren.
6. Mit bisheriger Konfiguration und Daten starten.
7. Kurzprüfung:
   - Anmeldung funktioniert
   - Spielerzustand erhalten
   - Dashboard funktioniert
   - Moderationszustand erhalten
8. Bei Fehler sofort zurückrollen.

<a id="downloaded-build-update-commands"></a>

## Updatebefehle für heruntergeladene Builds

Verwende bei heruntergeladenen Releasearchiven statt CI-Deployment die Helferskripte im Paketstamm.

Windows:

```powershell
.\update_server.ps1 -PackagePath C:\path\to\running_server_files_windows_server_dist.zip
```

Linux:

```sh
./update_server.sh --package /path/to/running_server_files_linux_server_dist.tar.gz
```

Optional nach dem Kopieren automatisch starten:

- Windows: `-StartAfter` ergänzen
- Linux: `--start-after` ergänzen

Beide Updateskripte starten automatisch über `launch_server.bat`/`launch_server.sh` statt direkt über `node`. So bleiben die Sicherheitsprüfungen des Starters aktiv, einschließlich veralteter Windows-Prozesse und der Erststartinstallation von Runtime-Abhängigkeiten.

Beide Skripte erhalten:

- `data/`
- `server-settings.json`
- `server-settings-dump.json`
- `server-settings-merged.json`

Beide erzeugen vor dem Ersetzen von Laufzeitdateien eine Sicherung mit Zeitstempel unter `./backups/`.

`node_modules` darf in heruntergeladenen Archiven fehlen. Die Starter installieren benötigte npm-Laufzeitabhängigkeiten beim ersten Start.

<a id="rollback-procedure"></a>

## Rollback

1. Aktualisierten Server stoppen.
2. Dienst auf vorherigen Releaseordner verweisen oder vorheriges Paket wiederherstellen.
3. Sicherungen wiederherstellen, falls persistente Dateien geändert wurden.
4. Server starten.
5. Betreiber und Spieler über den Rollback informieren.

<a id="recommended-deployment-layout"></a>

## Empfohlene Verteilung

Verwende eine stabile Struktur mit klar getrenntem Releasecode und dauerhaften Daten.

Beispiel:

```text
/opt/skymp/
  releases/
    v1.0.0/
    v1.0.1/
  current -> /opt/skymp/releases/v1.0.1
  persistent/
    server-settings.json
    data/
```

Setze anschließend `dataDir` auf den dauerhaften Speicherort.

<a id="communication-checklist-per-release"></a>

## Mitteilung pro Release

- Änderungen als kurze Liste
- Risiko (`patch`/`minor`/`major`)
- Erforderliche Betreibermaßnahmen
- Sicherungshinweis, immer
- Wartungsfenster
- Rollback-Aussage
