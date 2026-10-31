[Deutsch](../../de/docs/docs_server_update_playbook.md) · [English](../../en/docs/docs_server_update_playbook.md) · [Русский](docs_server_update_playbook.md)

<a id="server-update-playbook-no-progress-loss"></a>

# Обновление сервера без потери прогресса

Состояние fork: **23 октября 2026 года**. Команды `update_server.*` применимы к сборкам/релизам, действительно содержащим эти скрипты. Локальные архивы настройки браузером содержат `start-test-server.*`; используйте их `UPDATE-VPS.md`, сохраняя конфигурацию/данные. С r4 GitHub release workflow также подготавливает полную runtime первого запуска с независимым dashboard/ботом и исходниками под платформы. См. [пакетные обновления](docs_packaged_server_update.md), [VPS](docs_linux_vps.md), [heartbeat Worlds](docs_launcher_worlds.md), [статус](docs_project_status.md). Нативные клиентские/runtime-пакеты и desktop launcher обновляются отдельно от игрового backend.

Руководство для операторов, обновляющих сервер без переустановки и потери прогресса.

<a id="update-goal"></a>

## Цель

- Заменить программы и скрипты.
- Сохранить прогресс, модерацию, настройки, файлы.
- Подготовить откат.

<a id="what-must-persist"></a>

## Что сохранить

Храните эти данные вне временных каталогов выпусков и включайте в резервные копии.

- `server-settings.json`
- `dataDir` (по умолчанию `./data`) с:
  - `changeForms`
  - `admin-auth.json`
  - `admin-bans.json`
  - `admin-mutes.json`
  - `admin-history.json`
  - `admin-player-stats.json`
  - вашими модами/скриптами/UI
- Файлы и дампы базы, если данные не только в памяти

Ссылки:

- [Каталог данных](docs_server_data_directory.md)
- [Конфигурация](docs_server_configuration_reference.md)
- [Запуск сервера](docs_running_a_server.md)

<a id="release-classification-policy"></a>

## Классификация выпуска

Используйте её для ясного сообщения риска оператору.

- `patch` (`fix`) — миграция не ожидается, низкий риск
- `minor` (`feat`) — новая функция, обычно совместима
- `major` (`major`, `breaking`, `!`, `BREAKING CHANGE`) — миграция или риск совместимости

<a id="commit-message-convention-release-trigger"></a>

## Коммиты как триггер выпуска

Автоматический выпуск создаётся только при наличии после прошлого выпуска хотя бы одного принятого триггера:

- `fix(...)` → patch
- `feat(...)` → minor
- `major(...)`, `breaking(...)`, `type!:` или `BREAKING CHANGE` → major

Если триггеров нет, workflow пропускает выпуск.

Журнал изменений:

- Включает все коммиты после прошлого тега.
- Группы: Major, Features, Fixes and Improvements, Other Changes.
- Коммиты без триггеров тоже включены, когда выпуск запущен другим коммитом.

Примеры:

- `fix(auth): handle expired admin session token`
- `fix: prevent crash on empty player list`
- `feat(admin): add update banner in dashboard`
- `feat: support separate release metadata file`
- `major(server): switch default data layout`
- `feat(api)!: remove legacy endpoint format`

<a id="operator-procedure"></a>

## Порядок оператора

1. Прочитать выпуск и определить риск (`patch`/`minor`/`major`).
2. Объявить обслуживание.
3. Обязательно сохранить:
   - `server-settings.json`
   - весь `dataDir`
   - снимок/дамп базы
4. Корректно остановить сервер.
5. Установить новые файлы.
6. Запустить с существующими настройками/данными.
7. Проверить:
   - вход работает
   - состояние игроков цело
   - dashboard работает
   - модерация сохранена
8. При неудаче сразу откатить.

<a id="downloaded-build-update-commands"></a>

## Команды скачанных сборок

Для релизных архивов вместо CI используйте скрипты в корне пакета.

Windows:

```powershell
.\update_server.ps1 -PackagePath C:\path\to\running_server_files_windows_server_dist.zip
```

Linux:

```sh
./update_server.sh --package /path/to/running_server_files_linux_server_dist.tar.gz
```

Необязательный автоматический запуск после копирования:

- Windows: добавить `-StartAfter`
- Linux: добавить `--start-after`

При автозапуске оба скрипта вызывают `launch_server.bat`/`launch_server.sh`, а не `node` напрямую. Сохраняются проверки стартера, включая очистку старых Windows-процессов и подготовку runtime-зависимостей при первом запуске.

Оба скрипта сохраняют:

- `data/`
- `server-settings.json`
- `server-settings-dump.json`
- `server-settings-merged.json`

Перед заменой runtime оба создают резервную копию с меткой времени в `./backups/`.

`node_modules` может отсутствовать в архиве. Стартеры устанавливают необходимые npm runtime-зависимости при первом запуске.

<a id="rollback-procedure"></a>

## Откат

1. Остановить обновлённый сервер.
2. Направить сервис на прошлый выпуск или восстановить пакет.
3. Восстановить резервные копии изменённых постоянных файлов.
4. Запустить.
5. Сообщить об откате операторам/игрокам.

<a id="recommended-deployment-layout"></a>

## Рекомендуемая структура

Используйте стабильную структуру с раздельными кодом выпусков и постоянными данными.

Пример:

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

Затем направьте `dataDir` на постоянное расположение.

<a id="communication-checklist-per-release"></a>

## Сообщение для каждого выпуска

- Краткие изменения
- Риск (`patch`/`minor`/`major`)
- Действия оператора, если нужны
- Напоминание о резервной копии всегда
- Окно обслуживания
- Условия отката
