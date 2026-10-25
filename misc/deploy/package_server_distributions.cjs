#!/usr/bin/env node
// Convert a verified first-run package into separate full and non-destructive update ZIPs.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');

const preservedPaths = ['server-settings.json', 'logo.png', 'banner.png', 'data/', 'world/', 'client-resources/', 'plugins/', 'mods/', 'gamemode.js', 'package.json', 'package-lock.json', '.runtime/', '.env', 'logs/'];
const programFiles = new Set(['build-manifest.json', 'scam_native.node', 'server-supervisor.cjs', 'setup-server.cjs', 'setup-web.cjs', 'launcher-connection.cjs', 'check-install.cjs', 'start-test-server.sh', 'launch_server.sh', 'bootstrap-runtime.sh', 'start-test-server.bat', 'start-test-server.cmd', 'launch_server.bat', 'bootstrap-runtime.ps1', 'release-info.json', 'QUELLSTAND.txt', 'README-TEST.md', 'DISCORD-BOT.md', 'INGAME-LOGIN.md', 'PORTS-VPS.md', 'UPDATE-VPS.md', 'LICENSE', 'THIRD_PARTY_LICENSES']);
const isUpdatePath = name => programFiles.has(name) || name === 'MOD-LOAD-ORDER.md' || /^(?:dist_back|ui|setup-ui|supervisor-ui)\//.test(name) || /^server-assets\/(?:logo|banner)\.png$/.test(name);
const isPreservedPath = name => preservedPaths.some(item => item.endsWith('/') ? name.startsWith(item) : name === item);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
function safePath(name) {
  assert(typeof name === 'string' && name.length && !/[\\\x00-\x1f]/.test(name) && !path.posix.isAbsolute(name) && !path.win32.isAbsolute(name) && path.posix.normalize(name) === name && !name.split('/').includes('..'), 'Invalid package path: ' + name);
}
function zipMetadata(file, platform) {
  const buffer = fs.readFileSync(file);
  let end = -1;
  for (let at = buffer.length - 22; at >= Math.max(0, buffer.length - 65557); at--) {
    if (buffer.readUInt32LE(at) === 0x06054b50 && at + 22 + buffer.readUInt16LE(at + 20) === buffer.length) { end = at; break; }
  }
  assert(end >= 0, 'ZIP directory missing');
  const count = buffer.readUInt16LE(end + 10);
  assert(count !== 65535 && buffer.readUInt16LE(end + 4) === 0 && buffer.readUInt16LE(end + 6) === 0, 'ZIP64 or split archives are not supported');
  let offset = buffer.readUInt32LE(end + 16);
  const entries = [];
  for (let i = 0; i < count; i++) {
    assert.equal(buffer.readUInt32LE(offset), 0x02014b50, 'Invalid ZIP directory');
    const length = buffer.readUInt16LE(offset + 28), extra = buffer.readUInt16LE(offset + 30), comment = buffer.readUInt16LE(offset + 32);
    const name = buffer.subarray(offset + 46, offset + 46 + length).toString('utf8');
    safePath(name.endsWith('/') ? name.slice(0, -1) : name);
    const directory = name.endsWith('/');
    if (platform === 'linux-x64') {
      const mode = directory ? 0o40755 : name.endsWith('.sh') || name === 'scam_native.node' ? 0o100755 : 0o100644;
      // .NET on Windows writes DOS-host ZIPs. Mark Unix ownership and modes so
      // Linux unzip also restores executable starters without a chmod step.
      buffer.writeUInt16LE(0x0314, offset + 4);
      buffer.writeUInt32LE((mode * 65536 + (directory ? 16 : 0)) >>> 0, offset + 38);
    }
    entries.push({ path: name, unixMode: buffer.readUInt32LE(offset + 38) >>> 16, directory });
    offset += 46 + length + extra + comment;
  }
  assert.equal(offset, end, 'Unexpected ZIP directory layout');
  fs.writeFileSync(file, buffer);
  return entries;
}
function makeZip(source, destination, platform) {
  const windows = process.platform === 'win32';
  const command = windows ? path.join(process.env.ProgramFiles, 'PowerShell/7/pwsh.exe') : 'zip';
  const args = windows ? ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'zip_archive.ps1'), '-Action', 'Create', '-Source', source, '-Destination', destination] : ['-qr', destination, '.'];
  const result = spawnSync(command, args, { cwd: source, encoding: 'utf8', timeout: 120000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'ZIP creation failed');
  return zipMetadata(destination, platform);
}
function createDistributions(options) {
  assert(options.source && options.output, 'Expected --source DIR --output DIR');
  const source = path.resolve(options.source), output = path.resolve(options.output);
  assert(output !== source && !output.startsWith(source + path.sep), 'Output must be outside the source package');
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'build-manifest.json'), 'utf8'));
  assert.equal(manifest.installationMode, 'first-run', 'Use an unconfigured first-run package');
  assert.equal(manifest.runtimeDependenciesBundled, true);
  assert(['linux-x64', 'windows-x64'].includes(manifest.platform));
  assert(/^[a-zA-Z0-9._-]+$/.test(manifest.buildId));
  const names = new Set();
  for (const file of manifest.files) {
    safePath(file.path); assert(!names.has(file.path), 'Duplicate file'); names.add(file.path);
    assert(isUpdatePath(file.path) || isPreservedPath(file.path), 'Unclassified runtime file: ' + file.path);
    assert(!/^(?:data\/(?!scripts\/[^/]+\.pex$|SPIELDATEN\.txt$)|client-resources\/(?!README\.md$)|world\/|plugins\/|mods\/|\.runtime\/|logs\/|\.env$|TEST-ZUGANG\.txt$)/.test(file.path), 'Private file in first-run package: ' + file.path);
    const input = path.join(source, file.path); assert(fs.lstatSync(input).isFile(), 'Only regular package files are accepted');
    assert.equal(fs.statSync(input).size, file.bytes); assert.equal(hash(input), file.sha256, 'Source package changed: ' + file.path);
  }
  for (const required of ['server-settings.json', 'gamemode.js', 'package.json', 'scam_native.node', 'dist_back/skymp5-server.js', 'dist_back/skymp5-admin.js', 'ui/build.js', 'UPDATE-VPS.md']) assert(names.has(required), 'Missing full package file: ' + required);
  const settings = JSON.parse(fs.readFileSync(path.join(source, 'server-settings.json'), 'utf8'));
  assert(!settings.playerAccess?.steamApiKey && !settings.steam_webApiKey && !settings.masterKey && !settings.discordBot?.token && !settings.discordAuth?.token && !settings.adminUiAuth?.password && !settings.metricsAuth?.password, 'First-run configuration must not contain credentials');
  const base = manifest.buildId + '-' + manifest.platform;
  for (const name of [base + '-full.zip', base + '-update.zip', 'distributions.json', 'SHA256SUMS']) assert(!fs.existsSync(path.join(output, name)), 'Refusing to overwrite ' + name);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-server-distribution-'));
  try {
    fs.mkdirSync(output, { recursive: true });
    const artifacts = [];
    for (const mode of ['full', 'update']) {
      const stage = path.join(temporary, mode); fs.mkdirSync(stage);
      const files = manifest.files.filter(file => mode === 'full' || isUpdatePath(file.path));
      for (const file of files) {
        const target = path.join(stage, file.path); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(path.join(source, file.path), target);
        assert.equal(hash(target), file.sha256);
      }
      if (mode === 'full') fs.mkdirSync(path.join(stage, 'client-resources/Data'), { recursive: true });
      const next = { ...manifest, distributionMode: mode, requiresExistingInstallation: mode === 'update', preservedPathsOnUpdate: preservedPaths, files };
      fs.writeFileSync(path.join(stage, 'build-manifest.json'), json(next));
      const name = base + '-' + mode + '.zip', destination = path.join(output, name);
      const entries = makeZip(stage, destination, manifest.platform);
      const payload = [...files, { path: 'build-manifest.json', bytes: fs.statSync(path.join(stage, 'build-manifest.json')).size, sha256: hash(path.join(stage, 'build-manifest.json')) }];
      assert.equal(entries.filter(entry => !entry.directory).length, payload.length);
      if (mode === 'update') for (const entry of entries) assert(isUpdatePath(entry.path) && !isPreservedPath(entry.path), 'Update would overwrite persistent data: ' + entry.path);
      artifacts.push({ mode, file: name, bytes: fs.statSync(destination).size, sha256: hash(destination), files: payload, entries });
    }
    const report = { ok: true, buildId: manifest.buildId, platform: manifest.platform, sourceFingerprint: manifest.sourceFingerprint, preservedPaths, artifacts };
    fs.writeFileSync(path.join(output, 'distributions.json'), json(report));
    fs.writeFileSync(path.join(output, 'SHA256SUMS'), artifacts.map(file => `${file.sha256}  ${file.file}`).join('\n') + '\n');
    return report;
  } finally {
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir())); assert(path.basename(temporary).startsWith('skymp-server-distribution-'));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
module.exports = { createDistributions, isUpdatePath, isPreservedPath };
if (require.main === module) {
  const args = process.argv.slice(2), options = {};
  for (let i = 0; i < args.length; i += 2) { assert(args[i].startsWith('--') && args[i + 1], 'Expected --option value pairs'); options[args[i].slice(2)] = args[i + 1]; }
  const report = createDistributions(options);
  console.log(JSON.stringify({ ok: true, buildId: report.buildId, platform: report.platform, artifacts: report.artifacts.map(({ file, bytes, sha256, files }) => ({ file, bytes, sha256, files: files.length })) }));
}
