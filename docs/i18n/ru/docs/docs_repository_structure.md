[Deutsch](../../de/docs/docs_repository_structure.md) · [English](../../en/docs/docs_repository_structure.md) · [Русский](docs_repository_structure.md)

<a id="repository-structure"></a>

# Структура репозитория

Основные языки проекта — C++ и TypeScript.

Система сборки основана на CMake. При работе со всем проектом CMake автоматически вызывает NPM для подпроектов TypeScript: установка зависимостей, компиляция исходников и другое.

<a id="special-folders"></a>

## Специальные каталоги

- `<repo_root>/build` — фиксированный каталог сборки CMake. Содержит артефакты и не отслеживается Git.

- `<repo_root>/cmake` — скрипты CMake.

- `<repo_root>/overlay_ports` — overlay-порты Vcpkg.

- `<repo_root>/overlay_triplets` — overlay-triplet Vcpkg.

<a id="project-commons"></a>

## Общие правила проектов

У каждого проекта свой каталог: `<repo_root>/<project_name>`.

Независимо от языка, имена каталогов используют kebab-case: вариант snake_case с дефисом вместо подчёркивания, например `skyrim-platform`, а не `skyrim_platform` или `skyrimPlatform`.

У каждого проекта есть `CMakeLists.txt`.

`CMakeLists.txt` должна определять цель с тем же именем, что и проект.

<a id="c-projects"></a>

## Проекты C++

Имена файлов используют CamelCase: `JsEngine.h`.

<a id="typescript-projects"></a>

## Проекты TypeScript

Имена файлов используют lowerCamelCase: `fooBar.ts`.

<a id="frontend-structure-skymp5-front"></a>

## Структура frontend (`skymp5-front`)

Основные исходники находятся в `skymp5-front/src`.

- `src/features/adminDashboard` — страницы администратора, панели и формы
- `src/features/serverList` — интерфейс launcher/списка серверов
- `src/features/login` — вход frontend
- `src/features/chat` — интерфейс чата
- `src/features/skillsMenu` — интерфейс навыков
- `src/features/animList` — список анимаций
- `src/features/testMenu` — интерфейс разработки/тестирования
- `src/locales` — ресурсы локализации (`en`, `ru`, `de`, `es`, `fr`, `it`)

<a id="server-typescript-structure-skymp5-serverts"></a>

## Серверный TypeScript (`skymp5-server/ts`)

- `index.ts` — начальная загрузка сервера
- `ui.ts` — HTTP-маршруты (`/api/admin/*`, метрики, аутентификация/сессии администратора)
- `settings.ts` — загрузка/проверка `server-settings.json`, объединение дополнительных настроек
- `manifestGen.ts` — манифесты ресурсов/порядка загрузки
- `scampNative.ts` — нативные привязки серверной runtime
- `systems/` — игровые системы и системы выполнения
- `examples/` — примеры скриптов, например лечение/возрождение
- `shims/` — совместимость при сборке и выполнении
