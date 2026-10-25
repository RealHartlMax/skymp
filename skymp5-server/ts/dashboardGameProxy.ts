import * as http from 'http';
import { getManagedGameState } from './managedRuntime';

// Only live game operations are delegated. Authentication, settings, logs,
// static assets and launcher downloads always belong to the persistent dashboard.
export const isGameRequest = (method: string, route: string): boolean => {
  if (route.startsWith('/rpc/')) return true;
  if (/^\/api\/admin\/players(?:\/|$)/.test(route)) return true;
  return [
    '/api/admin/bans', '/api/admin/mutes', '/api/admin/console',
    '/api/admin/announcement', '/api/admin/revive', '/api/admin/respawn-status',
    '/api/admin/client-runtime-events', '/api/admin/events',
    '/api/admin/history', '/api/admin/player-drops',
    '/api/admin/voice/status', '/api/admin/voice/speakers',
  ].includes(route);
};

export const proxyGameRequest = async (ctx: any): Promise<void> => {
  const state = getManagedGameState();
  if (state.state !== 'running' || !state.gamePort) {
    ctx.status = 409;
    ctx.body = { ok: false, code: 'GAME_NOT_RUNNING', error: 'The game server is not running.', gameState: state.state };
    return;
  }
  const payload = ['GET', 'HEAD'].includes(ctx.method) ? undefined : Buffer.from(JSON.stringify(ctx.request.body ?? {}));
  const headers = { ...ctx.headers };
  delete headers['content-length']; delete headers['transfer-encoding']; delete headers.connection;
  if (payload) { headers['content-type'] = 'application/json'; headers['content-length'] = String(payload.length); }
  await new Promise<void>(resolve => {
    const request = http.request({ host: '127.0.0.1', port: state.gamePort, path: ctx.originalUrl, method: ctx.method, headers, timeout: 15000 }, response => {
      ctx.status = response.statusCode || 502;
      for (const [name, value] of Object.entries(response.headers)) {
        if (value !== undefined && !['connection', 'transfer-encoding', 'keep-alive', 'set-cookie'].includes(name)) ctx.set(name, value);
      }
      ctx.body = response;
      resolve();
    });
    request.on('timeout', () => request.destroy(new Error('Game request timed out')));
    request.on('error', () => {
      ctx.status = 503;
      ctx.body = { ok: false, code: 'GAME_UNAVAILABLE', error: 'The game server is unavailable. The dashboard remains online.' };
      resolve();
    });
    if (payload) request.write(payload);
    request.end();
  });
};
