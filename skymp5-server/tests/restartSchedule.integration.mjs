// Deterministic daily scheduling, DST, durable claims, safe HTTP settings and
// aggregate-only disconnect persistence. Run from build/.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-restart-schedule-'));
const checks = [];
let server;
const services = [];
try {
  const bundle = process.env.SKYMP_SCHEDULE_UNIT_BUNDLE || path.join(temporary, 'schedule.cjs');
  if (!process.env.SKYMP_SCHEDULE_UNIT_BUNDLE) require('../node_modules/esbuild').buildSync({
    stdin: { contents: "export * from './ts/restartSchedule'; export * from './ts/dashboardActivity';", resolveDir: path.resolve('../skymp5-server') },
    bundle: true, platform: 'node', target: 'es2022', outfile: bundle, logLevel: 'silent',
  });
  const { defaultRestartSchedule, validateRestartSchedule, nextRestartSlot, RestartScheduler, registerRestartSchedule, DashboardActivity } = require(bundle);
  const config = validateRestartSchedule({ enabled: true, timeZone: 'UTC', times: ['11:00', '11:00'], warningMinutes: [5, 15, 1, 1] });
  assert.deepEqual(config.times, ['11:00']); assert.deepEqual(config.warningMinutes, [15, 5, 1]);
  for (const value of [{ ...config, times: ['25:00'] }, { ...config, timeZone: 'Mars/City' }, { ...config, times: [] }, { ...config, enabled: 'yes' }, { ...config, warningMinutes: [0] }, { ...config, shell: 'unsafe' }]) assert.throws(() => validateRestartSchedule(value));
  checks.push('Strict configuration, valid IANA zones, HH:mm, daily limits and normalized duplicates');

  const berlin = { ...config, timeZone: 'Europe/Berlin', times: ['02:30'] };
  let slot = nextRestartSlot(berlin, Date.parse('2026-03-29T00:00:00Z'), new Set());
  assert.equal(slot.at, Date.parse('2026-03-30T00:30:00Z'), 'Missing spring hour is skipped');
  slot = nextRestartSlot(berlin, Date.parse('2026-10-25T00:00:00Z'), new Set());
  assert.equal(slot.at, Date.parse('2026-10-25T00:30:00Z'));
  const afterRepeatedHour = nextRestartSlot(berlin, Date.parse('2026-10-25T01:00:00Z'), new Set([slot.key]));
  assert.equal(afterRepeatedHour.at, Date.parse('2026-10-26T01:30:00Z'), 'Fall clock repetition never restarts twice');
  const midnight = nextRestartSlot({ ...config, times: ['00:01'] }, Date.parse('2026-10-26T23:59:00Z'), new Set());
  assert.equal(midnight.at, Date.parse('2026-10-27T00:01:00Z'));
  checks.push('Midnight boundaries and Europe/Berlin spring/fall DST including repeated-hour deduplication');

  let now = Date.parse('2026-10-26T10:45:00Z'), running = true, restarts = 0;
  const warnings = [], log = [];
  let settings = { restartSchedule: config, operatorValue: { keep: true }, discordBot: { token: 'FIXTURE_ONLY' } };
  const file = path.join(temporary, 'data/state.json');
  const options = { file, read: () => settings.restartSchedule, supported: () => true, running: () => running, now: () => now,
    restart: async () => { restarts++; return { ok: true }; }, warn: minutes => warnings.push(minutes), log: message => log.push(message) };
  const service = new RestartScheduler(options); services.push(service);
  await service.tick(); await service.tick(); now += 10 * 60000; await service.tick(); now += 4 * 60000; await Promise.all([service.tick(), service.tick()]);
  assert.deepEqual(warnings, [15, 5, 1]);
  now += 60000; await Promise.all([service.tick(), service.tick()]); await service.tick();
  assert.equal(restarts, 1);
  const reloaded = new RestartScheduler(options); services.push(reloaded); await reloaded.tick(); assert.equal(restarts, 1);
  assert(reloaded.view().nextAt > now + 23 * 3600000);
  now += 86400000; running = false; await reloaded.tick(); assert.equal(restarts, 1, 'Stopped games are never started');
  now += 86400000 + 120000; running = true; await reloaded.tick(); assert.equal(restarts, 1, 'Missed minutes are never caught up');
  checks.push('Warnings once per threshold; one durable restart; restart deduplication after web reload; stopped and missed schedules do not start games');

  const skippedAt = reloaded.view().nextAt; reloaded.skip(skippedAt);
  assert(reloaded.view().nextAt >= skippedAt + 23 * 3600000);
  const skippedReload = new RestartScheduler(options); services.push(skippedReload); assert.equal(skippedReload.view().nextAt, reloaded.view().nextAt);
  assert.throws(() => skippedReload.skip(skippedAt), /SCHEDULE_CHANGED/);
  fs.writeFileSync(path.join(temporary, 'invalid-state.json'), 'invalid');
  const invalidState = new RestartScheduler({ ...options, file: path.join(temporary, 'invalid-state.json') }); services.push(invalidState);
  assert.equal(invalidState.view().persistenceAvailable, false); await invalidState.tick(); assert.equal(restarts, 1); assert.equal(fs.readFileSync(path.join(temporary, 'invalid-state.json'), 'utf8'), 'invalid');
  const blocked = new RestartScheduler({ ...options, file: path.join(temporary, 'blocked/state.json') }); services.push(blocked);
  fs.writeFileSync(path.join(temporary, 'blocked'), 'not a directory'); assert.throws(() => blocked.skip(blocked.view().nextAt), /SCHEDULE_STATE_UNAVAILABLE/);
  checks.push('Skip-next survives reload; stale skip rejected; corrupt and unwritable state fail closed without overwriting existing data');

  const Koa = require('../node_modules/koa'), Router = require('../node_modules/koa-router'), body = require('../node_modules/koa-body');
  const app = new Koa(), router = new Router(); app.use((body.default || body)());
  registerRestartSchedule(router, { scheduler: reloaded, read: () => JSON.parse(JSON.stringify(settings)), write: value => { settings = value; }, authorize: (ctx, write) => { if (ctx.get('x-role') !== (write ? 'admin' : 'viewer') && ctx.get('x-role') !== 'admin') { ctx.status = 403; return false; } return true; } });
  app.use(router.routes()); server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`, route = '/api/admin/server/restart-schedule';
  const request = (suffix = '', init = {}) => fetch(origin + route + suffix, { ...init, headers: { 'x-role': 'admin', ...init.headers } });
  const post = (suffix, value, headers = {}) => request(suffix, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(value) });
  assert.equal((await request('', { headers: { 'x-role': 'viewer' } })).status, 200);
  const before = reloaded.view(), input = { config: { ...config, times: ['09:00', '15:00'] }, revision: before.revision };
  assert.equal((await post('', input, { 'x-role': 'viewer' })).status, 403);
  assert.equal((await post('', input, { origin: 'http://other.invalid' })).status, 403);
  assert.equal((await post('', input, { origin: '' })).status, 403);
  assert.equal((await post('', input, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await post('', { ...input, config: { ...config, times: ['bad'] } })).status, 400);
  const saved = await post('', input); assert.equal(saved.status, 200);
  assert.deepEqual(settings.operatorValue, { keep: true }); assert.equal(settings.discordBot.token, 'FIXTURE_ONLY');
  assert.equal((await post('', input)).status, 409, 'Stale update cannot overwrite a new schedule');
  assert.equal((await post('/skip', { nextAt: 1 })).status, 409);
  const next = reloaded.view().nextAt; assert.equal((await post('/skip', { nextAt: next })).status, 200);
  checks.push('Authenticated read/write boundaries, JSON same-origin CSRF, invalid schedules, stale revision conflict, skip conflict and preservation of unrelated settings');

  const activityFile = path.join(temporary, 'data/activity.json');
  const history = new DashboardActivity(activityFile, () => now); services.push(history);
  history.record({ ts: now, type: 'expected', reason: 'quit', ip: 'private', steamId: 'private' });
  history.record({ ts: now, type: 'unexpected', reason: 'timeout' }); history.record({ ts: now, type: 'unexpected', reason: 'timeout' });
  history.record({ ts: NaN, type: 'unexpected' }); history.record({ ts: now + 999999, type: 'unexpected' });
  history.flush(); const disk = fs.readFileSync(activityFile, 'utf8'); assert(!disk.includes('private')); assert(!disk.includes('steamId'));
  const activityReload = new DashboardActivity(activityFile, () => now); services.push(activityReload);
  assert.equal(activityReload.view().total, 3); assert.equal(activityReload.view().expected, 1); assert.deepEqual(activityReload.view().reasons, [{ reason: 'timeout', count: 2 }]);
  now += 6 * 3600000 + 1; assert.equal(activityReload.view().total, 0);
  fs.writeFileSync(path.join(temporary, 'bad-activity.json'), 'corrupt');
  const badHistory = new DashboardActivity(path.join(temporary, 'bad-activity.json'), () => now); services.push(badHistory);
  badHistory.record({ ts: now, type: 'unexpected' }); badHistory.flush(); assert.equal(badHistory.persistenceAvailable, false); assert.equal(fs.readFileSync(path.join(temporary, 'bad-activity.json'), 'utf8'), 'corrupt');
  checks.push('Six-hour aggregate disconnect history persists across game/web reloads, ignores malformed events, excludes identities and preserves corrupt files');
  console.log(JSON.stringify({ ok: true, platform: process.platform, checks }, null, 2));
} finally {
  for (const service of services) service.close();
  if (server) await new Promise(resolve => server.close(resolve));
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir())); assert(path.basename(temporary).startsWith('skymp-restart-schedule-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
