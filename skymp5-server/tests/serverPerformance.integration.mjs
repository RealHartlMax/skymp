// Deterministic history, private IPC validation and real process sampling.
// Run from build/: node ../skymp5-server/tests/serverPerformance.integration.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-performance-test-'));
const checks = [];
const realNow = Date.now;
const original = { send: process.send, connected: process.connected, managed: process.env.SKYMP_MANAGED_SERVER, role: process.env.SKYMP_MANAGED_ROLE };
const messageListeners = process.listeners('message');
let service;
try {
  const output = process.env.SKYMP_PERFORMANCE_UNIT_BUNDLE || path.join(root, 'performance.cjs');
  if (!process.env.SKYMP_PERFORMANCE_UNIT_BUNDLE) require('../node_modules/esbuild').buildSync({
    stdin: { contents: "export * from './ts/serverPerformance'; export { getManagedGameState } from './ts/managedRuntime';", resolveDir: path.resolve('../skymp5-server') },
    outfile: output, bundle: true, platform: 'node', target: 'es2022', logLevel: 'silent',
  });
  process.env.SKYMP_MANAGED_SERVER = '1'; process.env.SKYMP_MANAGED_ROLE = 'dashboard';
  process.send = () => true; process.connected = true;
  const api = require(output);
  const recorder = new api.TickRecorder();
  for (const ms of [-1, NaN, Infinity, 0, 1, 1.01, 2, 4, 1001]) recorder.record(ms);
  const recorded = recorder.take();
  assert.equal(recorded.count, 6);
  assert.deepEqual(recorded.buckets, [2, 2, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(recorded.maxMs, 1001);
  assert.equal(recorder.take().count, 0);
  checks.push('Native tick boundaries are noncumulative, reject invalid durations and reset after each sample');

  let now = Math.floor(realNow() / 60000) * 60000 + 1000;
  const runtime = { cpuPercent: 25, rssBytes: 512 * 1048576, heapUsedBytes: 32 * 1048576, eventLoopMs: 20 };
  const game = { at: now, pid: 123, players: 3, runtime, ticks: recorded };
  const file = path.join(root, 'history/server-performance.json');
  const history = new api.PerformanceHistory(file, () => now);
  history.observe(now, 2000, true, game, runtime);
  history.recordTicks(now, recorded);
  let points = history.points(now - 60000, now);
  assert.equal(points.length, 2);
  assert.deepEqual(points.map(point => point.observedMs), [1000, 1000]);
  assert.equal(points[0].game.cpuPercent, 25);
  assert.equal(points[1].players, 3);
  assert.equal(points[1].ticks.averageMs, recorded.totalMs / 6);
  now += 180000;
  history.observe(now, 180000, false, null, runtime);
  points = history.points(now - 240000, now);
  assert.equal(points.reduce((sum, point) => sum + point.observedMs, 0), 7000, 'A three-minute stall is capped to five observed seconds');
  assert(!points.some(point => point.at === Math.floor(now / 60000) * 60000 - 120000), 'Unknown minutes stay absent');
  assert.equal(points.at(-1).game, null);
  assert.equal(points.at(-1).runningMs, 0);
  assert.equal(history.histogram(now).count, 0, 'Last-minute histogram expires without invented ticks');
  await history.flush();
  const reloaded = new api.PerformanceHistory(file, () => now);
  assert.deepEqual(reloaded.points(now - 240000, now), points);
  assert.equal(reloaded.histogram(now).count, 0, 'Historical minutes never populate a new live histogram');
  now += 25 * 3600000;
  assert.deepEqual(reloaded.points(now - 86400000, now), []);
  await reloaded.flush();
  assert.equal(JSON.parse(fs.readFileSync(file)).buckets.length, 0);
  checks.push('Minute boundaries, weighted samples, five-second stall limit, offline gaps, private persistence/reload and 24-hour retention');

  const invalidFile = path.join(root, 'invalid.json');
  const corrupt = JSON.parse(fs.readFileSync(file));
  corrupt.buckets = [{ at: now - now % 60000, observedMs: 1, runningMs: 1, gameMs: 1, webMs: 1, playerSum: 0,
    gameSum: { a: 1, b: 2, c: 3, d: 4 }, webSum: runtime, ticks: recorded }];
  fs.writeFileSync(invalidFile, JSON.stringify(corrupt));
  const invalid = new api.PerformanceHistory(invalidFile, () => now);
  const before = fs.readFileSync(invalidFile, 'utf8');
  assert.equal(invalid.persistenceAvailable, false);
  await invalid.flush(); assert.equal(fs.readFileSync(invalidFile, 'utf8'), before);
  const failureDir = path.join(root, 'blocked-directory');
  const unwritable = new api.PerformanceHistory(path.join(failureDir, 'child.json'), () => now);
  fs.writeFileSync(failureDir, 'The directory became a file after history initialization.');
  await unwritable.flush(); assert.equal(unwritable.persistenceAvailable, false);
  checks.push('Invalid existing histories are preserved and write failures explicitly retain memory-only measurements');

  now = realNow(); Date.now = () => now;
  service = new api.ServerPerformance({ dataDir: path.join(root, 'private-data') });
  process.emit('message', { type: 'skymp:game-state', value: { state: 'running', pid: 321 } });
  const sample = { ...game, at: now, pid: 321 };
  for (const value of [{ ...sample, pid: 999 }, { ...sample, at: now - 6000 }, { ...sample, players: -1 }, { ...sample, ticks: { ...recorded, count: 123 } }, { ...sample, runtime: { ...runtime, rssBytes: NaN } }]) service.accept(value);
  assert.equal(service.view().telemetryFresh, false);
  service.accept(sample); service.accept(sample);
  assert.equal(service.view().histogram.count, recorded.count, 'Duplicate IPC messages must not double-count ticks');
  now += 1000; service.sample();
  const live = service.view();
  assert.equal(live.mode, 'dashboard'); assert.equal(live.live.players, 3);
  assert.equal(live.live.game.cpuPercent, 25);
  assert(Number.isFinite(live.live.web.cpuPercent)); assert(live.live.web.rssBytes > 0);
  assert(live.points.some(point => point.game && point.web));
  assert(service.history.file.includes(path.join('.admin', 'server-performance.json')));
  now += 6000;
  assert.equal(service.view().live.game, null);
  process.emit('message', { type: 'skymp:game-state', value: { state: 'stopped', pid: null } });
  service.accept({ ...sample, at: now }); assert.equal(service.view().live.game, null);
  process.emit('message', { type: 'skymp:game-state', value: { state: 'running', pid: 322 } });
  service.accept({ ...sample, at: now }); assert.equal(service.view().telemetryFresh, false);
  service.accept({ ...sample, at: now, pid: 322 }); assert.equal(service.view().telemetryFresh, true);
  assert.equal(service.view().gamePid, 322);
  await service.close(); service = null;
  checks.push('Current-PID IPC only, stale/invalid/duplicate rejection, real dashboard CPU/RSS sampling, stopped/crashed game clearing and new-PID recovery');
  console.log(JSON.stringify({ ok: true, checks, nativeModuleRequired: false }));
} finally {
  Date.now = realNow;
  if (service) await service.close();
  for (const listener of process.listeners('message')) if (!messageListeners.includes(listener)) process.removeListener('message', listener);
  process.send = original.send; process.connected = original.connected;
  for (const [key, value] of [['SKYMP_MANAGED_SERVER', original.managed], ['SKYMP_MANAGED_ROLE', original.role]]) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith('skymp-performance-test-'));
  fs.rmSync(root, { recursive: true, force: true });
}
