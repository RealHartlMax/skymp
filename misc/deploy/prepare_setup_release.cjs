#!/usr/bin/env node
// Run from build/: node ../misc/deploy/prepare_setup_release.cjs --linux-package DIR --windows-package DIR --output NEW_DIR --build-id NAME
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const options = {};
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  assert(args[i].startsWith('--') && args[i + 1], 'Expected --option value pairs');
  options[args[i].slice(2)] = args[i + 1];
}
for (const name of ['linux-package', 'windows-package', 'output', 'build-id']) assert(options[name], `Missing --${name}`);
assert(/^[a-zA-Z0-9._-]+$/.test(options['build-id']), 'Invalid build ID');
const output = path.resolve(options.output);
assert(!fs.existsSync(output), 'Refusing to overwrite a release directory');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', timeout: 300000, maxBuffer: 32 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || `${command} failed`);
  return result.stdout;
}
function tarGzip(directory, archive) {
  const raw = archive + '.uncompressed';
  if (process.platform === 'win32') {
    const pwsh = path.join(process.env.ProgramFiles, 'PowerShell/7/pwsh.exe');
    run(pwsh, ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'tar_archive.ps1'), '-Action', 'Create', '-Source', directory, '-Destination', raw]);
  } else run('tar', ['-cf', raw, '-C', directory, '.']);
  // Avoid the crashing Windows tar implementation; compress with Node's zlib.
  fs.writeFileSync(archive, zlib.gzipSync(fs.readFileSync(raw), { level: 6 }));
  fs.unlinkSync(raw);
}
function checkPackage(dir, platform) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'build-manifest.json'), 'utf8'));
  assert.equal(manifest.platform, platform);
  for (const file of manifest.files) {
    assert(!path.isAbsolute(file.path) && !file.path.split('/').includes('..'));
    assert.equal(hash(path.join(dir, file.path)), file.sha256, `Runtime input changed: ${file.path}`);
  }
  return manifest;
}
const linux = path.resolve(options['linux-package']);
const windows = path.resolve(options['windows-package']);
const linuxManifest = checkPackage(linux, 'linux-x64');
const windowsManifest = checkPackage(windows, 'windows-x64');
const backend = options.backend ? path.resolve(options.backend) : undefined;
if (backend) for (const name of ['skymp5-server.js', 'skymp5-server.js.map', 'skymp5-admin.js', 'skymp5-admin.js.map']) assert(fs.statSync(path.join(backend, name)).isFile(), `Missing rebuilt backend: ${name}`);
const frontend = options.frontend ? path.resolve(options.frontend) : undefined;
if (frontend) for (const name of ['index.html', 'build.js']) assert(fs.statSync(path.join(frontend, name)).isFile(), `Missing rebuilt frontend: ${name}`);
assert.equal(linuxManifest.sourceFingerprint, windowsManifest.sourceFingerprint);
let nativeBaselineCheck;
if (options['native-baseline-commit']) {
  const paths = ['skymp5-server/cpp', 'libespm', 'papyrus-vm', 'serialization', 'savefile', 'viet', 'skymp5-functions-lib', 'skymp5-scripts', 'vcpkg.json', 'vcpkg-configuration.json', 'overlay_triplets'];
  const changed = run('git', ['--no-optional-locks', 'diff', options['native-baseline-commit'], '--name-only', '--', ...paths]).trim();
  const added = run('git', ['--no-optional-locks', 'ls-files', '--others', '--exclude-standard', '--', ...paths]).trim();
  assert(!changed && !added, `Native server inputs changed; rebuild both native modules before release: ${changed}\n${added}`);
  nativeBaselineCheck = { commit: options['native-baseline-commit'], paths, changedFiles: [], newFiles: [], note: 'Native server code/inputs unchanged; reuse qualified platform modules. Client-only CommonLib changes are outside these server targets.' };
}
for (const file of linuxManifest.files.filter(file => /^(ui\/|dist_back\/|data\/scripts\/|gamemode\.js$)/.test(file.path))) {
  assert.equal(hash(path.join(windows, file.path)), file.sha256, `Cross-platform runtime mismatch: ${file.path}`);
}
fs.mkdirSync(output, { recursive: true });
const sourceFiles = run('git', ['--no-optional-locks', 'ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean).filter(name => {
  if (/^(?:\.kilo|\.codex|\.agents|\.aws|vcpkg|build)(?:\/|$)/.test(name)) return false;
  return fs.existsSync(path.join(root, name)) && fs.statSync(path.join(root, name)).isFile();
});
function addDirectory(relative) {
  for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const name = relative + '/' + entry.name;
    if (entry.isDirectory()) addDirectory(name);
    else if (entry.isFile()) sourceFiles.push(name);
  }
}
addDirectory('skymp5-front/dist');
const files = [...new Set(sourceFiles)].sort();
for (const name of files) {
  assert(!/[\r\n]/.test(name), 'Invalid source filename');
  assert(!/(?:^|\/)(?:admin-auth\.json|server-settings\.json|\.env|id_rsa|TEST-ZUGANG\.txt)$/.test(name), `Review private file before archiving: ${name}`);
}
const list = path.join(output, 'source-files.txt');
fs.writeFileSync(list, files.join('\n') + '\n');
const buildId = options['build-id'];
const sourceArchive = path.join(output, buildId + '-source.tar.gz');
// Stage on the local temp filesystem. Thousands of small writes on exFAT and
// decoding Unicode filenames through Windows tar's -T are both avoided.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-setup-release-'));
const sourceTree = path.join(temporary, 'source');
fs.mkdirSync(sourceTree);
console.log(`Preparing sources in ${temporary}`);
const baseTar = path.join(temporary, 'git-source.tar');
run('git', ['--no-optional-locks', 'archive', '--format=tar', '--output', baseTar, 'HEAD']);
if (process.platform === 'win32') {
  run(path.join(process.env.ProgramFiles, 'PowerShell/7/pwsh.exe'), ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'tar_archive.ps1'), '-Action', 'Extract', '-Source', baseTar, '-Destination', sourceTree]);
} else run('tar', ['-xf', baseTar, '-C', sourceTree]);
const allowed = new Set(files);
function copySource(name) {
  const target = path.join(sourceTree, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) fs.unlinkSync(target);
  fs.copyFileSync(path.join(root, name), target);
}
const dirty = run('git', ['--no-optional-locks', 'ls-files', '-z', '--modified', '--others', '--exclude-standard']).split('\0').filter(name => allowed.has(name));
for (const name of new Set(dirty)) copySource(name);
// git archive normalizes committed text, while the Windows worktree may use
// CRLF. Preserve exact bytes for every template copied into the runtime package.
for (const name of files.filter(name => name.startsWith('misc/deploy/test-server/'))) copySource(name);
for (const name of files) {
  if (name.startsWith('skymp5-front/dist/') || !fs.existsSync(path.join(sourceTree, name)) || fs.lstatSync(path.join(sourceTree, name)).isSymbolicLink()) copySource(name);
}
function prune(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) prune(file);
    else if (!allowed.has(path.relative(sourceTree, file).split(path.sep).join('/'))) fs.unlinkSync(file);
  }
}
prune(sourceTree);
const temporarySource = path.join(temporary, buildId + '-source.tar.gz');
console.log(`Archiving ${files.length} source files`);
tarGzip(sourceTree, temporarySource);
fs.copyFileSync(temporarySource, sourceArchive);
const metadata = {
  buildId, sourceCommit: run('git', ['--no-optional-locks', 'rev-parse', 'HEAD']).trim(),
  sourceFingerprint: hash(temporarySource), builtAt: new Date().toISOString(),
  runtimeBuildId: backend ? buildId : linuxManifest.runtimeBuildId || linuxManifest.buildId,
  runtimeSourceFingerprint: backend ? hash(temporarySource) : linuxManifest.runtimeSourceFingerprint || linuxManifest.sourceFingerprint,
  nativeBuildId: linuxManifest.nativeBuildId || linuxManifest.runtimeBuildId || linuxManifest.buildId,
  nativeSourceFingerprint: linuxManifest.nativeSourceFingerprint || linuxManifest.runtimeSourceFingerprint || linuxManifest.sourceFingerprint,
  frontendBuildId: frontend ? buildId : linuxManifest.frontendBuildId || linuxManifest.runtimeBuildId || linuxManifest.buildId,
  frontendSourceFingerprint: frontend ? hash(temporarySource) : linuxManifest.frontendSourceFingerprint || linuxManifest.runtimeSourceFingerprint || linuxManifest.sourceFingerprint,
  ...(nativeBaselineCheck ? { nativeBaselineCheck } : {}),
  sourceSnapshotNote: 'Git HEAD plus current modified/untracked files and production frontend; private directories excluded. Qualification results are recorded separately.',
};
const metadataFile = path.join(output, 'build-metadata.json');
fs.writeFileSync(metadataFile, JSON.stringify(metadata, null, 2) + '\n');
const archives = [];
for (const [platform, source] of [['linux-x64', linux], ['windows-x64', windows]]) {
  const target = path.join(temporary, platform);
  console.log(`Packaging ${platform}`);
  const templates = files.filter(name => name.startsWith('misc/deploy/test-server/'));
  for (const relative of templates) {
    assert.equal(hash(path.join(root, relative)), hash(path.join(sourceTree, relative)), `Source changed during packaging: ${relative}`);
  }
  run(process.execPath, [path.join(__dirname, 'package_test_server.cjs'), '--mode', 'first-run', '--platform', platform, '--source', source, '--scripts', path.join(source, 'data/scripts'), '--output', target, '--metadata', metadataFile, ...(backend ? ['--backend', backend] : []), ...(frontend ? ['--frontend', frontend] : [])]);
  const name = buildId + '-' + platform + (platform === 'linux-x64' ? '.tar.gz' : '.zip');
  const archive = path.join(temporary, name);
  if (platform === 'linux-x64') tarGzip(target, archive);
  else if (process.platform === 'win32') {
    run(path.join(process.env.ProgramFiles, 'PowerShell/7/pwsh.exe'), ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'zip_archive.ps1'), '-Action', 'Create', '-Source', target, '-Destination', archive]);
  } else run('zip', ['-qr', archive, '.'], target);
  fs.copyFileSync(archive, path.join(output, name));
  archives.push({ name, bytes: fs.statSync(archive).size, sha256: hash(archive) });
}
archives.push({ name: path.basename(sourceArchive), bytes: fs.statSync(sourceArchive).size, sha256: metadata.sourceFingerprint });
fs.writeFileSync(path.join(output, 'SHA256SUMS'), archives.map(file => `${file.sha256}  ${file.name}`).join('\n') + '\n');
console.log(JSON.stringify({ ok: true, output, metadata, archives, sourceFiles: files.length }, null, 2));
assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
assert(path.basename(temporary).startsWith('skymp-setup-release-'));
fs.rmSync(temporary, { recursive: true, force: true });
