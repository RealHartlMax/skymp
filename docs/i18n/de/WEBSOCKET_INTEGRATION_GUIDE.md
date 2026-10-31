<a id="websocket-first-real-time-updates---integration-guide"></a>
# Echtzeitaktualisierung über WebSocket – Integrationsanleitung

> Historischer Implementierungsvermerk. Am 22. Oktober 2026 geprüft: Die Integration der sechs Datenströme sowie Wiederverbindung und HTTP-Rückfall sind bereits in [ROADMAP_FRONTEND.md](../../../ROADMAP_FRONTEND.md) erfasst. Die folgenden alten Checklisten und Messungen beschreiben diese frühere Arbeit. Aktuelle Aufgaben und Prüfgrenzen stehen im [Projektstatus](docs/docs_project_status.md).

> **Damals dokumentierter Status: ✅ Implementierung abgeschlossen — 2026-05-17**  
> Alle unten beschriebenen Integrationsschritte wurden umgesetzt. Backend `adminWebSocket.ts` und Frontend `useAdminWebSocket.ts` sind aktiv. Alle 6 Push-Datenströme sind eingebunden. WebSocket wird vorrangig verwendet, HTTP-Polling dient als Rückfall. Diese Anleitung bleibt als historische Referenz erhalten.

<a id="overview"></a>
## Überblick
Diese Anleitung beschreibt die Einbindung der neuen WebSocket-Infrastruktur in die vorhandene Codebasis.

<a id="new-files-created"></a>
## Neu erstellte Dateien

<a id="1-backend-skymp5-servertsadminwebsocketts-✅"></a>
### 1. Backend: `skymp5-server/ts/adminWebSocket.ts` ✅
- Stellt Einrichtung und Broadcast-Funktionen des WebSocket-Servers bereit.
- Verarbeitet Nachrichten für Admin-Aktualisierungen.
- Sendet regelmäßig Statusmeldungen.

<a id="2-frontend-skymp5-frontsrchooksuseadminwebsocketts-✅"></a>
### 2. Frontend: `skymp5-front/src/hooks/useAdminWebSocket.ts` ✅
- React-Hook zur Verwaltung der WebSocket-Verbindung.
- Automatische Wiederverbindung mit exponentiell wachsenden Wartezeiten.
- Weiterleitung eingehender Nachrichten an ihre Empfänger.

<a id="integration-steps"></a>
## Integrationsschritte

<a id="step-1-import-in-skymp5-servertsuits"></a>
### Schritt 1: Import in `skymp5-server/ts/ui.ts`

Bei den Imports ungefähr in Zeile 18 ergänzen:
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
### Schritt 2: WebSocket in `main()` initialisieren

Nach dem Aufruf von `setupLiveConsoleWebSocket(server)` ungefähr in Zeile 5933 ergänzen:
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
### Schritt 3: Polling-Aufrufe im Frontend ersetzen

Die `setInterval`-Polling-Aufrufe in `adminDashboard/index.tsx` durch WebSocket ersetzen:

**ALT (HTTP-Polling):**
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

**NEU (WebSocket):**
```typescript
const wsState = useAdminWebSocketMessages('status', (data) => {
  if (data.online !== undefined) {
    setOnline(data.online);
  }
}, visible); // Only listen when visible
```

<a id="step-4-broadcast-updates-when-actions-occur"></a>
### Schritt 4: Änderungen bei Aktionen senden

Bei Spielerbeitritten und -austritten, neuen Logeinträgen und ähnlichen Ereignissen die Broadcast-Funktionen aufrufen:

**Beispiel: Ein Spieler tritt bei:**
```typescript
// In your player join handler
const players = getOnlinePlayerList(); // Get current list
broadcastPlayersUpdate(players);
```

**Beispiel: Ein Logeintrag wird hinzugefügt:**
```typescript
// In logDashboardLog() or similar
const entry = { ... };
broadcastLogEntry(entry);
```

**Beispiel: Ein Verlaufseintrag wird hinzugefügt:**
```typescript
// In warn/ban/kick handlers
broadcastHistoryEntry(entry);
```

<a id="migration-path"></a>
## Migrationsweg

