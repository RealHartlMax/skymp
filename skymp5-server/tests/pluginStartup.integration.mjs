// Exercise actual discovery and temporary-entry startup helpers without a native game.
// Run: node skymp5-server/tests/pluginStartup.integration.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('../node_modules/typescript');
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-plugin-startup-test-'));
const previousCwd = process.cwd();
const previousMp = globalThis.mp;
const statuses = [], logs = [], checks = [];
const transpile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

try {
  process.chdir(temporary);
  const stateModule = { exports: {} };
  new Function('require', 'module', 'exports', transpile(fs.readFileSync(path.join(serverRoot, 'ts/pluginDiscoveryState.ts'), 'utf8')))(require, stateModule, stateModule.exports);
  const state = stateModule.exports;
  const sourcePath = path.join(serverRoot, 'ts/index.ts');
  const source = fs.readFileSync(sourcePath, 'utf8');
  const syntax = ts.createSourceFile(sourcePath, source, ts.ScriptTarget.Latest, true);
  const names = new Set(['pluginsLog', 'pluginsWarn', 'pluginsError', 'SAFE_PLUGIN_NAME_RE', 'SAFE_VERSION_RE',
    'toAbsolutePath', 'getAlternativeNtfsAliasPath', 'resolveExistingPath', 'sha256', 'ensureMainPath', 'isRelativePathSafe',
    'readPluginManifest', 'fingerprintPlugin', 'discoverPlugins', 'buildPluginSortOrder', 'askToEnablePlugin',
    'requireTemp', 'runGamemodePlugin', 'bootstrapPlugins']);
  const selected = [];
  for (const node of syntax.statements) {
    const declared = ts.isFunctionDeclaration(node) && node.name ? [node.name.text]
      : ts.isVariableStatement(node) ? node.declarationList.declarations.map(value => value.name.getText(syntax)) : [];
    if (declared.some(name => names.has(name))) {
      selected.push(node.getFullText(syntax));
      declared.forEach(name => names.delete(name));
    }
  }
  assert.equal(names.size, 0, 'Missing actual loader helpers: ' + [...names].join(', '));
  const ui = { updatePluginRuntimeStatus: (name, status, detail) => statuses.push({ name, status, detail }) };
  const fakeProcess = { cwd: () => process.cwd(), platform: process.platform, stdin: { isTTY: false }, stdout: { isTTY: false }, exit() { throw Error('Unexpected server exit'); } };
  const logger = Object.fromEntries(['log', 'warn', 'error'].map(level => [level, (...args) => logs.push(args.join(' '))]));
  const bootstrap = new Function('fs', 'os', 'path', 'crypto', 'ui', 'readDiscoveryState', 'writeDiscoveryState', 'PLUGINS_DIR',
    'installShutdownHooks', 'runProcessPlugin', 'require', 'process', 'console',
    transpile(selected.join('\n')) + '\nreturn bootstrapPlugins;')(
    fs, os, path, crypto, ui, state.readDiscoveryState, state.writeDiscoveryState, state.PLUGINS_DIR,
    () => {}, () => { throw Error('Unexpected process plugin'); }, require, fakeProcess, logger,
  );
  const server = { executed: [] };
  globalThis.mp = server;
  const addPlugin = (name, startupDefault = false, version = '1.0.0') => {
    const directory = path.join(state.PLUGINS_DIR, name);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, 'plugin.json'), JSON.stringify({
      name, version, displayName: name, description: 'Disposable startup fixture', kind: 'gamemode', main: 'index.cjs', startupDefault,
    }));
    fs.writeFileSync(path.join(directory, 'index.cjs'), `mp.executed.push(${JSON.stringify(name)});`);
  };
  const start = mode => bootstrap(server, { mode: state.normalizePluginDiscoveryMode(mode), loadOrder: [], abortOnPluginError: true, processCommandAllowlist: [] });
  addPlugin('safe-first', true);
  await start(undefined);
  assert.deepEqual(server.executed, []);
  assert.equal(state.readDiscoveryState().plugins['safe-first'].startupEnabled, false);
  assert(statuses.some(value => value.name === 'safe-first' && value.status === 'stopped'));
  checks.push('Default safe mode discovers but does not execute a new plugin, even with startupDefault=true');

  addPlugin('automatic', false);
  await start('auto');
  assert.deepEqual(server.executed, ['automatic']);
  let saved = state.readDiscoveryState();
  assert.equal(saved.plugins.automatic.startupEnabled, true);
  assert.equal(saved.plugins['safe-first'].startupEnabled, false);
  assert(statuses.some(value => value.name === 'automatic' && value.status === 'running'));
  checks.push('Auto mode discovers and executes a new plugin in the same start while preserving a known disabled plugin');

  await start('auto');
  assert.deepEqual(server.executed, ['automatic', 'automatic']);
  saved = state.readDiscoveryState();
  saved.plugins.automatic.startupEnabled = false;
  state.writeDiscoveryState(saved);
  addPlugin('automatic', false, '2.0.0');
  await start('auto');
  assert.deepEqual(server.executed, ['automatic', 'automatic']);
  assert.equal(state.readDiscoveryState().plugins.automatic.version, '2.0.0');
  assert.equal(state.readDiscoveryState().plugins.automatic.startupEnabled, false);
  checks.push('Startup approval persists across starts; disabling a plugin remains effective after an update in auto mode');

  saved = state.readDiscoveryState();
  saved.plugins['safe-first'].startupEnabled = true;
  state.writeDiscoveryState(saved);
  await start('safe');
  assert.equal(server.executed.at(-1), 'safe-first');
  addPlugin('noninteractive-prompt');
  await start('prompt');
  assert.equal(state.readDiscoveryState().plugins['noninteractive-prompt'].startupEnabled, false);
  addPlugin('invalid-mode');
  await start('invalid');
  assert.equal(state.readDiscoveryState().plugins['invalid-mode'].startupEnabled, false);
  assert.equal(state.readDiscoveryState().plugins['safe-first'].startupEnabled, true);
  assert(!logs.some(line => line.includes('failed to start')));
  checks.push('Switching modes preserves existing approvals; prompt without a TTY and invalid settings leave new plugins disabled');
  console.log(JSON.stringify({ ok: true, checks, nativeGameStarted: false }, null, 2));
} finally {
  globalThis.mp = previousMp;
  process.chdir(previousCwd);
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  assert(path.basename(temporary).startsWith('skymp-plugin-startup-test-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
