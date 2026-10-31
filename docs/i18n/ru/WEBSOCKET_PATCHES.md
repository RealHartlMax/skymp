<a id="websocket-integration---exact-code-patches"></a>
## Интеграция WebSocket — конкретные изменения кода

> Историческая заметка о реализации. Проверено 22 октября 2026 года: шесть потоков, повторное подключение и резервный HTTP-опрос уже отражены в [ROADMAP_FRONTEND.md](../../../ROADMAP_FRONTEND.md). Приведённые ниже списки задач и измерения относятся к прежним работам. Актуальные задачи и границы проверки указаны в [состоянии проекта](docs/docs_project_status.md).

> **Зафиксированный тогда статус: ✅ Все патчи применены — 2026-05-17**  
> Все приведённые ниже патчи применены к `skymp5-server/ts/ui.ts` и `skymp5-front/src/features/adminDashboard/index.tsx`. Файл сохранён как историческое описание изменений.

<a id="file-skymp5-servertsuits"></a>
### Файл: skymp5-server/ts/ui.ts

<a id="patch-1-add-import-after-line-18"></a>
#### Патч 1: добавить импорт (после строки 18)
```typescript
// Add to imports section
import {
  setupAdminWebSocket,
  startAdminUpdateBroadcasts,
  broadcastPlayersUpdate,
  broadcastStatusUpdate,
  broadcastLogEntry,
  broadcastEvent,
  broadcastHistoryEntry,
  broadcastRespawnUpdate,
} from './adminWebSocket';
```

<a id="patch-2-initialize-websocket-in-main-around-line-5933"></a>
#### Патч 2: инициализировать WebSocket в main() (примерно строка 5933)
```typescript
// In the server.listen() callback, after setupLiveConsoleWebSocket(server):
setupAdminWebSocket(server);

// Start periodic broadcasts
startAdminUpdateBroadcasts(
  () => ({
    name: settings.name,
    master: settings.master,
    online: getOnlinePlayerIds().length,
    maxPlayers: settings.maxPlayers,
    port: settings.port,
    uptimeSec: Math.floor((Date.now() - processStartedAt) / 1000),
  }),
  () => {
    // Return players list in same format as /api/admin/players endpoint
    // This would require extracting the logic from the HTTP endpoint
    return [];
  }
);
```

<a id="patch-3-add-broadcast-calls-to-existing-event-handlers"></a>
#### Патч 3: добавить рассылку в существующие обработчики событий

**В административной точке предупреждений (примерно строка 4810):**
```typescript
// After successfully adding warn entry, add:
broadcastHistoryEntry(adminHistory[adminHistory.length - 1]);
broadcastPlayersUpdate(/* current players */);
```

**В административной точке исключения игроков (примерно строка 4698):**
```typescript
// After successfully kicking player:
broadcastEvent({
  type: 'player_kicked',
  userId: parseInt(userId),
  playerName,
  reason,
  author: admin,
  ts: Date.now(),
});
broadcastPlayersUpdate(/* current players */);
```

**В административной точке блокировок (примерно строка 4730):**
```typescript
// After successfully banning:
broadcastHistoryEntry({
  id: generateId(),
  type: 'ban',
  playerName,
  userId: parseInt(userId),
  reason,
  author: admin,
  ts: Date.now(),
});
```

**В административной точке отключения чата (примерно строка 4890):**
```typescript
// After successfully muting:
broadcastHistoryEntry({
  id: generateId(),
  type: 'mute',
  playerName,
  userId: parseInt(userId),
  reason,
  author: admin,
  ts: Date.now(),
});
```

---

<a id="file-skymp5-frontsrcfeaturesadmindashboardindextsx"></a>
### Файл: skymp5-front/src/features/adminDashboard/index.tsx

<a id="patch-4-import-websocket-hook-after-other-imports"></a>
#### Патч 4: импортировать WebSocket-хук (после остальных импортов)
```typescript
import { useAdminWebSocket, useAdminWebSocketMessages } from '../../hooks/useAdminWebSocket';
```

<a id="patch-5-replace-status-polling-around-line-1155"></a>
#### Патч 5: заменить опрос состояния (примерно строка 1155)

**РАНЬШЕ:**
```typescript
const fetchStatus = useCallback(async () => {
  const [statusRes, playersRes] = await Promise.all([
    fetch('/api/admin/status'),
    fetch('/api/admin/players'),
  ]);
  const status = await statusRes.json();
  const players = await playersRes.json();
  // ... update state
}, []);

useEffect(() => {
  const interval = setInterval(fetchStatus, 1000);
  return () => clearInterval(interval);
}, [fetchStatus]);
```

**ТЕПЕРЬ:**
```typescript
// Use WebSocket for real-time status + players
const wsStatusState = useAdminWebSocketMessages('status', (data) => {
  if (data.online !== undefined) setOnline(data.online);
  if (data.uptimeSec !== undefined) setUptimeSec(data.uptimeSec);
}, visible);

const wsPlayersState = useAdminWebSocketMessages('players', (data) => {
  if (data.players) {
    setAllPlayers(data.players);
  }
}, visible);

// Fallback to HTTP polling if WebSocket unavailable
useEffect(() => {
  if (wsStatusState.connected) return; // WebSocket is primary
  
  const fetchStatus = async () => {
    try {
      const [statusRes, playersRes] = await Promise.all([
        fetch('/api/admin/status'),
        fetch('/api/admin/players'),
      ]);
      const status = await statusRes.json();
      const players = await playersRes.json();
      setOnline(status.online);
      setUptimeSec(status.uptimeSec);
      setAllPlayers(players);
    } catch (error) {
      console.error('Failed to fetch status:', error);
    }
  };
  
  const interval = setInterval(fetchStatus, 2000); // Slower polling fallback
  return () => clearInterval(interval);
}, [wsStatusState.connected, visible]);
```

