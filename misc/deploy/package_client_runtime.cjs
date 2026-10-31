#!/usr/bin/env node
// Prepare an additive launcher runtime update from a verified existing runtime
// and this fork's built client/CEF files. Never modifies the input or a VPS.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const json = value => JSON.stringify(value, null, 2) + '\n';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// Hash-addressed binary downloads preserve text bytes through FTP/HTTP hosting.
const isText = name => /\.(?:svg|txt|js|json|ini|cfg|xml|html|css|md|toml|yaml|yml|csv|map)$/i.test(name);
const required = ['Data/SKSE/Plugins/SkyrimPlatform.dll', 'Data/SKSE/Plugins/MpClientPlugin.dll',
  'Data/Platform/Plugins/skymp5-client.js', 'Data/Platform/Distribution/RuntimeDependencies/SkyrimPlatformImpl.dll',
  'Data/Platform/UI/index.html', 'Data/Platform/UI/build.js'];
function safePath(name) {
  assert(typeof name === 'string' && name && !/[\\\x00-\x1f\x7f:*?"<>|]/.test(name) && !path.posix.isAbsolute(name) &&
    !path.win32.isAbsolute(name) && path.posix.normalize(name) === name && !name.split('/').some(p => !p || p === '.' || p === '..'), 'Invalid runtime path: ' + name);
}
function installable(name) {
  safePath(name);
  const lower = name.toLowerCase(), leaf = path.posix.basename(lower);
  assert(!lower.startsWith('data/platform/pluginruntime/'), 'Plugin-owned files do not belong in a central runtime');
  assert(!lower.includes('auth-data') && !lower.includes('.skymp') && !/\/(?:plugin-example|modules|source)\//.test(lower) &&
    !/\.(?:log|zip)$/.test(lower) && !['skymp5-client-settings.txt', 'server-settings.json', '.env', 'config.php', 'state.json'].includes(leaf), 'Private/unnecessary runtime path: ' + name);
  assert(!/^(?:skyrim|update|dawnguard|hearthfires|dragonborn)\.(?:esm|bsa)$/.test(leaf) && !/^skyrim\s*-.*\.bsa$/.test(leaf), 'Bethesda game files must remain local');
  assert(lower.startsWith('data/') || (!lower.includes('/') && (lower === 'skse64_loader.exe' || /^skse64_[a-z0-9_]+\.dll$/.test(lower))), 'Unsupported runtime path: ' + name);
}
function regularFile(directory, relative) {
  safePath(relative);
  let current = directory;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    assert(!fs.lstatSync(current).isSymbolicLink(), 'Links are forbidden in runtime packages: ' + relative);
  }
  assert(fs.statSync(current).isFile(), 'Expected runtime file: ' + relative);
  return current;
}
async function hashFile(filename) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}
function normalizeHash(value) {
  assert(typeof value === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/i.test(value), 'Invalid SHA-256');
  return value.replace(/^sha256:/i, '').toLowerCase();
}
function checkManifest(manifest) {
  assert(manifest.version === 1 && Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= 10000, 'Expected runtime manifest v1');
  assert(typeof manifest.gameVersion === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(manifest.gameVersion) && manifest.gameVersion.split('.').every(n => Number(n) <= 65535), 'A versioned base runtime is required');
  assert(typeof manifest.skseVersion === 'string' && /^\d+\.\d+\.\d+$/.test(manifest.skseVersion), 'Base runtime must declare skseVersion');
  const names = new Set(); let total = 0;
  for (const entry of manifest.files) {
    installable(entry.path); assert(!names.has(entry.path.toLowerCase()), 'Duplicate/case-colliding runtime path: ' + entry.path); names.add(entry.path.toLowerCase());
    assert(Number.isSafeInteger(entry.size) && entry.size >= 0, 'Invalid runtime file size'); normalizeHash(entry.sha256); total += entry.size;
  }
  assert(total < 4 * 1024 ** 3, 'This ZIP32 runtime packager supports packages below 4 GiB');
  const version = manifest.gameVersion.split('.');
  const addressPrefix = Number(version[1]) >= 6 ? 'versionlib' : 'version';
  const mustHave = [...required, 'skse64_loader.exe', `skse64_${version.slice(0, 3).map(Number).join('_')}.dll`,
    `Data/SKSE/Plugins/${addressPrefix}-${version.map(Number).join('-')}.bin`];
  mustHave.forEach(name => assert(names.has(name.toLowerCase()), 'Incomplete versioned runtime: ' + name));
  return manifest;
}
function createZip(source, destination) {
  const windows = process.platform === 'win32';
  const command = windows ? path.join(process.env.ProgramFiles, 'PowerShell/7/pwsh.exe') : 'zip';
  const args = windows ? ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'zip_archive.ps1'), '-Action', 'Create', '-Source', source, '-Destination', destination] : ['-qr', destination, '.'];
  const result = spawnSync(command, args, { cwd: source, encoding: 'utf8', timeout: 300000 });
  assert.equal(result.status, 0, result.stderr || result.error?.message || 'Runtime ZIP failed');
}
async function packageRuntime(options) {
  assert(options.base && options.output && options.release, 'Usage: --base RUNTIME_DIR --output NEW_DIR --release ID [--catalog CATALOG_JSON] [--client CLIENT_DIR] [--frontend FRONT_DIST]');
  assert(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(options.release) && !options.release.includes('..'), 'Invalid release ID');
  const base = fs.realpathSync(path.resolve(options.base)), output = path.resolve(options.output);
  const client = fs.realpathSync(path.resolve(options.client || path.join(root, 'build/dist/client')));
  const frontend = fs.realpathSync(path.resolve(options.frontend || path.join(root, 'skymp5-front/dist')));
  for (const input of [base, client, frontend]) assert(output !== input && !output.startsWith(input + path.sep) && !input.startsWith(output + path.sep), 'Output must be separate from every input');
  assert(!fs.existsSync(output), 'Choose a fresh output directory; previous runtimes are never overwritten');
  const baseBytes = fs.readFileSync(regularFile(base, 'runtime-manifest.json'));
  const manifest = checkManifest(JSON.parse(baseBytes));
  const catalog = options.catalog ? JSON.parse(fs.readFileSync(options.catalog, 'utf8')) : { version: 2, packages: [] };
  assert(catalog.version === 2 && Array.isArray(catalog.packages) && catalog.packages.length <= 512, 'Invalid existing runtime catalog');
  const versions = new Set();
  for (const entry of catalog.packages) {
    assert(typeof entry.gameVersion === 'string' && /^\d+\.\d+\.\d+\.\d+$/.test(entry.gameVersion) && entry.gameVersion.split('.').every(n => Number(n) <= 65535), 'Invalid catalog gameVersion');
    const normalizedVersion = entry.gameVersion.split('.').map(Number).join('.');
    assert(!versions.has(normalizedVersion), 'Duplicate catalog gameVersion'); versions.add(normalizedVersion);
    safePath(entry.manifest); normalizeHash(entry.sha256);
    const oldManifest = regularFile(path.dirname(path.resolve(options.catalog)), entry.manifest);
    assert.equal(await hashFile(oldManifest), normalizeHash(entry.sha256), 'Existing catalog manifest hash mismatch');
    const old = checkManifest(JSON.parse(fs.readFileSync(oldManifest)));
    assert.equal(old.gameVersion.split('.').map(Number).join('.'), normalizedVersion, 'Catalog gameVersion does not match its manifest');
  }
  const assets = JSON.parse(fs.readFileSync(regularFile(frontend, 'assets-manifest.json')));
  assert(assets.version === 1 && assets.mode === 'production' && Array.isArray(assets.assets) && assets.assets.includes('build.js') && assets.assets.includes('index.html'), 'Build the local production frontend first');
  const replacements = new Map();
  const clientPath = 'Data/Platform/Plugins/skymp5-client.js';
  replacements.set(clientPath, regularFile(client, clientPath));
  assert(fs.readFileSync(replacements.get(clientPath), 'utf8').includes('skympChat:send'), 'Client build lacks the chat adapter');
  assert(fs.readFileSync(regularFile(frontend, 'build.js'), 'utf8').includes('skympChat:packet'), 'Frontend build lacks the chat adapter');
  for (const asset of assets.assets) {
    safePath(asset); const target = 'Data/Platform/UI/' + asset; installable(target);
    assert(!replacements.has(target), 'Duplicate frontend asset'); replacements.set(target, regularFile(frontend, asset));
  }
  // Verify every base entry, including files replaced by a fresh build.
  for (const entry of manifest.files) {
    const file = regularFile(base, entry.path);
    assert.equal(fs.statSync(file).size, entry.size, 'Base runtime size mismatch: ' + entry.path);
    assert.equal(await hashFile(file), normalizeHash(entry.sha256), 'Base runtime hash mismatch: ' + entry.path);
  }
  const sourceFiles = new Map();
  for (const entry of manifest.files) {
    if (!entry.path.toLowerCase().startsWith('data/platform/ui/') && entry.path.toLowerCase() !== clientPath.toLowerCase()) sourceFiles.set(entry.path, regularFile(base, entry.path));
  }
  for (const [name, source] of replacements) sourceFiles.set(name, source);
  const caseNames = new Set();
  for (const name of sourceFiles.keys()) { assert(!caseNames.has(name.toLowerCase()), 'Output case collision'); caseNames.add(name.toLowerCase()); }
  const relativeManifest = `${manifest.gameVersion}/${options.release}/runtime-manifest.json`;
  assert(!catalog.packages.some(p => p.manifest === relativeManifest), 'Release path already appears in the existing catalog; choose a new ID');
  const webroot = path.join(output, 'upload'), runtimeRoot = path.join(webroot, 'client-runtime');
  const packageRoot = path.join(runtimeRoot, manifest.gameVersion, options.release);
  fs.mkdirSync(packageRoot, { recursive: true });
  const entries = [];
  for (const [name, source] of [...sourceFiles].sort(([a], [b]) => a.localeCompare(b))) {
    const target = path.join(packageRoot, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.copyFileSync(source, target);
    const entry = { path: name, size: fs.statSync(target).size, sha256: await hashFile(target) };
    if (isText(name)) {
      entry.downloadPath = 'payloads/' + entry.sha256 + '.bin';
      const transport = path.join(packageRoot, entry.downloadPath);
      fs.mkdirSync(path.dirname(transport), { recursive: true }); fs.copyFileSync(target, transport);
      assert.equal(await hashFile(transport), entry.sha256, 'Binary transport copy changed: ' + name);
    }
    entries.push(entry);
  }
  const pluginRuntimeApi = fs.readFileSync(replacements.get(clientPath), 'utf8').includes('SkyMPPluginRuntimeLoader/v1') &&
    fs.readFileSync(regularFile(frontend, 'build.js'), 'utf8').includes('SkyMPPluginUiHost/v1') ? 1 : 0;
  const nextManifest = checkManifest({ version: 1, ...(pluginRuntimeApi ? { pluginRuntimeApi } : {}), gameVersion: manifest.gameVersion, skseVersion: manifest.skseVersion, files: entries });
  const nextBytes = Buffer.from(json(nextManifest)); fs.writeFileSync(path.join(packageRoot, 'runtime-manifest.json'), nextBytes);
  const nextPackage = { gameVersion: manifest.gameVersion, manifest: relativeManifest, sha256: digest(nextBytes) };
  const retained = catalog.packages.filter(p => p.gameVersion.split('.').map(Number).join('.') !== manifest.gameVersion.split('.').map(Number).join('.'));
  const nextCatalog = { version: 2, packages: [...retained, nextPackage].sort((a, b) => a.gameVersion.localeCompare(b.gameVersion)) };
  assert(nextCatalog.packages.length <= 512, 'Catalog package limit exceeded');
  fs.writeFileSync(path.join(runtimeRoot, 'catalog.json'), json(nextCatalog));
  const preserved = entries.filter(e => /\.(dll|exe|bin|pak|dat)$/i.test(e.path));
  for (const entry of preserved) {
    const old = manifest.files.find(f => f.path.toLowerCase() === entry.path.toLowerCase());
    assert(old && entry.sha256 === normalizeHash(old.sha256), 'Native input changed unexpectedly: ' + entry.path);
  }
  const archive = path.join(output, `skymp-client-runtime-${manifest.gameVersion}-${options.release}.zip`);
  createZip(webroot, archive);
  const report = { passed: true, gameVersion: manifest.gameVersion, skseVersion: manifest.skseVersion,
    baseManifestSHA256: digest(baseBytes), manifest: relativeManifest, manifestSHA256: digest(nextBytes),
    files: entries.length, binaryTextDownloads: entries.filter(e => e.downloadPath).length, nativeFilesPreserved: preserved.length, retainedCatalogPackages: retained,
    archive: path.basename(archive), archiveSHA256: await hashFile(archive),
    clientSHA256: await hashFile(replacements.get(clientPath)), frontendSHA256: await hashFile(regularFile(frontend, 'build.js')),
    skyrimStarted: false, nativeCompatibilityRetested: false, published: false, deployed: false };
  fs.writeFileSync(path.join(output, 'VALIDATION.json'), json(report));
  fs.writeFileSync(path.join(output, 'SHA256SUMS'), `${report.archiveSHA256}  ${path.basename(archive)}\n`);
  fs.writeFileSync(path.join(output, 'README-UPLOAD.md'), `# Client-Runtime lokal vorbereitet\n\n1. Den gesamten neuen Ordner samt payloads/ in binaerem Uebertragungsmodus kopieren: client-runtime/${manifest.gameVersion}/${options.release}/ unter den vom Launcher verwendeten Runtime-Webroot hochladen.\n2. Erst danach client-runtime/catalog.json austauschen. Bestehende Versionsordner und andere Katalogeinträge erhalten.\n3. Bei einem abweichenden Live-Katalog vor Veröffentlichung dessen weitere Versionen mit --catalog in einem neuen lokalen Paket erhalten.\n4. Spieler laden das passende Paket über den bestehenden Launcher; Skyrim danach neu starten.\n\nDas Server-Plugin Plugins/SkyMPChat/ wird getrennt installiert/aktiviert und benötigt einen Gameserver-Neustart.\nNative Dateien wurden unverändert aus der angegebenen Basis übernommen; echter Skyrim-/CEF-Betrieb ist nicht durch diese Paketprüfung bestätigt.\nDer ZIP-Inhalt gehört in den Runtime-Webroot, nicht in den Gameserver-Plugin-Ordner.\n`);
  return report;
}
module.exports = { packageRuntime, checkManifest, safePath, installable, hashFile, required };
if (require.main === module) {
  const options = {};
  for (let i = 2; i < process.argv.length; i += 2) {
    const flag = process.argv[i];
    assert(['--base', '--output', '--release', '--catalog', '--client', '--frontend'].includes(flag) && process.argv[i + 1], 'Unknown/missing runtime option');
    options[flag.slice(2)] = process.argv[i + 1];
  }
  packageRuntime(options).then(report => console.log(json(report))).catch(error => { console.error(error); process.exitCode = 1; });
}
