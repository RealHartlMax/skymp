<a id="websocket-first-real-time-updates---integration-guide"></a>
# Обновления в реальном времени через WebSocket — руководство по интеграции

> Историческая заметка о реализации. Проверено 22 октября 2026 года: интеграция шести потоков, повторное подключение и резервный HTTP-опрос уже отражены в [ROADMAP_FRONTEND.md](../../../ROADMAP_FRONTEND.md). Старые списки задач и измерения ниже относятся к прежним работам. Актуальные задачи и границы проверки указаны в [состоянии проекта](docs/docs_project_status.md).

> **Зафиксированный тогда статус: ✅ Реализация завершена — 2026-05-17**  
> Все описанные ниже этапы интеграции выполнены. Серверный `adminWebSocket.ts` и клиентский `useAdminWebSocket.ts` работают. Все 6 потоков push-обновлений подключены. WebSocket используется в первую очередь, HTTP-опрос служит резервным механизмом. Руководство сохранено как исторический материал.

<a id="overview"></a>
## Обзор
Это руководство описывает подключение новой инфраструктуры WebSocket к существующему коду.

<a id="new-files-created"></a>
## Созданные файлы

<a id="1-backend-skymp5-servertsadminwebsocketts-✅"></a>
### 1. Сервер: `skymp5-server/ts/adminWebSocket.ts` ✅
- Настройка WebSocket-сервера и функции рассылки.
- Обработка сообщений с обновлениями для администраторов.
- Периодическая рассылка состояния.

<a id="2-frontend-skymp5-frontsrchooksuseadminwebsocketts-✅"></a>
### 2. Клиент: `skymp5-front/src/hooks/useAdminWebSocket.ts` ✅
- React-хук управления WebSocket-соединением.
- Автоматическое повторное подключение с экспоненциальным увеличением задержки.
- Доставка входящих сообщений соответствующим обработчикам.

<a id="integration-steps"></a>
## Этапы интеграции

<a id="step-1-import-in-skymp5-servertsuits"></a>
### Этап 1: импорт в `skymp5-server/ts/ui.ts`

Добавить к импортам примерно в строке 18:
```typescript
import {
  setupAdminWebSocket,
  startAdminUpdateBroadcasts,
  stopAdminUpdateBroadcasts,
  broadcastPlayersUpdate,
  broadcastStatusUpdate,
  broadcastLogEntry,
  broadcastEvent,
  broadcastHistoryEntry,
  broadcastRespawnUpdate,
} from './adminWebSocket';
```

<a id="step-2-initialize-websocket-in-main-function"></a>
### Этап 2: инициализация WebSocket в `main()`

После вызова `setupLiveConsoleWebSocket(server)`, примерно в строке 5933, добавить:
```typescript
setupAdminWebSocket(server);

// Start periodic broadcasts
// This requires access to getOnlinePlayerIds() and server state
const getStatusFn = () => ({
  name: settings.name,
  online: getOnlinePlayerIds().length,
  maxPlayers: settings.maxPlayers,
  uptimeSec: Math.floor((Date.now() - processStartedAt) / 1000),
});

const getPlayersFn = () => {
  // Return current player list in same format as /api/admin/players
  return []; // Implement based on existing player fetching logic
};

startAdminUpdateBroadcasts(getStatusFn, getPlayersFn);
```

<a id="step-3-replace-polling-calls-in-frontend"></a>
### Этап 3: замена опроса в клиентском интерфейсе

Заменить вызовы `setInterval` для опроса в `adminDashboard/index.tsx` на WebSocket:

