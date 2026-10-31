// Real Koa HTTP contract, using disposable Data directories, never a real Skyrim install.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const repo = process.env.SKYMP_TEST_REPO ? path.resolve(process.env.SKYMP_TEST_REPO) : path.resolve(__dirname, '../..');
const dependencies = path.join(repo, 'skymp5-server/node_modules');
const Koa = require(path.join(dependencies, 'koa'));
const Router = require(path.join(dependencies, 'koa-router'));
const crc32 = require(path.join(dependencies, 'crc-32'));
const ts = require(path.join(dependencies, 'typescript'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
let compiled;
function loadApi() {
  if (!compiled) {
    const result = ts.transpileModule(fs.readFileSync(process.env.SKYMP_LAUNCHER_RESOURCE_SOURCE || path.join(repo, 'skymp5-server/ts/launcherResources.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
    const output = new Module('launcher-resources-test.cjs', module);
    output._compile(result.outputText, path.join(repo, 'build/launcher-resources-test.cjs'));
    compiled = output.exports;
  }
  return compiled;
}
function write(root, relative, bytes) {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes);
}
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-mod-publication-'));
  const data = path.join(root, 'data'), publication = path.join(root, 'data/mods/Assets');
  write(root, 'data/Skyrim.esm', 'TES4-owned-base');
  write(root, 'data/Community.esp', 'TES4-custom-plugin');
  write(root, 'data/Community.bsa', 'custom archive');
  write(root, 'data/Community - Textures.bsa', 'custom textures archive');
  write(root, 'data/admin-auth.json', '{"passwordHash":"must never be published"}');
  write(root, 'data/scripts/ServerOnly.pex', 'server-only script');
  write(root, 'data/mods/Assets/Scripts/ClientScript.pex', 'client script');
  write(root, 'data/mods/Assets/textures/first/shared.dds', 'first texture');
  write(root, 'data/mods/Assets/textures/second/shared.dds', 'second texture');
  write(root, 'data/mods/Assets/meshes/Community/Schwert.nif', 'mesh bytes');
  write(root, 'data/mods/Assets/SKSE/Plugins/Community.ini', '[community]\nenabled=true');
  const loadOrder = ['Skyrim.esm', 'Community.esp'];
  const mods = loadOrder.map(filename => {
    const bytes = fs.readFileSync(path.join(data, filename));
    return { filename, size: bytes.length, crc32: crc32.buf(bytes) };
  });
  write(data, 'manifest.json', JSON.stringify({ versionMajor: 1, loadOrder, mods }));
  return { root, data, publication, options: { dataDir: data, loadOrder } };
}
async function serve(options) {
  const app = new Koa(), router = new Router();
  // Match the original fork's earlier *.esm guard; opaque IDs cannot hit it.
  router.get(/\.esm$/i, ctx => { ctx.status = 403; });
  const store = loadApi().registerLauncherResources(router, options);
  app.use(router.routes()).use(router.allowedMethods());
  const server = await new Promise(resolve => { const active = app.listen(0, '127.0.0.1', () => resolve(active)); });
  return { store, base: `http://127.0.0.1:${server.address().port}/`, close: async () => { server.closeIdleConnections(); await new Promise(resolve => server.close(resolve)); } };
}
async function dispose(f, server) {
  if (server) await server.close();
  assert.equal(path.dirname(f.root), path.resolve(os.tmpdir())); assert(path.basename(f.root).startsWith('skymp-mod-publication-'));
  fs.rmSync(f.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
async function run() {
  let checks = 0; const skipped = [];
  async function check(name, action) {
    const f = fixture(); let server;
    try { server = await serve(f.options); await action(f, server); checks++; }
    finally { await dispose(f, server); }
  }
  await check('manifest and downloads', async (f, server) => {
    const request = await fetch(server.base + 'api/launcher/manifest'); assert.equal(request.status, 200);
    const manifest = await request.json(); assert.equal(manifest.version, '2');
    assert.deepEqual(manifest.loadOrder, f.options.loadOrder);
    assert.equal(manifest.requiredLocalFiles.length, 1); assert.equal(manifest.requiredLocalFiles[0].filename, 'Skyrim.esm');
    assert.equal(manifest.resources.length, 8);
    assert.equal(manifest.totalSize, manifest.resources.reduce((sum, file) => sum + file.size, 0));
    assert(!JSON.stringify(manifest).includes(f.root));
    for (const hidden of ['admin-auth.json', 'ServerOnly.pex', 'Data/Skyrim.esm']) assert(!manifest.resources.some(file => file.path.endsWith(hidden)));
    assert.equal(manifest.resources.filter(file => file.name === 'shared.dds').length, 2);
    for (const file of manifest.resources) {
      const response = await fetch(server.base + file.downloadPath);
      assert.equal(response.status, 200, file.path);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(bytes.length, file.size); assert.equal('sha256:' + hash(bytes), file.hash);
      assert.equal(response.headers.get('x-resource-hash'), file.hash);
      assert.equal(Number(response.headers.get('content-length')), file.size);
    }
    const second = new (loadApi().LauncherResourceStore)(f.options);
    assert.equal((await second.manifest()).revision, manifest.revision, 'Revision depends on content, not generatedAt');
    const concurrent = await Promise.all(Array.from({ length: 5 }, () => fetch(server.base + 'api/launcher/manifest').then(r => r.json())));
    assert(concurrent.every(value => value.revision === manifest.revision));
  });
  await check('HEAD, ranges, ETag and invalid IDs', async (_f, server) => {
    const manifest = await (await fetch(server.base + 'api/launcher/manifest')).json();
    const file = manifest.resources.find(file => file.name === 'Community.esp');
    const head = await fetch(server.base + file.downloadPath, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal(Number(head.headers.get('content-length')), file.size); assert.equal((await head.arrayBuffer()).byteLength, 0);
    const range = await fetch(server.base + file.downloadPath, { headers: { range: 'bytes=0-3' } });
    assert.equal(range.status, 206); assert.equal(await range.text(), 'TES4');
    assert.equal(range.headers.get('content-range'), `bytes 0-3/${file.size}`);
    const notModified = await fetch(server.base + file.downloadPath, { headers: { 'if-none-match': head.headers.get('etag') } }); assert.equal(notModified.status, 304);
    for (const range of ['bytes=100000-', 'bytes=0-1,4-5', 'bytes=-0', 'bytes=abc']) assert.equal((await fetch(server.base + file.downloadPath, { headers: { range } })).status, 416);
    assert.equal((await fetch(server.base + 'api/launcher/files/not-an-id')).status, 400);
    assert.equal((await fetch(server.base + 'api/launcher/files/' + '0'.repeat(64))).status, 404);
  });
  await check('changed files invalidate the old revision', async (f, server) => {
    const original = await (await fetch(server.base + 'api/launcher/manifest')).json();
    const file = original.resources.find(file => file.path.endsWith('first/shared.dds'));
    write(f.publication, 'textures/first/shared.dds', 'changed texture with a different size');
    assert.equal((await fetch(server.base + file.downloadPath)).status, 409);
    const changed = await (await fetch(server.base + 'api/launcher/manifest')).json();
    assert.notEqual(changed.revision, original.revision);
    assert.equal((await fetch(server.base + file.downloadPath)).status, 404);
  });
  for (const [name, mutate] of [
    ['missing plugin', f => fs.unlinkSync(path.join(f.data, 'Community.esp'))],
    ['stale game manifest', f => { const file = path.join(f.data, 'manifest.json'); const json = JSON.parse(fs.readFileSync(file)); json.loadOrder.reverse(); fs.writeFileSync(file, JSON.stringify(json)); }],
  ]) {
    const f = fixture(); let server;
    try {
      mutate(f); server = await serve(f.options);
      const response = await fetch(server.base + 'api/launcher/manifest'); assert.equal(response.status, 503, name);
      const failure = await response.json(); assert(!JSON.stringify(failure).includes(f.root), 'Do not leak source paths'); checks++;
    } finally { await dispose(f, server); }
  }
  await check('disabled uploaded plugins are excluded from the active manifest', async (f, server) => {
    write(f.data, 'mods/Unused/Unused.esl', 'TES4-inactive-upload');
    write(f.data, 'mods/Unused/textures/unused.dds', 'inactive mod asset');
    const response = await fetch(server.base + 'api/launcher/manifest');
    assert.equal(response.status, 200);
    const manifest = await response.json();
    assert.deepEqual(manifest.loadOrder, f.options.loadOrder);
    assert(!manifest.resources.some(entry => entry.name === 'Unused.esl' || entry.name === 'unused.dds'));
    assert(manifest.resources.some(entry => entry.name === 'Community.esp'));
  });
  await check('disabled endpoint returns 404', async (f) => {
    const server = await serve({ ...f.options, enabled: false });
    try { assert.equal((await fetch(server.base + 'api/launcher/manifest')).status, 404); }
    finally { await server.close(); }
  });
  await check('server-provided client runtime', async (f) => {
    const runtimeSource = 'https://files.example.org/client/runtime-manifest.json';
    const server = await serve({ ...f.options, runtimeSource });
    try {
      const manifest = await (await fetch(server.base + 'api/launcher/manifest')).json();
      assert.equal(manifest.runtimeSource, runtimeSource);
    } finally { await server.close(); }
    for (const runtimeSource of ['file:///private/runtime-manifest.json', 'https://user:secret@files.example.org/runtime-manifest.json', 'https://files.example.org/runtime-manifest.json?secret=1']) {
      const invalid = await serve({ ...f.options, runtimeSource });
      try { assert.equal((await fetch(invalid.base + 'api/launcher/manifest')).status, 503); }
      finally { await invalid.close(); }
    }
  });
  if (process.platform !== 'win32') {
    await check('case collisions are rejected for Windows clients', async (f, server) => {
      write(f.publication, 'textures/first/SHARED.dds', 'case collision');
      const manifest = await (await fetch(server.base + 'api/launcher/manifest')).json();
      assert.equal(manifest.resources.filter(file => file.path.toLowerCase() === 'data/textures/first/shared.dds').length, 1);
    });
  } else skipped.push('Case-only duplicate files cannot be created on this Windows filesystem; exercised by Linux run');
  await check('symlink escape', async (f, server) => {
    const outside = path.join(f.root, 'outside'); fs.mkdirSync(outside); write(outside, 'secret.dds', 'must remain private');
    try { fs.symlinkSync(outside, path.join(f.publication, 'textures/linked'), process.platform === 'win32' ? 'junction' : 'dir'); }
    catch (error) { if (['EPERM', 'EACCES'].includes(error.code)) { skipped.push('OS does not allow test symlink'); return; } throw error; }
    assert.equal((await fetch(server.base + 'api/launcher/manifest')).status, 503);
    assert.equal(fs.readFileSync(path.join(outside, 'secret.dds'), 'utf8'), 'must remain private');
  });
  const raceMenu = f => {
    write(f.data, 'mods/RaceMenu/RaceMenu.esp', 'TES4-race');
    write(f.data, 'mods/RaceMenu/RaceMenuPlugin.esp', 'TES4-plugin');
    write(f.data, 'mods/RaceMenu/RaceMenu.bsa', 'race archive');
    write(f.data, 'mods/RaceMenu/SKSE/Plugins/skee64.dll', 'dll bytes');
    write(f.data, 'mods/RaceMenu/SKSE/Plugins/skee64.ini', '[Features]');
    write(f.data, 'mods/RaceMenu/SKSE/Plugins/skee64.pdb', 'debug symbols');
    write(f.data, 'mods/RaceMenu/ModderResource/NiOverride.h', 'header');
    const loadOrder = ['Skyrim.esm', 'mods/RaceMenu/RaceMenu.esp', 'mods/RaceMenu/RaceMenuPlugin.esp'];
    const names = loadOrder.map(name => path.basename(name));
    write(f.data, 'manifest.json', JSON.stringify({ versionMajor: 1, loadOrder: names, mods: JSON.parse(fs.readFileSync(path.join(f.data, 'manifest.json'))).mods.filter(mod => mod.filename === 'Skyrim.esm') }));
    return { ...f.options, loadOrder };
  };
  await check('a mod folder installs into the flat Data layout and never leaks its source path', async (f) => {
    const server = await serve(raceMenu(f));
    try {
      const manifest = await (await fetch(server.base + 'api/launcher/manifest')).json();
      assert.equal(manifest.version, '2');
      assert.deepEqual(manifest.loadOrder, ['Skyrim.esm', 'RaceMenu.esp', 'RaceMenuPlugin.esp']);
      const paths = manifest.resources.map(file => file.path);
      for (const expected of ['Data/RaceMenu.esp', 'Data/RaceMenuPlugin.esp', 'Data/RaceMenu.bsa', 'Data/SKSE/Plugins/skee64.ini']) assert(paths.includes(expected), expected);
      assert(!paths.some(value => /\.(?:dll|pdb|h)$/.test(value) || value.includes('mods/')));
      const file = manifest.resources.find(entry => entry.name === 'RaceMenu.bsa');
      assert.equal(await (await fetch(server.base + file.downloadPath)).text(), 'race archive');
      const scan = await loadApi().scanModFolders(raceMenu(f));
      assert.deepEqual(scan.skipped, [{ mod: 'RaceMenu', file: 'SKSE/Plugins/skee64.dll' }]);
    } finally { await server.close(); }
  });
  await check('SKSE DLLs need an operator opt-in and a game version, and raise the manifest version', async (f) => {
    const options = { ...raceMenu(f), skseFolders: ['RaceMenu'] };
    const missing = await serve(options);
    try { assert.equal((await fetch(missing.base + 'api/launcher/manifest')).status, 503); } finally { await missing.close(); }
    const server = await serve({ ...options, skseGameVersion: '1.6.1170.0' });
    try {
      const manifest = await (await fetch(server.base + 'api/launcher/manifest')).json();
      assert.equal(manifest.version, '4'); assert.equal(manifest.skseGameVersion, '1.6.1170.0');
      const dll = manifest.resources.find(file => file.name === 'skee64.dll');
      assert.equal(dll.kind, 'skse-plugin'); assert.equal(dll.path, 'Data/SKSE/Plugins/skee64.dll');
    } finally { await server.close(); }
  });
  await check('runtime DLLs and protected files in a mod folder are skipped, not fatal', async (f) => {
    write(f.data, 'mods/Bad/SKSE/Plugins/SkyrimPlatform.dll', 'replacement');
    write(f.data, 'mods/Bad/Skyrim.esm', 'not distributable');
    write(f.data, 'mods/Bad/Platform/Plugins/skymp5-client-settings.txt', 'private');
    write(f.data, 'mods/Bad/tool.exe', 'installer');
    const manifest = await new (loadApi().LauncherResourceStore)({ ...f.options, skseFolders: ['Bad'], skseGameVersion: '1.6.1170.0' }).manifest();
    assert.equal(manifest.version, '2');
    assert(!manifest.resources.some(file => /SkyrimPlatform|skymp5-client-settings|tool\.exe/.test(file.path)));
    const scan = await loadApi().scanModFolders({ ...f.options, skseFolders: ['Bad'] });
    assert.equal(scan.skipped.filter(item => item.mod === 'Bad').length, 4);
  });
  await check('later folders win conflicts and modFolders sets the order', async (f) => {
    write(f.data, 'mods/First/textures/same.dds', 'first'); write(f.data, 'mods/Second/textures/same.dds', 'second');
    const value = async modFolders => { const scan = await loadApi().scanModFolders({ ...f.options, modFolders }); return { source: scan.sources.get('data/textures/same.dds').mod, conflicts: scan.conflicts.filter(item => item.file.endsWith('same.dds')) }; };
    assert.deepEqual(await value(undefined), { source: 'Second', conflicts: [{ file: 'Data/textures/same.dds', winner: 'Second', loser: 'First' }] });
    assert.equal((await value(['Assets', 'Second', 'First'])).source, 'First');
  });
  const api = loadApi();
  for (const bad of ['../Data/Foo.esp', 'Data/../secret.dds', 'Data/a:stream.dds', 'Data/NUL.dds', 'Data/COM1/test.dds', 'Data/a./file.dds', 'Data\\x.dds', 'Data/Platform/settings.txt']) assert.throws(() => api.validateClientPath(bad));
  checks++;
  console.log(JSON.stringify({ ok: true, platform: process.platform, checks, skipped, scope: 'real HTTP v2, path-preserving files, SHA256/size, local game requirements, HEAD/range/ETag, revision changes, hidden server files, invalid publications and traversal/symlinks' }));
}
module.exports = { loadApi, fixture, serve, dispose, write, hash };
if (require.main === module) run().catch(error => { console.error(error); process.exitCode = 1; });
