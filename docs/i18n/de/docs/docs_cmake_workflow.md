[Deutsch](docs_cmake_workflow.md) · [English](../../en/docs/docs_cmake_workflow.md) · [Русский](../../ru/docs/docs_cmake_workflow.md)

<a id="cmake-workflow"></a>

# CMake-Arbeitsablauf

Unser Buildsystem basiert auf CMake. Dieses Dokument beschreibt Besonderheiten des CMake-Codes und hilft bei Änderungen an den CMake-Bestandteilen des Projekts.

Führe beim Wechsel zwischen Commits `cmake ..` im Ordner `build` aus. Dieser Schritt heißt „CMake-Neugenerierung“.

Die am 29. Oktober 2026 geprüfte lokale Windows-Konfiguration verwendet den Generator `Visual Studio 18 2026` (Community, MSVC 14.51). Gezielte native Unit-Test- und Server-Addon-Builds waren damit erfolgreich. Ältere Anleitungen mit ausschließlicher Nennung von Visual Studio 2019 beschreiben eine frühere Toolchain und beschränken den aktuellen Checkout nicht. Verwende den Repository-Ordner `build`: Die oberste CMake-Konfiguration verlangt als Binärverzeichnis genau `<repository>/build`.

<a id="adding-source-files"></a>

## Quelldateien hinzufügen

- **Visual Studio**: `Add -> New Item -> /ein sinnvoller Quellordner, nicht der Buildordner/`. Projektdateien müssen nicht neu generiert werden.
- **VS Code**: Datei normal hinzufügen und anschließend Projektdateien neu generieren. Die CMake-Erweiterung von VS Code generiert normalerweise bei Strg+S in der obersten `CMakeLists.txt` neu.

<a id="modifying-cmakelists"></a>

## CMakeLists ändern

- Nach Änderungen am Inhalt von CMakeLists musst du CMake neu generieren.

- Rufe `apply_default_settings` für alle neuen Targets auf:

  ```cmake
  apply_default_settings(TARGETS skyrim_platform)
  ```

- Ein neues C/C++-Target mit vcpkg-Abhängigkeiten musst du nicht manuell über `target_link_libraries` verknüpfen. Ergänze es stattdessen in der Liste `VCPKG_DEPENDENT`:

  ```cmake
  list(APPEND VCPKG_DEPENDENT skyrim_platform)
  ```

- Die CMakeLists.txt eines Projekts enthält gewöhnlich etwas wie:
  ```cmake
  foreach(target ${VCPKG_DEPENDENT})
    # link everything
  endforeach()
  ```

<a id="cmake-errors"></a>

## CMake-Fehler

Fehler beim Erzeugen von Projektdateien erscheinen in der Konsole. Wenn die Generierung fehlschlägt, siehst du diese Zeilen im Terminal:

```
- Configuring incomplete, errors occured
```

Suche weiter oben nach `CMake Error at...`. Dort stehen Dateipfad und Zeilennummer. VS Code kann diese Stelle hervorheben.

<a id="troubleshooting"></a>

## Fehlersuche

```
 CMake Error at vcpkg/scripts/buildsystems/vcpkg.cmake:857 (_find_package):
   Could not find a configuration file for package "directxtk" that is
   compatible with requested version "".
```

Dieser Fehler wurde von einem VS-Code-Benutzer gemeldet. Lösung:

1. Offenbar ist das Kit `amd64_x86` ausgewählt. SkyMP unterstützt derzeit keine `x86`-Builds. Wechsle zum aktiven Kit `amd64`.
   ![Bild](https://user-images.githubusercontent.com/37947786/125172169-cb8e4080-e1c0-11eb-8e72-b16b47908e39.png)
   ![Bild](https://user-images.githubusercontent.com/37947786/125172181-df39a700-e1c0-11eb-9d75-d576cf563c22.png)
2. Entferne `build/CMakeCache.txt` und `build/CMakeFiles`.
3. Generiere die Projektdateien neu.