<a id="phase-1-status--players-high-impact-low-risk"></a>
### Phase 1: Status und Spieler (großer Nutzen, geringes Risiko)
1. `useAdminWebSocketMessages('status', ...)` im Spielerbereich einbinden.
2. `useAdminWebSocketMessages('players', ...)` in der Statusanzeige einbinden.
3. HTTP-Polling als Rückfall für weniger wichtige Felder beibehalten.
4. Verbesserte Latenz und CPU-Verbrauch messen.

<a id="phase-2-logs--events-medium-impact"></a>
### Phase 2: Logs und Ereignisse (mittlerer Nutzen)
1. Bei neuen Logs `broadcastLogEntry()` aufrufen.
2. `useAdminWebSocketMessages('log', ...)` im Logbereich einbinden.
3. Bei Admin-Ereignissen `broadcastEvent()` aufrufen.
4. `useAdminWebSocketMessages('event', ...)` im Ereignisbereich einbinden.

<a id="phase-3-history-append-only-stream"></a>
### Phase 3: Verlauf (nur ergänzter Datenstrom)
1. `broadcastHistoryEntry()` in den Handlern für Verwarnung, Sperre und Kick aufrufen.
2. `useAdminWebSocketMessages('history', ...)` im Verlaufsbereich einbinden.
3. Neue Einträge der vorhandenen Liste voranstellen; bestehende Einträge bleiben erhalten.

<a id="phase-4-respawn-state-updates"></a>
### Phase 4: Respawn (Zustandsaktualisierungen)
1. Bei geändertem Respawn-Status `broadcastRespawnUpdate()` aufrufen.
2. `useAdminWebSocketMessages('respawn', ...)` im Respawn-Bereich einbinden.
3. Den Zustand durch die neuesten Broadcast-Daten ersetzen.

<a id="fallback-strategy"></a>
## Rückfallstrategie

Der Hook `useAdminWebSocket` bietet einen automatischen Rückfall:
- Scheitert der Verbindungsaufbau, folgen neue Versuche mit exponentiell wachsenden Wartezeiten.
- Netzwerkfehler werden abgefangen und protokolliert.
- Das Frontend bleibt durch HTTP-Polling als Ersatz funktionsfähig.
- Die bisherige Oberfläche bleibt kompatibel.

<a id="performance-targets"></a>
## Leistungsziele

Nach der Migration:
- **Latenz**: 100–500 ms → 10–50 ms (Faktor 10).
- **Polling-Aufwand**: 1 Anfrage/s → 0 Anfragen/s bei aktivem WebSocket.
- **Serverlast**: 50 % weniger für die Admin-Überwachung.
- **Bandbreite**: deutliche Verringerung durch Änderungen statt vollständiger Zustände.

<a id="monitoring"></a>
## Überwachung

Folgende Messgrößen zur Überwachung der WebSocket-Verbindung ergänzen:
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
## Tests

<a id="unit-tests"></a>
### Unit-Tests
- Prüfen, ob `broadcastAdminUpdate()` an alle verbundenen Clients sendet.
- Serialisierung und Deserialisierung der Nachrichten prüfen.
- Aufräumen nach dem Trennen eines Clients prüfen.

<a id="e2e-tests"></a>
### E2E-Tests
- WebSocket-Client verbinden und Verbindungsnachricht prüfen.
- Serverzustand ändern, etwa durch einen neuen Spieler, und Broadcast prüfen.
- Verbindung trennen und automatische Wiederverbindung prüfen.
- Netzwerkfehler und Rückfall auf Polling simulieren.

<a id="load-tests"></a>
### Lasttests
- Mindestens 50 gleichzeitige WebSocket-Verbindungen.
- Durchsatz von 1000 Nachrichten/s.
- Speicherverbrauch pro aktiver Verbindung unter 100 KB.

<a id="rollback-plan"></a>
## Rollback-Plan

Bei Problemen:
1. WebSocket durch `enabled={false}` an den Hooks deaktivieren.
2. Das Frontend arbeitet weiter mit HTTP-Polling.
3. Keine Datenbankänderungen und kein Zustandsverlust.
4. Vollständige Abwärtskompatibilität bleibt bestehen.

<a id="status-indicators"></a>
## Statusanzeigen

In der Dashboard-Diagnose ergänzen:
- ✅ WebSocket verbunden.
- 🔄 WebSocket verbindet erneut; Versuchszähler und Zeit bis zum nächsten Versuch anzeigen.
- ❌ WebSocket nicht verfügbar; Polling wird verwendet.
- 📊 Nachrichtenrate, Latenz und Verbindungsdauer.
