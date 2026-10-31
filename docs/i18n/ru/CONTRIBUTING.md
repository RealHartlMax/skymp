# Участие в разработке

Вклад участников делает сообщество открытого ПО местом, где можно учиться, вдохновлять других и создавать новое. Любые изменения приветствуются, авторы будут указаны.

Мы рады вкладу любого размера, даже исправлению одной буквы в опечатке.

Мы просим тщательно проверять изменения, соблюдать стиль кода и поддерживать документацию в актуальном состоянии.

Также необходимо согласиться публиковать свой вклад под той же лицензией.

## Сборка из исходного кода

Ниже приведены примерные шаги локальной настройки проекта. Потребуется примерно 4 ГБ оперативной памяти, 22 ГБ дискового пространства и немного времени.

## Требования

### Общие

Для любой системы нужны:

* 64-разрядный [NodeJS](https://nodejs.org/en/download/) версии 18 или новее; рекомендуется текущая LTS-версия.
* [Yarn](https://yarnpkg.com/getting-started/install): `npm install --global yarn`.
* [CMake 3.19](https://cmake.org/download/) или новее.

### Windows

Перед началом проверьте требования:

* Windows 7 или новее; рекомендуется [Windows 10](https://www.microsoft.com/en-us/software-download/windows10).
* [Visual Studio 2022](https://visualstudio.microsoft.com/downloads/). Версии 2019 и более ранние не поддерживаются.
* .NET Framework SDK версии 4.6.0 или новее: Visual Studio Installer → разработка классических приложений .NET.
* Python 3.9.x, 64- или 32-разрядный.
  * Установка с https://www.python.org/downloads/windows/
  * Либо поиск «python» в разделе отдельных компонентов Visual Studio Installer.

### Linux

Сервер и модульные тесты можно собирать и запускать в Linux. Нативной версии Skyrim для Linux нет, поэтому клиент собирается только с MSVC. Затем его можно запускать через Proton, хотя возможны сбои при старте SP и сложности с текстом, содержащим символы вне ASCII.

* Ubuntu 22.04. Другие дистрибутивы не проверены или, как ожидается, не работают:
  * Alpine Linux не работает.
  * Дистрибутивы на базе Arch также [не позволяют запустить сервер](https://github.com/chakra-core/ChakraCore/issues/6613).
* Clang 15; GCC не поддерживается: `sudo apt install clang-15`.
* Убедитесь, что NodeJS и CMake достаточно новые:
  * Новую версию Node можно установить через [`nvm`](https://github.com/nvm-sh/nvm) или [APT-репозитории Nodesource](https://github.com/nodesource/distributions).
  * Для установки нового CMake удобно скачать `.tar.gz` со [страницы загрузки CMake](https://cmake.org/download/), распаковать в домашний каталог и добавить в путь поиска:
    ```sh
    echo 'export PATH="$HOME/apps/cmake-3.22.0-.../bin:$PATH"' >> ~/.bashrc
    ```

Для сборки и запуска сервера также можно использовать контейнеры. Подробности приведены далее.

## Настройка и сборка

### Общие шаги

1. Клонируйте репозиторий вместе с подмодулями:
   ```sh
   git clone https://github.com/skyrim-multiplayer/skymp.git
   cd skymp
   git submodule init
   git submodule update
   ```

2. Выполните описанные ниже действия для своей ОС.

### Windows

1. Создайте каталог сборки для файлов проекта, кэша и результатов:
   ```sh
   mkdir build
   ```
2. Создайте файлы проекта через CMake, заменив путь на свой каталог Skyrim SE:
   ```sh
   cd build
   cmake .. -DSKYRIM_DIR="C:/Program Files (x86)/Steam/steamapps/common/Skyrim Special Edition"
   ```
   Если Skyrim SE не установлен:
   ```sh
   cd build
   cmake ..
   ```
   * Некоторые тесты будут пропущены.
   * Для сервера потребуется вручную установить `Skyrim.esm` и другие мастер-файлы.
   * Скрипты Papyrus, которым нужен компилятор Bethesda, не будут собраны: будут использованы готовые версии.

3. Выполните сборку через CMake:
   ```sh
   cmake --build . --config Release
   ```
   В Windows можно также открыть `build/skymp.sln` в Visual Studio и выбрать Build → Build Solution.

   Все результаты сборки помещаются в `build/dist`.

### Linux

В Linux возможны сложности с зависимостями. Для их обхода рекомендуется скрипт-обёртка `build.sh`: он создаёт временный каталог и добавляет несколько псевдонимов в `PATH`.

Если вы не хотите самостоятельно собирать зависимости или используете неподдерживаемый дистрибутив, доступен [Docker-образ с установленными зависимостями](https://hub.docker.com/r/skymp/skymp-vcpkg-deps):

```sh
. misc/github_env_linux; docker run -it --rm -v "$PWD:$PWD" -w "$PWD" -u "`id -u`:`id -g`" \
    $SKYMP_VCPKG_DEPS_IMAGE bash
# ... or go rootless!
. misc/github_env_linux; podman run -it --rm -v "$PWD:$PWD" --security-opt label=disable -w "$PWD" \
    -e VCPKG_DEFAULT_BINARY_CACHE=/home/skymp/.cache/vcpkg/archives \
    $SKYMP_VCPKG_DEPS_IMAGE bash
```

Параметр `--security-opt label=disable` предназначен для систем с включённым SELinux, если исходный код находится в домашнем каталоге. Подробности — в [документации `podman run`](https://docs.podman.io/en/latest/markdown/podman-run.1.html).

1. Создайте файлы проекта через обёртку CMake, заменив путь на свой каталог Skyrim SE:
   ```sh
   ./build.sh --configure -DCMAKE_BUILD_TYPE=Debug \
      -DSKYRIM_DIR="$HOME/.steam/debian-installation/steamapps/common/Skyrim Special Edition"
   ```
   Если Skyrim SE не установлен:
   ```sh
   ./build.sh --configure -DCMAKE_BUILD_TYPE=Debug
   ```
   Для рабочей машины смените тип сборки на Release:
   ```sh
   ./build.sh --configure -DCMAKE_BUILD_TYPE=Release
   ```

2. Соберите через обёртку CMake:
   ```sh
   cd build
   ../build.sh --build
   ```
   Дополнительные аргументы после `--build` передаются в CMake. Например, можно выбрать конкретную цель:
   ```sh
   cd build
   ../build.sh --build --target=unit  # only build unit-tests and their dependencies
   # Will run cmake --build . --target=unit
   ```
   С параметром `--parallel $(nproc)` система сборки использует все доступные потоки процессора.

### Необязательные действия после сборки

1. Запустите тесты:
   ```sh
   ctest -C Debug --verbose
   ```
   Некоторые тесты, включая [ESPMTest](https://github.com/skyrim-multiplayer/skymp/blob/main/skymp5-server/cpp/unit/EspmTest.cpp), требуют файлов Skyrim SE и пропускаются, если не указан `-DSKYRIM_DIR`.

   Для предотвращения возможных ошибок убедитесь, что:
   1. Игра установлена через Steam и обновлена. Исторический исходный текст указывает последним обновлением [20 ноября 2019 года](https://steamdb.info/depot/489832/history/?changeid=M:8702665189575304780). [Хеши](https://steamdb.info/depot/489832/?show_hashes) и [история обновлений](https://steamdb.info/depot/489832/history/) доступны в SteamDB.
   2. Вы не изменяли `Skyrim.esm`, `Update.esm`, `Dawnguard.esm`, `HearthFires.esm` и `Dragonborn.esm`. Лучше использовать чистую оригинальную установку.

2. Измерьте покрытие тестами; только Windows:

   Установите [OpenCppCoverage](https://github.com/OpenCppCoverage/OpenCppCoverage/releases), затем выполните:
   ```sh
   cmake .. -DCPPCOV_PATH="C:\Program Files\OpenCppCoverage"
   ctest -C Debug --verbose
   ```
   Команды заново создадут файлы проекта с включённым измерением покрытия и запустят тесты. Отчёт появится в `build/__coverage`.

## Разработка интерфейса

Код интерфейса находится в `skymp5-front` и использует **React 18**, **TypeScript** и **Webpack**.

### Настройка

1. Перейдите в каталог интерфейса:
   ```sh
   cd skymp5-front
   ```

2. Установите зависимости:
   ```sh
   npm ci
   ```

   Для зависимостей интерфейса используется только npm. Если `npm ci` завершается ошибкой из-за рассогласованного lock-файла, выполните `npm install` и включите изменения `package-lock.json` в коммит.

### Сервер разработки

Запустите сервер с горячей заменой модулей:
```sh
npm run watch
```

Приложение будет доступно по адресу `http://localhost:3000` или на настроенном порту.

Другие полезные режимы:

```sh
# fixed local port (1234)
npm run watch:fixed

# LAN testing (binds to 0.0.0.0)
npm run dev:lan
```

### Сборка для публикации

```sh
npm run build
```

Результаты помещаются в `skymp5-front/dist`.

Команда использует производственный режим и завершается ошибкой, если суммарный JavaScript превышает текущий бюджет 850 КиБ после gzip. Файл `bundle-size.json` содержит исходные и сжатые размеры каждого файла и общий размер. Долгосрочная цель 500 КиБ пока не достигнута. Для разработки используйте `npm run build:dev`, для горячей перезагрузки — команды `watch`. Подробности бюджета находятся в `skymp5-front/README.md`.

### Стиль кода

#### TypeScript

- Явно указывайте типы параметров функций и возвращаемых значений.
- Для описания объектов предпочитайте интерфейсы псевдонимам типов.
- Используйте проверки null/undefined, сужение типов и явные защитные условия.
- Избегайте `any`: используйте обобщения или подходящие типы.
- По умолчанию применяйте `const`, а `let` — только при повторном присваивании.

#### React

- Используйте только функциональные компоненты с хуками.
- Применяйте `useState`, `useEffect`, `useMemo` и `useCallback` по назначению.
- Для компонентов предпочитайте именованные функции стрелочным.
- Всегда задавайте массив зависимостей `useEffect`.

#### Форматирование

- Используйте Format Document в VS Code для единообразного оформления изменённых файлов.
- Строки заключайте в двойные кавычки, как настроено в Prettier.
- Используйте пробелы вместо табуляции: два пробела на уровень отступа.
- Рекомендуемая максимальная длина строки — 100 символов.

#### ESLint

Проверки линтера автоматически выполняются во время сборки. Для локальной проверки:
```sh
npm run lint
```

Для автоматического исправления:
```sh
npm run lint:fix
```

### Тестирование

Автоматические тесты проверяют функциональность, в особенности локализацию и согласованность компонентов.

#### Все тесты

```sh
npm run test
```

#### Отдельные тесты

Проверка структуры и совпадения ключей в `en.json`, `ru.json`, `de.json` и `es.json`:
```sh
npm run test:i18n
```

Модульные тесты интерфейса:
```sh
npm run test:unit
```

Интеграционные тесты API:
```sh
npm run test:api
```

Сквозные smoke-тесты:
```sh
npm run test:e2e
```

Просмотр компонентов в Storybook:
```sh
npm run storybook
```

В `skymp5-front/package.json` сейчас нет отдельного скрипта интерфейса `test:coverage`.

### Локализация (i18n)

Поддерживаются **английский (en)**, **русский (ru)**, **немецкий (de)**, **испанский (es)**, **французский (fr)** и **итальянский (it)**.

Файлы локализации расположены в `src/locales/`:

- `src/locales/en.json`
- `src/locales/ru.json`
- `src/locales/de.json`
- `src/locales/es.json`
- `src/locales/fr.json`
- `src/locales/it.json`

Во всех шести файлах должна совпадать структура ключей. При добавлении нового текста:

1. Добавьте пару ключ–значение в одинаковую структуру всех шести файлов.
2. Запустите проверку локализации:
   ```sh
   npm run test:i18n
   ```
3. Используйте ключ в компоненте:
   ```tsx
   const { t } = useTranslation();
   return <div>{t('your.locale.key')}</div>;
   ```

### Настройка TypeScript

Основные параметры `skymp5-front/tsconfig.json`:

- `"resolveJsonModule": true` разрешает импорт JSON как модулей.
- `"ignoreDeprecations": "6.0"` подавляет предупреждения об устаревших возможностях TypeScript 6.
- `"rootDir": "./src"` задаёт корень исходных файлов.

## Замечания по CI/CD

- Сборки PR для Windows, VR и Emscripten используют `.github/actions/pr_base/action.yml`.
- В workflow развёртывания используется `DEPLOY_STATUS_WEBHOOK` для уведомлений Discord.
- Установочные бинарные файлы здесь не собираются. Отправка в `main` запускает `.github/workflows/trigger-installer.yml`, который посылает `repository_dispatch` в репозиторий установщика.
- Переменная репозитория `INSTALLER_REPOSITORY` задаёт цель в формате `owner/repo`.
- Секрет репозитория `SKYMP5_INSTALLER_REPOSITORY_DISPATCH_PAT` обеспечивает аутентификацию вызова.

## Pull request

- **Ветка должна собираться.** Система сборки проекта должна работать с вашими изменениями.
- **Создавайте ветки функций.** Не отправляйте PR из своей основной ветки.
- **Одна функция — один PR.** Независимые изменения разделяйте.
- **Дайте PR понятное название.** Это облегчает обработку.
- **Форматируйте C++** по правилам `.clang-format`.
- **Форматируйте TypeScript** в стиле изменяемых файлов, например через контекстное меню Format Document в VS Code. Для строк используются двойные кавычки.
- **Пробелы вместо табуляции** во всех языках предотвращают разное оформление.
- **Строгих правил названия коммитов для участников нет.** Названия исправляют сопровождающие.
- **Сохраняйте чистую историю Git.** Отправляйте только необходимые изменения, меняйте пути файлов лишь при необходимости.
- **Удаляйте ненужный код**, а не превращайте его в комментарии. Историю сохраняет Git.
- **Не используйте оскорбления** в коде и комментариях.
- **Разрешайте конфликты слияния.** Ветка не должна конфликтовать с `main`.

## Последовательность действий

1. Создайте форк проекта.
2. Создайте ветку функции: `git checkout -b feature/my-awesome-feature`.
3. Зафиксируйте изменения: `git commit -m 'Add some my-awesome-feature'`.
4. Отправьте ветку: `git push origin feature/my-awesome-feature`.
5. Откройте pull request.

**Удачного программирования!**
