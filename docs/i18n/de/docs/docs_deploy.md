[Deutsch](docs_deploy.md) · [English](../../en/docs/docs_deploy.md) · [Русский](../../ru/docs/docs_deploy.md)

<a id="deploy-server-from-github"></a>

# Server aus GitHub bereitstellen

Diese Anleitung beschreibt Docker-/GitHub-Actions-Deployment, nicht lokale Browser-Testarchive oder den getrennten PHP-Webroot-Upload. Geprüft am 22. Oktober 2026. Dafür gelten [VPS-/Browser-Einrichtung](docs_linux_vps.md), [SkyMP Worlds](docs_launcher_worlds.md) und [aktueller Status](docs_project_status.md). Workflow-Konfiguration belegt kein erfolgreiches Live-Deployment.

Ein GitHub-Actions-Job kann den Server aus einem Git-Zweig bereitstellen. Diese Anleitung beschreibt die Einrichtung.

<a id="github-prerequisites"></a>

## GitHub-Voraussetzungen

- Du musst das Quellrepository besitzen. Ein Fork von [skyrim-multiplayer/skymp](https://github.com/skyrim-multiplayer/skymp) sollte funktionieren.
- Repository-Secrets einrichten (bei uns https://github.com/skyrim-multiplayer/skymp/settings/secrets/actions):
  - `DEPLOY_TARGET_HOST`: IP oder Domain des Zielservers.
  - `DEPLOY_SSH_PRIVATE_KEY`, `DEPLOY_SSH_KNOWN_HOSTS`: privater SSH-Schlüssel und erwarteter Fingerabdruck, siehe unten.
  - `DEPLOY_STATUS_WEBHOOK`: Discord-Webhook, siehe https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks. **Kein /github oder Ähnliches anhängen!**
- Gewünschte Zweige in [`.github/workflows/deploy.yml`](../../../../.github/workflows/deploy.yml) ergänzen und `DEPLOY_TARGET_USER` auf den eingerichteten Serverbenutzer setzen.
- Ein bereitzustellender PR muss aus einem Zweig **des Hauptrepositories, nicht eines Forks** stammen. \
  Siehe https://docs.github.com/en/actions/security-guides/encrypted-secrets:
  > **Hinweis:** Außer `GITHUB_TOKEN` werden Secrets bei Workflows aus Forks nicht an Runner weitergegeben.

<a id="server-prerequisites"></a>

## Servervoraussetzungen

- Ubuntu 22.04; andere Distributionen sollten funktionieren, sind ungetestet.
- Aus dem Internet erreichbar, erforderliche Ports offen.
- Docker und ein Benutzer in der Gruppe `docker`. \
  **Hinweis:** Das entspricht praktisch Root-Zugriff. Wähle sorgfältig, wer Deployjobs ausführen darf, also Schreibzugriff auf das Repository erhält.
- Pro bereitzustellendem Zweig einen Ordner `~/skymp-server-<branch>` anlegen, entsprechend den Optionen der Deploy-Aktion. Siehe Einrichtung unten.

<a id="setup-access-for-github"></a>

### Zugriff für GitHub

Öffentlichen Serverschlüssel abrufen:

```
ssh-keyscan <server ip>
<...>
# <server ip>:22 SSH-2.0-OpenSSH_8.2p1 Ubuntu-4ubuntu0.2
<server ip> ecdsa-sha2-nistp256 AAAAE<...>
<...>
```

Die Zeichenfolge mit `ecdsa-sha2-nistp256` in `DEPLOY_SSH_KNOWN_HOSTS` kopieren.

Schlüsselpaar für Deployment erzeugen und als autorisierten Schlüssel eintragen:

```sh
ssh-keygen -b 4096 -C skymp_github_deployer -f gh_key
cat gh_key.pub >> ~/.ssh/authorized_keys
```

Inhalt von `gh_key` ohne `.pub` in `DEPLOY_SSH_PRIVATE_KEY` kopieren.

Zur Sicherheit kannst du den privaten Schlüssel anschließend löschen:

```
rm gh_key
```

<a id="setting-up-branch-on-a-server"></a>

## Zweig auf dem Server einrichten

- Ordner anlegen: `mkdir -p ~/skymp-server-<branch>/server/data`; erforderliche Daten hochladen.
- `server-settings.json` mit den gewünschten Werten in `skymp-server-<branch>` anlegen, nicht in `skymp-server-<branch>/server`, wo sie überschrieben würde.

Erwarteter Inhalt des Serverzweigs für erfolgreiches Deployment:

```
$ ls -lhR skymp-server-<branch>/
skymp-server-<branch>/:
total 8.0K
drwxrwxr-x 3 ubuntu ubuntu 4.0K Dec  5 12:04 server
-rw-rw-r-- 1 ubuntu ubuntu  239 Dec  5 12:02 server-settings.json

skymp-server-<branch>/server:
total 4.0K
drwxrwxr-x 2 ubuntu ubuntu 4.0K Dec  5 12:01 data

skymp-server-<branch>/server/data:
total 346M
-rw-rw-r-- 1 ubuntu ubuntu  25M Dec  5 12:01 Dawnguard.esm
-rw-rw-r-- 1 ubuntu ubuntu  62M Dec  5 12:01 Dragonborn.esm
-rw-rw-r-- 1 ubuntu ubuntu 3.8M Dec  5 12:01 HearthFires.esm
-rw-rw-r-- 1 ubuntu ubuntu 239M Dec  5 12:01 Skyrim.esm
-rw-rw-r-- 1 ubuntu ubuntu  18M Dec  5 12:01 Update.esm
```

<a id="running-deploy"></a>

## Deployment ausführen

Die separate Aktion [`.github/workflows/deploy.yml`](../../../../.github/workflows/deploy.yml) lässt sich im GitHub-Reiter [Actions](https://github.com/skyrim-multiplayer/skymp/actions) starten: https://github.com/skyrim-multiplayer/skymp/actions/workflows/deploy.yml

![](../../../img/run_deploy.png)

Verfolge den Fortschritt über die Ausführungsliste oder den mit `DEPLOY_STATUS_WEBHOOK` verbundenen Discord-Kanal.

Verfügbare Aktionen:

- `deploy` – PRs mit `merge-to:<branch>` zusammenführen, Ergebnis bauen, Artefakte hochladen und Server neu starten.
- `restart` – Server stoppen, falls aktiv, und starten.
- `stop` – Server stoppen.

<a id="debugging-crashes"></a>

## Abstürze untersuchen

Die wichtigsten Befehle:

```sh
# To attach to the running server
docker exec -it -u 0:0 skymp-server-indev sh -c 'gdb -p "`pgrep node`" -ex c'

# To debug a crash (needs some configuration, see below for details)
ls -lh /var/crash
docker exec -it skymp-server-indev gdb /usr/bin/node /var/crash/...
```

Ein bereitgestellter Server kann unter bestimmten Umständen abstürzen. Halte dafür Debugging-Möglichkeiten bereit.

Voraussetzungen:

1. `scam_native.node` benötigt Debugsymbole, sonst ist der Core-Dump wenig hilfreich. Unser [CI-Build](https://github.com/skyrim-multiplayer/skymp/blob/688c5dfeabffd6510d759d5a128349de8898743c/.github/workflows/pr-ubuntu-docker.yml#L10) enthält sie. Bei eigenen Builds gegebenenfalls `-DCMAKE_BUILD_TYPE=Debug` oder `RelWithDebInfo` ausdrücklich angeben.
2. `gdb` in der Serverumgebung installieren. Bei Containern gehört es ins Image; Debugging des Containerprozesses vom Host ist unzuverlässig.
3. Im Container muss `ptrace` verfügbar sein: `--cap-add=SYS_PTRACE` zu `docker run` ergänzen.

An den Server anhängen:

```
$ docker exec -it -u 0:0 skymp-server-indev sh -c 'gdb -p "`pgrep node`" -ex c'
<...>
Continuing.
```

gdb benötigt einige Sekunden zum Laden; währenddessen pausiert der Server. Normalerweise wartet gdb anschließend auf Eingabe, hier setzt `-ex c` die Ausführung direkt fort und minimiert die Pause. Strg+C pausiert erneut und öffnet die Eingabe. Halte Pausen bei aktiven Spielern kurz.

Nun sind übliche gdb-Befehle verfügbar. Setze Breakpoints oder verwende `c` zum Fortsetzen.

<a id="collecting-core-dumps"></a>

### Core-Dumps sammeln

Für Abstürze ohne angehängtes `gdb` ist auch diese Einrichtung erforderlich und dringend empfohlen.

1. Core-Dumps auf dem Host konfigurieren, bei Containern also auf dem Hauptrechner.
   1. `ulimit -c` muss `unlimited` oder mindestens etwa 500–1000 MB anzeigen.
   2. Optional `sysctl kernel.core_pattern` auf einen Dateisystempfad setzen. Möglichst nicht mit `|` beginnen: Das erschwert Docker und benötigt ein konfiguriertes Empfangsprogramm wie apport. \
      Empfohlen:
      - `sudo sysctl kernel.core_pattern=/var/crash/core-%P-%u-%g-%s-%t-%c-%h`
      - `kernel.core_pattern=/var/crash/core-%P-%u-%g-%s-%t-%c-%h` in `/etc/sysctl.cfg` ergänzen, damit es Neustarts übersteht.
2. Bei Containern `/var/crash` als Volume einhängen; andernfalls liegen Dumps nur im Container.

Funktionsprüfung:

1. Server-PID ermitteln, beispielsweise:
   ```
   $ ps aux | grep 'node dist_back' | grep -v grep
   ubuntu   1532646  5.8  3.7 35411280 609416 ?     SLl  Jan28   2:21 node dist_back/skymp5-server.js
            ^~~~~~~ PID you're looking for
   ```
2. Abnormales Beenden mit `SIGABRT` erzwingen:
   ```
   $ kill -QUIT 1532646
   ```
3. Bei Containern muss `docker logs <container name>` Folgendes enthalten:
   ```
   ./run.sh: line 8:     7 Quit                    (core dumped) LD_LIBRARY_PATH="$PWD" node dist_back/skymp5-server.js
   ```
4. Der Core-Dump muss unter `/var/crash` sichtbar sein:
   ```
   $ ls -lh /var/crash
   total 204M
   -rw------- 1 ubuntu ubuntu 326M Jan 29 00:33 core-1532646-1000-1000-3-<...>
                                          ^~~~~      ^~~~~~~
                                   Current time      Server's PID when it crashed
   ```

Core-Dump untersuchen:

1. In den vorhandenen Servercontainer oder einen identisch eingerichteten neuen Container wechseln und gdb starten: `docker exec -it skymp-server-indev gdb /usr/bin/node /var/crash/...`.
2. `bt` zeigt den Aufrufstapel.
3. Fehler untersuchen.
