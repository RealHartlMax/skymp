import { randomUUID } from 'crypto';
import type { DiscordBan, DiscordNotification } from './discordBot';
import type { GamePerformanceSample } from './serverPerformanceTypes';

// The packaged starter owns the dashboard and game over private Node IPC channels.
export const isManagedRuntime = (): boolean =>
  process.env.SKYMP_MANAGED_SERVER === '1' && typeof process.send === 'function' && process.connected;

export const isDashboardRuntime = (): boolean =>
  isManagedRuntime() && process.env.SKYMP_MANAGED_ROLE === 'dashboard';

export interface ManagedGameState {
  state: 'starting' | 'running' | 'stopping' | 'stopped' | 'crashed';
  pid: number | null;
  gamePort: number;
  dashboardPid: number | null;
  startedAt: number | null;
  lastExit: { code: number | null; signal: string | null; at: string } | null;
  operation?: 'start' | 'stop' | 'restart' | 'shutdown';
  reason?: 'startup-timeout' | 'startup-failed' | null;
}

let gameState: ManagedGameState = {
  state: 'starting', pid: null, gamePort: 0, dashboardPid: null, startedAt: null, lastExit: null,
};
export const getManagedGameState = (): ManagedGameState => gameState;
const listeners = new Set<(message: any) => void>();
let shutdownKind: 'restart' | 'shutdown' = 'shutdown';
export const getManagedShutdownKind = () => shutdownKind;
export const onManagedMessage = (listener: (message: any) => void): void => { listeners.add(listener); };
const pendingControls = new Map<string, { resolve: (value: { ok: boolean; error?: string }) => void; timer: NodeJS.Timeout }>();

const publish = (message: Record<string, unknown>): void => {
  if (!isManagedRuntime()) return;
  try { process.send?.(message, () => {}); } catch { /* Manager may be shutting down. */ }
};

export const publishAdminSession = (session: { id: string; user: string; lastActivityAt: number }): void =>
  publish({ type: 'skymp:session', id: session.id, user: session.user, lastActivityAt: session.lastActivityAt });

export const removeManagedSession = (id: string): void => publish({ type: 'skymp:logout', id });
export const publishManagedReady = (port: number): void => publish({ type: 'skymp:ready', port });
export const publishGamePerformance = (sample: GamePerformanceSample): void => publish({ type: 'skymp:performance', sample });
export const notifyManagedSettingsChanged = (): void => publish({ type: 'skymp:settings-changed' });
export const publishScheduledAnnouncement = (message: string): void => publish({ type: 'skymp:scheduled-announcement', message });
export const publishDiscordNotification = (notification: DiscordNotification): void =>
  publish({ type: 'skymp:discord-notification', notification });
export const publishDiscordBan = (ban: DiscordBan): void =>
  publish({ type: 'skymp:discord-ban', ban });
export const publishManagedUpdate = (updateType: string, data: any): void => {
  if (!isDashboardRuntime()) publish({ type: 'skymp:update', updateType, data });
};
export const requestManagedControl = (action: 'start' | 'stop' | 'restart'): Promise<{ ok: boolean; error?: string }> => {
  if (!isManagedRuntime()) return Promise.resolve({ ok: false, error: 'No packaged process manager is connected.' });
  const id = randomUUID();
  return new Promise(resolve => {
    const timer = setTimeout(() => { pendingControls.delete(id); resolve({ ok: false, error: 'Process manager did not acknowledge the action.' }); }, 5000);
    pendingControls.set(id, { resolve, timer });
    publish({ type: 'skymp:control', action, id });
  });
};

if (isManagedRuntime()) {
  let stopping = false;
  const stop = (reason?: unknown) => {
    if (stopping) return;
    stopping = true;
    shutdownKind = reason === 'restart' ? 'restart' : 'shutdown';
    // Give existing heartbeat/plugin shutdown listeners time to finish on both OSes.
    process.emit('SIGTERM', 'SIGTERM');
    setTimeout(() => process.exit(0), 1500);
  };
  process.on('message', (message: any) => {
    if (message?.type === 'skymp:shutdown') stop(message.reason);
    if (message?.type === 'skymp:game-state') gameState = message.value;
    if (message?.type === 'skymp:control-result') {
      const pending = pendingControls.get(message.id);
      if (pending) { clearTimeout(pending.timer); pendingControls.delete(message.id); pending.resolve({ ok: message.ok === true, error: message.error }); }
    }
    for (const listener of listeners) listener(message);
  });
  process.on('disconnect', stop);
}
