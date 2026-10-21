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
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for (const file of manifest.files) assert.equal(hash(path.join(source, file.path)), file.sha256, `Package checksum: ${file.path}`);
fs.cpSync(source, root, { recursive: true });
const modFixture = Buffer.from('launcher-publication-native-server-smoke-test');
const modFixturePath = 'Data/textures/launcher-validation/test.dds';
assert(!fs.existsSync(path.join(root, 'client-resources', modFixturePath)), 'Mod fixture must be new');
fs.mkdirSync(path.dirname(path.join(root, 'client-resources', modFixturePath)), { recursive: true });
fs.writeFileSync(path.join(root, 'client-resources', modFixturePath), modFixture);
const settings = JSON.parse(fs.readFileSync(path.join(root, 'server-settings.json'), 'utf8'));
assert.equal(settings.offlineMode, true, 'Test package must use offline mode');
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
const report = { platform: process.platform, architecture: process.arch, node: process.version, buildId: manifest.buildId, sourceFingerprint: manifest.sourceFingerprint, startedAt: new Date().toISOString(), checks: ['All package SHA256 checksums match'], checksums: { native: hash(path.join(root, 'scam_native.node')), backend: hash(path.join(root, 'dist_back/skymp5-server.js')), frontend: hash(path.join(root, 'ui/build.js')) } };
if (manifest.installationMode === 'first-run') report.checks.push('No shipped credentials; real HTTP setup with terminal PIN creates own scrypt account; noninteractive startup and repeated startup preserve the account');
const preflight = spawnSync(process.execPath, ['check-install.cjs'], { cwd: root, encoding: 'utf8', timeout: 30000 });
assert.equal(preflight.status, 0, `Shipped preflight failed: ${preflight.stdout}\n${preflight.stderr}`);
report.checks.push('Shipped preflight accepts the native platform and five real master files');
const child = spawn(process.execPath, ['dist_back/skymp5-server.js'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
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
    let response;
    const deadline = Date.now() + 180000;
    while (Date.now() < deadline && !exited) {
      try { response = await request('/admin'); if (response.ok) break; } catch {}
      await sleep(500);
    }
    assert(response?.ok, 'Server did not serve /admin within 180 seconds');
    assert((await response.text()).includes('SkyMP Admin Login'));
    report.checks.push('Native server starts with the shipped configuration and five real masters');
    const asset = await request('/build.js');
    assert.equal(asset.status, 200);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(await asset.arrayBuffer())).digest('hex'), report.checksums.frontend);
    report.checks.push('Production frontend is served unchanged');
    const publication = await request('/api/launcher/manifest');
    assert.equal(publication.status, 200);
    const modManifest = await publication.json();
    assert.equal(modManifest.version, '2');
    assert.deepEqual(modManifest.loadOrder, settings.loadOrder);
    assert.deepEqual(modManifest.requiredLocalFiles.map(file => file.filename), settings.loadOrder);
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
    const session = await request('/api/admin/session', { headers: { cookie } });
    assert.equal(session.status, 200);
    const current = await session.json(); assert.equal(current.authenticated, true); assert.equal(current.user, user);
    report.checks.push('Shipped admin credentials authenticate; incorrect password is rejected');
    await checkUdp(); report.checks.push('Native UDP game socket is bound');
    assert(output.includes('Master server heartbeat is disabled in offline mode'));
    report.checks.push('Offline startup does not publish a master-server heartbeat');
    report.ok = true;
  } catch (error) { report.ok = false; report.error = error.stack; }
  finally {
    if (!exited) { child.kill('SIGTERM'); await sleep(3000); }
    report.stoppedAfterSigterm = exited;
    if (!exited) { child.kill('SIGKILL'); await sleep(500); }
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(reportFile.replace(/\.json$/, '') + '-server.log', output);
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
