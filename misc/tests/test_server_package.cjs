// Real native server smoke test. Run only against a disposable package copy.
// node misc/tests/test_server_package.cjs --package DIR --workspace NEW_DIR --game-data DIR --report FILE
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dgram = require('node:dgram');
const { spawn, spawnSync } = require('node:child_process');
const args = process.argv.slice(2), options = {};
for (let i = 0; i < args.length; i += 2) {
  assert(args[i].startsWith('--') && args[i + 1], 'Expected --option value pairs');
  options[args[i].slice(2)] = args[i + 1];
}
for (const name of ['package', 'workspace', 'game-data', 'report']) assert(options[name], `Missing --${name}`);
const source = path.resolve(options.package), root = path.resolve(options.workspace);
assert(!fs.existsSync(root), 'Refusing to overwrite an existing test workspace');
const manifest = JSON.parse(fs.readFileSync(path.join(source, 'build-manifest.json'), 'utf8'));
assert.equal(manifest.discordHostedBy, 'dashboard');
assert(fs.existsSync(path.join(source, 'DISCORD-BOT.md')));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const file of manifest.files) assert.equal(hash(path.join(source, file.path)), file.sha256, `Package checksum: ${file.path}`);
fs.cpSync(source, root, { recursive: true });
const modFixture = Buffer.from('launcher-publication-native-server-smoke-test');
const modFixturePath = 'Data/textures/launcher-validation/test.dds';
assert(!fs.existsSync(path.join(root, 'client-resources', modFixturePath)), 'Mod fixture must be new');
fs.mkdirSync(path.dirname(path.join(root, 'client-resources', modFixturePath)), { recursive: true });
fs.writeFileSync(path.join(root, 'client-resources', modFixturePath), modFixture);
const settings = JSON.parse(fs.readFileSync(path.join(root, 'server-settings.json'), 'utf8'));
assert.equal(settings.offlineMode, false, 'New packages must use verified Steam access');
assert.equal(settings.playerAccess.mode, 'guest');
assert.equal(settings.playerAccess.steamApiKey, '', 'No private Steam key may be shipped');
assert(fs.existsSync(path.join(root, 'INGAME-LOGIN.md')));
assert.equal(settings.loadOrder.length, 5);
for (const name of settings.loadOrder) {
  assert(!fs.existsSync(path.join(source, settings.dataDir, name)), 'Game masters must not be shipped in the archive');
  fs.copyFileSync(path.resolve(options['game-data'], name), path.join(root, settings.dataDir, name));
}
// Isolate only network bindings; all other shipped settings and credentials stay in use.
Object.assign(settings, { port: 27777, uiPort: 28080, listenHost: '127.0.0.1', uiListenHost: '127.0.0.1' });
fs.writeFileSync(path.join(root, 'server-settings.json'), JSON.stringify(settings, null, 2));
async function setupViaBrowser(user, password) {
  const setup = spawn(process.execPath, ['setup-server.cjs', '--ensure'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '', exited = false;
  const exit = new Promise(resolve => setup.once('exit', code => { exited = true; resolve(code); }));
  setup.stdout.on('data', data => { output += data; });
  setup.stderr.on('data', data => { output += data; });
  const base = 'http://127.0.0.1:28080';
  const deadline = Date.now() + 30000;
  try {
    while (!/Einrichtungscode: \d{4}/.test(output) && !exited && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 50));
    const code = /Einrichtungscode: (\d{4})/.exec(output)?.[1];
    assert(code, 'Noninteractive starter must print a four-digit code and serve browser setup');
    const page = await fetch(base + '/admin'); assert.equal(page.status, 200); assert((await page.text()).includes('Einrichtungscode'));
    const unlock = await fetch(base + '/api/setup/unlock', { method: 'POST', headers: { 'content-type': 'application/json', origin: base }, body: JSON.stringify({ code }) });
    assert.equal(unlock.status, 200);
    const cookie = unlock.headers.get('set-cookie').split(';')[0];
    const state = await (await fetch(base + '/api/setup/state', { headers: { cookie } })).json();
    assert.equal(state.installation.ready, true);
    const complete = await fetch(base + '/api/setup/complete', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: base, cookie, 'x-skymp-setup-csrf': state.csrf },
      body: JSON.stringify({ serverName: settings.name, port: 27777, uiPort: 28080, maxPlayers: settings.maxPlayers, access: 'local', adminUser: user, password, passwordConfirm: password }),
    });
    assert.equal(complete.status, 200); assert.equal((await complete.json()).ok, true);
    assert.equal(await Promise.race([exit, new Promise(resolve => { const timer = setTimeout(() => resolve('timeout'), 10000); timer.unref(); })]), 0);
    assert(!output.includes(password), 'Browser password must not appear in terminal output');
    assert(!output.includes('Servername ['), 'No terminal questionnaire');
  } finally { if (!exited) { setup.kill(); await exit; } }
}
(async () => {
let user, password;
if (manifest.installationMode === 'first-run') {
  assert(!fs.existsSync(path.join(source, 'TEST-ZUGANG.txt')), 'First-run package must not ship a password');
  assert(!fs.existsSync(path.join(source, 'data/admin-auth.json')), 'First-run package must not ship an admin account');
  const blocked = spawnSync(process.execPath, ['check-install.cjs'], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.notEqual(blocked.status, 0, 'Unconfigured installation must not pass preflight');
  assert(blocked.stderr.includes('Ersteinrichtung fehlt'));
  user = 'setup-admin'; password = crypto.randomBytes(24).toString('hex');
  await setupViaBrowser(user, password);
  const authBefore = hash(path.join(root, 'data/admin-auth.json'));
  const repeat = spawnSync(process.execPath, ['setup-server.cjs', '--ensure'], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.equal(repeat.status, 0, repeat.stderr);
  assert.equal(hash(path.join(root, 'data/admin-auth.json')), authBefore, 'Repeated startup must retain the admin account');
} else {
  const access = fs.readFileSync(path.join(root, 'TEST-ZUGANG.txt'), 'utf8');
  user = /^Benutzer: (.+)$/m.exec(access)?.[1].trim();
  password = /^Passwort: (.+)$/m.exec(access)?.[1].trim();
  assert(user && password, 'Package test credentials missing');
}
const reportFile = path.resolve(options.report);
fs.mkdirSync(path.dirname(reportFile), { recursive: true });
const report = { platform: process.platform, architecture: process.arch, node: process.version, buildId: manifest.buildId, sourceFingerprint: manifest.sourceFingerprint, startedAt: new Date().toISOString(), checks: ['All package SHA256 checksums match'], checksums: { native: hash(path.join(root, 'scam_native.node')), backend: hash(path.join(root, 'dist_back/skymp5-server.js')), frontend: hash(path.join(root, 'ui/build.js')), ...(manifest.dashboardIndependent ? { dashboard: hash(path.join(root, 'dist_back/skymp5-admin.js')) } : {}) } };
if (manifest.installationMode === 'first-run') report.checks.push('No shipped credentials; real HTTP setup with terminal PIN creates own scrypt account; noninteractive startup and repeated startup preserve the account');
const preflight = spawnSync(process.execPath, ['check-install.cjs'], { cwd: root, encoding: 'utf8', timeout: 30000 });
assert.equal(preflight.status, 0, `Shipped preflight failed: ${preflight.stdout}\n${preflight.stderr}`);
report.checks.push('Shipped preflight accepts the native platform and five real master files');
const managed = manifest.processManager === 'packaged-supervisor';
const child = spawn(process.execPath, [managed ? 'server-supervisor.cjs' : 'dist_back/skymp5-server.js'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let exited = false, output = '';
child.on('exit', (code, signal) => { exited = true; report.exit = { code, signal }; });
child.stdout.on('data', data => { output += data; });
child.stderr.on('data', data => { output += data; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const request = (route, init = {}) => fetch(`http://127.0.0.1:28080${route}`, { ...init, signal: AbortSignal.timeout(5000) });
async function checkUdp() {
  const socket = dgram.createSocket('udp4');
  await new Promise((resolve, reject) => {
    socket.once('error', error => { socket.close(); error.code === 'EADDRINUSE' ? resolve() : reject(error); });
    socket.bind(27777, '127.0.0.1', () => { socket.close(); reject(new Error('Native UDP port is not bound')); });
  });
}
  try {
    let response, adminHtml = '';
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline && !exited) {
      try { response = await request('/admin'); if (response.ok) { adminHtml = await response.text(); if (adminHtml.includes('SkyMP Admin Login')) break; } } catch {}
      await sleep(500);
    }
    assert(response?.ok, 'Server did not serve /admin within 180 seconds');
    assert(adminHtml.includes('SkyMP Admin Login'));
    if (manifest.dashboardIndependent) {
      while (!output.includes('[SkyMP] Game-Server bereit.') && !exited && Date.now() < deadline) await sleep(200);
      assert(output.includes('[SkyMP] Game-Server bereit.'), 'Independent dashboard must not hide a game startup failure');
    }
    while (!output.includes('Initialized MovementDebugLogSystem') && !exited && Date.now() < deadline) await sleep(100);
    assert(output.includes('Initialized MovementDebugLogSystem'), 'All game systems must initialize, including Steam login, before qualifying native startup');
    assert(!output.includes('unhandledRejection'), 'Native startup must not hide an asynchronous system initialization failure');
    report.checks.push('Native server starts with the shipped configuration and five real masters');
    const branding = await (await request('/api/launcher/assets')).json();
    for (const name of ['logo', 'banner']) {
      const image = branding.assets[name]; assert(image, 'Missing packaged ' + name);
      assert.equal(image.sha256, hash(path.join(root, name + '.png')));
      const response = await request(image.path); assert.equal(response.status, 200);
      assert.equal(crypto.createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), image.sha256);
    }
    report.checks.push('Packaged logo and banner are available through the launcher asset API with matching hashes');
    const asset = await request('/build.js');
    assert.equal(asset.status, 200);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('hex'), report.checksums.frontend);
    report.checks.push('Production frontend is served unchanged');
    const authPolicyResponse = await request('/api/launcher/auth-policy');
    assert.equal(authPolicyResponse.status, 200);
    const authPolicy = await authPolicyResponse.json();
    assert.equal(authPolicy.version, 2);
    assert.match(authPolicy.ticketIdentity, /^skymp[a-f0-9]{24}$/);
    assert.equal(authPolicy.steamRequired, true);
    assert.equal(authPolicy.steamConfigured, false);
    assert.equal(authPolicy.accountLoginRequired, false);
    assert.equal(authPolicy.steamAppId, 489830);
    assert(!('steamApiKey' in authPolicy));
    const stalePolicy = await request('/api/launcher/auth/steam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ticket: '00'.repeat(128), ticketIdentity: 'outdated-policy' }) });
    assert.equal(stalePolicy.status, 409);
    assert.equal((await stalePolicy.json()).code, 'STEAM_POLICY_CHANGED');
    report.checks.push('Compact Steam ticket identity and stale-policy HTTP rejection are present in the real packaged dashboard');
    report.checks.push('Shipped guest mode still requires verified Steam; public launcher auth policy contains no secret and correctly reports missing operator key');
    const publication = await request('/api/launcher/manifest');
    assert.equal(publication.status, 200);
    const modManifest = await publication.json();
    assert.equal(modManifest.version, '2');
    assert.deepEqual(modManifest.loadOrder, settings.loadOrder);
    assert.deepEqual(modManifest.requiredLocalFiles.map(file => file.filename), settings.loadOrder);
    assert.equal(modManifest.runtimeSource, settings.launcherResources?.runtimeSource || undefined);
    assert.equal(modManifest.resources.length, 1, 'Game masters must never be mod downloads');
    const modFile = modManifest.resources[0];
    assert.equal(modFile.path, modFixturePath);
    assert.equal(modManifest.totalSize, modFixture.length);
    const downloadedMod = await request('/' + modFile.downloadPath);
    assert.equal(downloadedMod.status, 200);
    assert.deepEqual(Buffer.from(await downloadedMod.arrayBuffer()), modFixture);
    assert.equal(modFile.hash, 'sha256:' + crypto.createHash('sha256').update(modFixture).digest('hex'));
    report.checks.push('Public launcher v2 API serves a path-preserving SHA256-verified asset; five game masters remain local requirements');
    const setupStatus = await request('/api/admin/setup/status');
    assert.equal((await setupStatus.json()).needsSetup, false);
    const bootstrap = await request('/api/admin/setup/bootstrap', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user: 'unexpected', password: 'must-not-be-applied', passwordConfirm: 'must-not-be-applied' }) });
    assert.equal(bootstrap.status, 409, 'Configured admin account must not be replaced by public bootstrap');
    const rejected = await request('/api/admin/session/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, password: password + '-wrong' }) });
    assert.equal(rejected.status, 401);
    const login = await request('/api/admin/session/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, password }) });
    assert.equal(login.status, 200); assert.equal((await login.json()).ok, true);
    const cookie = login.headers.get('set-cookie')?.split(';')[0];
    assert(cookie?.startsWith('skymp_admin_session='));
    const unauthorizedConnection = await request('/api/admin/launcher-connection');
    assert.equal(unauthorizedConnection.status, 401);
    const launcherConnection = await request('/api/admin/launcher-connection', { headers: { cookie } });
    assert.equal(launcherConnection.status, 200);
    const connection = await launcherConnection.json();
    assert.equal(connection.authMode, 'guestOpen');
    assert.equal(connection.runtimeSource, settings.launcherResources?.runtimeSource || '');
    const activeSettings = JSON.parse(fs.readFileSync(path.join(root, 'server-settings.json'), 'utf8'));
    assert(!activeSettings.masterKey || !JSON.stringify(connection).includes(activeSettings.masterKey));
    report.checks.push('Launcher connection settings require authentication, advertise the configured catalog and never expose the private key');
    const session = await request('/api/admin/session', { headers: { cookie } });
    assert.equal(session.status, 200);
    const current = await session.json(); assert.equal(current.authenticated, true); assert.equal(current.user, user);
    report.checks.push('Shipped admin credentials authenticate; incorrect password is rejected');
    const botStatus = await (await request('/api/admin/status', { headers: { cookie } })).json();
    assert.equal(botStatus.discordBot.state, 'disabled');
    assert(!Object.hasOwn(botStatus.discordBot, 'token'));
    report.checks.push('Dashboard owns Discord, reports its disabled-by-default state without secrets and includes the bot setup guide');
    await checkUdp(); report.checks.push('Native UDP game socket is bound');
    assert(output.includes('[MasterClient] Missing or invalid private server key.'));
    assert.equal(activeSettings.masterKey, '', 'Unregistered guest setup must not invent master credentials');
    report.checks.push('Unregistered guest startup skips the master heartbeat without inventing a server key');
    if (managed) {
      const origin = 'http://127.0.0.1:28080';
      const post = (route, value, sessionCookie = cookie, host = origin) => request(route, { method: 'POST', headers: { 'content-type': 'application/json', origin: host, cookie: sessionCookie }, body: JSON.stringify(value) });
      const waitState = async expected => {
        const limit = Date.now() + 60000;
        while (Date.now() < limit) {
          const result = await request('/api/admin/supervisor/state', { headers: { cookie } });
          assert.equal(result.status, 200);
          const status = await result.json();
          if (status.state === expected) return status;
          await sleep(100);
        }
        assert.fail('Supervisor did not reach ' + expected);
      };
      const caps = await request('/api/admin/capabilities', { headers: { cookie } });
      const abilities = await caps.json();
      assert.equal(abilities.serverControlAvailable, true);
      assert.equal(abilities.serverControlMode, 'packaged');
      assert.equal(abilities.canMessage, true);
      const before = await waitState('running');
      assert(before.pid > 0 && before.pid !== child.pid);
      if (manifest.dashboardIndependent) {
        assert.equal(abilities.independentDashboard, true);
        assert(before.dashboardPid > 0 && before.dashboardPid !== before.pid && before.dashboardPid !== child.pid);
      }
      const readiness = await (await request('/api/admin/runtime-readiness', { headers: { cookie } })).json();
      assert.equal(readiness.checks.find(check => check.id === 'launcher').level, 'ok');
      assert.equal(readiness.checks.find(check => check.id === 'nodeModules').code, 'runtime_dependencies_bundled');
      assert.equal((await post('/api/admin/server/control', { action: 'stop' }, '')).status, 401);
      assert.equal((await post('/api/admin/server/control', { action: 'stop' }, cookie, 'https://other.example')).status, 403);
      assert.equal((await post('/api/admin/server/control', { action: 'invalid' })).status, 400);
      assert.equal((await post('/api/admin/supervisor/control', { action: 'stop' }, '')).status, 401);
      assert.equal((await post('/api/admin/supervisor/control', { action: 'stop' }, cookie, 'https://other.example')).status, 403);
      const cfgBefore = hash(path.join(root, 'server-settings.json'));
      const authBefore = hash(path.join(root, 'data/admin-auth.json'));
      const stop = await post('/api/admin/server/control', { action: 'stop' });
      assert.equal(stop.status, 200); assert.equal((await stop.json()).via, 'packaged-supervisor');
      await waitState('stopped');
      const stoppedPage = await request('/admin', { headers: { cookie } }); assert.equal(stoppedPage.status, 200);
      if (manifest.dashboardIndependent) {
        assert((await stoppedPage.text()).includes('<script src="/build.js'));
        const stoppedStatus = await (await request('/api/admin/status', { headers: { cookie } })).json();
        assert.equal(stoppedStatus.gameState, 'stopped'); assert.equal(stoppedStatus.online, 0);
        assert.equal(stoppedStatus.dashboardPid, before.dashboardPid);
        assert.equal((await request('/api/admin/cfg/server-settings', { headers: { cookie } })).status, 200);
        const retainedLogs = await (await request('/api/admin/logs?type=server', { headers: { cookie } })).json();
        assert(retainedLogs.length > 0, 'Game logs must remain readable after stop');
        assert.equal((await request('/api/launcher/manifest')).status, 200);
        assert.deepEqual(Buffer.from(await (await request('/' + modFile.downloadPath)).arrayBuffer()), modFixture);
      } else {
        assert((await stoppedPage.text()).includes('Serversteuerung'));
        assert.equal((await request('/api/launcher/manifest')).status, 503);
      }
      // The game socket is released while management retains the original HTTP port.
      const free = dgram.createSocket('udp4');
      await new Promise((resolve, reject) => { free.once('error', reject); free.bind(27777, '127.0.0.1', () => { free.close(); resolve(); }); });
      const badLogin = await post('/api/admin/session/login', { user, password: password + '-wrong' }, ''); assert.equal(badLogin.status, 401);
      const start = await post(manifest.dashboardIndependent ? '/api/admin/server/control' : '/api/admin/supervisor/control', { action: 'start' }); assert.equal(start.status, manifest.dashboardIndependent ? 200 : 202);
      const afterStart = await waitState('running'); assert.notEqual(afterStart.pid, before.pid);
      if (manifest.dashboardIndependent) {
        assert.equal(afterStart.dashboardPid, before.dashboardPid);
        assert.equal((await request('/api/admin/players', { headers: { cookie } })).status, 200, 'Original login must still work in the restarted native game');
      }
      const loginAgain = await post('/api/admin/session/login', { user, password }, ''); assert.equal(loginAgain.status, 200);
      const newCookie = loginAgain.headers.get('set-cookie').split(';')[0];
      const restart = await post('/api/admin/server/control', { action: 'restart' }, newCookie); assert.equal(restart.status, 200);
      let afterRestart;
      const restartLimit = Date.now() + 60000;
      while (Date.now() < restartLimit) { const response = await request('/api/admin/supervisor/state', { headers: { cookie } }); const current = await response.json(); if (current.state === 'running' && current.pid !== afterStart.pid) { afterRestart = current; break; } await sleep(100); }
      assert(afterRestart, 'Restart must replace the owned child and keep management alive');
      if (manifest.dashboardIndependent) {
        assert.equal(afterRestart.dashboardPid, before.dashboardPid);
        report.checks.push('Independent full dashboard, settings, logs, launcher downloads and original session survive native game stop/start/restart; only the game PID changes');
      }
      assert.equal(hash(path.join(root, 'server-settings.json')), cfgBefore);
      assert.equal(hash(path.join(root, 'data/admin-auth.json')), authBefore);
      await checkUdp();
      report.checks.push('Packaged supervisor enables quick controls; authenticated same-origin stop releases UDP, management stays on HTTP, start and restart use new child PIDs without changing configuration or owner credentials');
      report.checks.push('Bundled-dependency readiness accepts the supplied starters without requiring npm install or node_modules');
    }
    assert(!output.includes('unhandledRejection'), 'Game lifecycle must not introduce an asynchronous initialization failure');
    report.ok = true;
  } catch (error) { report.ok = false; report.error = error.stack; }
  finally {
    if (!exited) {
      child.kill('SIGTERM');
      // Ordered r4 shutdown stops the game before closing the dashboard/bot.
      const shutdownDeadline = Date.now() + 10000;
      while (!exited && Date.now() < shutdownDeadline) await sleep(50);
    }
    report.stoppedAfterSigterm = exited;
    if (!exited) { report.ok = false; report.error = (report.error || '') + '\nSupervisor did not exit after graceful shutdown.'; }
    if (!exited) { child.kill('SIGKILL'); await sleep(500); }
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(reportFile.replace(/\.json$/, '') + '-server.log', output);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
