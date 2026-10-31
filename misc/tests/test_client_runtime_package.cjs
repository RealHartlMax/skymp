const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http'), crypto = require('node:crypto');
const { packageRuntime, checkManifest, required } = require('../deploy/package_client_runtime.cjs');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-client-package-'));
  t.after(() => { assert.equal(path.dirname(root), fs.realpathSync(os.tmpdir())); assert(path.basename(root).startsWith('skymp-client-package-')); fs.rmSync(root, { recursive: true, force: true }); });
  const base = path.join(root, 'base'), client = path.join(root, 'client'), frontend = path.join(root, 'front'), output = path.join(root, 'out');
  const write = (dir, name, bytes) => { const target = path.join(dir, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); return target; };
  const names = [...required, 'skse64_loader.exe', 'skse64_1_7_104.dll', 'Data/SKSE/Plugins/versionlib-1-7-104-0.bin', 'Data/Platform/UI/old-unused.js'];
  const files = names.map(name => { const bytes = Buffer.from('base:' + name); write(base, name, bytes); return { path: name, size: bytes.length, sha256: digest(bytes) }; });
  const manifest = { version: 1, gameVersion: '1.7.104.0', skseVersion: '2.3.1', files };
  write(base, 'runtime-manifest.json', JSON.stringify(manifest));
  write(base, 'Data/Platform/Plugins/auth-data.json', 'private, never publish'); // Unlisted private source file.
  write(client, 'Data/Platform/Plugins/skymp5-client.js', 'fresh skympChat:send client');
  write(frontend, 'build.js', 'fresh skympChat:packet frontend'); write(frontend, 'index.html', '<script src="build.js"></script>');
  write(frontend, 'font name.ttf', 'font data'); write(frontend, 'stale.js', 'must not publish');
  write(frontend, 'assets-manifest.json', JSON.stringify({ version: 1, mode: 'production', assets: ['build.js', 'index.html', 'font name.ttf'] }));
  return { root, base, client, frontend, output, manifest, write, options: { base, client, frontend, output, release: 'client-test' } };
}
test('New runtime preserves native bytes, replaces CEF/client, updates catalog/hash, serves launcher files over HTTP and leaves the base untouched', async t => {
  const f = fixture(t), original = fs.readFileSync(path.join(f.base, 'runtime-manifest.json'));
  const other = { ...f.manifest, gameVersion: '1.6.1170.0', files: f.manifest.files.map(file => ({ ...file,
    path: file.path.replace('skse64_1_7_104.dll', 'skse64_1_6_1170.dll').replace('versionlib-1-7-104-0.bin', 'versionlib-1-6-1170-0.bin') })) };
  const oldManifestBytes = Buffer.from(JSON.stringify(other));
  f.write(f.root, 'old/runtime-manifest.json', oldManifestBytes);
  const old = { gameVersion: '1.6.1170.0', manifest: 'old/runtime-manifest.json', sha256: digest(oldManifestBytes) };
  const catalog = f.write(f.root, 'catalog.json', JSON.stringify({ version: 2, packages: [old] }));
  const report = await packageRuntime({ ...f.options, catalog });
  assert.equal(report.passed, true); assert.equal(report.nativeCompatibilityRetested, false); assert(report.nativeFilesPreserved >= 6);
  assert.deepEqual(fs.readFileSync(path.join(f.base, 'runtime-manifest.json')), original);
  const folder = path.join(f.output, 'upload/client-runtime/1.7.104.0/client-test');
  const next = JSON.parse(fs.readFileSync(path.join(folder, 'runtime-manifest.json')));
  assert.equal(fs.readFileSync(path.join(folder, 'Data/Platform/Plugins/skymp5-client.js'), 'utf8'), 'fresh skympChat:send client');
  assert.equal(fs.existsSync(path.join(folder, 'Data/Platform/UI/old-unused.js')), false);
  assert.equal(fs.existsSync(path.join(folder, 'Data/Platform/UI/stale.js')), false);
  assert.equal(fs.existsSync(path.join(folder, 'Data/Platform/Plugins/auth-data.json')), false);
  assert.equal(fs.existsSync(path.join(f.output, report.archive)), true);
  const webroot = path.join(f.output, 'upload');
  const server = http.createServer((req, res) => {
    const target = path.resolve(webroot, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!target.startsWith(webroot + path.sep) || !fs.existsSync(target)) return res.writeHead(404).end();
    fs.createReadStream(target).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => server.close());
  const url = `http://127.0.0.1:${server.address().port}/client-runtime/`;
  const servedCatalog = await (await fetch(url + 'catalog.json')).json();
  assert.deepEqual(servedCatalog.packages.find(p => p.gameVersion === old.gameVersion), old);
  const entry = servedCatalog.packages.find(p => p.gameVersion === next.gameVersion);
  const bytes = Buffer.from(await (await fetch(url + entry.manifest)).arrayBuffer()); assert.equal(digest(bytes), entry.sha256);
  for (const file of next.files) {
    const textFile = /\.(js|html)$/i.test(file.path);
    if (textFile) assert.equal(file.downloadPath, 'payloads/' + file.sha256 + '.bin');
    for (const download of new Set([file.path, ...(file.downloadPath ? [file.downloadPath] : [])])) {
      const response = await fetch(new URL(download.split('/').map(encodeURIComponent).join('/'), new URL('.', url + entry.manifest)));
      assert.equal(response.status, 200); const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.length, file.size); assert.equal(digest(bytes), file.sha256);
    }
  }
  assert(report.binaryTextDownloads >= 3);
  await assert.rejects(packageRuntime(f.options), /fresh output directory/);
});
test('A corrupted base is rejected before creating output or altering source', async t => {
  const f = fixture(t); fs.appendFileSync(path.join(f.base, required[0]), 'corrupt');
  await assert.rejects(packageRuntime(f.options), /Base runtime size mismatch/); assert.equal(fs.existsSync(f.output), false);
});
test('Traversal, private files, Bethesda files, case collisions and incomplete versioned manifests are rejected', () => {
  const base = { version: 1, gameVersion: '1.7.104.0', skseVersion: '2.3.1', files: [] };
  for (const name of ['../secret', 'Data/../secret', 'Data\\escape.dll', 'Data/Platform/Plugins/auth-data.json', 'Data/Platform/Plugins/skymp5-client-settings.txt', 'Data/Skyrim.esm']) {
    assert.throws(() => checkManifest({ ...base, files: [{ path: name, size: 0, sha256: '0'.repeat(64) }] }));
  }
  assert.throws(() => checkManifest({ ...base, files: [
    { path: 'Data/x.dll', size: 0, sha256: '0'.repeat(64) }, { path: 'Data/X.dll', size: 0, sha256: '0'.repeat(64) },
  ] }), /case-colliding/);
  assert.throws(() => checkManifest({ ...base, files: [{ path: 'Data/x.dll', size: 0, sha256: '0'.repeat(64) }] }), /Incomplete versioned runtime/);
});
