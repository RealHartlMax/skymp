// Upgrade a disposable existing installation with the program-only ZIP.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { isUpdatePath, isPreservedPath } = require('../deploy/package_server_distributions.cjs');
const options = {}, args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) { assert(args[i].startsWith('--') && args[i + 1]); options[args[i].slice(2)] = args[i + 1]; }
for (const name of ['previous-package', 'update-package', 'workspace', 'game-data', 'report']) assert(options[name], name);
const root = path.resolve(options.workspace), update = path.resolve(options['update-package']);
assert(['linux', 'win32'].includes(process.platform)); assert(!fs.existsSync(root));
const manifest = JSON.parse(fs.readFileSync(path.join(update, 'build-manifest.json')));
assert.equal(manifest.distributionMode, 'update'); assert.equal(manifest.requiresExistingInstallation, true);
for (const file of manifest.files) assert(isUpdatePath(file.path) && !isPreservedPath(file.path));
fs.cpSync(path.resolve(options['previous-package']), root, { recursive: true });
const write = (name, content) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const settings = JSON.parse(fs.readFileSync(path.join(root, 'server-settings.json')));
Object.assign(settings, { port: 37777, uiPort: 38080, listenHost: '127.0.0.1', uiListenHost: '127.0.0.1', serverUid: 'update-preserved-instance', operatorMarker: { retained: true } });
write('server-settings.json', JSON.stringify(settings));
for (const master of settings.loadOrder) fs.copyFileSync(path.join(options['game-data'], master), path.join(root, settings.dataDir, master));
const user = 'update-admin', password = crypto.randomBytes(24).toString('hex');
require(path.join(root, 'setup-server.cjs')).configure(root, { serverName: 'Preserved Update Server', port: 37777, uiPort: 38080, maxPlayers: 7, access: 'local', adminUser: user, password, passwordConfirm: password });
fs.appendFileSync(path.join(root, 'gamemode.js'), '\n// custom operator gamemode must survive the update\n');
write('data/player-access.json', JSON.stringify({ version: 1, nextProfileId: 2000000000, principals: {}, sessions: {}, tickets: {}, accounts: {}, operatorMarker: 'preserve' }));
write('data/operator-data.txt', 'preserved application data'); write('world/operator-backup.txt', 'preserved world data');
write('client-resources/Data/textures/update-keep.dds', 'preserved custom mod'); write('.env', 'SKYMP_UPDATE_TEST=preserved\n');
write('.runtime/operator-marker.txt', 'preserved runtime'); write('logs/operator-marker.txt', 'preserved log');
// Root images are operator-owned; defaults in server-assets/ must not replace them.
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aOucAAAAASUVORK5CYII=', 'base64');
write('logo.png', Buffer.concat([image, Buffer.from('custom logo')]));
write('banner.png', Buffer.concat([image, Buffer.from('custom banner')]));
const protectedFiles = new Map();
function snapshot(directory) { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name); if (entry.isDirectory()) snapshot(file); else if (entry.isFile()) { const name = path.relative(root, file).split(path.sep).join('/'); if (isPreservedPath(name)) protectedFiles.set(name, hash(file)); } } }
snapshot(root);
fs.cpSync(update, root, { recursive: true });
const verifyPreserved = () => { for (const [name, expected] of protectedFiles) assert.equal(hash(path.join(root, name)), expected, 'Update changed ' + name); };
verifyPreserved(); for (const file of manifest.files) assert.equal(hash(path.join(root, file.path)), file.sha256, file.path);
const ensure = spawnSync(process.execPath, ['setup-server.cjs', '--ensure'], { cwd: root, encoding: 'utf8', timeout: 30000 });
assert.equal(ensure.status, 0, ensure.stderr); assert(!ensure.stdout.includes('Einrichtungscode:')); verifyPreserved();
const report = { ok: false, previousBuild: JSON.parse(fs.readFileSync(path.join(options['previous-package'], 'build-manifest.json'))).buildId, buildId: manifest.buildId, sourceFingerprint: manifest.sourceFingerprint, preservedFiles: protectedFiles.size, checks: ['ZIP overlay preserves settings, admin credentials, Steam store, scripts, masters, world data, mods, gamemode, package files, environment, runtime and logs', 'Existing installation starts without PIN setup or configuration replacement'] };
let output = '', finished = false;
const child = process.platform === 'win32'
  ? spawn(process.execPath, ['server-supervisor.cjs'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] })
  : spawn(path.join(root, 'start-test-server.sh'), [], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
const exited = new Promise(resolve => { child.once('exit', (code, signal) => { finished = true; resolve({ code, signal }); }); child.once('error', error => { finished = true; resolve({ error: error.message }); }); });
child.stdout.on('data', data => { output += data; }); child.stderr.on('data', data => { output += data; });
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const base = 'http://127.0.0.1:38080';
const request = (route, values = {}) => fetch(base + route, { ...values, signal: AbortSignal.timeout(5000) });
(async () => {
  try {
    const deadline = Date.now() + 60000;
    while (!output.includes('Initialized MovementDebugLogSystem') && !finished && Date.now() < deadline) await sleep(100);
    assert(!finished && output.includes('Initialized MovementDebugLogSystem'), 'Updated game systems did not initialize'); assert(!output.includes('unhandledRejection'));
    assert.equal((await (await request('/api/admin/setup/status')).json()).needsSetup, false);
    const login = await request('/api/admin/session/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ user, password }) });
    assert.equal(login.status, 200); const cookie = login.headers.get('set-cookie').split(';')[0];
    const frontend = await request('/build.js'); assert.equal(frontend.status, 200);
    assert.equal(crypto.createHash('sha256').update(Buffer.from(await frontend.arrayBuffer())).digest('hex'), hash(path.join(root, 'ui/build.js')));
    const policy = await (await request('/api/launcher/auth-policy')).json(); assert.equal(policy.version, 2); assert.match(policy.ticketIdentity, /^skymp[a-f0-9]{24}$/);
    const resource = await (await request('/api/launcher/manifest')).json(); assert(JSON.stringify(resource).includes('update-keep.dds'));
    const branding = await (await request('/api/launcher/assets')).json();
    for (const name of ['logo', 'banner']) assert.equal(branding.assets[name].sha256, hash(path.join(root, name + '.png')));
    report.checks.push('Custom root logo and banner remain byte-identical and take precedence over new packaged defaults');
    report.checks.push('Updated native server and dashboard start with the old account, custom gamemode, Steam policy, new UI and preserved mod publication');
    const state = async () => (await request('/api/admin/supervisor/state', { headers: { cookie } })).json();
    const before = await state(); assert.equal(before.state, 'running');
    const control = action => request('/api/admin/server/control', { method: 'POST', headers: { cookie, origin: base, 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
    const waitState = async (wanted, oldPid) => { const limit = Date.now() + 60000; while (Date.now() < limit) { const current = await state(); if (current.state === wanted && (!oldPid || current.pid !== oldPid)) return current; await sleep(100); } assert.fail('Game state did not reach ' + wanted); };
    assert.equal((await control('stop')).status, 200); const stopped = await waitState('stopped'); assert.equal(stopped.dashboardPid, before.dashboardPid);
    assert.equal((await request('/api/admin/cfg/server-settings', { headers: { cookie } })).status, 200);
    assert.equal((await control('start')).status, 200); const running = await waitState('running', before.pid); assert.equal(running.dashboardPid, before.dashboardPid);
    assert.equal((await request('/api/admin/session', { headers: { cookie } })).status, 200);
    verifyPreserved(); assert(!output.includes('unhandledRejection'));
    report.checks.push('Game stop/start retains the updated dashboard PID and original session; all protected files remain byte-identical');
    report.ok = true;
  } catch (error) { report.error = error.stack; }
  finally {
    if (!finished) child.kill('SIGTERM');
    let exit = await Promise.race([exited, sleep(15000).then(() => null)]);
    report.stoppedAfterSigterm = Boolean(exit);
    if (!exit) { child.kill('SIGKILL'); exit = await exited; }
    report.exit = exit; report.finishedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(options.report), { recursive: true }); fs.writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n');
    fs.writeFileSync(options.report.replace(/\.json$/, '-server.log'), output);
    console.log(JSON.stringify(report)); if (!report.ok || !report.stoppedAfterSigterm) process.exitCode = 1;
  }
})();
