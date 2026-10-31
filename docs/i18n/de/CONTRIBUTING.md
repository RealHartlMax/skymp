# Mitwirken

Beiträge machen die Open-Source-Gemeinschaft zu einem Ort zum Lernen, Inspirieren und Gestalten. Beiträge sind willkommen und werden vollständig gewürdigt.

Wir begrüßen Beiträge jeder Größe, selbst die Korrektur eines einzelnen Tippfehlers.

Wir erwarten gründliche Tests, einen einheitlichen Codestil und aktuelle Dokumentation.

Außerdem musst du zustimmen, deinen Beitrag unter derselben Lizenz zu veröffentlichen.

## Aus dem Quellcode bauen

Die folgenden Beispielschritte richten das Projekt lokal ein. Dafür brauchst du ungefähr 4 GB RAM, 22 GB freien Speicher und etwas Zeit.

## Voraussetzungen

### Allgemein

Diese Werkzeuge werden auf jedem System benötigt:

* 64-Bit-[NodeJS](https://nodejs.org/en/download/) ab Version 18; empfohlen wird die aktuelle LTS-Version.
* [Yarn](https://yarnpkg.com/getting-started/install): `npm install --global yarn`
* [CMake 3.19](https://cmake.org/download/) oder neuer.

### Windows

Prüfe vor Beginn die Systemvoraussetzungen:

* Windows 7 oder neuer; empfohlen wird [Windows 10](https://www.microsoft.com/en-us/software-download/windows10).
* [Visual Studio 2022](https://visualstudio.microsoft.com/downloads/). Version 2019 und ältere werden nicht unterstützt.
* .NET Framework SDK ab 4.6.0: Visual Studio Installer → .NET-Desktopentwicklung.
* Python 3.9.x mit 64 oder 32 Bit.
  * Installation über https://www.python.org/downloads/windows/
  * Oder im Visual Studio Installer unter Einzelne Komponenten nach „python“ suchen.

### Linux

Server und Unit-Tests lassen sich unter Linux bauen und ausführen. Skyrim besitzt keine native Linux-Version. Der Client muss deshalb mit MSVC gebaut werden; anschließend kann er unter Proton laufen. Dabei können beim Start von SP Abstürze auftreten. Auch die Darstellung nicht-ASCII-kodierter Texte in Skyrim kann schwierig sein.

* Ubuntu 22.04. Andere Distributionen sind nicht getestet oder funktionieren voraussichtlich nicht:
  * Alpine Linux funktioniert nicht.
  * Auf Arch basierende Distributionen können den Server ebenfalls [nicht ausführen](https://github.com/chakra-core/ChakraCore/issues/6613).
* Clang 15; GCC wird nicht unterstützt: `sudo apt install clang-15`.
* Stelle sicher, dass NodeJS und CMake aktuell genug sind:
  * Eine aktuelle Node-Version lässt sich mit [`nvm`](https://github.com/nvm-sh/nvm) oder den [APT-Repositories von Nodesource](https://github.com/nodesource/distributions) installieren.
  * Für ein aktuelles CMake kannst du ein `.tar.gz` von der [CMake-Downloadseite](https://cmake.org/download/) herunterladen, in dein Benutzerverzeichnis entpacken und zum Suchpfad hinzufügen:
    ```sh
    echo 'export PATH="$HOME/apps/cmake-3.22.0-.../bin:$PATH"' >> ~/.bashrc
    ```

Alternativ können Container Server bauen und ausführen. Einzelheiten folgen im nächsten Abschnitt.

## Konfigurieren und bauen

### Allgemein

1. Klone das Repository einschließlich der Submodule:
   ```sh
   git clone https://github.com/skyrim-multiplayer/skymp.git
   cd skymp
   git submodule init
   git submodule update
   ```

2. Führe die unten beschriebenen Schritte für dein Betriebssystem aus.

### Windows

1. Erstelle das Build-Verzeichnis für Projektdateien, Cache und Artefakte:
   ```sh
   mkdir build
   ```
2. Erzeuge Projektdateien mit CMake. Ersetze den Beispielpfad durch deinen Skyrim-SE-Ordner:
   ```sh
   cd build
   cmake .. -DSKYRIM_DIR="C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition"
   ```
   Ohne installiertes Skyrim SE:
   ```sh
   cd build
   cmake ..
   ```
   * Einige Tests werden übersprungen.
   * `Skyrim.esm` und die weiteren Masterdateien müssen für den Server manuell installiert werden.
   * Papyrus-Skripte, die Bethesdas Compiler benötigen, werden nicht kompiliert. Stattdessen werden vorhandene Binärdateien verwendet.

3. Baue mit CMake:
   ```sh
   cmake --build . --config Release
   ```
   Unter Windows kannst du auch `build/skymp.sln` in Visual Studio öffnen und Build → Build Solution wählen.

   Alle Build-Artefakte landen in `build/dist`.

### Linux

Unter Linux können Abhängigkeiten Schwierigkeiten bereiten. Dafür wird das Wrapper-Skript `build.sh` empfohlen. Es erstellt ein temporäres Verzeichnis und ergänzt einige Aliase im `PATH`.

Wenn du die Abhängigkeiten nicht selbst bauen möchtest oder eine nicht unterstützte Distribution nutzt, steht ein [Docker-Image mit vorinstallierten Abhängigkeiten](https://hub.docker.com/r/skymp/skymp-vcpkg-deps) bereit:

```sh
. misc/github_env_linux; docker run -it --rm -v "$PWD:$PWD" -w "$PWD" -u "`id -u`:`id -g`" \
    $SKYMP_VCPKG_DEPS_IMAGE bash
# ... or go rootless!
. misc/github_env_linux; podman run -it --rm -v "$PWD:$PWD" --security-opt label=disable -w "$PWD" \
    -e VCPKG_DEFAULT_BINARY_CACHE=/home/skymp/.cache/vcpkg/archives \
    $SKYMP_VCPKG_DEPS_IMAGE bash
```

`--security-opt label=disable` ist für aktiviertes SELinux vorgesehen, wenn der Quellcode innerhalb des Benutzerverzeichnisses liegt. Weitere Informationen enthält die [Dokumentation zu `podman run`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).

1. Erzeuge die Projektdateien mit dem CMake-Wrapper. Ersetze den Pfad durch deinen Skyrim-SE-Ordner:
   ```sh
   ./build.sh --configure -DCMAKE_BUILD_TYPE=Debug \
      -DSKYRIM_DIR="$HOME/.steam/debian-installation/steamapps/common/Skyrim Special Edition"
   ```
   Ohne installiertes Skyrim SE:
   ```sh
   ./build.sh --configure -DCMAKE_BUILD_TYPE=Debug
   ```
   Für eine Produktionsmaschine wähle den Build-Typ Release:
   ```sh
   ./build.sh --configure -DCMAKE_BUILD_TYPE=Release
   ```

2. Baue mit dem CMake-Wrapper:
   ```sh
   cd build
   ../build.sh --build
   ```
   Weitere Argumente nach `--build` werden an CMake übergeben. So wählst du beispielsweise ein bestimmtes Ziel:
   ```sh
   cd build
   ../build.sh --build --target=unit  # only build unit-tests and their dependencies
   # Will run cmake --build . --target=unit
   ```
   Mit `--parallel $(nproc)` verwendet das Build-System alle verfügbaren CPU-Threads.

### Optionale Schritte nach dem Build

1. Führe die Tests aus:
   ```sh
   ctest -C Debug --verbose
   ```
   Einige Tests, darunter [ESPMTest](https://github.com/skyrim-multiplayer/skymp/blob/main/skymp5-server/cpp/unit/EspmTest.cpp), benötigen Skyrim-SE-Datendateien. Ohne `-DSKYRIM_DIR` werden sie übersprungen.

   Vermeide mögliche Fehler mit diesen Voraussetzungen:
   1. Skyrim wurde über Steam installiert und aktualisiert. Der historische Ausgangstext nennt als letzten Aktualisierungsstand den [20. November 2019](https://steamdb.info/depot/489832/history/?changeid=M:8702665189575304780). [Prüfsummen](https://steamdb.info/depot/489832/?show_hashes) und [Update-Verlauf](https://steamdb.info/depot/489832/history/) stehen bei SteamDB.
   2. `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm` und `Dragonborn.esm` wurden nicht verändert. Ideal ist eine unveränderte Vanilla-Installation.

2. Ermittle die Testabdeckung; nur unter Windows:

   Installiere [OpenCppCoverage](https://github.com/OpenCppCoverage/OpenCppCoverage/releases) und führe aus:
   ```sh
   cmake .. -DCPPCOV_PATH="C:\Program Files\OpenCppCoverage"
   ctest -C Debug --verbose
   ```
   Damit werden die Projektdateien mit aktivierter Abdeckungsmessung neu erzeugt und die Tests ausgeführt. Der Bericht liegt unter `build/__coverage`.

## Frontend-Entwicklung

Das Frontend liegt im Verzeichnis `skymp5-front` und verwendet **React 18**, **TypeScript** und **Webpack**.

### Einrichtung

1. Wechsle ins Frontend-Verzeichnis:
   ```sh
   cd skymp5-front
   ```

2. Installiere die Abhängigkeiten:
   ```sh
   npm ci
   ```

   Die Frontend-Abhängigkeiten werden ausschließlich mit npm verwaltet. Scheitert `npm ci` wegen einer abweichenden Lockdatei, führe `npm install` aus und nimm die Änderungen an `package-lock.json` in den Commit auf.

### Entwicklungsserver

Starte den Entwicklungsserver mit Hot Module Reloading:
```sh
npm run watch
```

Die Anwendung ist unter `http://localhost:3000` beziehungsweise dem konfigurierten Port erreichbar.

Weitere nützliche Betriebsarten:

```sh
# fixed local port (1234)
npm run watch:fixed

# LAN testing (binds to 0.0.0.0)
npm run dev:lan
```

### Produktionsbuild

```sh
npm run build
```

Die Ausgaben liegen unter `skymp5-front/dist`.

Der Befehl verwendet den Produktionsmodus und schlägt fehl, wenn das gesamte ausgegebene JavaScript das aktuelle gzip-Budget von 850 KiB überschreitet. `bundle-size.json` dokumentiert je Datei und insgesamt die Roh- und gzip-Größe. Das längerfristige Ziel von 500 KiB ist weiterhin offen. `npm run build:dev` erzeugt einen Entwicklungsbuild; die `watch`-Befehle aktivieren Hot Reload. Einzelheiten zum Budget stehen in `skymp5-front/README.md`.

### Codestil

#### TypeScript

- Verwende explizite Typen für Funktionsparameter und Rückgabewerte.
- Bevorzuge Interfaces gegenüber Typ-Aliasen für Objektstrukturen.
- Verwende Code mit sicheren Null-/Undefined-Prüfungen, Typverengung und expliziten Schutzprüfungen.
- Vermeide `any`; verwende Generics oder passende Typen.
- Verwende standardmäßig `const` und `let` nur für neu zugewiesene Variablen.

#### React

- Verwende ausschließlich Funktionskomponenten mit Hooks.
- Setze `useState`, `useEffect`, `useMemo` und `useCallback` passend ein.
- Bevorzuge benannte Funktionen gegenüber Pfeilfunktionen für Komponenten.
- Gib bei `useEffect` immer ein Abhängigkeitsarray an.

#### Formatierung

- Nutze in VS Code „Format Document“ für einheitliche Formatierung geänderter Dateien.
- Verwende doppelte Anführungszeichen für Zeichenketten, wie in Prettier konfiguriert.
- Verwende Leerzeichen statt Tabs und zwei Leerzeichen je Einrückungsebene.
- Die empfohlene maximale Zeilenlänge beträgt 100 Zeichen.

#### ESLint

Lint-Prüfungen laufen während des Builds automatisch. Lokal prüfst du mit:
```sh
npm run lint
```

Automatische Korrektur von Lint-Problemen:
```sh
npm run lint:fix
```

### Tests

Automatisierte Tests prüfen die Funktionalität, insbesondere Lokalisierung und die Konsistenz von Komponenten.

#### Alle Tests ausführen

```sh
npm run test
```

#### Bestimmte Tests ausführen

Prüfe übereinstimmende Locale-Schlüssel und Strukturen in `en.json`, `ru.json`, `de.json` und `es.json`:
```sh
npm run test:i18n
```

Frontend-Unit-Tests:
```sh
npm run test:unit
```

API-Integrationstests:
```sh
npm run test:api
```

E2E-Smoke-Tests:
```sh
npm run test:e2e
```

UI-Komponenten in Storybook ansehen:
```sh
npm run storybook
```

In `skymp5-front/package.json` gibt es derzeit kein eigenes Frontend-Skript `test:coverage`.

### Lokalisierung (i18n)

Das Projekt unterstützt **Englisch (en)**, **Russisch (ru)**, **Deutsch (de)**, **Spanisch (es)**, **Französisch (fr)** und **Italienisch (it)**.

Die Locale-Dateien liegen unter `src/locales/`:

- `src/locales/en.json`
- `src/locales/ru.json`
- `src/locales/de.json`
- `src/locales/es.json`
- `src/locales/fr.json`
- `src/locales/it.json`

Alle sechs Dateien müssen dieselbe Schlüsselstruktur haben. Beim Ergänzen neuer UI-Texte:

1. Ergänze das Schlüssel-Wert-Paar mit derselben Struktur in allen sechs Dateien.
2. Führe den Locale-Test aus:
   ```sh
   npm run test:i18n
   ```
3. Verwende den Schlüssel in deiner Komponente:
   ```tsx
   const { t } = useTranslation();
   return <div>{t('your.locale.key')}</div>;
   ```

### TypeScript-Konfiguration

Wichtige Einstellungen in `skymp5-front/tsconfig.json`:

- `"resolveJsonModule": true` erlaubt JSON-Importe als Module.
- `"ignoreDeprecations": "6.0"` unterdrückt Veraltungswarnungen von TypeScript 6.
- `"rootDir": "./src"` legt das Wurzelverzeichnis der Quelldateien fest.

## CI/CD-Hinweise

- PR-Builds für Windows, VR und Emscripten verwenden `.github/actions/pr_base/action.yml`.
- Deploy-Workflows verwenden `DEPLOY_STATUS_WEBHOOK` für Discord-Benachrichtigungen.
- Installer-Binärdateien werden nicht in diesem Repository gebaut. Ein Push nach `main` startet `.github/workflows/trigger-installer.yml`, das `repository_dispatch` an das Installer-Repository sendet.
- Die Repository-Variable `INSTALLER_REPOSITORY` legt das Ziel im Format `owner/repo` fest.
- Das Repository-Secret `SKYMP5_INSTALLER_REPOSITORY_DISPATCH_PAT` authentifiziert diesen Aufruf.

## Pull Requests

- **Der Branch muss baubar sein.** Das Build-System muss das Repository mit deinen Änderungen bauen können.
- **Verwende Feature-Branches.** Reiche keinen Pull Request aus deinem Master-Branch ein.
- **Ein Pull Request pro Funktion.** Teile unabhängige Änderungen auf.
- **Wähle einen aussagekräftigen PR-Namen.** Das erleichtert die Bearbeitung.
- **Formatiere C++** entsprechend `.clang-format`.
- **Formatiere TypeScript** wie die geänderten Dateien, etwa mit Rechtsklick → Format Document in VS Code. Zeichenketten verwenden doppelte Anführungszeichen.
- **Leerzeichen statt Tabs** in allen Sprachen vermeiden uneinheitliche Formatierung.
- **Keine festen Commit-Namensregeln für Beitragende.** Maintainer kümmern sich um Commit-Namen.
- **Halte den Git-Verlauf sauber.** Pushe nur benötigte Änderungen und ändere Dateipfade nur bei Bedarf.
- **Entferne unbenutzten Code**, statt ihn auszukommentieren. Git verwaltet die Historie.
- **Keine beleidigenden Texte** in Code und Kommentaren.
- **Löse Merge-Konflikte.** Dein Branch darf keine Konflikte mit `main` haben.

## Schritt für Schritt

1. Forke das Projekt.
2. Erstelle deinen Feature-Branch: `git checkout -b feature/my-awesome-feature`.
3. Committe deine Änderungen: `git commit -m 'Add some my-awesome-feature'`.
4. Pushe den Branch: `git push origin feature/my-awesome-feature`.
5. Erstelle einen Pull Request.

**Viel Erfolg beim Programmieren!**
