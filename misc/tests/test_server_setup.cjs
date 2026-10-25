const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { configure, isConfigured, validate } = require('../deploy/test-server/setup-server.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-setup-'));
let checks = 0;
const base = { name: 'Before', dataDir: 'data', loadOrder: ['Skyrim.esm'], offlineMode: true, customGamemode: { keep: true }, adminApi: { rateLimit: 7 }, adminUiUsers: { moderator: { role: 'moderator' } } };
const input = { serverName: 'My VPS', port: 7777, uiPort: 8080, maxPlayers: 16, access: 'public', publicHost: '203.0.113.10', adminUser: 'owner', password: 'Only-For-Setup-Testing!2026', passwordConfirm: 'Only-For-Setup-Testing!2026' };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function fixture(name) {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'world'));
  fs.writeFileSync(path.join(dir, 'world', 'keep.json'), '{"actor":42}');
  fs.writeFileSync(path.join(dir, 'server-settings.json'), JSON.stringify(base));
  return dir;
}
try {
  for (const invalid of [
    { passwordConfirm: 'wrong' }, { password: 'short', passwordConfirm: 'short' },
    { adminUser: 'ab' }, { publicHost: 'http://example.com:8080/admin' },
    { publicHost: '0.0.0.0' }, { publicHost: '999.999.999.999' },
    { port: 0 }, { port: 65536 }, { uiPort: '8080x' }, { maxPlayers: 1.5 },
    { access: 'unknown' }, { serverName: '' },
  ]) {
    const dir = fixture('invalid-' + checks);
    assert.throws(() => configure(dir, { ...input, ...invalid }));
    assert.deepEqual(read(path.join(dir, 'server-settings.json')), base);
    assert(!fs.existsSync(path.join(dir, 'data/admin-auth.json')));
    checks++;
  }
  const dir = fixture('public');
  assert.equal(isConfigured(dir, base), false);
  const result = configure(dir, input);
  assert.equal(result.dashboard, 'http://203.0.113.10:8080/admin');
  const settings = read(path.join(dir, 'server-settings.json'));
  assert.equal(settings.listenHost, '0.0.0.0');
  assert.equal(settings.uiListenHost, '0.0.0.0');
  assert.equal(settings.adminUiMasterUser, 'owner');
  assert.equal(settings.masterKey, '', 'Guest setup must not invent an unregistered master-server credential');
  assert.equal(settings.adminUiUsers.owner.role, 'admin');
  assert.equal(settings.adminUiUsers.moderator.role, 'moderator');
  assert.equal(settings.adminApi.rateLimit, 7);
  assert.deepEqual(settings.customGamemode, base.customGamemode);
  assert.equal(fs.readFileSync(path.join(dir, 'world/keep.json'), 'utf8'), '{"actor":42}');
  assert.equal(isConfigured(dir, settings), true);
  const auth = read(path.join(dir, 'data/admin-auth.json'));
  const [algorithm, n, r, p, salt, hash] = auth.passwordHash.split('$');
  assert.equal(algorithm, 'scrypt-v1');
  assert.equal(crypto.scryptSync(input.password, salt, 64, { N: +n, r: +r, p: +p }).toString('hex'), hash);
  assert(!JSON.stringify(settings).includes(input.password));
  assert(!fs.readFileSync(path.join(dir, 'VERBINDUNG.txt'), 'utf8').includes(input.password));
  assert(!fs.readFileSync(path.join(dir, 'skymp5-client-settings.example.txt'), 'utf8').includes(input.password));
  assert(!fs.readFileSync(path.join(dir, 'skymp5-client-settings.example.txt'), 'utf8').includes('profileId'), 'Exported address examples must not recommend a client-selected identity');
  if (process.platform !== 'win32') assert.equal(fs.statSync(path.join(dir, 'data/admin-auth.json')).mode & 0o777, 0o600);
  const beforeSettings = fs.readFileSync(path.join(dir, 'server-settings.json'));
  const beforeAuth = fs.readFileSync(path.join(dir, 'data/admin-auth.json'));
  assert.throws(() => configure(dir, { ...input, adminUser: 'changed' }), /bereits eingerichtet/);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'server-settings.json')), beforeSettings);
  assert.deepEqual(fs.readFileSync(path.join(dir, 'data/admin-auth.json')), beforeAuth);
  assert(!fs.existsSync(path.join(dir, '.setup.lock')));
  checks++;
  for (const access of ['private', 'local']) {
    const target = fixture(access);
    configure(target, { ...input, access });
    const saved = read(path.join(target, 'server-settings.json'));
    assert.equal(saved.uiListenHost, '127.0.0.1');
    assert.equal(saved.listenHost, access === 'local' ? '127.0.0.1' : '0.0.0.0');
    checks++;
  }
  assert.equal(validate({ ...input, port: 8080 }).port, 8080, 'UDP and TCP may share a number'); checks++;
  const unsafe = fixture('outside');
  fs.writeFileSync(path.join(unsafe, 'server-settings.json'), JSON.stringify({ ...base, dataDir: '../outside-data' }));
  assert.throws(() => configure(unsafe, input), /innerhalb/);
  assert(!fs.existsSync(path.join(root, 'outside-data'))); checks++;
  const corrupt = fixture('corrupt');
  fs.writeFileSync(path.join(corrupt, 'data/admin-auth.json'), '{"user":"keep"}');
  assert.throws(() => configure(corrupt, input), /ungueltig/);
  assert.deepEqual(read(path.join(corrupt, 'data/admin-auth.json')), { user: 'keep' }); checks++;
  const cli = fixture('cli');
  fs.copyFileSync(path.resolve(__dirname, '../deploy/test-server/setup-server.cjs'), path.join(cli, 'setup-server.cjs'));
  fs.copyFileSync(path.resolve(__dirname, '../deploy/test-server/launcher-connection.cjs'), path.join(cli, 'launcher-connection.cjs'));
  fs.writeFileSync(path.join(cli, 'build-manifest.json'), JSON.stringify({ nodeMinimum: 22, installationMode: 'first-run', platform: `${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}` }));
  assert(!fs.existsSync(path.join(cli, 'data/admin-auth.json')));
  fs.writeFileSync(path.join(cli, 'answers.json'), JSON.stringify(input), { mode: 0o600 });
  const setup = spawnSync(process.execPath, ['setup-server.cjs', '--config', 'answers.json'], { cwd: cli, encoding: 'utf8' });
  assert.equal(setup.status, 0, setup.stderr);
  assert(!setup.stdout.includes(input.password));
  fs.unlinkSync(path.join(cli, 'answers.json'));
  const restart = spawnSync(process.execPath, ['setup-server.cjs', '--ensure'], { cwd: cli, encoding: 'utf8' });
  assert.equal(restart.status, 0, restart.stderr);
  assert.equal(restart.stdout, ''); checks++;
  console.log(JSON.stringify({ ok: true, platform: process.platform, checks, scope: 'configuration validation, scrypt, data preservation, repeat startup, explicit provisioning interface' }));
} finally {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert(path.basename(root).startsWith('skymp-setup-'));
  fs.rmSync(root, { recursive: true, force: true });
}
