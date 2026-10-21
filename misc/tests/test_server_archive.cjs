// node ../misc/tests/test_server_archive.cjs ARCHIVE PLATFORM NEW_EXTRACTION_DIRECTORY
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const zlib = require('node:zlib');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const [archiveArg, platform, outputArg] = process.argv.slice(2);
assert(archiveArg && platform && outputArg, 'Expected ARCHIVE PLATFORM NEW_EXTRACTION_DIRECTORY');
const archive = path.resolve(archiveArg), output = path.resolve(outputArg);
assert(!fs.existsSync(output), 'Refusing to overwrite archive verification output');
fs.mkdirSync(output, { recursive: true });
let extracted;
if (archive.endsWith('.zip') && process.platform === 'win32') {
  extracted = spawnSync(path.join(process.env.ProgramFiles, 'PowerShell/7/pwsh.exe'), ['-NoProfile', '-NonInteractive', '-File', path.resolve(__dirname, '../deploy/zip_archive.ps1'), '-Action', 'Extract', '-Source', archive, '-Destination', output], { encoding: 'utf8', timeout: 60000 });
} else if (archive.endsWith('.gz')) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-archive-check-'));
  try {
    const raw = path.join(temporary, 'server.tar');
    fs.writeFileSync(raw, zlib.gunzipSync(fs.readFileSync(archive)));
    if (process.platform === 'win32') {
      extracted = spawnSync(path.join(process.env.ProgramFiles, 'PowerShell/7/pwsh.exe'), ['-NoProfile', '-NonInteractive', '-File', path.resolve(__dirname, '../deploy/tar_archive.ps1'), '-Action', 'Extract', '-Source', raw, '-Destination', output], { encoding: 'utf8', timeout: 60000 });
    } else extracted = spawnSync('tar', ['-xf', raw, '-C', output], { encoding: 'utf8', timeout: 60000 });
  } finally {
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    assert(path.basename(temporary).startsWith('skymp-archive-check-'));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
} else extracted = spawnSync('tar', ['-xf', archive, '-C', output], { encoding: 'utf8', timeout: 60000 });
assert.equal(extracted.status, 0, extracted.stderr || extracted.error?.message);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'build-manifest.json'), 'utf8'));
assert.equal(manifest.platform, platform);
for (const entry of manifest.files) {
  assert(!path.isAbsolute(entry.path) && !entry.path.split('/').includes('..'));
  assert.equal(hash(path.join(output, entry.path)), entry.sha256, entry.path);
}
const release = path.dirname(archive);
const metadata = JSON.parse(fs.readFileSync(path.join(release, 'build-metadata.json'), 'utf8'));
assert.equal(manifest.sourceFingerprint, metadata.sourceFingerprint);
assert.equal(hash(path.join(release, metadata.buildId + '-source.tar.gz')), metadata.sourceFingerprint);
if (manifest.installationMode === 'first-run') {
  assert(!fs.existsSync(path.join(output, 'TEST-ZUGANG.txt')));
  assert(!fs.existsSync(path.join(output, 'data/admin-auth.json')));
  assert(fs.existsSync(path.join(output, 'setup-server.cjs')));
  assert.equal(manifest.setupMethod, 'browser-pin');
  for (const name of ['setup-web.cjs', 'setup-ui/setup.html', 'setup-ui/setup.js', 'setup-ui/setup.css']) assert(fs.existsSync(path.join(output, name)), `Missing browser setup: ${name}`);
}
const settings = JSON.parse(fs.readFileSync(path.join(output, 'server-settings.json'), 'utf8'));
for (const name of settings.loadOrder) assert(!fs.existsSync(path.join(output, settings.dataDir, name)), 'Game master included in archive');
const report = { ok: true, archive: path.basename(archive), platform, installationMode: manifest.installationMode, bytes: fs.statSync(archive).size, sha256: hash(archive), files: manifest.files.length, sourceFingerprint: manifest.sourceFingerprint, runtimeSourceFingerprint: manifest.runtimeSourceFingerprint };
fs.writeFileSync(path.join(release, platform + '-archive-verification.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
