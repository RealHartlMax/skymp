<a id="github-workflows---websocket-implementation-analysis"></a>
# GitHub Workflows — анализ реализации WebSocket

> Историческая заметка о реализации. Проверено 22 октября 2026 года: шесть потоков, повторное подключение и резервный HTTP-опрос уже отражены в [ROADMAP_FRONTEND.md](../../../ROADMAP_FRONTEND.md). Старые списки задач и измерения относятся к прежним работам. Актуальные задачи и границы проверки указаны в [состоянии проекта](docs/docs_project_status.md).

> **Зафиксированный тогда статус: ✅ Проверено — 2026-05-17**  
> Изменять workflows не потребовалось. Анализ ниже подтвердил, что все новые `.ts`-файлы компилируются существующими средствами CMake/npm. Файл сохранён как исторический материал.

<a id="executive-summary"></a>
## Сводка
✅ Для реализации WebSocket **ИЗМЕНЕНИЯ НЕ ТРЕБУЮТСЯ**.

Существующие GitHub workflows **не зависят от реализации серверной части** и не требуют обновления:
- Клиентские сборки используют `npm ci` и `npm run build`. ✓
- Серверные сборки используют CMake с существующей компиляцией TypeScript. ✓
- Workflows не зависят от отдельных API-точек или схем опроса. ✓

<a id="workflow-inventory--impact-analysis"></a>
## Перечень workflows и анализ влияния

<a id="1-pr-linux-variantsyml"></a>
### 1. **pr-linux-variants.yml**
- **Назначение:** Linux-сборки pull request для Ubuntu, Arch и Fedora.
- **Клиент:** ✅ `npm ci` и `npm run build`, строки 141–145.
- **Сервер:** ✅ Настройка и сборка CMake.
- **Влияние WebSocket:** отсутствует.
  - Новая `adminWebSocket.ts` входит в существующую сборку TypeScript.
  - Дополнительные зависимости не нужны.
  - Новые этапы сборки не нужны.
- **Статус:** ✅ Изменения не требуются.

<a id="2-running_server_filesyml"></a>
### 2. **running_server_files.yml**
- **Назначение:** Релизные сборки основной ветки для распространения сервера.
- **Клиент:** ✅ `npm ci` и `npm run build`, строки 265–266.
- **Сервер:** ✅ CMake и сборка сервера.
- **Влияние WebSocket:** отсутствует.
  - WebSocket-сервер инициализируется в существующей функции `main()`.
  - Распространяется вместе с сервером, как прежний WebSocket.
  - Тестовые сборки при необходимости могут обходиться без WebSocket.
- **Статус:** ✅ Изменения не требуются.

<a id="3-pr-windows-flatrimyml--pr-windows-skyrimvryml"></a>
### 3. **pr-windows-flatrim.yml** и **pr-windows-skyrimvr.yml**
- **Назначение:** Windows-сборки pull request для Skyrim AE, SE и VR.
- **Клиент:** ✅ Общая action `.github/actions/pr_base`.
- **Сервер:** ✅ Настройка CMake.
- **Влияние WebSocket:** отсутствует.
  - Конфигурация сборки клиентского TypeScript не меняется.
  - Новая `adminWebSocket.ts` компилируется существующим серверным процессом.
- **Статус:** ✅ Изменения не требуются.

<a id="4-deployyml"></a>
### 4. **deploy.yml**
- **Назначение:** Ручной workflow развёртывания веток sweetpie и indev.
- **Клиент:** Непосредственно не собирается; используются готовые артефакты.
- **Сервер:** ✅ CMake-сборка через `./build.sh`.
- **Влияние WebSocket:** отсутствует.
  - Используется существующий процесс сборки.
  - Конфигурацию развёртывания менять не нужно.
- **Статус:** ✅ Изменения не требуются.

<a id="5-pr-emscriptenyml"></a>
### 5. **pr-emscripten.yml**
- **Назначение:** Сборки Emscripten/WebAssembly.
- **Клиент:** Не участвует, только серверная часть.
- **Влияние WebSocket:** отсутствует.
- **Статус:** ✅ Изменения не требуются.

<a id="6-prettieryml--formattingyml"></a>
### 6. **prettier.yml** и **formatting.yml**
- **Назначение:** Проверка стиля кода через Prettier и линтер.
- **Влияние:** отсутствует; новые `.ts`-файлы автоматически входят в проверку.
- **Статус:** ✅ Изменения не требуются.

<a id="7-other-workflows"></a>
### 7. **Другие workflows**
- `sp-release.yml`: Skyrim Platform, без изменений.
- `trigger-installer.yml`: запуск установщика, без изменений.
- `build-docker-images.yml`: Docker-образы, без изменений.
- `deploy_gamemode.yml`: развёртывание игрового режима, без изменений.
- Workflows метаданных репозитория: без изменений.

<a id="build-pipeline-impact-check"></a>
## Проверка процесса сборки

<a id="current-build-flow-unchanged"></a>
### Текущий процесс сборки (не меняется)
```
GitHub PR → pr-linux-variants.yml
  ├─ npm ci (frontend)
  ├─ npm run build (frontend)
  └─ CMake build (backend, includes ui.ts)
     └─ Compiles new adminWebSocket.ts automatically

GitHub main push → running_server_files.yml
  ├─ npm ci (frontend)
  ├─ npm run build (frontend)
  └─ CMake build (backend)
     └─ Includes WebSocket server
```

