import * as fs from 'fs';
import * as path from 'path';
import { randomBytes } from 'crypto';
import { monitorEventLoopDelay, performance } from 'perf_hooks';
import { getManagedGameState, isDashboardRuntime, isManagedRuntime, onManagedMessage, publishGamePerformance } from './managedRuntime';
import type { GamePerformanceSample, PerformancePoint, PerformanceView, RuntimeMetrics, TickMetrics } from './serverPerformanceTypes';

export const TICK_BOUNDS_MS: readonly (number | null)[] = [1, 2, 4, 8, 16, 33, 50, 100, 250, 500, 1000, null];
const MINUTE = 60000, RETENTION = 24 * 60 * MINUTE;
const emptyTicks = (): TickMetrics => ({ count: 0, totalMs: 0, maxMs: 0, buckets: TICK_BOUNDS_MS.map(() => 0) });
const emptyRuntime = (): RuntimeMetrics => ({ cpuPercent: 0, rssBytes: 0, heapUsedBytes: 0, eventLoopMs: 0 });
const addRuntime = (sum: RuntimeMetrics, value: RuntimeMetrics, weight: number) => { for (const key of Object.keys(sum) as (keyof RuntimeMetrics)[]) sum[key] += value[key] * weight; };
const averageRuntime = (sum: RuntimeMetrics, weight: number): RuntimeMetrics | null => weight > 0 ? Object.fromEntries(Object.entries(sum).map(([key, value]) => [key, value / weight])) as unknown as RuntimeMetrics : null;
const addTicks = (target: TickMetrics, value: TickMetrics) => { target.count += value.count; target.totalMs += value.totalMs; target.maxMs = Math.max(target.maxMs, value.maxMs); value.buckets.forEach((count, i) => { target.buckets[i] += count; }); };
const finite = (value: unknown, max = 1e20): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
const validRuntime = (value: any): value is RuntimeMetrics => value && finite(value.cpuPercent, 100000) && finite(value.rssBytes, 2 ** 50) && finite(value.heapUsedBytes, 2 ** 50) && finite(value.eventLoopMs, RETENTION);
const validTicks = (value: any): value is TickMetrics => value && Number.isInteger(value.count) && finite(value.count, 1e10) && finite(value.totalMs) && finite(value.maxMs) && Array.isArray(value.buckets) && value.buckets.length === TICK_BOUNDS_MS.length && value.buckets.every((count: unknown) => Number.isInteger(count) && finite(count, 1e10)) && value.buckets.reduce((sum: number, count: number) => sum + count, 0) === value.count;

export class TickRecorder {
  private value = emptyTicks();
  record(ms: number): void {
    if (!finite(ms, RETENTION)) return;
    this.value.count++; this.value.totalMs += ms; this.value.maxMs = Math.max(this.value.maxMs, ms);
    const index = TICK_BOUNDS_MS.findIndex(bound => bound === null || ms <= bound);
    this.value.buckets[index]++;
  }
  take(): TickMetrics { const result = this.value; this.value = emptyTicks(); return result; }
}

interface Bucket {
  at: number; observedMs: number; runningMs: number; gameMs: number; webMs: number;
  playerSum: number; gameSum: RuntimeMetrics; webSum: RuntimeMetrics; ticks: TickMetrics;
}
const freshBucket = (at: number): Bucket => ({ at, observedMs: 0, runningMs: 0, gameMs: 0, webMs: 0, playerSum: 0, gameSum: emptyRuntime(), webSum: emptyRuntime(), ticks: emptyTicks() });
const validRuntimeSum = (value: any): boolean => value && Object.keys(value).length === 4 && ['cpuPercent', 'rssBytes', 'heapUsedBytes', 'eventLoopMs'].every(key => finite(value[key]));
const validBucket = (value: any): value is Bucket => value && Number.isInteger(value.at) && value.at % MINUTE === 0 && ['observedMs', 'runningMs', 'gameMs', 'webMs'].every(key => finite(value[key], MINUTE)) && value.runningMs <= value.observedMs && value.gameMs <= value.observedMs && value.webMs <= value.observedMs && finite(value.playerSum, MINUTE * 10000) && validRuntimeSum(value.gameSum) && validRuntimeSum(value.webSum) && validTicks(value.ticks);