**РАНЬШЕ (HTTP-опрос):**
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const res = await fetch('/api/admin/status');
    const data = await res.json();
    setOnline(data.online);
  }, 1000);
  return () => clearInterval(interval);
}, []);
```

**ТЕПЕРЬ (WebSocket):**
```typescript
const wsState = useAdminWebSocketMessages('status', (data) => {
  if (data.online !== undefined) {
    setOnline(data.online);
  }
}, visible); // Only listen when visible
```

<a id="step-4-broadcast-updates-when-actions-occur"></a>
### Этап 4: рассылка изменений при действиях

Вызывать функции рассылки при входе и выходе игроков, появлении записей журнала и других событиях:

**Пример: подключение игрока:**
```typescript
// In your player join handler
const players = getOnlinePlayerList(); // Get current list
broadcastPlayersUpdate(players);
```

**Пример: добавление записи журнала:**
```typescript
// In logDashboardLog() or similar
const entry = { ... };
broadcastLogEntry(entry);
```

**Пример: добавление записи истории:**
```typescript
// In warn/ban/kick handlers
broadcastHistoryEntry(entry);
```

<a id="migration-path"></a>
## План миграции

<a id="phase-1-status--players-high-impact-low-risk"></a>
### Фаза 1: состояние и игроки (высокая отдача, низкий риск)
1. Подключить `useAdminWebSocketMessages('status', ...)` в разделе игроков.
2. Подключить `useAdminWebSocketMessages('players', ...)` к отображению состояния.
3. Оставить HTTP-опрос резервным механизмом для менее важных полей.
4. Измерить изменение задержки и загрузки процессора.

<a id="phase-2-logs--events-medium-impact"></a>
### Фаза 2: журналы и события (средняя отдача)
1. Вызывать `broadcastLogEntry()` при появлении новых записей журнала.
2. Подключить `useAdminWebSocketMessages('log', ...)` в разделе журнала.
3. Вызывать `broadcastEvent()` для административных событий.
4. Подключить `useAdminWebSocketMessages('event', ...)` в разделе событий.

<a id="phase-3-history-append-only-stream"></a>
### Фаза 3: история (поток только с добавлением записей)
1. Вызывать `broadcastHistoryEntry()` в обработчиках предупреждений, блокировок и исключений.
2. Подключить `useAdminWebSocketMessages('history', ...)` в разделе истории.
3. Добавлять новые записи в начало существующего списка, сохраняя прежние записи.

<a id="phase-4-respawn-state-updates"></a>
### Фаза 4: возрождение (обновления состояния)
1. Вызывать `broadcastRespawnUpdate()` при изменении состояния возрождения.
2. Подключить `useAdminWebSocketMessages('respawn', ...)` в разделе возрождения.
3. Заменять состояние последними полученными данными рассылки.

<a id="fallback-strategy"></a>
## Резервный механизм

Хук `useAdminWebSocket` предусматривает автоматический переход к резервному механизму:
- Если соединение установить не удалось, попытки повторяются с экспоненциальным увеличением задержки.
- Сетевые ошибки перехватываются и записываются в журнал.
- Клиентский интерфейс продолжает работать с резервным HTTP-опросом.
- Существующий интерфейс сохраняет совместимость.

<a id="performance-targets"></a>
## Целевые показатели производительности

После миграции:
- **Задержка**: 100–500 мс → 10–50 мс, улучшение в 10 раз.
- **Нагрузка от опроса**: 1 запрос/с → 0 запросов/с при активном WebSocket.
- **Нагрузка на сервер**: снижение на 50 % для административного наблюдения.
- **Трафик**: существенное снижение за счёт передачи изменений вместо полного состояния.

<a id="monitoring"></a>
## Наблюдение

Добавить следующие показатели для контроля WebSocket:
```typescript
// In admin dashboard
const wsMetrics = {
  connectedClients: getAdminWebSocketClientCount(),
  messagesSinceConnect: wsState.messageCount,
  lastUpdateAge: wsState.lastMessageTs
    ? Date.now() - wsState.lastMessageTs
    : null,
  isConnected: wsState.connected,
};
```

<a id="testing"></a>
## Проверки

<a id="unit-tests"></a>
### Модульные тесты
- Проверить отправку `broadcastAdminUpdate()` всем подключённым клиентам.
- Проверить сериализацию и десериализацию сообщений.
- Проверить освобождение ресурсов после отключения клиента.

<a id="e2e-tests"></a>
### Сквозные тесты
- Подключить WebSocket-клиент и проверить сообщение о соединении.
- Изменить состояние сервера, например подключить игрока, и проверить рассылку.
- Разорвать соединение и проверить автоматическое повторное подключение.
- Смоделировать сбой сети и переход на опрос.

<a id="load-tests"></a>
### Нагрузочные тесты
- Не менее 50 одновременных WebSocket-соединений.
- Пропускная способность 1000 сообщений/с.
- Память на активное соединение менее 100 КБ.

<a id="rollback-plan"></a>
## План отката

При проблемах:
1. Отключить WebSocket параметром `enabled={false}` в хуках.
2. Клиентский интерфейс продолжит работу через HTTP-опрос.
3. Изменений базы данных и потери состояния нет.
4. Сохраняется полная обратная совместимость.

<a id="status-indicators"></a>
## Индикаторы состояния

Добавить в диагностику административной панели:
- ✅ WebSocket подключён.
- 🔄 Повторное подключение WebSocket: число попыток и время до следующей попытки.
- ❌ WebSocket недоступен, используется опрос.
- 📊 Частота сообщений, задержка и длительность соединения.
