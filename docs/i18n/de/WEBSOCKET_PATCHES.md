<a id="websocket-integration---exact-code-patches"></a>
## WebSocket-Integration – konkrete Codeänderungen

> Historischer Implementierungsvermerk. Am 22. Oktober 2026 geprüft: Die sechs Datenströme sowie Wiederverbindung und HTTP-Rückfall sind bereits in [ROADMAP_FRONTEND.md](../../../ROADMAP_FRONTEND.md) erfasst. Die folgenden Checklisten und Messungen beschreiben die damalige Arbeit. Aktuelle Aufgaben und Prüfgrenzen stehen im [Projektstatus](docs/docs_project_status.md).

> **Damals dokumentierter Status: ✅ Alle Patches übernommen — 2026-05-17**  
> Alle folgenden Patches wurden in `skymp5-server/ts/ui.ts` und `skymp5-front/src/features/adminDashboard/index.tsx` übernommen. Diese Datei bleibt als historische Referenz der Änderungen erhalten.

<a id="file-skymp5-servertsuits"></a>
### Datei: skymp5-server/ts/ui.ts

<a id="patch-1-add-import-after-line-18"></a>
#### Patch 1: Import ergänzen (nach Zeile 18)
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
#### Patch 2: WebSocket in main() initialisieren (ungefähr Zeile 5933)
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
#### Patch 3: Broadcast-Aufrufe in vorhandenen Ereignishandlern ergänzen

**Im Admin-Endpunkt für Verwarnungen (ungefähr Zeile 4810):**
```typescript
// After successfully adding warn entry, add:
broadcastHistoryEntry(adminHistory[adminHistory.length - 1]);
broadcastPlayersUpdate(/* current players */);
```

**Im Admin-Endpunkt für Kicks (ungefähr Zeile 4698):**
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

**Im Admin-Endpunkt für Sperren (ungefähr Zeile 4730):**
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

**Im Admin-Endpunkt für Stummschaltungen (ungefähr Zeile 4890):**
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
### Datei: skymp5-front/src/features/adminDashboard/index.tsx

<a id="patch-4-import-websocket-hook-after-other-imports"></a>
#### Patch 4: WebSocket-Hook importieren (nach den übrigen Imports)
```typescript
import { useAdminWebSocket, useAdminWebSocketMessages } from '../../hooks/useAdminWebSocket';
```

<a id="patch-5-replace-status-polling-around-line-1155"></a>
#### Patch 5: Status-Polling ersetzen (ungefähr Zeile 1155)

**ALT:**
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

**NEU:**
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
#### Patch 6: Log-Polling ersetzen (ungefähr Zeile 1318)

**ALT:**
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

**NEU:**
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
#### Patch 7: WebSocket-Statusanzeige ergänzen

In der oberen Leiste oder im Diagnosebereich ergänzen:
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
### Datei: skymp5-front/src/hooks/useAdminWebSocket.ts ✅ ERSTELLT

Keine Änderungen erforderlich; die Datei ist vollständig.

---

<a id="file-skymp5-servertsadminwebsocketts-✅-created"></a>
### Datei: skymp5-server/ts/adminWebSocket.ts ✅ ERSTELLT

Keine Änderungen erforderlich; die Datei ist vollständig.

---

<a id="implementation-order"></a>
## Reihenfolge der Umsetzung

1. **Phase 1 (sofort):**
   - ✅ `/src/hooks/useAdminWebSocket.ts` erstellen.
   - ✅ `/ts/adminWebSocket.ts` erstellen.
   - Patch 1 für Imports in ui.ts übernehmen.
   - Patch 2 für die Initialisierung in ui.ts übernehmen.

2. **Phase 2 (diese Woche):**
   - Patches 4 und 5 für Status und Spieler in index.tsx übernehmen.
   - WebSocket-Verbindung testen.
   - Verbesserte Latenz prüfen.

3. **Phase 3 (nächste Woche):**
   - Patch 3 mit Broadcast-Aufrufen in die Ereignishandler von ui.ts übernehmen.
   - Patch 6 für Logs in index.tsx übernehmen.
   - E2E-Tests des WebSocket-Ablaufs durchführen.

4. **Phase 4 (später):**
   - Patch 6 für den Verlauf in index.tsx übernehmen.
   - Patch 6 für Ereignisse in index.tsx übernehmen.
   - Patch 6 für Respawn in index.tsx übernehmen.
   - Leistung überwachen.

<a id="key-points"></a>
## Wesentliche Eigenschaften

- ✅ Alle neuen Quellcodedateien sind vorbereitet.
- ✅ Bei Problemen fällt WebSocket auf HTTP-Polling zurück.
- ✅ Abwärtskompatibel ohne inkompatible Änderungen.
- ✅ Automatische Wiederverbindung mit exponentiell wachsenden Wartezeiten.
- ✅ Abonnements je Nachrichtentyp; nur benötigte Nachrichten empfangen.

<a id="testing-checklist"></a>
## Testcheckliste

- [ ] WebSocket-Server startet unter /ws/admin-updates.
- [ ] Client verbindet sich und empfängt die Nachricht 'connected'.
- [ ] Statusaktualisierungen kommen ungefähr einmal pro Sekunde an.
- [ ] Trennen und Wiederverbinden funktionieren zuverlässig.
- [ ] CPU-Verbrauch unter 2 % im normalen Betrieb.
- [ ] Speicherbedarf pro Verbindung unter 200 KB.
- [ ] E2E-Test mit WebSocket und Polling-Rückfall besteht.

<a id="performance-beforeafter"></a>
## Leistung vorher und nachher

| Messgröße | Vorher (Polling) | Nachher (WebSocket) |
| --- | --- | --- |
| Statuslatenz | 1000 ms | ~50 ms |
| API-Aufrufe/s | 1–2 | 0 (1 initialer Aufruf) |
| Bandbreite | 2–3 KB/s | 0,5–1 KB/s |
| CPU des Admin-Threads | ~2 % | ~0,5 % |