// Owned by the persistent dashboard. All durations are observations; gaps while
// this process was absent are never turned into uptime, downtime or zero load.
export class PerformanceHistory {
  private buckets = new Map<number, Bucket>();
  private recent: { at: number; ticks: TickMetrics }[] = [];
  persistenceAvailable = true;
  private pending: Promise<void> = Promise.resolve();
  constructor(readonly file: string, private clock = Date.now) {
    try {
      if (fs.statSync(file).size > 4 * 1024 * 1024) throw Error('History too large');
      const value = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (value.version !== 1 || !Array.isArray(value.buckets) || value.buckets.length > 1441 || !value.buckets.every(validBucket)) throw Error('Invalid performance history');
      for (const bucket of value.buckets as Bucket[]) if (bucket.at >= Math.floor((clock() - RETENTION) / MINUTE) * MINUTE && bucket.at <= clock()) this.buckets.set(bucket.at, bucket);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') { this.persistenceAvailable = false; console.warn('[Performance] Existing history could not be loaded; it will not be overwritten.'); }
    }
  }
  private bucket(at: number): Bucket { const key = Math.floor(at / MINUTE) * MINUTE; let bucket = this.buckets.get(key); if (!bucket) { bucket = freshBucket(key); this.buckets.set(key, bucket); } return bucket; }
  private prune(now: number): void { for (const at of this.buckets.keys()) if (at < Math.floor((now - RETENTION) / MINUTE) * MINUTE) this.buckets.delete(at); this.recent = this.recent.filter(sample => sample.at > now - MINUTE).slice(-120); }
  recordTicks(at: number, ticks: TickMetrics): void { addTicks(this.bucket(at).ticks, ticks); this.recent.push({ at, ticks }); this.prune(at); }
  observe(at: number, elapsed: number, running: boolean, game: GamePerformanceSample | null, web: RuntimeMetrics | null): void {
    // Long dashboard stalls remain gaps. At most five seconds can be attributed
    // to the current observation, split correctly across minute boundaries.
    let start = at - Math.min(Math.max(elapsed, 0), 5000);
    while (start < at) {
      const bucket = this.bucket(start), duration = Math.min(at, bucket.at + MINUTE) - start;
      const available = Math.max(0, Math.min(duration, MINUTE - bucket.observedMs));
      bucket.observedMs += available; if (running) bucket.runningMs += available;
      if (game) { bucket.gameMs += available; bucket.playerSum += game.players * available; addRuntime(bucket.gameSum, game.runtime, available); }
      if (web) { bucket.webMs += available; addRuntime(bucket.webSum, web, available); }
      start += duration;
    }
    this.prune(at);
  }
  points(from: number, to: number): PerformancePoint[] {
    this.prune(to);
    return [...this.buckets.values()].filter(bucket => bucket.at + MINUTE > from && bucket.at <= to).sort((a, b) => a.at - b.at).map(bucket => ({
      at: bucket.at, observedMs: bucket.observedMs, runningMs: bucket.runningMs,
      players: bucket.gameMs ? Math.round(bucket.playerSum / bucket.gameMs) : null,
      game: averageRuntime(bucket.gameSum, bucket.gameMs), web: averageRuntime(bucket.webSum, bucket.webMs),
      ticks: { ...bucket.ticks, averageMs: bucket.ticks.count ? bucket.ticks.totalMs / bucket.ticks.count : null },
    }));
  }
  histogram(now: number): TickMetrics { this.prune(now); const value = emptyTicks(); for (const sample of this.recent) addTicks(value, sample.ticks); return value; }
  flush(): Promise<void> {
    if (!this.persistenceAvailable) return this.pending;
    this.prune(this.clock());
    const payload = JSON.stringify({ version: 1, buckets: [...this.buckets.values()] });
    this.pending = this.pending.then(async () => {
      const temporary = this.file + '.' + process.pid + '.' + randomBytes(4).toString('hex') + '.tmp';
      try { await fs.promises.mkdir(path.dirname(this.file), { recursive: true }); await fs.promises.writeFile(temporary, payload, { mode: 0o600, flag: 'wx' }); await fs.promises.rename(temporary, this.file); }
      catch { this.persistenceAvailable = false; console.warn('[Performance] History could not be saved; live measurements remain available.'); }
      finally { await fs.promises.unlink(temporary).catch(() => {}); }
    });
    return this.pending;
  }
}

class RuntimeSampler {
  private cpu = process.cpuUsage();
  private at = performance.now();
  private delay = monitorEventLoopDelay({ resolution: 20 });
  constructor() { this.delay.enable(); }
  sample(): RuntimeMetrics {
    const now = performance.now(), elapsed = Math.max(1, now - this.at), usage = process.cpuUsage(this.cpu), memory = process.memoryUsage();
    this.cpu = process.cpuUsage(); this.at = now;
    const result = { cpuPercent: (usage.user + usage.system) / (elapsed * 1000) * 100, rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, eventLoopMs: Number.isFinite(this.delay.mean) ? this.delay.mean / 1e6 : 0 };
    this.delay.reset(); return result;
  }
  close() { this.delay.disable(); }
}

