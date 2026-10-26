// Real local HTTP API checks with disposable plugin state; no game is started.
// Run: node skymp5-server/tests/plugins.integration.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const esbuild = require('../node_modules/esbuild');
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-plugins-test-'));
const bundle = path.join(temporary, 'plugins-http.cjs');
const previousCwd = process.cwd();
const checks = [];
let listener;

try {
  await esbuild.build({
    stdin: {
      contents: "export {createApp, adminAuthParse, updatePluginRuntimeStatus} from './ts/ui';",
      resolveDir: serverRoot, loader: 'ts',
    },
    outfile: bundle, absWorkingDir: serverRoot, bundle: true,
    platform: 'node', target: 'es2022', logLevel: 'silent',
    alias: { '@opentelemetry/api': './ts/shims/opentelemetry-api.js' },
    plugins: [{ name: 'expose-router-only-for-test', setup(build) {
      build.onLoad({ filter: /[\\/]ts[\\/]ui\.ts$/ }, args => ({
        contents: fs.readFileSync(args.path, 'utf8') + '\nexport {createApp, adminAuthParse};', loader: 'ts',
      }));
    } }],
  });
  esbuild.stop();
  process.chdir(temporary);
  const api = require(bundle);
  const cfg = {
    name: 'Plugin API fixture', port: 7777, maxPlayers: 16, loadOrder: [],
    dataDir: path.join(temporary, 'data'), offlineMode: true, adminApi: { enabled: true },
    adminUiAuth: { user: 'owner', password: crypto.randomBytes(24).toString('hex') },
    adminUiUsers: { owner: { role: 'admin' } },
    masterKey: 'LOCAL_PRIVATE_FIXTURE',
    pluginDiscovery: { processCommandAllowlist: ['node'], abortOnPluginError: true },
  };
  fs.mkdirSync(cfg.dataDir);
  const settingsFile = path.join(temporary, 'server-settings.json');
  fs.writeFileSync(settingsFile, JSON.stringify(cfg));
  const settingsBefore = fs.readFileSync(settingsFile, 'utf8');
  const pluginDirectory = path.join(temporary, 'Plugins/HelloPlugin');
  fs.mkdirSync(pluginDirectory, { recursive: true });
  fs.writeFileSync(path.join(pluginDirectory, 'plugin.json'), JSON.stringify({ name: 'hello', version: '1.0.0', kind: 'gamemode' }));
  // The admin API must never execute an entry when listing or enabling plugins.
  fs.writeFileSync(path.join(pluginDirectory, 'index.cjs'), "throw Error('Plugin entry must not execute in the dashboard');");
  for (const name of ['second', 'already-enabled']) {
    fs.mkdirSync(path.join(temporary, 'Plugins', name));
    fs.writeFileSync(path.join(temporary, 'Plugins', name, 'plugin.json'), JSON.stringify({ name, version: '1.0.0', kind: 'gamemode' }));
    fs.writeFileSync(path.join(temporary, 'Plugins', name, 'index.cjs'), "throw Error('Dashboard must not execute plugins');");
  }
  const stamp = new Date().toISOString();
  const entry = { pluginPath: 'Plugins/HelloPlugin', version: '1.0.0', fingerprint: 'fixture', startupEnabled: false, discoveredAt: stamp, updatedAt: stamp };
  const stateFile = path.join(temporary, 'Plugins/.discovery-state.json');
  fs.writeFileSync(stateFile, JSON.stringify({ version: 1, plugins: {
    hello: entry, removed: { ...entry, pluginPath: 'Plugins/Removed' },
    second: { ...entry, pluginPath: 'Plugins/second' },
    'already-enabled': { ...entry, pluginPath: 'Plugins/already-enabled', startupEnabled: true },
  } }));
  const settings = { ...cfg, allSettings: cfg };
  api.adminAuthParse(settings);
  api.updatePluginRuntimeStatus('hello', 'running');
  const app = api.createApp(settings, () => listener.address().port);
  listener = http.createServer(app.callback());
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${listener.address().port}`;
  const authorization = 'Basic ' + Buffer.from(`owner:${cfg.adminUiAuth.password}`).toString('base64');
  const request = (route, init = {}) => fetch(base + route, { ...init, headers: { authorization, ...init.headers } });
  const patch = body => ({ method: 'PATCH', headers: { 'Content-Type': 'application/json', origin: base }, body: JSON.stringify(body) });
  const putMode = mode => ({ ...patch({ mode }), method: 'PUT' });
  const enableAll = { ...patch({}), method: 'POST' };

  let response = await request('/api/admin/plugins');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  let list = await response.json();
  assert.equal(list.length, 4);
  assert.equal(list.find(plugin => plugin.name === 'hello').manifestPresent, true);
  assert.equal(list.find(plugin => plugin.name === 'removed').manifestPresent, false);
  assert.equal(list.find(plugin => plugin.name === 'removed').runtimeStatus, null);
  assert.equal(list.find(plugin => plugin.name === 'hello').runtimeStatus.status, 'running');
  assert.equal(list.find(plugin => plugin.name === 'hello').startupEnabled, false);
  checks.push('Discovered plugins expose independent runtime/startup state and missing manifests without executing entries');

  response = await request('/api/admin/plugins/hello', patch({ startupEnabled: true }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).restartRequired, true);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(JSON.parse(fs.readFileSync(stateFile)).plugins.hello.startupEnabled, true);
  assert.deepEqual(JSON.parse(fs.readFileSync(stateFile)).plugins.removed, { ...entry, pluginPath: 'Plugins/Removed' });
  response = await request('/api/admin/plugins/hello', patch({ startupEnabled: false }));
  assert.equal(response.status, 200);
  list = await (await request('/api/admin/plugins')).json();
  assert.equal(list.find(plugin => plugin.name === 'hello').startupEnabled, false);
  assert.equal(list.find(plugin => plugin.name === 'hello').runtimeStatus.status, 'running');
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), settingsBefore);
  checks.push('Enable/disable persists only startup state, reports the required restart, and preserves current runtime and server settings');

  response = await request('/api/admin/plugins/settings');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { mode: 'safe' });
  // Settings edited outside this request must also survive the mode save.
  const externalSettings = { ...cfg, externallyEdited: { keep: 'disk-value' } };
  fs.writeFileSync(settingsFile, JSON.stringify(externalSettings));
  for (const mode of ['auto', 'prompt', 'safe', 'auto']) {
    response = await request('/api/admin/plugins/settings', putMode(mode));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, mode, restartRequired: true });
    const written = JSON.parse(fs.readFileSync(settingsFile));
    assert.deepEqual(written, { ...externalSettings, pluginDiscovery: { ...externalSettings.pluginDiscovery, mode } });
    assert.deepEqual(await (await request('/api/admin/plugins/settings')).json(), { mode });
  }
  assert.equal(JSON.parse(fs.readFileSync(stateFile)).plugins.hello.startupEnabled, false);
  checks.push('All discovery modes round-trip through the API while preserving private settings, nested plugin options, external edits and existing plugin flags');

  response = await request('/api/admin/plugins/enable-all', enableAll);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const bulk = await response.json();
  assert.deepEqual(bulk.names.sort(), ['hello', 'second']);
  assert.equal(bulk.count, 2);
  assert.equal(bulk.restartRequired, true);
  const bulkState = JSON.parse(fs.readFileSync(stateFile));
  assert.equal(bulkState.plugins.hello.startupEnabled, true);
  assert.equal(bulkState.plugins.second.startupEnabled, true);
  assert.deepEqual(bulkState.plugins.removed, { ...entry, pluginPath: 'Plugins/Removed' });
  assert.deepEqual(bulkState.plugins['already-enabled'], { ...entry, pluginPath: 'Plugins/already-enabled', startupEnabled: true });
  list = await (await request('/api/admin/plugins')).json();
  assert.equal(list.find(plugin => plugin.name === 'hello').runtimeStatus.status, 'running');
  const beforeNoOp = fs.readFileSync(stateFile, 'utf8');
  assert.deepEqual(await (await request('/api/admin/plugins/enable-all', enableAll)).json(), { ok: true, names: [], count: 0, restartRequired: false });
  assert.equal(fs.readFileSync(stateFile, 'utf8'), beforeNoOp);
  checks.push('Bulk activation enables every eligible disabled plugin, skips missing manifests, preserves enabled entries and runtime state, and does not rewrite on a second call');

  const stateBeforeRejected = fs.readFileSync(stateFile, 'utf8');
  const settingsBeforeRejected = fs.readFileSync(settingsFile, 'utf8');
  assert.equal((await request('/api/admin/plugins/settings', putMode('unknown'))).status, 400);
  assert.equal((await request('/api/admin/plugins/hello', patch({ startupEnabled: 'true' }))).status, 400);
  assert.equal((await request('/api/admin/plugins/not-discovered', patch({ startupEnabled: true }))).status, 404);
  assert.equal((await request('/api/admin/plugins', { headers: { authorization: '' } })).status, 401);
  assert.equal((await request('/api/admin/plugins/hello', { ...patch({ startupEnabled: true }), headers: { 'Content-Type': 'application/json', authorization: '' } })).status, 401);
  assert.equal((await request('/api/admin/plugins/settings', { headers: { authorization: '' } })).status, 401);
  assert.equal((await request('/api/admin/plugins/settings', { ...putMode('safe'), headers: { 'Content-Type': 'application/json', authorization: '' } })).status, 401);
  assert.equal((await request('/api/admin/plugins/enable-all', { ...enableAll, headers: { 'Content-Type': 'application/json', authorization: '' } })).status, 401);
  settings.allSettings.adminUiCapabilities = { canViewLogs: true, canConsole: false };
  assert.equal((await request('/api/admin/plugins')).status, 200);
  assert.equal((await request('/api/admin/plugins/settings')).status, 200);
  assert.equal((await request('/api/admin/plugins/hello', patch({ startupEnabled: true }))).status, 403);
  assert.equal((await request('/api/admin/plugins/settings', putMode('safe'))).status, 403);
  assert.equal((await request('/api/admin/plugins/enable-all', enableAll)).status, 403);
  settings.allSettings.adminUiCapabilities.canViewLogs = false;
  assert.equal((await request('/api/admin/plugins')).status, 403);
  assert.equal((await request('/api/admin/plugins/settings')).status, 403);
  assert.equal(fs.readFileSync(stateFile, 'utf8'), stateBeforeRejected);
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), settingsBeforeRejected);
  checks.push('Unauthenticated/unauthorized access, invalid modes/startup values and undiscovered names cannot modify plugin state or server settings');

  settings.allSettings.adminUiCapabilities = { canConsole: true, canViewLogs: true };
  fs.writeFileSync(settingsFile, '{invalid JSON');
  assert.equal((await request('/api/admin/plugins/settings', putMode('auto'))).status, 503);
  assert.equal(fs.readFileSync(settingsFile, 'utf8'), '{invalid JSON');
  checks.push('A damaged server settings file is reported without being overwritten');
  console.log(JSON.stringify({ ok: true, checks, skyrimStarted: false }, null, 2));
} finally {
  esbuild.stop();
  if (listener?.listening) await new Promise(resolve => listener.close(resolve));
  process.chdir(previousCwd);
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  assert(path.basename(temporary).startsWith('skymp-plugins-test-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
