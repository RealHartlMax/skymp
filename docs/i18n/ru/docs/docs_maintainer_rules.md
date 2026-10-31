[Deutsch](../../de/docs/docs_maintainer_rules.md) · [English](../../en/docs/docs_maintainer_rules.md) · [Русский](docs_maintainer_rules.md)

<a id="maintainer-rules"></a>

# Правила сопровождающих

Сопровождающие отвечают за соблюдение этих правил. Если вы просто хотите внести вклад, знать все описанные здесь процессы необязательно.

<a id="messaging-protocol"></a>

## Протокол сообщений

Если PR меняет протокол, автор должен обновить `kMessagingProtocolVersion` в `skymp5-server/cpp/mp_common/Config.h` и отметить несовместимость в заголовке PR.

<a id="tree"></a>

## Дерево исходников

Merge-коммиты в дереве избегаются, как в [microsoft/vcpkg](https://github.com/microsoft/vcpkg).

<a id="commit-names"></a>

## Названия коммитов

Названия следуют [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

Типы коммитов по приоритету:

- release — выпуск новых версий SP и других проектов.
- feat — изменение API/функций, совместимое или нет.
- fix — исправление ошибки или сбоя.
- tests — изменения тестов.
- perf — повышение производительности.
- docs — изменения текстовых файлов.
- refact — улучшение читаемости или переписывание на другом языке/стиле.
- internal — система сборки, структура каталогов и всё, что не выполняется на компьютере пользователя.

Области commit scope называются по подкаталогам репозитория. Коммиты без scope разрешены.

Например, если все изменения в `skymp5-server`, используйте scope `skymp5-server`.

Типы `docs` и `tests` не должны иметь scope.

Все типы, кроме `fix`, начинаются с глагола: add, make и т. д.

Примеры:

```
feat(skymp5-server): add feature to choose default spawn points
internal: make server's node addon buildable via top-level CMakeLists
fix: server startup
release(skyrim-platform): version 2.1
```

Footer `BREAKING CHANGE` не используется, только знак `!`.

<a id="github-workflow-diagnostics"></a>

## Диагностика GitHub Workflow

Редакторские валидаторы YAML/Actions часто проверяют `.github/workflows`. Похожие предупреждения могут иметь разную серьёзность.

<a id="actionable-warnings-must-fix"></a>

### Требующие действий предупреждения (исправить)

Обычно это реальные ошибки связей контекста:

- Нет ID шага для используемого output, например `steps.buildx.outputs.name` без `id: buildx`.
- `${{ env.VAR }}` в выражениях, хотя значение динамически создано прежним шагом и должно передаваться через `$GITHUB_OUTPUT`.
- `${{ env.* }}` в шаге, где значение не было экспортировано.

Рекомендуемый подход:

1. Создайте динамические значения в шаге с `id:` и запишите в `$GITHUB_OUTPUT`.
2. Используйте в выражениях `${{ steps.<id>.outputs.<name> }}`.
3. В shell после экспорта через `$GITHUB_ENV` предпочитайте переменные оболочки (`$VAR`).

<a id="non-actionable-warnings-usually-safe"></a>

### Не требующие действий предупреждения (обычно безопасны)

Предупреждения вида `Context access might be invalid: SOME_SECRET_NAME` для `secrets.*` часто означают лишь, что локальный валидатор не может проверить имена секретов репозитория/организации.

Если имена намеренные и настроены в GitHub, такие предупреждения можно игнорировать.

<a id="maintainer-checklist-for-workflow-warning-triage"></a>

### Проверка предупреждений workflow

1. Сначала исправьте связи output/id/env.
2. Повторите диагностику `.github/workflows`.
3. Если остались только неизвестные имена `secrets.*`, считайте их информационными.
4. При сомнении проверьте имена секретов в настройках репозитория/организации до изменения workflow.
