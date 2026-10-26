import * as fs from 'fs';
import * as path from 'path';

export interface RestartScheduleConfig {
  enabled: boolean;
  timeZone: string;
  times: string[];
  warningMinutes: number[];
}
export interface RestartScheduleView {
  supported: boolean;
  config: RestartScheduleConfig;
  revision: string;
  nextAt: number | null;
  serverTimeZone: string;
  persistenceAvailable: boolean;
  error: string | null;
}
type Slot = { at: number; key: string };
export const defaultRestartSchedule = (): RestartScheduleConfig => ({ enabled: false, timeZone: 'UTC', times: [], warningMinutes: [15, 5, 1] });
export function validateRestartSchedule(value: unknown): RestartScheduleConfig {
  const input = value as RestartScheduleConfig;
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['enabled', 'timeZone', 'times', 'warningMinutes'].includes(key)) ||
      typeof input.enabled !== 'boolean' || typeof input.timeZone !== 'string' || input.timeZone.length > 100 ||
      !Array.isArray(input.times) || input.times.length > 12 || input.times.some(time => typeof time !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) ||
      !Array.isArray(input.warningMinutes) || input.warningMinutes.length > 5 || input.warningMinutes.some(minutes => !Number.isInteger(minutes) || minutes < 1 || minutes > 60)) throw Error('INVALID_SCHEDULE');
  let timeZone: string;
  try { timeZone = new Intl.DateTimeFormat('en', { timeZone: input.timeZone }).resolvedOptions().timeZone; } catch { throw Error('INVALID_TIME_ZONE'); }
  const times = [...new Set(input.times)].sort();
  if (input.enabled && !times.length) throw Error('SCHEDULE_TIMES_REQUIRED');
  return { enabled: input.enabled, timeZone, times, warningMinutes: [...new Set(input.warningMinutes)].sort((a, b) => b - a) };
}
export const scheduleRevision = (config: RestartScheduleConfig): string => JSON.stringify(config);
const revisionOf = (value: unknown): string => {
  try { return scheduleRevision(value === undefined ? defaultRestartSchedule() : validateRestartSchedule(value)); }
  catch { return JSON.stringify(value) || 'invalid'; }
};

// Iterate real minutes, then match the selected wall clock. Nonexistent DST
// times are skipped; repeated local times are represented by the same key.
export function nextRestartSlot(config: RestartScheduleConfig, now: number, consumed: Set<string>): Slot | null {
  if (!config.enabled || !config.times.length) return null;
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: config.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const times = new Set(config.times);
  for (let at = Math.floor(now / 60000) * 60000, end = at + 49 * 3600000; at <= end; at += 60000) {
    const parts = Object.fromEntries(formatter.formatToParts(at).map(part => [part.type, part.value]));
    const time = `${parts.hour}:${parts.minute}`;
    if (!times.has(time)) continue;
    const key = `${config.timeZone}|${parts.year}-${parts.month}-${parts.day}|${time}`;
    if (!consumed.has(key)) return { at, key };
  }
  return null;
}