const ticks = new TickRecorder();
let players = () => 0;
export const recordGameTick = (durationMs: number): void => ticks.record(durationMs);
export const setPerformancePlayers = (getPlayers: () => number): void => { players = getPlayers; };
export class ServerPerformance {
  readonly history: PerformanceHistory | null;
  private sampler = new RuntimeSampler();
  private latestGame: GamePerformanceSample | null = null;
  private latestWeb: RuntimeMetrics | null = null;
  private lastAt = Date.now();
  private timer: NodeJS.Timeout;
  private saveTimer?: NodeJS.Timeout;
  readonly mode = isDashboardRuntime() ? 'dashboard' : isManagedRuntime() ? 'game' : 'standalone';
  constructor(settings: Record<string, any>) {
    // koa-static never serves dot directories; keep operational history outside
    // the public flat data namespace used for client downloads.
    this.history = this.mode === 'game' ? null : new PerformanceHistory(path.resolve(settings.dataDir || 'data', '.admin', 'server-performance.json'));
    onManagedMessage(message => {
      if (this.mode !== 'dashboard') return;
      if (message?.type === 'skymp:performance') this.accept(message.sample);
      if (message?.type === 'skymp:game-state' && (message.value.state !== 'running' || message.value.pid !== this.latestGame?.pid)) this.latestGame = null;
    });
    this.timer = setInterval(() => this.sample(), 1000); this.timer.unref();
    if (this.history) { this.saveTimer = setInterval(() => { void this.history?.flush(); }, MINUTE); this.saveTimer.unref(); }
  }
  accept(value: any): void {
    if (!value || !finite(value.at) || Math.abs(Date.now() - value.at) > 5000 || !Number.isInteger(value.pid) || value.pid !== getManagedGameState().pid || !Number.isInteger(value.players) || !finite(value.players, 10000) || !validRuntime(value.runtime) || !validTicks(value.ticks)) return;
    if (getManagedGameState().state !== 'running' || (this.latestGame?.pid === value.pid && this.latestGame.at >= value.at)) return;
    this.latestGame = value; this.history?.recordTicks(value.at, value.ticks);
  }
  private sample(): void {
    const now = Date.now(), runtime = this.sampler.sample();
    if (this.mode !== 'dashboard') {
      const sample = { at: now, pid: process.pid, players: Math.max(0, Math.floor(players())), runtime, ticks: ticks.take() };
      if (this.mode === 'game') { publishGamePerformance(sample); return; }
      this.latestGame = sample; this.history?.recordTicks(now, sample.ticks);
    } else this.latestWeb = runtime;
    const fresh = this.latestGame && now - this.latestGame.at <= 5000 ? this.latestGame : null;
    this.history?.observe(now, now - this.lastAt, this.mode === 'standalone' || getManagedGameState().state === 'running', fresh, this.latestWeb);
    this.lastAt = now;
  }
  view(minutes = 1440): PerformanceView {
    const now = Date.now(), from = now - Math.min(1440, Math.max(1, minutes)) * MINUTE;
    const all = this.history?.points(now - RETENTION, now) || [], live = this.latestGame && now - this.latestGame.at <= 5000 ? this.latestGame : null;
    const summaryPoints = all.filter(point => point.at >= now - RETENTION);
    const observedMs = summaryPoints.reduce((sum, point) => sum + point.observedMs, 0), runningMs = summaryPoints.reduce((sum, point) => sum + point.runningMs, 0);
    const counts = summaryPoints.filter(point => point.players !== null).map(point => point.players as number).sort((a, b) => a - b);
    const middle = Math.floor(counts.length / 2);
    return {
      at: now, from, to: now, mode: this.mode === 'dashboard' ? 'dashboard' : 'standalone', gameState: this.mode === 'standalone' ? 'running' : getManagedGameState().state,
      gamePid: this.mode === 'standalone' ? process.pid : getManagedGameState().pid, telemetryFresh: Boolean(live), persistenceAvailable: this.history?.persistenceAvailable !== false,
      bucketBoundsMs: [...TICK_BOUNDS_MS], live: { players: live?.players ?? null, game: live?.runtime ?? null, web: this.latestWeb }, histogram: this.history?.histogram(now) || emptyTicks(),
      summary: { observedMs, runningPercent: observedMs ? runningMs / observedMs * 100 : null, medianPlayers: counts.length ? counts.length % 2 ? counts[middle] : (counts[middle - 1] + counts[middle]) / 2 : null, peakPlayers: counts.length ? counts[counts.length - 1] : null },
      points: all.filter(point => point.at + MINUTE > from),
    };
  }
  close(): Promise<void> { clearInterval(this.timer); if (this.saveTimer) clearInterval(this.saveTimer); this.sampler.close(); return this.history?.flush() || Promise.resolve(); }
}
let service: ServerPerformance | undefined;
export const initializeServerPerformance = (settings: Record<string, any>): ServerPerformance => {
  if (!service) {
    service = new ServerPerformance(settings);
    const close = () => { void service?.close(); };
    process.once('SIGTERM', close); process.once('SIGINT', close);
  }
  return service;
};
export const getServerPerformance = (): ServerPerformance | undefined => service;
