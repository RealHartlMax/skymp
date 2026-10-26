// Integration of the real dashboard bundle with an isolated, disposable game fixture.
// No native extension, Skyrim installation or public listener is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const crc32 = require('../../skymp5-server/node_modules/crc-32');
const { WebSocket } = require('../../skymp5-server/node_modules/ws');
const { createSupervisor } = require('../deploy/test-server/server-supervisor.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-dashboard-test-'));
const password = crypto.randomBytes(24).toString('hex');
const checks = [];
const testDiscord = process.argv.includes('--discord-fixture');
const delayDashboard = process.argv.includes('--delayed-dashboard');
const discordLog = path.join(root, 'discord-sdk-events.ndjson');
const discordEvents = () => fs.existsSync(discordLog) ? fs.readFileSync(discordLog, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) : [];
const sockets = [];
let manager;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function freeTcpPort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve)); return port;
}
(async () => {
  try {
    const port = await freeTcpPort();
    fs.mkdirSync(path.join(root, 'data'));
    fs.writeFileSync(path.join(root, 'data/Skyrim.esm'), 'TES4-dashboard-fixture-only');
    fs.mkdirSync(path.join(root, 'ui'));
    fs.mkdirSync(path.join(root, 'client-resources/Data/textures'), { recursive: true });
    fs.writeFileSync(path.join(root, 'ui/index.html'), '<html>persistent-full-dashboard</html>');
    fs.writeFileSync(path.join(root, 'ui/build.js'), '/* persistent dashboard asset */');
    const asset = 'persistent-launcher-resource';
    fs.writeFileSync(path.join(root, 'client-resources/Data/textures/dashboard-test.dds'), asset);
    const cfg = { name: 'Independent dashboard test', port: 27779, uiPort: port, uiListenHost: '127.0.0.1', dataDir: 'data', loadOrder: ['Skyrim.esm'], offlineMode: true, adminApi: { enabled: true }, adminUiUsers: { owner: { role: 'admin' } }, launcherResources: { enabled: true, directory: './client-resources' } };
    if (testDiscord) {
      cfg.localeRouting = { defaultLanguage: 'de' };
      cfg.discordBot = { enabled: true, token: 'LOCAL_FIXTURE_ONLY', guildId: '123456789012345678', statusChannelId: '223456789012345678', warningsChannelId: '323456789012345678' };
      process.env.SKYMP_TEST_DISCORD_LOG = discordLog;
    }
    const settingsFile = path.join(root, 'server-settings.json');
    fs.writeFileSync(settingsFile, JSON.stringify(cfg));
    const master = fs.readFileSync(path.join(root, 'data/Skyrim.esm'));
    fs.writeFileSync(path.join(root, 'data/manifest.json'), JSON.stringify({ versionMajor: 1, loadOrder: cfg.loadOrder, mods: [{ filename: 'Skyrim.esm', size: master.length, crc32: crc32.buf(master) }] }));
    const salt = crypto.randomBytes(16).toString('hex');
    const authFile = path.join(root, 'data/admin-auth.json');
    fs.writeFileSync(authFile, JSON.stringify({ user: 'owner', algo: 'scrypt-v1', passwordHash: `scrypt-v1$16384$8$1$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}` }));
    const authBefore = fs.readFileSync(authFile, 'utf8');
    fs.copyFileSync(path.join(__dirname, 'fixtures/dashboard_game.cjs'), path.join(root, 'fixture.cjs'));
    let dashboardEntry = process.env.SKYMP_DASHBOARD_TEST_BUNDLE ? path.resolve(process.env.SKYMP_DASHBOARD_TEST_BUNDLE) : path.resolve(__dirname, '../../build/dist/server/dist_back/skymp5-admin.js');
    if (testDiscord) {
      if (process.env.SKYMP_DISCORD_FIXTURE_BUNDLE) dashboardEntry = path.resolve(process.env.SKYMP_DISCORD_FIXTURE_BUNDLE);
      else {
        dashboardEntry = path.join(root, 'dashboard-discord-fixture.cjs');
        const serverRoot = path.resolve(__dirname, '../../skymp5-server');
        require('../../skymp5-server/node_modules/esbuild').buildSync({
          entryPoints: [path.join(serverRoot, 'ts/dashboard.ts')], outfile: dashboardEntry,
          absWorkingDir: serverRoot, bundle: true, platform: 'node', target: 'es2022', logLevel: 'silent',
          alias: { 'discord.js': path.join(serverRoot, 'tests/fixtures/discordSdk.mjs'), '@opentelemetry/api': './ts/shims/opentelemetry-api.js' },
        });
      }
    }
    assert(fs.existsSync(dashboardEntry), 'Build the dashboard before this test');
    assert(!fs.existsSync(path.join(root, 'scam_native.node')));
    if (delayDashboard) {
      const actualDashboard = dashboardEntry;
      dashboardEntry = path.join(root, 'held-dashboard.cjs');
      fs.writeFileSync(dashboardEntry, `const fs = require('node:fs');
const send = process.send.bind(process);
process.send = (message, ...args) => {
  if (message.type !== 'skymp:ready') return send(message, ...args);
  fs.writeFileSync('dashboard-ready.json', JSON.stringify(message));
  const timer = setInterval(() => { if (fs.existsSync('release-dashboard')) { clearInterval(timer); send(message, ...args); } }, 25);
  return true;
};
require(${JSON.stringify(actualDashboard)});
`);
      const gameSource = fs.readFileSync(path.join(root, 'fixture.cjs'), 'utf8');
      fs.writeFileSync(path.join(root, 'fixture.cjs'), `const fs = require('node:fs'); const send = process.send.bind(process);
process.send = (message, ...args) => { if (message.type === 'skymp:ready') fs.writeFileSync('game-ready.json', JSON.stringify(message)); return send(message, ...args); };
` + gameSource);
    }
    manager = createSupervisor({ root, entry: 'fixture.cjs', dashboardEntry, args: [], stopTimeout: 2000 });
    let listenerEvents = 0, closeEvents = 0;
    manager.server.on('listening', () => listenerEvents++); manager.server.on('close', () => closeEvents++);
    manager.start();
    const base = `http://127.0.0.1:${port}`;
    let cookie = '';
    const request = (route, init = {}) => fetch(base + route, { ...init, headers: { cookie, ...init.headers }, signal: AbortSignal.timeout(5000) });
    const post = (route, value, init = {}) => request(route, { ...init, method: 'POST', headers: { origin: base, 'content-type': 'application/json', ...init.headers }, body: JSON.stringify(value) });
    const wait = async (label, fn) => {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) { if (await fn()) return; await sleep(80); }
      assert.fail('Timed out: ' + label);
    };
    if (delayDashboard) await wait('held dashboard and live game readiness', async () => fs.existsSync(path.join(root, 'dashboard-ready.json')) && fs.existsSync(path.join(root, 'game-ready.json')));
    await wait('dashboard startup', async () => { try { const response = await post('/api/admin/session/login', { user: 'owner', password }); if (!response.ok) return false; cookie = response.headers.get('set-cookie').split(';')[0]; return true; } catch { return false; } });
    if (delayDashboard) {
      const gamePort = JSON.parse(fs.readFileSync(path.join(root, 'game-ready.json'))).port;
      await wait('early session forwarded to already running game', async () => (await fetch(`http://127.0.0.1:${gamePort}/api/admin/players`, { headers: { cookie } })).status === 200);
      assert.equal((await post('/api/admin/session/touch', {})).status, 200);
      assert.equal((await post('/api/admin/session/logout', {})).status, 200);
      await wait('early logout forwarded to already running game', async () => (await fetch(`http://127.0.0.1:${gamePort}/api/admin/players`, { headers: { cookie } })).status === 401);
      const relogin = await post('/api/admin/session/login', { user: 'owner', password });
      assert.equal(relogin.status, 200); cookie = relogin.headers.get('set-cookie').split(';')[0];
      await wait('new early session reaches game', async () => (await fetch(`http://127.0.0.1:${gamePort}/api/admin/players`, { headers: { cookie } })).status === 200);
      fs.writeFileSync(path.join(root, 'release-dashboard'), 'ready');
      checks.push('Owner login, touch and logout before dashboard readiness reach an already running game; the new session remains valid when dashboard becomes ready');
    }
    const status = async () => (await request('/api/admin/status')).json();
    await wait('game startup', async () => (await status()).gameState === 'running');
    const first = await status(); assert(first.gamePid > 0); assert(first.dashboardPid > 0); assert.notEqual(first.gamePid, first.dashboardPid);
    assert.equal((await request('/api/admin/server-performance', { headers: { cookie: '' } })).status, 401);
    const performance = async () => {
      const response = await request('/api/admin/server-performance');
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      return response.json();
    };
    await wait('private game telemetry and dashboard measurements', async () => { const value = await performance(); return value.telemetryFresh && value.live.web && value.points.some(point => point.game && point.web); });
    const firstPerformance = await performance();
    assert.equal(firstPerformance.gamePid, first.gamePid);
    assert.equal(firstPerformance.live.game.cpuPercent, 12.5);
    assert(firstPerformance.histogram.count >= 100);
    assert(firstPerformance.summary.observedMs > 0);
    assert.equal(firstPerformance.bucketBoundsMs.length, 12);
    assert.equal((await request('/.admin/server-performance.json', { headers: { cookie: '' } })).status, 404);
    checks.push('Authenticated private IPC telemetry exposes separate game/dashboard CPU, RSS, heap, event-loop and tick histogram with retained minute samples');
    assert.equal((await request('/api/admin/discord/settings', { headers: { cookie: '' } })).status, 401);
    const discordSettingsResponse = await request('/api/admin/discord/settings');
    assert.equal(discordSettingsResponse.status, 200); assert.equal(discordSettingsResponse.headers.get('cache-control'), 'no-store');
    const discordSettings = await discordSettingsResponse.json();
    const beforeDiscord = JSON.parse(fs.readFileSync(settingsFile));
    const customDiscord = { ...discordSettings.discordBot, statusEmbed: { title: 'Dashboard lifecycle: {{serverName}}', fields: [{ name: 'Status', value: '{{statusString}}' }] } };
    assert.equal((await post('/api/admin/discord/settings', { discordBot: customDiscord }, { headers: { origin: 'https://other.example' } })).status, 403);
    for (const invalid of [
      { ...customDiscord, statusEmbed: { title: '{{token}}' } },
      { ...customDiscord, statusConfig: { buttons: [{ label: 'Unsafe', url: 'javascript:alert(1)' }] } },
      { ...customDiscord, unexpectedSetting: true },
    ]) assert.equal((await post('/api/admin/discord/settings', { discordBot: invalid })).status, 400);
    assert.deepEqual(JSON.parse(fs.readFileSync(settingsFile)), beforeDiscord, 'Rejected Discord writes retain the entire configuration');
    const discordSave = await post('/api/admin/discord/settings', { discordBot: customDiscord });
    assert.equal(discordSave.status, 200); assert.equal((await discordSave.json()).restartRequired, false);
    const afterDiscord = JSON.parse(fs.readFileSync(settingsFile));
    for (const key of Object.keys(beforeDiscord).filter(key => !['discordBot', 'discordAuth'].includes(key))) assert.deepEqual(afterDiscord[key], beforeDiscord[key], 'Discord save must preserve ' + key);
    assert.equal(afterDiscord.discordBot.statusEmbed.title, customDiscord.statusEmbed.title);
    assert.equal((await post('/api/admin/discord/settings', { discordBot: discordSettings.discordBot })).status, 200);
    checks.push('Discord settings require owner auth and same-origin writes, reject malformed templates/links/fields without modifying disk, and save only bot/auth settings without a game restart');
    if (testDiscord) {
      await wait('Discord ready', async () => (await status()).discordBot?.state === 'connected');
      await wait('Discord initial online message', async () => discordEvents().some(entry => entry.payload?.content.includes('ist online')));
      assert.equal((await post('/api/admin/console', { command: 'discord-warning' })).status, 200);
      await wait('game warning relayed', async () => discordEvents().some(entry => entry.channelId === cfg.discordBot.warningsChannelId && entry.payload.content.includes('Game warning forwarded')));
      const rejectedCfg = structuredClone(cfg); rejectedCfg.discordBot.statusChannelId = 'not-an-id';
      assert.equal((await post('/api/admin/cfg/server-settings', { json: JSON.stringify(rejectedCfg) })).status, 400);
      assert.equal(JSON.parse(fs.readFileSync(settingsFile)).discordBot.statusChannelId, cfg.discordBot.statusChannelId);
    }
    assert.equal((await request('/api/admin/cfg/server-settings', { headers: { cookie: '' } })).status, 401);
    assert.equal((await post('/api/admin/server/control', { action: 'stop' }, { headers: { origin: 'https://other.example' } })).status, 403);
    assert.equal((await post('/api/admin/server/control', { action: 'invalid' })).status, 400);
    assert.equal((await request('/api/admin/players')).status, 200, 'Dashboard login must authenticate the game proxy');
    checks.push('Real dashboard runs without a native module; game APIs retain authentication and control rejects foreign origins');

    const wsMessages = [], closed = [];
    const connect = async route => {
      const ws = new WebSocket(base.replace('http:', 'ws:') + route, { headers: { cookie, origin: base } });
      ws.on('message', data => wsMessages.push(JSON.parse(data))); ws.on('close', () => closed.push(route));
      sockets.push(ws);
      await new Promise((resolve, reject) => { ws.once('open', resolve); ws.once('error', reject); }); return ws;
    };
    await connect('/ws/admin-updates'); await connect('/ws/live-console');
    const denied = new WebSocket(base.replace('http:', 'ws:') + '/ws/live-console');
    denied.on('error', () => {});
    const deniedStatus = await new Promise(resolve => { const timer = setTimeout(() => resolve('timeout'), 5000); timer.unref(); denied.once('unexpected-response', (req, response) => { clearTimeout(timer); response.resume(); resolve(response.statusCode); }); denied.once('open', () => { clearTimeout(timer); resolve(101); }); denied.once('error', () => { clearTimeout(timer); resolve('error'); }); });
    denied.terminate(); assert.equal(deniedStatus, 401);
    assert.equal((await post('/api/admin/console', { command: 'log' })).status, 200);
    await wait('forwarded game log', async () => (await (await request('/api/admin/logs?type=server')).json()).some(entry => entry.message.includes('dashboard-log-')));
    await wait('server log broadcast to the dashboard update socket', async () => wsMessages.some(message => message.type === 'log' && message.data?.entry?.message.includes('dashboard-log-')));
    assert.equal(wsMessages.filter(message => message.type === 'log' && message.data?.entry?.message.includes('dashboard-log-')).length, 1);
    checks.push('Game stdout reaches the Server Log WebSocket exactly once while the HTTP log list remains available');

    const stopped = await post('/api/admin/server/control', { action: 'stop' }); assert.equal(stopped.status, 200);
    await wait('game stop', async () => (await status()).gameState === 'stopped');
    await wait('admin action broadcast to dashboard logs', async () => wsMessages.some(message => message.type === 'log' && message.data?.entry?.message.includes('Server stop requested through packaged process manager')));
    const afterStop = await status(); assert.equal(afterStop.gamePid, null); assert.equal(afterStop.dashboardPid, first.dashboardPid); assert.equal(afterStop.online, 0);
    const stoppedPerformance = await performance();
    assert.equal(stoppedPerformance.gameState, 'stopped');
    assert.equal(stoppedPerformance.live.game, null);
    assert.equal(stoppedPerformance.live.players, null);
    assert.equal(stoppedPerformance.telemetryFresh, false);
    assert(stoppedPerformance.live.web);
    assert(stoppedPerformance.points.some(point => point.game), 'Historical game measurements survive a game stop');
    assert.equal((await request('/admin')).status, 200);
    assert((await (await request('/admin-app')).text()).includes('<script src="/build.js'));
    assert.equal((await request('/build.js')).status, 200);
    assert.equal((await request('/api/admin/session')).status, 200);
    assert.equal((await request('/api/admin/players')).status, 200);
    assert.equal((await post('/api/admin/announcement', { message: 'offline' })).status, 409);
    const manifestResponse = await request('/api/launcher/manifest', { headers: { cookie: '' } });
    const downloadManifest = await manifestResponse.json();
    assert.equal(manifestResponse.status, 200, JSON.stringify(downloadManifest));
    const resource = downloadManifest.resources.find(item => item.path.endsWith('dashboard-test.dds')); assert(resource);
    const download = await request('/' + resource.downloadPath, { headers: { cookie: '' } }); assert.equal(await download.text(), asset);
    const logAfterStop = await (await request('/api/admin/logs?type=server')).json(); assert(logAfterStop.some(entry => entry.message.includes('dashboard-log-')));
    const config = await (await request('/api/admin/cfg/server-settings')).json();
    const edited = JSON.parse(config.json); edited.name = 'Edited while game stopped';
    assert.equal((await post('/api/admin/cfg/server-settings', { json: JSON.stringify(edited) })).status, 200);
    assert.equal(JSON.parse(fs.readFileSync(settingsFile)).name, edited.name);
    assert.equal((await request('/api/admin/admin-users')).status, 200);
    checks.push('Stopped game retains full dashboard, owner session, settings writes, historical logs and verified public launcher downloads');

    assert.equal((await post('/api/admin/server/control', { action: 'start' })).status, 200);
    await wait('game start', async () => { const value = await status(); return value.gameState === 'running' && value.gamePid !== first.gamePid; });
    const second = await status(); assert.equal(second.dashboardPid, first.dashboardPid);
    await wait('telemetry from the new game PID', async () => { const value = await performance(); return value.gamePid === second.gamePid && value.telemetryFresh; });
    assert.equal((await request('/api/admin/players')).status, 200, 'Existing session must survive game start');
    assert.equal((await post('/api/admin/server/control', { action: 'restart' })).status, 200);
    await wait('game restart', async () => { const value = await status(); return value.gameState === 'running' && value.gamePid !== second.gamePid; });
    assert.equal((await status()).dashboardPid, first.dashboardPid);
    assert.equal((await post('/api/admin/console', { command: 'crash' })).status, 200);
    await wait('game crash', async () => (await status()).gameState === 'crashed');
    const crashedPerformance = await performance();
    assert.equal(crashedPerformance.live.game, null);
    assert.equal(crashedPerformance.gameState, 'crashed');
    assert(crashedPerformance.live.web);
    checks.push('Metrics remain available through game stop/start/restart/crash, clear stale game samples and retain dashboard/history measurements');
    assert.equal((await status()).dashboardPid, first.dashboardPid);
    assert.equal((await request('/api/admin/cfg/server-settings')).status, 200);
    assert.equal((await request('/api/admin/logs')).status, 200);
    assert.equal(closed.length, 0, 'Game controls and crashes must not close either dashboard WebSocket');
    assert(wsMessages.some(message => message.type === 'status' && message.data?.gameState === 'stopped'));
    assert.equal(listenerEvents, 1); assert.equal(closeEvents, 0);
    assert.equal(fs.readFileSync(authFile, 'utf8'), authBefore);
    if (testDiscord) {
      await wait('Discord crash message', async () => discordEvents().some(entry => entry.payload?.content.includes('abgestürzt')));
      const events = discordEvents();
      assert.equal(events.filter(entry => entry.event === 'created').length, 1);
      assert.equal(events.filter(entry => entry.event === 'destroyed').length, 0);
      assert(events.every(entry => entry.pid === first.dashboardPid && entry.role === 'dashboard'));
      assert(events.some(entry => entry.payload?.content.includes('wieder online')));
      assert(events.some(entry => entry.payload?.content.includes('wurde gestoppt')));
      assert(events.filter(entry => entry.event === 'message').every(entry => entry.payload.allowedMentions.parse.length === 0));
      checks.push('Real dashboard/supervisor IPC keeps one mocked Discord client across stop/start/restart/crash, routes game warnings, emits lifecycle messages and validates settings');
    }
    checks.push('Start, restart and crash preserve dashboard PID, HTTP listener, both WebSockets and the original authenticated session');
    const permissionsCfg = JSON.parse(fs.readFileSync(settingsFile));
    const restrictedCfg = structuredClone(permissionsCfg);
    restrictedCfg.adminUiRoleCapabilities = { ...restrictedCfg.adminUiRoleCapabilities, admin: { ...restrictedCfg.adminUiRoleCapabilities?.admin, canViewLogs: false } };
    assert.equal((await post('/api/admin/cfg/server-settings', { json: JSON.stringify(restrictedCfg) })).status, 200);
    assert.equal((await request('/api/admin/server-performance')).status, 403);
    assert.equal((await post('/api/admin/cfg/server-settings', { json: JSON.stringify(permissionsCfg) })).status, 200);
    assert.equal((await request('/api/admin/server-performance')).status, 200);
    const noDiscordWrite = structuredClone(permissionsCfg);
    noDiscordWrite.adminUiRoleCapabilities = { ...noDiscordWrite.adminUiRoleCapabilities, admin: { ...noDiscordWrite.adminUiRoleCapabilities?.admin, canConsole: false } };
    fs.writeFileSync(settingsFile, JSON.stringify(noDiscordWrite));
    assert.equal((await post('/api/admin/discord/settings', { discordBot: customDiscord })).status, 403);
    fs.writeFileSync(settingsFile, JSON.stringify(permissionsCfg));
    checks.push('Metrics require canViewLogs even with an authenticated session; permission changes apply without restarting');
    const logout = await post('/api/admin/session/logout', {}); assert.equal(logout.status, 200);
    assert.equal((await request('/api/admin/status')).status, 401);
    assert.equal((await request('/api/admin/server-performance')).status, 401);
    await wait('logged-out status WebSocket', async () => closed.includes('/ws/admin-updates'));
    const relogin = await post('/api/admin/session/login', { user: 'owner', password });
    cookie = relogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('/api/admin/server/control', { action: 'start' })).status, 200);
    await wait('logged-out console WebSocket', async () => closed.includes('/ws/live-console'));
    checks.push('Logout invalidates HTTP access and both existing dashboard WebSocket subscriptions');
    if (testDiscord) {
      const currentCfg = JSON.parse(fs.readFileSync(settingsFile));
      currentCfg.discordBot.enabled = false;
      assert.equal((await post('/api/admin/cfg/server-settings', { json: JSON.stringify(currentCfg) })).status, 200);
      await wait('Discord disabled live', async () => (await status()).discordBot?.state === 'disabled');
      assert.equal(discordEvents().filter(entry => entry.event === 'destroyed').length, 1);
      assert.equal((await status()).dashboardPid, first.dashboardPid);
      checks.push('Saving disabled applies immediately without restarting the game or dashboard');
    }
    console.log(JSON.stringify({ ok: true, platform: process.platform, node: process.version, checks, gameStarted: false, nativeModuleRequired: false, discordFixture: testDiscord, realDiscordConnected: false }));
  } finally {
    for (const ws of sockets) ws.terminate();
    if (manager) { manager.close(); await sleep(2500); }
    if (testDiscord) delete process.env.SKYMP_TEST_DISCORD_LOG;
    assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith('skymp-dashboard-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