<a id="what-changed-transparency"></a>
### Что изменилось
✅ Новый файл: `skymp5-server/ts/adminWebSocket.ts`
- Автоматически компилируется существующим процессом CMake.
- Новые правила сборки не нужны.
- Использует пакет npm `ws`, уже имеющийся среди зависимостей.

✅ Новый файл: `skymp5-front/src/hooks/useAdminWebSocket.ts`
- Входит в существующую клиентскую сборку TypeScript.
- Автоматически включается в webpack-bundle.
- Новые npm-зависимости не нужны.

<a id="what-didnt-change"></a>
### Что осталось прежним
- Конфигурация npm. ✓
- Конфигурация CMake. ✓
- Цели сборки. ✓
- Процесс развёртывания. ✓
- Переменные окружения CI/CD. ✓

<a id="dependency-check"></a>
## Проверка зависимостей

<a id="backend-dependencies"></a>
### Зависимости сервера
```typescript
// adminWebSocket.ts uses:
import * as http from 'http';          // ✅ Node.js built-in
import { WebSocket, WebSocketServer } from 'ws';  // ✅ Already in package.json
```

**Проверено:** `ws` уже указан в `skymp5-server/package.json`.
```json
{
  "dependencies": {
    "ws": "^8.x.x"  // ✅ Already present
  }
}
```

<a id="frontend-dependencies"></a>
### Зависимости клиента
```typescript
// useAdminWebSocket.ts uses:
import { useEffect, useRef, useState, useCallback } from 'react';  // ✅ React 18 (already installed)
```

**Проверено:** новые npm-зависимости не требуются.
- Хуки React 18 являются стандартными.
- API WebSocket встроен в браузер, polyfill не нужен.

<a id="workflow-test-recommendations"></a>
## Рекомендации по тестам workflows

Хотя изменения **не требуются**, следующие улучшения тестирования возможны:

<a id="optional-enhancement-1-add-websocket-health-check-to-workflows"></a>
### Дополнение 1: проверка доступности WebSocket в workflows
```yaml
# In running_server_files.yml, after server build:
- name: Verify WebSocket infrastructure
  run: |
    docker run --rm \
      -v "${{ github.workspace }}:/src" \
      -w /src \
      node:22 \
      bash -c "grep -r 'setupAdminWebSocket\|/ws/admin-updates' skymp5-server/ts/"
```

<a id="optional-enhancement-2-frontend-lint-coverage"></a>
### Дополнение 2: охват клиентского кода линтером
```yaml
# In pr-linux-variants.yml:
- name: Lint TypeScript frontend
  run: |
    cd ${{ github.workspace }}/skymp5-front
    npm run lint  # Already in package.json, includes .ts files
```

<a id="optional-enhancement-3-e2e-websocket-test"></a>
### Дополнение 3: сквозной тест WebSocket
```yaml
# In running_server_files.yml after frontend build:
- name: Add WebSocket E2E test
  run: |
    cd ${{ github.workspace }}/skymp5-front
    npm run test:e2e  # Uses test-e2e-smoke.js with WebSocket tests
```

<a id="risk-assessment"></a>
## Оценка рисков

| Риск | Уровень | Снижение риска |
|------|-------|-----------|
| Новый файл нарушит сборку | ❌ Отсутствует | Оба файла автоматически компилируются существующими процессами |
| Нет npm-зависимости | ❌ Отсутствует | Все зависимости уже имеются |
| Нужна настройка workflow | ❌ Отсутствует | Изменения workflows не требуются |
| Несовместимое изменение поведения | 🟡 Низкий | WebSocket необязателен, HTTP остаётся резервным механизмом |
| Ухудшение производительности | 🟡 Низкий | Затронута лишь административная панель, не ядро сервера |

<a id="deployment-checklist"></a>
## Проверки перед развёртыванием

- ✅ Обновлять workflows не нужно.
- ✅ Изменять package.json не нужно.
- ✅ Изменять CMakeLists.txt не нужно.
- ✅ Новые GitHub secrets и переменные не нужны.
- ✅ Обратная совместимость через резервный HTTP-опрос.
- ✅ Совместимость с существующим CI/CD.

<a id="implementation-status"></a>
## Состояние реализации

| Пункт | Состояние |
|------|--------|
| Изменения кода компилируются автоматически | ✅ Да |
| Новых внешних зависимостей нет | ✅ Да |
| Изменения workflows не требуются | ✅ Да |
| Подготовлено к слиянию и развёртыванию | ✅ Да |

---

<a id="conclusion"></a>
## Результат

**Реализация WebSocket НЕ требует изменений workflows.**

Новые TypeScript-файлы `adminWebSocket.ts` и `useAdminWebSocket.ts` автоматически:
- Обнаруживаются существующими системами сборки.
- Компилируются имеющимися процессами TypeScript.
- Попадают в итоговые серверные и клиентские bundles.
- Развёртываются без дополнительных шагов.

Историческая инструкция предлагает закоммитить новые файлы; оставшиеся действия выполняет существующий CI/CD. ✅
