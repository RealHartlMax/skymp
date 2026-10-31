const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { createDistributions, isUpdatePath } = require('../deploy/package_server_distributions.cjs');
assert.equal(process.platform, 'win32', 'ZIP creation fixture uses the Windows archive helper; Linux extraction is tested separately');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-distribution-test-'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (base, name, value) => { const file = path.join(base, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
function extract(archive, target) {
  const result = spawnSync(path.join(process.env.ProgramFiles, 'PowerShell/7/pwsh.exe'), ['-NoProfile', '-NonInteractive', '-File', path.resolve(__dirname, '../deploy/zip_archive.ps1'), '-Action', 'Extract', '-Source', archive, '-Destination', target], { encoding: 'utf8', timeout: 30000 });
  assert.equal(result.status, 0, result.stderr);
}
try {
  const source = path.join(root, 'source'), output = path.join(root, 'output');
  const contents = {
    'server-settings.json': JSON.stringify({ name: 'new install', playerAccess: { steamApiKey: '' } }),
    'gamemode.js': '// default gamemode', 'package.json': '{}', 'package-lock.json': '{}',
    'logo.png': 'default root logo', 'banner.png': 'default root banner',
    'server-assets/logo.png': 'default logo', 'server-assets/banner.png': 'default banner',
    'data/scripts/ActiveMagicEffect.pex': 'default script', 'data/SPIELDATEN.txt': 'own masters required',
    'scam_native.node': 'ELF fixture', 'dist_back/skymp5-server.js': '// new game backend', 'dist_back/skymp5-admin.js': '// new dashboard backend',
    'ui/build.js': '// new frontend', 'ui/index.html': '<html></html>', 'setup-ui/setup.js': '// setup', 'supervisor-ui/app.js': '// control',
    'start-test-server.sh': '#!/bin/sh\nexit 0\n', 'launch_server.sh': '#!/bin/sh\nexit 0\n', 'bootstrap-runtime.sh': '#!/bin/sh\n',
    'UPDATE-VPS.md': 'Stop whole service, overlay update, start service', 'DASHBOARD.md': 'Dashboard and scheduled game restarts', 'release-info.json': '{}', 'README-TEST.md': 'Browser setup', 'LICENSE': 'license',
  };
  for (const [name, value] of Object.entries(contents)) write(source, name, value);
  const manifest = { buildId: 'skymp-server-fixture', installationMode: 'first-run', platform: 'linux-x64', sourceFingerprint: 'f'.repeat(64), runtimeDependenciesBundled: true, files: Object.keys(contents).map(name => ({ path: name, bytes: fs.statSync(path.join(source, name)).size, sha256: hash(path.join(source, name)) })) };
  write(source, 'build-manifest.json', JSON.stringify(manifest));
  write(source, 'data/admin-auth.json', 'unlisted private file must never be copied');
  write(source, '.env', 'unlisted private environment');
  const result = createDistributions({ source, output });
  assert.equal(result.ok, true); assert.equal(result.artifacts.length, 2);
  for (const artifact of result.artifacts) {
    assert.equal(hash(path.join(output, artifact.file)), artifact.sha256);
    for (const entry of artifact.entries) if (!entry.directory) assert.equal(entry.unixMode & 0o777, entry.path.endsWith('.sh') || entry.path === 'scam_native.node' ? 0o755 : 0o644);
  }
  const full = result.artifacts.find(item => item.mode === 'full'), update = result.artifacts.find(item => item.mode === 'update');
  const fullRoot = path.join(root, 'full'), updateRoot = path.join(root, 'update');
  extract(path.join(output, full.file), fullRoot); extract(path.join(output, update.file), updateRoot);
  assert(fs.existsSync(path.join(fullRoot, 'server-settings.json'))); assert(fs.existsSync(path.join(fullRoot, 'gamemode.js')));
  assert(fs.existsSync(path.join(fullRoot, 'data/scripts/ActiveMagicEffect.pex')));
  for (const name of ['logo.png', 'banner.png']) {
    assert(fs.existsSync(path.join(fullRoot, name)));
    assert(!fs.existsSync(path.join(updateRoot, name)));
    assert.equal(fs.readFileSync(path.join(updateRoot, 'server-assets', name), 'utf8'), contents['server-assets/' + name]);
  }
  assert(!fs.existsSync(path.join(fullRoot, 'data/admin-auth.json'))); assert(!fs.existsSync(path.join(fullRoot, '.env')));
  for (const file of update.files) assert(isUpdatePath(file.path));
  for (const name of ['server-settings.json', 'data', 'world', 'client-resources', 'gamemode.js', 'package.json', 'package-lock.json', '.env']) assert(!fs.existsSync(path.join(updateRoot, name)), name);
  const existing = path.join(root, 'existing');
  const privateFiles = { 'server-settings.json': '{"existing":true}', 'data/admin-auth.json': 'existing admin hash', 'data/player-access.json': 'existing Steam approvals', 'data/scripts/own.pex': 'custom script', 'world/actor.json': 'world data', 'client-resources/Data/mod.esp': 'own mod', 'gamemode.js': 'own gamemode', 'package.json': 'own dependencies', 'package-lock.json': 'own lockfile', 'plugins/own.js': 'own plugin', '.runtime/bin/node': 'private runtime', '.env': 'private environment', 'logs/server.log': 'existing logs' };
  for (const [name, value] of Object.entries(privateFiles)) write(existing, name, value);
  Object.assign(privateFiles, { 'logo.png': 'custom logo', 'banner.png': 'custom banner' });
  for (const name of ['logo.png', 'banner.png']) write(existing, name, privateFiles[name]);
  write(existing, 'dist_back/skymp5-server.js', '// old backend');
  fs.cpSync(updateRoot, existing, { recursive: true });
  for (const [name, value] of Object.entries(privateFiles)) assert.equal(fs.readFileSync(path.join(existing, name), 'utf8'), value, name);
  assert.equal(fs.readFileSync(path.join(existing, 'dist_back/skymp5-server.js'), 'utf8'), contents['dist_back/skymp5-server.js']);
  const updatedManifest = JSON.parse(fs.readFileSync(path.join(existing, 'build-manifest.json')));
  assert.equal(updatedManifest.distributionMode, 'update'); assert.equal(updatedManifest.requiresExistingInstallation, true);
  assert(updatedManifest.files.every(file => isUpdatePath(file.path)));
  assert.throws(() => createDistributions({ source, output }), /Refusing to overwrite/);
  write(source, 'ui/build.js', 'changed after manifest');
  assert.throws(() => createDistributions({ source, output: path.join(root, 'changed-output') }), /Source package changed|Assertion/);
  console.log(JSON.stringify({ ok: true, checks: ['Two flat Linux ZIPs with independent archive extraction and Unix executable metadata', 'Full ZIP includes first-run defaults and scripts, without unlisted private files', 'Update overlay replaces both backends and UI while preserving settings, admin, Steam, scripts, world, mods, gamemode, packages, plugins, runtime and logs', 'Update manifest covers only supplied program files; changed source and output overwrites are rejected'] }));
} finally {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith('skymp-distribution-test-'));
  fs.rmSync(root, { recursive: true, force: true });
}
