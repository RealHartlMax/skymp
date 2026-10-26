// Production dashboard + real supervisor IPC; the game and Discord are local
// substitutes. Waits for one actual wall-clock minute; never contacts a VPS.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { createSupervisor } = require('../deploy/test-server/server-supervisor.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-schedule-runtime-'));
let manager;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const checks = [];
(async () => {
  try {
    const socket = net.createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve)); const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
    const password = crypto.randomBytes(24).toString('hex'), salt = crypto.randomBytes(16).toString('hex');
    const discordLog = path.join(root, 'discord.ndjson'); process.env.SKYMP_TEST_DISCORD_LOG = discordLog;
    const settings = { name: 'Schedule runtime test', port: 27779, uiPort: port, uiListenHost: '127.0.0.1', dataDir: 'data', loadOrder: ['Skyrim.esm'], offlineMode: true,
      adminApi: { enabled: true }, adminUiUsers: { owner: { role: 'admin' } }, operatorValue: { keep: true },
      discordBot: { enabled: true, token: 'LOCAL_FIXTURE_ONLY', guildId: '123456789012345678', statusChannelId: '223456789012345678', warningsChannelId: '323456789012345678' } };
    fs.mkdirSync(path.join(root, 'data')); fs.mkdirSync(path.join(root, 'ui')); fs.writeFileSync(path.join(root, 'ui/build.js'), '// local fixture');
    fs.writeFileSync(path.join(root, 'server-settings.json'), JSON.stringify(settings));
    fs.writeFileSync(path.join(root, 'data/Skyrim.esm'), 'TES4-fixture');
    fs.writeFileSync(path.join(root, 'data/admin-auth.json'), JSON.stringify({ user: 'owner', algo: 'scrypt-v1', passwordHash: `scrypt-v1$16384$8$1$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}` }));
    fs.copyFileSync(path.join(__dirname, 'fixtures/dashboard_game.cjs'), path.join(root, 'game.cjs'));
    const dashboardEntry = path.resolve(process.env.SKYMP_DISCORD_FIXTURE_BUNDLE || 'server-r12-validation/back-mock/skymp5-admin.js');
    manager = createSupervisor({ root, entry: 'game.cjs', dashboardEntry, args: [], stopTimeout: 2000 }); manager.start();
    const base = `http://127.0.0.1:${port}`; let cookie = '';
    const request = (route, init = {}) => fetch(base + route, { ...init, headers: { cookie, ...init.headers }, signal: AbortSignal.timeout(5000) });
    const post = (route, value, headers = {}) => request(route, { method: 'POST', headers: { origin: base, 'content-type': 'application/json', ...headers }, body: JSON.stringify(value) });
    const wait = async (label, predicate, ms = 20000) => { const until = Date.now() + ms; while (Date.now() < until) { try { if (await predicate()) return; } catch {} await sleep(100); } assert.fail(label); };
    await wait('owner login', async () => { const response = await post('/api/admin/session/login', { user: 'owner', password }); if (!response.ok) return false; cookie = response.headers.get('set-cookie').split(';')[0]; return true; });
    const status = async () => (await request('/api/admin/status')).json();
    await wait('running game', async () => (await status()).gameState === 'running'); const first = await status();
    const route = '/api/admin/server/restart-schedule', schedule = await (await request(route)).json(); assert.equal(schedule.supported, true); assert.equal(schedule.config.enabled, false);
    assert.equal((await post(route, { config: { enabled: true, timeZone: 'UTC', times: ['bad'], warningMinutes: [] }, revision: schedule.revision })).status, 400);
    const target = (Math.floor((Date.now() + 15000) / 60000) + 1) * 60000;
    const time = new Date(target).toISOString().slice(11, 16);
    let response = await post(route, { config: { enabled: true, timeZone: 'UTC', times: [time], warningMinutes: [1] }, revision: schedule.revision }); assert.equal(response.status, 200); assert.equal((await response.json()).nextAt, target);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(root, 'server-settings.json'))).operatorValue, { keep: true });
    assert.equal((await post('/api/admin/console', { command: 'fixture-drop' })).status, 200);
    await wait('drop reaches persistent web process', async () => (await (await request('/api/admin/overview')).json()).drops.unexpected === 1);
    console.log(JSON.stringify({ waitingForScheduledRestart: new Date(target).toISOString(), seconds: Math.ceil((target - Date.now()) / 1000) }));
    await wait('scheduled restart changes only game PID', async () => { const state = await status(); assert.equal(state.dashboardPid, first.dashboardPid); return state.gameState === 'running' && state.gamePid !== first.gamePid; }, Math.max(20000, target - Date.now() + 15000));
    assert.equal((await request('/api/admin/session')).status, 200);
    assert.equal((await (await request('/api/admin/overview')).json()).drops.unexpected, 1);
    const events = () => fs.existsSync(discordLog) ? fs.readFileSync(discordLog, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
    await wait('Discord warning uses warning channel', () => events().some(event => event.event === 'message' && event.channelId === settings.discordBot.warningsChannelId && /Scheduled server restart/.test(event.payload?.content)));
    const log = JSON.stringify(await (await request('/api/admin/logs?source=server')).json()); assert.match(log, /scheduled-warning-received/);
    checks.push('Real wall-clock scheduled restart via private supervisor IPC changes only game PID; owner session and web PID survive');
    checks.push('Game fixture receives advance warning; Discord substitute receives warning on the configured channel; six-hour disconnect history survives');
    const next = await (await request(route)).json(); response = await post(route + '/skip', { nextAt: next.nextAt }); assert.equal(response.status, 200); assert((await response.json()).nextAt >= next.nextAt + 23 * 3600000);
    assert.equal((await post(route + '/skip', { nextAt: next.nextAt })).status, 409);
    await post('/api/admin/server/control', { action: 'stop' }); await wait('manual stop', async () => (await status()).gameState === 'stopped');
    assert.equal((await request(route)).status, 200); assert.equal((await request('/api/admin/overview')).status, 200); assert.equal((await status()).dashboardPid, first.dashboardPid);
    checks.push('Skip-next persists, stale skip is rejected, and overview/settings remain available after manual game stop');
    console.log(JSON.stringify({ ok: true, platform: process.platform, checks, skyrimStarted: false, realDiscordConnected: false }));
  } finally {
    if (manager) { manager.close(); await sleep(2500); }
    delete process.env.SKYMP_TEST_DISCORD_LOG;
    assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith('skymp-schedule-runtime-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
