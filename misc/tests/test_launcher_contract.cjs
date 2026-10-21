// End-to-end: the actual server API feeds the compiled Rust launcher preparer.
// Uses a disposable game directory and never executes SKSE/Skyrim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { fixture, serve, dispose, write, hash } = require('./test_launcher_resources.cjs');
const harness = process.argv[2];
assert(harness && fs.existsSync(harness), 'Pass the compiled prepare-server integration executable');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function runProcess(args) {
  const child = spawn(harness, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
  const timeout = setTimeout(() => child.kill(), 60000);
  return new Promise((resolve, reject) => {
    child.once('error', error => { clearTimeout(timeout); reject(error); });
    child.once('exit', status => { clearTimeout(timeout); resolve({ status, stdout, stderr }); });
  });
}
(async () => {
  const f = fixture(); let server;
  const report = { ok: false, checks: [], gameStarted: false };
  const reportFile = process.env.SKYMP_CONTRACT_REPORT || path.resolve('launcher-contract-report.json');
  try {
    server = await serve(f.options);
    const game = path.join(f.root, 'game'), profile = path.join(f.root, 'profile'), cache = path.join(f.root, 'cache');
    write(game, 'Data/Skyrim.esm', fs.readFileSync(path.join(f.data, 'Skyrim.esm')));
    for (const file of ['Data/SKSE/Plugins/SkyrimPlatform.dll', 'Data/SKSE/Plugins/MpClientPlugin.dll', 'Data/Platform/Plugins/skymp5-client.js']) write(game, file, 'isolated runtime fixture; never executed');
    write(game, 'Data/Platform/Plugins/skymp5-client-settings.txt', '{"preserveThis":true}');
    write(game, 'Data/Scripts/ClientScript.pex', 'single-player script');
    write(profile, 'plugins.txt', '*Original.esp');
    const request = path.join(f.root, 'request.json');
    fs.writeFileSync(request, JSON.stringify({ ip: '127.0.0.1', port: 27777, resourceUrl: server.base, offline: true, profileId: 123, operationId: 'server-launcher-contract' }));
    const args = [request, game, profile, cache];
    const first = await runProcess(args); assert.equal(first.status, 0, first.stderr);
    const manifest = await (await fetch(server.base + 'api/launcher/manifest')).json();
    const result = JSON.parse(first.stdout); assert.equal(result.downloadedFiles, manifest.resources.length);
    assert.deepEqual(result.loadOrder, f.options.loadOrder);
    for (const file of manifest.resources) {
      const bytes = fs.readFileSync(path.join(game, file.path)); assert.equal(bytes.length, file.size); assert.equal('sha256:' + hash(bytes), file.hash);
    }
    assert.equal(fs.readFileSync(path.join(game, 'Data/textures/first/shared.dds'), 'utf8'), 'first texture');
    assert.equal(fs.readFileSync(path.join(game, 'Data/textures/second/shared.dds'), 'utf8'), 'second texture');
    const settings = JSON.parse(fs.readFileSync(path.join(game, 'Data/Platform/Plugins/skymp5-client-settings.txt')));
    assert.equal(settings.preserveThis, true); assert.equal(settings.gameData.profileId, 123);
    assert.equal(settings['server-port'], 27777);
    report.checks.push('Actual server v2 manifest drives Rust downloads, SHA256/size checks, directory-preserving installation, client settings and plugin load order');
    const second = await runProcess(args); assert.equal(second.status, 0, second.stderr);
    assert.equal(JSON.parse(second.stdout).downloadedFiles, 0);
    assert.equal(JSON.parse(second.stdout).cachedFiles, manifest.resources.length);
    report.checks.push('Second preparation verifies and reuses all cached mod files');
    const texture = manifest.resources.find(file => file.path === 'Data/textures/first/shared.dds');
    const cacheDir = path.join(cache, fs.readdirSync(cache)[0]);
    fs.writeFileSync(path.join(cacheDir, texture.hash.slice('sha256:'.length)), 'corrupted cache');
    const repaired = await runProcess(args); assert.equal(repaired.status, 0, repaired.stderr);
    assert.equal(JSON.parse(repaired.stdout).downloadedFiles, 1);
    report.checks.push('A corrupted cache entry is detected and downloaded again');
    write(f.publication, 'Data/textures/second/shared.dds', 'updated texture from the operator');
    await sleep(2100); // The public snapshot deliberately has a two-second metadata cache.
    const updated = await runProcess(args); assert.equal(updated.status, 0, updated.stderr);
    assert.equal(JSON.parse(updated.stdout).downloadedFiles, 1);
    assert.equal(fs.readFileSync(path.join(game, 'Data/textures/second/shared.dds'), 'utf8'), 'updated texture from the operator');
    report.checks.push('A server-side mod update changes the revision and replaces only the changed file');
    const originalSettings = fs.readFileSync(path.join(game, 'Data/Platform/Plugins/skymp5-client-settings.txt'));
    write(f.publication, 'Data/Community.esp', 'different from active server plugin');
    await sleep(2100);
    const rejected = await runProcess(args); assert.notEqual(rejected.status, 0); assert(rejected.stderr.includes('503'));
    assert.deepEqual(fs.readFileSync(path.join(game, 'Data/Platform/Plugins/skymp5-client-settings.txt')), originalSettings);
    assert.equal(fs.readFileSync(path.join(game, 'Data/Community.esp'), 'utf8'), 'TES4-custom-plugin');
    report.checks.push('Incomplete/mismatching publication blocks preparation without replacing the active installation');
    const restore = await runProcess(['--restore', game, profile, cache]); assert.equal(restore.status, 0, restore.stderr);
    assert(!fs.existsSync(path.join(game, 'Data/Community.esp')));
    assert(!fs.existsSync(path.join(game, 'Data/textures/first/shared.dds')));
    assert.equal(fs.readFileSync(path.join(game, 'Data/Scripts/ClientScript.pex'), 'utf8'), 'single-player script');
    assert.equal(fs.readFileSync(path.join(profile, 'plugins.txt'), 'utf8'), '*Original.esp');
    report.checks.push('Restore recovers original scripts/settings/load order and removes only launcher-installed files');
    report.ok = true;
  } catch (error) { report.error = error.stack; process.exitCode = 1; }
  finally { await dispose(f, server); fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report)); }
})();
