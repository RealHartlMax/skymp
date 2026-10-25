// Assemble both CI package layouts with synthetic native headers; no game or
// Discord session. Actual native binaries are qualified by test_server_package.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { packageCiServer } = require('../deploy/package_ci_server.cjs');
const yaml = require('../../skymp5-front/node_modules/js-yaml');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-ci-package-test-'));
const checks = [];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
try {
  const sourceArchive = zlib.gzipSync(Buffer.from('synthetic CI source snapshot'));
  const readGit = args => {
    if (args[0] === 'status') return Buffer.from('');
    if (args[0] === 'rev-parse') return Buffer.from('a'.repeat(40));
    assert.deepEqual(args, ['archive', '--format=tar.gz', 'HEAD']); return sourceArchive;
  };
  for (const platform of ['linux-x64', 'windows-x64']) {
    const source = path.join(root, platform, 'input'); fs.mkdirSync(path.join(source, 'dist_back'), { recursive: true });
    fs.mkdirSync(path.join(source, 'ui')); fs.mkdirSync(path.join(source, 'data/scripts'), { recursive: true });
    for (const name of ['skymp5-server.js', 'skymp5-admin.js', 'skymp5-server.js.map', 'skymp5-admin.js.map']) fs.writeFileSync(path.join(source, 'dist_back', name), 'fixture only');
    for (const name of ['build.js', 'index.html']) fs.writeFileSync(path.join(source, 'ui', name), 'fixture only');
    fs.writeFileSync(path.join(source, 'data/scripts/Test.pex'), 'fixture only');
    fs.writeFileSync(path.join(source, 'scam_native.node'), Buffer.from(platform === 'linux-x64' ? '7f454c46' : '4d5a0000', 'hex'));
    fs.writeFileSync(path.join(source, 'gamemode.js'), '// fixture');
    for (const name of ['package.json', 'package-lock.json']) fs.writeFileSync(path.join(source, name), '{}');
    fs.writeFileSync(path.join(source, 'data/Skyrim.esm'), 'must stay in input');
    fs.writeFileSync(path.join(source, 'data/admin-auth.json'), 'must never be published');
    const output = path.join(root, platform, 'release');
    const result = packageCiServer({ platform, version: 'v1.10.0', source, output, readGit });
    const target = result.output, manifest = JSON.parse(fs.readFileSync(path.join(target, 'build-manifest.json')));
    assert.equal(manifest.installationMode, 'first-run'); assert.equal(manifest.dashboardIndependent, true); assert.equal(manifest.discordHostedBy, 'dashboard');
    assert.equal(manifest.sourceDirty, false); assert.equal(manifest.sourceFingerprint, hash(sourceArchive));
    assert.deepEqual(fs.readFileSync(result.sourceArchive), sourceArchive);
    assert(fs.readFileSync(path.join(target, 'QUELLSTAND.txt'), 'utf8').includes(path.basename(result.sourceArchive)));
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'release-info.json'))).version, 'v1.10.0');
    for (const name of ['server-supervisor.cjs', 'DISCORD-BOT.md', 'UPDATE-VPS.md', 'setup-web.cjs', 'check-install.cjs']) assert(fs.existsSync(path.join(target, name)), name);
    for (const file of manifest.files) assert.equal(hash(fs.readFileSync(path.join(target, file.path))), file.sha256, file.path);
    assert(!fs.existsSync(path.join(target, 'data/admin-auth.json'))); assert(!fs.existsSync(path.join(target, 'data/Skyrim.esm')));
    assert(fs.existsSync(path.join(source, 'data/Skyrim.esm')), 'Packaging must not delete input game files');
    assert.equal(JSON.parse(fs.readFileSync(path.join(target, 'server-settings.json'))).discordBot.enabled, false);
    checks.push(platform + ': full first-run runtime, independent dashboard/bot, source archive/checksums and release metadata; credentials and game masters excluded');
  }
  assert.throws(() => packageCiServer({ platform: 'linux-x64', version: 'v1.10.0', source: path.join(root, 'linux-x64/input'), output: path.join(root, 'dirty'), readGit: () => Buffer.from(' M source.ts') }), /tracked modifications/);
  assert(!fs.existsSync(path.join(root, 'dirty')));
  const workflow = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../.github/workflows/running_server_files.yml'), 'utf8'));
  for (const name of ['windows-server-files', 'linux-server-files']) {
    const steps = workflow.jobs[name].steps;
    assert(steps.some(step => step.run?.includes('package_ci_server.cjs')));
    assert(steps.some(step => step.with?.path?.includes('ci-server/*-source.tar.gz')));
  }
  assert(workflow.jobs['release-server-files'].steps.at(-1).with.files.includes('*-source.tar.gz'));
  checks.push('Dirty sources are rejected before writing output; workflow YAML stages both complete packages and publishes their corresponding source archives');
  console.log(JSON.stringify({ ok: true, platform: process.platform, checks, nativeStarted: false, githubActionsExecuted: false }));
} finally {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith('skymp-ci-package-test-'));
  fs.rmSync(root, { recursive: true, force: true });
}
