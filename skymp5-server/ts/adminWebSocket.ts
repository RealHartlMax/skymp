/**
 * Admin Dashboard WebSocket Server
 * Provides real-time updates for status, players, logs, events, history, and respawn status
 * Path: /ws/admin-updates
 */

import * as http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { isDashboardRuntime, isManagedRuntime, publishManagedUpdate } from './managedRuntime';

// Types
export interface AdminUpdateMessage {
  type: 'status' | 'players' | 'log' | 'event' | 'history' | 'respawn';
  ts: number;
  data: any;
}

// Client tracking
let adminUpdateClients: Set<WebSocket> = new Set();
const clientAuthorizers = new WeakMap<WebSocket, () => boolean>();
let statusBroadcastInterval: NodeJS.Timeout | null = null;

/**
 * Broadcast an admin update to all connected clients
 */
export const broadcastAdminUpdate = (type: string, data: any): void => {
  publishManagedUpdate(type, data);
  if (adminUpdateClients.size === 0) return;

  const message: AdminUpdateMessage = {
    type: type as any,
    ts: Date.now(),
    data,
  };

  const payload = JSON.stringify(message);
  const deadClients: WebSocket[] = [];

  for (const ws of adminUpdateClients) {
    if (clientAuthorizers.has(ws) && !clientAuthorizers.get(ws)!()) {
      ws.close(1008, 'Admin session expired'); deadClients.push(ws); continue;
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    } else {
      deadClients.push(ws);
    }
  }

  // Clean up closed connections
  deadClients.forEach((ws) => adminUpdateClients.delete(ws));
};

/**
 * Broadcast player list update
 */
export const broadcastPlayersUpdate = (players: any[]): void => {
  broadcastAdminUpdate('players', { players });
};

/**
 * Broadcast server status update
 */
export const broadcastStatusUpdate = (status: any): void => {
  broadcastAdminUpdate('status', status);
};

/**
 * Broadcast new log entry
 */
export const broadcastLogEntry = (entry: any): void => {
  broadcastAdminUpdate('log', { entry });
};

/**
 * Broadcast new event
 */
export const broadcastEvent = (event: any): void => {
  broadcastAdminUpdate('event', { event });
};

/**
 * Broadcast new history entry
 */
export const broadcastHistoryEntry = (entry: any): void => {
  broadcastAdminUpdate('history', { entry });
};

/**
 * Broadcast respawn status update
 */
export const broadcastRespawnUpdate = (respawnStatus: any[]): void => {
  broadcastAdminUpdate('respawn', { respawnStatus });
};

/**
 * Setup admin updates WebSocket server
 */
export const setupAdminWebSocket = (server: http.Server, authorize?: (request: http.IncomingMessage) => boolean): void => {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    if (new URL(request.url || '/', 'http://localhost').pathname !== '/ws/admin-updates') return;
    if (authorize && !authorize(request)) { socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return; }
    wss.handleUpgrade(request, socket, head, ws => wss.emit('connection', ws, request));
  });

  wss.on('connection', (ws, request) => {
    adminUpdateClients.add(ws);
    if (authorize) clientAuthorizers.set(ws, () => authorize(request));

    // Send initial empty state on connect (client will fetch via HTTP if needed)
    ws.send(
      JSON.stringify({
        type: 'connected',
        ts: Date.now(),
        data: { clientCount: adminUpdateClients.size },
      }),
    );

    ws.on('close', () => {
      adminUpdateClients.delete(ws);
    });

    ws.on('error', () => {
      adminUpdateClients.delete(ws);
    });
  });
};

/**
 * Start periodic status broadcasts
 * Should be called after server is initialized
 */
export const startAdminUpdateBroadcasts = (
  getStatus: () => any,
  getPlayers: () => any[],
): void => {
  // Broadcast status+players every 200ms if there are clients
  // 200ms interval gives ~100ms avg latency vs ~500ms at 1000ms interval
  statusBroadcastInterval = setInterval(() => {
    if (adminUpdateClients.size === 0 && !(isManagedRuntime() && !isDashboardRuntime())) return;

    try {
      const status = getStatus();
      broadcastStatusUpdate(status);

      const players = getPlayers();
      broadcastPlayersUpdate(players);
    } catch (error) {
      console.error('[AdminWebSocket] Error broadcasting status:', error);
    }
  }, 200);
};

/**
 * Stop periodic broadcasts
 */
export const stopAdminUpdateBroadcasts = (): void => {
  if (statusBroadcastInterval) {
    clearInterval(statusBroadcastInterval);
    statusBroadcastInterval = null;
  }
};

/**
 * Get current client count for diagnostics
 */
export const getAdminWebSocketClientCount = (): number => {
  return adminUpdateClients.size;
};