export class RestartScheduler {
  private consumed: { key: string; at: number }[] = [];
  private warnings = new Set<string>();
  private cached: { revision: string; minute: number; slot: Slot | null } | null = null;
  private busy = false;
  private timer?: NodeJS.Timeout;
  private error: string | null = null;
  persistenceAvailable = true;
  constructor(private options: {
    file: string; read: () => unknown; supported: () => boolean; running: () => boolean;
    restart: () => Promise<{ ok: boolean; error?: string }>; warn: (minutes: number, at: number) => void | Promise<void>;
    log: (message: string) => void; now?: () => number;
  }) {
    try {
      if (fs.existsSync(options.file)) {
        const data = JSON.parse(fs.readFileSync(options.file, 'utf8'));
        if (data.version !== 1 || !Array.isArray(data.consumed) || data.consumed.length > 256 || data.consumed.some((entry: any) => typeof entry?.key !== 'string' || entry.key.length > 180 || !Number.isFinite(entry.at))) throw Error();
        this.consumed = data.consumed;
      }
    } catch { this.persistenceAvailable = false; this.error = 'SCHEDULE_STATE_UNAVAILABLE'; }
  }
  private now(): number { return this.options.now?.() ?? Date.now(); }
  private config(): RestartScheduleConfig { const value = this.options.read(); return value === undefined ? defaultRestartSchedule() : validateRestartSchedule(value); }
  private slot(config: RestartScheduleConfig): Slot | null {
    const revision = scheduleRevision(config), minute = Math.floor(this.now() / 60000);
    if (!this.cached || this.cached.revision !== revision || this.cached.minute !== minute) this.cached = { revision, minute, slot: nextRestartSlot(config, this.now(), new Set(this.consumed.map(entry => entry.key))) };
    return this.cached.slot;
  }
  view(): RestartScheduleView {
    let config = defaultRestartSchedule(), next: Slot | null = null, error = this.error, revision = 'unavailable';
    try { const raw = this.options.read(); revision = revisionOf(raw); config = raw === undefined ? defaultRestartSchedule() : validateRestartSchedule(raw); next = this.slot(config); if (error === 'INVALID_SCHEDULE') error = this.error = null; } catch { error = 'INVALID_SCHEDULE'; }
    return { supported: this.options.supported(), config, revision, nextAt: next?.at ?? null,
      serverTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, persistenceAvailable: this.persistenceAvailable, error };
  }
  private consume(slot: Slot): void {
    if (!this.persistenceAvailable) throw Error('SCHEDULE_STATE_UNAVAILABLE');
    const consumed = [...this.consumed.filter(entry => entry.at > this.now() - 7 * 86400000), { key: slot.key, at: slot.at }].slice(-256);
    const temporary = this.options.file + '.tmp';
    try {
      fs.mkdirSync(path.dirname(this.options.file), { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify({ version: 1, consumed }) + '\n', { mode: 0o600 });
      fs.renameSync(temporary, this.options.file);
    } catch { this.persistenceAvailable = false; this.error = 'SCHEDULE_STATE_UNAVAILABLE'; throw Error(this.error); }
    this.consumed = consumed; this.cached = null;
  }
  skip(expectedAt: unknown): void {
    const slot = this.slot(this.config());
    if (this.busy || !slot || expectedAt !== slot.at) throw Error('SCHEDULE_CHANGED');
    this.consume(slot); this.options.log(`Scheduled game restart skipped (${new Date(slot.at).toISOString()}).`);
  }
  async tick(): Promise<void> {
    if (this.busy || !this.options.supported() || !this.persistenceAvailable) return;
    this.busy = true;
    try {
      const config = this.config(), slot = this.slot(config);
      if (!slot) return;
      const remaining = slot.at - this.now();
      if (remaining <= 0) {
        // Claim durably BEFORE sending control. Never retry a claimed restart,
        // never catch up missed minutes, and never start a stopped game.
        this.consume(slot);
        if (this.options.running()) {
          const result = await this.options.restart();
          this.error = result.ok ? null : 'SCHEDULE_CONTROL_FAILED';
          this.options.log(result.ok ? 'Scheduled game restart requested; dashboard remains online.' : 'Scheduled game restart was not acknowledged; no automatic retry.');
        } else this.options.log('Scheduled restart passed while game was stopped; game remains stopped.');
      } else if (this.options.running()) {
        const minutes = Math.ceil(remaining / 60000);
        const key = `${slot.key}|${minutes}`;
        if (config.warningMinutes.includes(minutes) && !this.warnings.has(key)) {
          this.warnings.add(key);
          if (this.warnings.size > 256) this.warnings = new Set([key]);
          await this.options.warn(minutes, slot.at);
        }
      }
    } catch (error) { this.error = error instanceof Error && error.message === 'SCHEDULE_STATE_UNAVAILABLE' ? error.message : 'INVALID_SCHEDULE'; }
    finally { this.busy = false; }
  }
  start(): void { if (!this.timer) { this.timer = setInterval(() => void this.tick(), 1000); this.timer.unref(); } }
  close(): void { clearInterval(this.timer); }
}

export function registerRestartSchedule(router: any, options: {
  scheduler: RestartScheduler; read: () => Record<string, unknown>; write: (settings: Record<string, unknown>) => void;
  authorize: (ctx: any, write: boolean) => boolean;
}): void {
  const authorize = (ctx: any, write: boolean): boolean => {
    if (!options.authorize(ctx, write)) return false;
    ctx.set('Cache-Control', 'no-store');
    if (write) {
      let sameOrigin = false;
      try { const origin = new URL(ctx.get('origin')); sameOrigin = ['http:', 'https:'].includes(origin.protocol) && origin.host === ctx.host; } catch {}
      if (!sameOrigin || ctx.get('content-type').split(';')[0].trim() !== 'application/json' || !['', 'same-origin', 'none'].includes(ctx.get('sec-fetch-site'))) {
        ctx.status = 403; ctx.body = { ok: false, error: 'SAME_ORIGIN_REQUIRED' }; return false;
      }
    }
    return true;
  };
  router.get('/api/admin/server/restart-schedule', (ctx: any) => { if (authorize(ctx, false)) ctx.body = { ok: true, ...options.scheduler.view() }; });
  router.post('/api/admin/server/restart-schedule', (ctx: any) => {
    if (!authorize(ctx, true)) return;
    try {
      const config = validateRestartSchedule(ctx.request.body?.config);
      const settings = options.read();
      if (ctx.request.body?.revision !== revisionOf(settings.restartSchedule)) { ctx.status = 409; ctx.body = { ok: false, error: 'SCHEDULE_CHANGED' }; return; }
      settings.restartSchedule = config; options.write(settings);
      ctx.body = { ok: true, ...options.scheduler.view() };
    } catch (error) { const code = error instanceof Error ? error.message : ''; ctx.status = code.startsWith('INVALID_') || code === 'SCHEDULE_TIMES_REQUIRED' ? 400 : 500; ctx.body = { ok: false, error: ctx.status === 400 ? code : 'SCHEDULE_SAVE_FAILED' }; }
  });
  router.post('/api/admin/server/restart-schedule/skip', (ctx: any) => {
    if (!authorize(ctx, true)) return;
    try { options.scheduler.skip(ctx.request.body?.nextAt); ctx.body = { ok: true, ...options.scheduler.view() }; }
    catch (error) { const code = error instanceof Error ? error.message : ''; ctx.status = code === 'SCHEDULE_CHANGED' ? 409 : 500; ctx.body = { ok: false, error: code === 'SCHEDULE_CHANGED' ? code : 'SCHEDULE_STATE_UNAVAILABLE' }; }
  });
}
