<a id="roadmap-update-instructions"></a>
# Инструкция по обновлению ROADMAP

> Историческая заметка о реализации. Проверено 22 октября 2026 года: шесть потоков, повторное подключение и резервный HTTP-опрос уже отражены в [ROADMAP_FRONTEND.md](../../../ROADMAP_FRONTEND.md). Старые списки задач и измерения относятся к прежним работам. Актуальные задачи и границы проверки указаны в [состоянии проекта](docs/docs_project_status.md).

> **Зафиксированный тогда статус: ✅ Применено — 2026-05-17**  
> Все инструкции этого файла применены к `ROADMAP_FRONTEND.md`. В строке WebSocket таблицы сравнения с txAdmin стоит `✅ Done`; добавлен раздел «WebSocket Observability Checkpoint (2026-05-17)».  
> Этот файл сохранён исключительно как исторический материал.

**Место в ROADMAP_FRONTEND.md:** примерно строка 95 таблицы «txAdmin Parity Snapshot».

<a id="update-to-make"></a>
### Предусмотренное изменение

Найти строку:
```
| WebSocket-first real-time updates                 | 🔄 In progress       | Polling is primary, but live-console WebSocket stream exists; broader push updates are still planned            | Needed for txAdmin-like live feel at scale                                  |
```

Заменить на:
```
| WebSocket-first real-time updates                 | 🔄 In progress       | Backend WebSocket server (`/ws/admin-updates`) infrastructure created; frontend `useAdminWebSocket` hook implemented with auto-reconnect + exponential backoff; integration guide + patches ready; migration path documented (Status/Players → Logs/Events → History → Respawn)              | Status + Players phase starting (est. 1-2 weeks for full rollout)            |
```

---

<a id="update-recommended-next-adoption-steps-section"></a>
## Обновление раздела «Recommended Next Adoption Steps»

**Место:** примерно строка 101 после таблицы сравнения с txAdmin.

<a id="old-text"></a>
### Старый текст:
```
1. Extend guarded server control with richer operator diagnostics (which supervisor is active, last action result, command health checks).
2. Expand Players into a txAdmin-style player profile modal (notes/history/identifiers/warn templates).
3. Add a first scheduler page for planned restarts and warning announcements.
4. Introduce WebSocket push for dashboard status/player/events to reduce polling lag and API load.
```

<a id="new-text"></a>
### Новый текст:
```
1. **WebSocket Status + Players phase** (this week): Migrate status/players polling to WebSocket; measure latency improvement (target: 1000ms → 50ms); deploy with HTTP fallback.
2. **WebSocket Logs + Events phase** (next week): Add broadcast calls to log/event handlers; migrate Logs/Events panels to WebSocket streams; add append-only pattern for history.
3. **WebSocket History + Respawn phase** (week 3): Complete real-time updates for all admin dashboard data; measure total polling elimination.
4. **Server control enhancements** (parallel): Richer operator diagnostics (which supervisor is active, last action result, command health checks).
5. **Scheduler page** (week 4): First-class page for planned restarts, warning announcements, scheduled maintenance.
6. **RBAC policy editor** (week 5): Full role-based access control UI + audit model.
```

---

<a id="summary-of-changes"></a>
## Сводка изменений

✅ **Завершено:**
- Серверная инфраструктура WebSocket (`skymp5-server/ts/adminWebSocket.ts`).
- Клиентский хук WebSocket (`skymp5-front/src/hooks/useAdminWebSocket.ts`).
- Руководство по интеграции с конкретными изменениями кода (`WEBSOCKET_INTEGRATION_GUIDE.md`).
- Подробный файл патчей (`WEBSOCKET_PATCHES.md`).
- План сессии (`/memories/session/websocket-plan.md`).

🔄 **Подготовлено к реализации:**
- Патчи 1–2: инициализация WebSocket на сервере.
- Патчи 4–5: миграция опроса состояния и игроков.
- Проверка на сервере разработки.

📋 **Следующие фазы:**
- Неделя 2: журналы и события.
- Неделя 3: история и возрождение.
- Недели 4–5: планировщик и RBAC.

---

<a id="files-reference"></a>
## Ссылки на файлы

1. **Новый серверный файл:** `skymp5-server/ts/adminWebSocket.ts`
   - Настройка WebSocket-сервера.
   - Функции рассылки для каждого типа событий.
   - Учёт клиентов и освобождение ресурсов.

2. **Новый клиентский файл:** `skymp5-front/src/hooks/useAdminWebSocket.ts`
   - Основной хук: `useAdminWebSocket(onMessage, enabled)`.
   - Вспомогательный хук: `useAdminWebSocketMessages(type, onMessage, enabled)`.
   - Автоматическое повторное подключение с экспоненциальным увеличением задержки.
   - Полная типобезопасность TypeScript.

3. **Руководства по интеграции:**
   - `WEBSOCKET_INTEGRATION_GUIDE.md`: обзор и стратегия.
   - `WEBSOCKET_PATCHES.md`: конкретные изменения по файлам.

---

<a id="quick-start"></a>
## Быстрый старт

<a id="to-test-websocket-infrastructure-without-full-integration"></a>
### Проверка инфраструктуры WebSocket без полной интеграции:

1. Применить патчи 1 и 2 к `ui.ts`: импорты и инициализация.
2. Собрать сервер командой `npm run build` в `skymp5-server`.
3. Запустить сервер в режиме разработки.
4. Открыть консоль браузера и проверить:
```javascript
const ws = new WebSocket('ws://localhost:7777/ws/admin-updates');
ws.onmessage = (e) => console.log('Update:', JSON.parse(e.data));
```

Ожидаемый вывод:
```
Update: { type: 'connected', ts: 1234567890, data: { clientCount: 1 } }
Update: { type: 'status', ts: 1234567891, data: { ... } }
Update: { type: 'players', ts: 1234567891, data: { ... } }
```

---

<a id="performance-expectations"></a>
## Ожидаемая производительность

После миграции на WebSocket:

| Показатель | Опрос раньше | WebSocket после миграции |
|--------|-----------------|------------------|
| Задержка обновления состояния | ~1000 мс | ~50 мс |
| Вызовы API в секунду | 1–2 | 0,1 (только в начале) |
| Трафик (состояние/игроки) | 2–3 КБ/с | 0,3–0,5 КБ/с |
| CPU для административного опроса | ~2 % | ~0,3 % |
| Память на клиента | 10 КБ | 50 КБ |

---

<a id="implementation-checklist"></a>
## Список проверок реализации

- [ ] Проверить созданные файлы WebSocket.
- [ ] Применить патчи 1–2 к ui.ts.
- [ ] Проверить WebSocket-соединение.
- [ ] Применить патчи 4–5 для состояния и игроков к index.tsx.
- [ ] Выполнить сквозной тест WebSocket и резервного механизма.
- [ ] Обновить ROADMAP.
- [ ] Создать GitHub issue для фазы журналов и событий.
- [ ] Измерить производительность относительно опроса.
