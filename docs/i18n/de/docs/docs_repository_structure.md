[Deutsch](docs_repository_structure.md) · [English](../../en/docs/docs_repository_structure.md) · [Русский](../../ru/docs/docs_repository_structure.md)

<a id="repository-structure"></a>

# Repository-Struktur

Die Hauptsprachen des Projekts sind C++ und TypeScript.

Das Buildsystem basiert auf CMake. Bei Arbeiten am Gesamtprojekt ruft CMake automatisch NPM-Befehle für TypeScript-Teilprojekte auf, etwa zur Abhängigkeitsinstallation oder Quellkompilierung.

<a id="special-folders"></a>

## Besondere Ordner

- `<repo_root>/build` – fest vorgegebener CMake-Buildordner für Buildartefakte; nicht in Git erfasst.

- `<repo_root>/cmake` – CMake-Skripte.

- `<repo_root>/overlay_ports` – Vcpkg-Overlay-Ports.

- `<repo_root>/overlay_triplets` – Vcpkg-Overlay-Triplets.

<a id="project-commons"></a>

## Gemeinsame Projektregeln

Jedes Projekt hat einen Ordner: `<repo_root>/<project_name>`.

Unabhängig von der Sprache verwenden Ordnernamen kebab-case: eine Variante von snake_case mit Bindestrichen statt Unterstrichen, beispielsweise `skyrim-platform` statt `skyrim_platform` oder `skyrimPlatform`.

Jedes Projekt besitzt eine `CMakeLists.txt`.

Die `CMakeLists.txt` soll ein Target mit demselben Namen wie das Projekt definieren.

<a id="c-projects"></a>

## C++-Projekte

Dateinamen verwenden CamelCase: `JsEngine.h`.

<a id="typescript-projects"></a>

## TypeScript-Projekte

Dateinamen verwenden lowerCamelCase: `fooBar.ts`.

<a id="frontend-structure-skymp5-front"></a>

## Frontend-Struktur (`skymp5-front`)

Der Hauptquellcode liegt unter `skymp5-front/src`.

- `src/features/adminDashboard` – Web-Adminseiten, Panels und Einstellungsformulare
- `src/features/serverList` – Launcher-/Serverlistenoberfläche
- `src/features/login` – Frontend-Anmeldeabläufe
- `src/features/chat` – Chat-Oberfläche
- `src/features/skillsMenu` – Fertigkeiten-Oberfläche
- `src/features/animList` – Animationslisten-Oberfläche
- `src/features/testMenu` – Entwicklungs-/Testoberfläche
- `src/locales` – Sprachressourcen (`en`, `ru`, `de`, `es`, `fr`, `it`)

<a id="server-typescript-structure-skymp5-serverts"></a>

## Server-TypeScript-Struktur (`skymp5-server/ts`)

- `index.ts` – Server-Bootstrap
- `ui.ts` – HTTP-Routen (`/api/admin/*`, Metriken, Admin-Authentifizierung/Sitzungen)
- `settings.ts` – Laden/Prüfen von `server-settings.json`, Zusammenführen zusätzlicher Einstellungen
- `manifestGen.ts` – Ressourcen-/Ladereihenfolge-Manifeste
- `scampNative.ts` – native Bindings für die Serverruntime
- `systems/` – Spiel-/Laufzeitsysteme
- `examples/` – Beispielskripte, etwa Heilung/Respawn
- `shims/` – Kompatibilitätshilfen für Bündelung und Laufzeit