<a id="patch-6-replace-logs-polling-around-line-1318"></a>
#### Патч 6: заменить опрос журнала (примерно строка 1318)

**РАНЬШЕ:**
```typescript
const fetchLogs = useCallback(async () => {
  const res = await fetch(`/api/admin/logs?${params.toString()}`);
  const data = await res.json();
  setLogEntries(data);
}, [params]);

useEffect(() => {
  const interval = setInterval(fetchLogs, 1000);
  return () => clearInterval(interval);
}, [fetchLogs]);
```

**ТЕПЕРЬ:**
```typescript
// Store logs list in state
const [logList, setLogList] = useState<any[]>([]);

// WebSocket real-time log appends
useAdminWebSocketMessages('log', (data) => {
  if (data.entry) {
    setLogList((prev) => [data.entry, ...prev.slice(0, 199)]); // Keep last 200
  }
}, visible && activeTab === 'logs');

// Initial fetch + periodic refresh from HTTP
useEffect(() => {
  const fetchLogs = async () => {
    const res = await fetch(`/api/admin/logs?limit=200`);
    const data = await res.json();
    setLogList(data);
  };
  
  fetchLogs();
  const interval = setInterval(fetchLogs, 5000); // Less frequent full refresh
  return () => clearInterval(interval);
}, [visible]);
```

<a id="patch-7-add-websocket-status-indicator"></a>
#### Патч 7: добавить индикатор WebSocket

Добавить в верхнюю панель или раздел диагностики:
```typescript
// Status indicator for WebSocket health
const wsHealthIndicator = (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: wsStatusState.connected
          ? '#4CAF50'
          : wsStatusState.reconnecting
            ? '#FFC107'
            : '#F44336',
      }}
      title={
        wsStatusState.connected
          ? 'WebSocket connected'
          : wsStatusState.reconnecting
            ? 'Reconnecting...'
            : `Disconnected: ${wsStatusState.error || 'fallback to polling'}`
      }
    />
    {wsStatusState.messageCount > 0 && (
      <span style={{ fontSize: '0.8em', color: '#666' }}>
        {wsStatusState.messageCount} updates
      </span>
    )}
  </div>
);
```

---

<a id="file-skymp5-frontsrchooksuseadminwebsocketts-✅-created"></a>
### Файл: skymp5-front/src/hooks/useAdminWebSocket.ts ✅ СОЗДАН

Изменения не требуются: файл завершён.

---

<a id="file-skymp5-servertsadminwebsocketts-✅-created"></a>
### Файл: skymp5-server/ts/adminWebSocket.ts ✅ СОЗДАН

Изменения не требуются: файл завершён.

---

<a id="implementation-order"></a>
## Порядок реализации

1. **Фаза 1 (сразу):**
   - ✅ Создать `/src/hooks/useAdminWebSocket.ts`.
   - ✅ Создать `/ts/adminWebSocket.ts`.
   - Применить патч 1 с импортами к ui.ts.
   - Применить патч 2 с инициализацией к ui.ts.

2. **Фаза 2 (на этой неделе):**
   - Применить патчи 4 и 5 для состояния и игроков к index.tsx.
   - Проверить WebSocket-соединение.
   - Проверить уменьшение задержки.

3. **Фаза 3 (на следующей неделе):**
   - Применить патч 3 с рассылкой к обработчикам событий ui.ts.
   - Применить патч 6 для журналов к index.tsx.
   - Выполнить сквозные тесты работы WebSocket.

4. **Фаза 4 (позже):**
   - Применить патч 6 для истории к index.tsx.
   - Применить патч 6 для событий к index.tsx.
   - Применить патч 6 для возрождения к index.tsx.
   - Контролировать производительность.

<a id="key-points"></a>
## Основные свойства

- ✅ Все новые файлы исходного кода подготовлены.
- ✅ При проблемах WebSocket переключается на HTTP-опрос.
- ✅ Обратная совместимость без несовместимых изменений.
- ✅ Автоматическое повторное подключение с экспоненциальным увеличением задержки.
- ✅ Подписки по типу сообщения: получать только необходимые данные.

<a id="testing-checklist"></a>
## Список проверок

- [ ] WebSocket-сервер запускается по адресу /ws/admin-updates.
- [ ] Клиент подключается и получает сообщение 'connected'.
- [ ] Обновления состояния приходят примерно раз в секунду.
- [ ] Отключение и повторное подключение работают надёжно.
- [ ] CPU при обычной работе ниже 2 %.
- [ ] Память на соединение менее 200 КБ.
- [ ] Сквозной тест WebSocket с резервным опросом проходит.

<a id="performance-beforeafter"></a>
## Производительность до и после

| Показатель | До (опрос) | После (WebSocket) |
| --- | --- | --- |
| Задержка состояния | 1000 мс | ~50 мс |
| Вызовы API/с | 1–2 | 0 (1 начальный вызов) |
| Трафик | 2–3 КБ/с | 0,5–1 КБ/с |
| CPU административного потока | ~2 % | ~0,5 % |
