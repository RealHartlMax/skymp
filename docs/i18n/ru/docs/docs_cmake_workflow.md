[Deutsch](../../de/docs/docs_cmake_workflow.md) · [English](../../en/docs/docs_cmake_workflow.md) · [Русский](docs_cmake_workflow.md)

<a id="cmake-workflow"></a>

# Работа с CMake

Наша система сборки основана на CMake. В документе описаны особенности CMake-кода и порядок изменения соответствующих частей проекта.

При переключении между коммитами запускайте `cmake ..` в каталоге `build`. Это называется «повторная генерация CMake».

Локальная Windows-конфигурация, проверенная 29 октября 2026 года, использует генератор `Visual Studio 18 2026` (Community, MSVC 14.51). С ней успешно выполнены целевые нативные сборки модульных тестов и серверного addon. Старые инструкции, упоминающие только Visual Studio 2019, описывают прежний инструментарий и не ограничивают текущий checkout. Используйте каталог `build` репозитория: корневая конфигурация CMake требует, чтобы бинарный каталог был ровно `<repository>/build`.

<a id="adding-source-files"></a>

## Добавление исходных файлов

- **Visual Studio**: `Add -> New Item -> /подходящий каталог исходников, не каталог сборки/`. Повторная генерация проекта не нужна.
- **VS Code**: добавьте файл обычным способом и заново сгенерируйте проект. Расширение CMake для VS Code обычно перегенерирует проект при Ctrl+S в корневом `CMakeLists.txt`.

<a id="modifying-cmakelists"></a>

## Изменение CMakeLists

- После изменения содержимого CMakeLists требуется повторная генерация CMake.

- Вызывайте `apply_default_settings` для всех новых целей:

  ```cmake
  apply_default_settings(TARGETS skyrim_platform)
  ```

- Новую C/C++-цель с зависимостями vcpkg не нужно вручную связывать через `target_link_libraries`. Достаточно добавить её в список `VCPKG_DEPENDENT`:

  ```cmake
  list(APPEND VCPKG_DEPENDENT skyrim_platform)
  ```

- Обычно CMakeLists.txt проекта содержит что-то подобное:
  ```cmake
  foreach(target ${VCPKG_DEPENDENT})
    # link everything
  endforeach()
  ```

<a id="cmake-errors"></a>

## Ошибки CMake

Ошибки генерации файлов проекта выводятся в консоль. При неудачной генерации в терминале появляются такие строки:

```
- Configuring incomplete, errors occured
```

Найдите выше `CMake Error at...`: там указаны путь и номер строки. VS Code умеет выделять эту позицию.

<a id="troubleshooting"></a>

## Устранение неполадок

```
 CMake Error at vcpkg/scripts/buildsystems/vcpkg.cmake:857 (_find_package):
   Could not find a configuration file for package "directxtk" that is
   compatible with requested version "".
```

Об этой ошибке сообщил пользователь VS Code. Решение:

1. Похоже, выбран комплект `amd64_x86`. SkyMP пока не поддерживает сборки `x86`. Переключите активный комплект на `amd64`.
   ![изображение](https://user-images.githubusercontent.com/37947786/125172169-cb8e4080-e1c0-11eb-8e72-b16b47908e39.png)
   ![изображение](https://user-images.githubusercontent.com/37947786/125172181-df39a700-e1c0-11eb-9d75-d576cf563c22.png)
2. Удалите `build/CMakeCache.txt` и `build/CMakeFiles`.
3. Заново сгенерируйте файлы проекта.
