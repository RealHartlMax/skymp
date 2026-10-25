#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i += 2) {
  if (!args[i].startsWith('--') || !args[i + 1]) throw new Error('Expected --option value pairs');
  options[args[i].slice(2)] = args[i + 1];
}
for (const name of ['platform', 'source', 'scripts', 'output', 'metadata']) {
  if (!options[name]) throw new Error(`Missing --${name}`);
}
if (!['linux-x64', 'windows-x64'].includes(options.platform)) throw new Error('Unsupported platform');
const mode = options.mode || 'preset';
if (!['preset', 'first-run'].includes(mode)) throw new Error('Expected --mode preset or first-run');
const source = path.resolve(options.source);
const output = path.resolve(options.output);
const backend = path.resolve(options.backend || path.join(source, 'dist_back'));
const frontend = path.resolve(options.frontend || path.join(source, 'ui'));
const nativeFile = path.resolve(options.native || path.join(source, 'scam_native.node'));
const scripts = path.resolve(options.scripts);
const metadata = JSON.parse(fs.readFileSync(options.metadata, 'utf8'));
if (fs.existsSync(output)) throw new Error(`Output already exists: ${output}`);
if (output.startsWith(source + path.sep)) throw new Error('Output must be outside the source package');
if (!metadata.sourceFingerprint || (mode === 'preset' && (!metadata.profile?.user || !metadata.profile?.password || !metadata.profile?.salt || !metadata.profile?.masterKey))) throw new Error('Incomplete build metadata');

const header = Buffer.alloc(4);
const descriptor = fs.openSync(nativeFile, 'r');
fs.readSync(descriptor, header, 0, header.length, 0);
fs.closeSync(descriptor);
if (options.platform === 'linux-x64' && header.toString('hex') !== '7f454c46') throw new Error('Linux package requires an ELF module');
if (options.platform === 'windows-x64' && header.subarray(0, 2).toString() !== 'MZ') throw new Error('Windows package requires a PE module');

fs.mkdirSync(path.join(output, 'data/scripts'), { recursive: true });
fs.mkdirSync(path.join(output, 'client-resources/Data'), { recursive: true });
fs.copyFileSync(path.join(__dirname, 'test-server/client-resources/README.md'), path.join(output, 'client-resources/README.md'));
fs.mkdirSync(path.join(output, 'server-assets'));
for (const name of ['logo.png', 'banner.png']) {
  const source = path.resolve(__dirname, '../..', name);
  fs.copyFileSync(source, path.join(output, name));
  // Updates ship defaults separately so operator-owned root images survive.
  fs.copyFileSync(source, path.join(output, 'server-assets', name));
}
fs.cpSync(frontend, path.join(output, 'ui'), { recursive: true });
fs.mkdirSync(path.join(output, 'dist_back'));
for (const name of ['skymp5-server.js', 'skymp5-server.js.map', 'skymp5-admin.js', 'skymp5-admin.js.map']) fs.copyFileSync(path.join(backend, name), path.join(output, 'dist_back', name));
fs.copyFileSync(nativeFile, path.join(output, 'scam_native.node'));
for (const name of ['gamemode.js', 'package.json', 'package-lock.json']) fs.copyFileSync(path.join(source, name), path.join(output, name));
for (const name of fs.readdirSync(scripts).filter(name => name.endsWith('.pex'))) fs.copyFileSync(path.join(scripts, name), path.join(output, 'data/scripts', name));

const { user, password, salt, masterKey } = mode === 'preset' ? metadata.profile : {};
const settings = {
  name: 'SkyMP Test Server', port: 7777, uiPort: 8080, maxPlayers: 16,
  listenHost: '0.0.0.0', uiListenHost: '127.0.0.1', dataDir: 'data',
  loadOrder: ['Skyrim.esm', 'Update.esm', 'Dawnguard.esm', 'HearthFires.esm', 'Dragonborn.esm'],
  offlineMode: false, playerAccess: { mode: 'guest', approvalRequired: false, steamApiKey: '', steamAppId: 489830 }, master: 'https://api.skymp-worlds.net', masterKey: masterKey || '', serverUid: '',
  launcherResources: { enabled: true, directory: './client-resources', runtimeSource: 'https://update.skymp-worlds.net/client-runtime/catalog.json' },
  npcEnabled: false, itemsEnabled: true, discordAuth: null, discordBot: { enabled: false },
  adminApi: { enabled: true }, adminUiUsers: user ? { [user]: { role: 'admin' } } : {},
  startSpawn: { pos: [133857, -61130, 14662], worldOrCell: '0x3c', angleZ: 72 },
  starterInventory: { entries: [] }, npcSettings: {},
};
fs.writeFileSync(path.join(output, 'server-settings.json'), JSON.stringify(settings, null, 2) + '\n');
if (mode === 'preset') {
  const n = 16384, r = 8, p = 1;
  const hash = crypto.scryptSync(password, salt, 64, { N: n, r, p }).toString('hex');
  fs.writeFileSync(path.join(output, 'data/admin-auth.json'), JSON.stringify({ user, algo: 'scrypt-v1', passwordHash: `scrypt-v1$${n}$${r}$${p}$${salt}$${hash}` }, null, 2) + '\n', { mode: 0o600 });
  fs.writeFileSync(path.join(output, 'TEST-ZUGANG.txt'), `Lokaler Admin: http://127.0.0.1:8080/admin\nBenutzer: ${user}\nPasswort: ${password}\n\nEigener Testzugang dieses Build-Paares. Konfiguration: server-settings.json\n`, { mode: 0o600 });
}
fs.writeFileSync(path.join(output, 'data/SPIELDATEN.txt'), 'Hier die fuenf Masterdateien deiner Skyrim-Installation ablegen:\n' + settings.loadOrder.join('\n') + '\n');
fs.copyFileSync(path.join(__dirname, 'test-server/README.md'), path.join(output, 'README-TEST.md'));
fs.copyFileSync(path.resolve(__dirname, '../../docs/docs_vps_ports_and_process_control.md'), path.join(output, 'PORTS-VPS.md'));
fs.copyFileSync(path.resolve(__dirname, '../../docs/docs_discord_bot.md'), path.join(output, 'DISCORD-BOT.md'));
fs.copyFileSync(path.resolve(__dirname, '../../docs/docs_ingame_login.md'), path.join(output, 'INGAME-LOGIN.md'));
fs.copyFileSync(path.resolve(__dirname, '../../skymp5-server/MOD_LOAD_ORDER.md'), path.join(output, 'MOD-LOAD-ORDER.md'));
fs.copyFileSync(path.resolve(__dirname, '../../docs/docs_packaged_server_update.md'), path.join(output, 'UPDATE-VPS.md'));
fs.copyFileSync(path.join(__dirname, 'test-server/check-install.cjs'), path.join(output, 'check-install.cjs'));
fs.copyFileSync(path.join(__dirname, 'test-server/setup-server.cjs'), path.join(output, 'setup-server.cjs'));
fs.copyFileSync(path.join(__dirname, 'test-server/launcher-connection.cjs'), path.join(output, 'launcher-connection.cjs'));
fs.copyFileSync(path.join(__dirname, 'test-server/setup-web.cjs'), path.join(output, 'setup-web.cjs'));
fs.copyFileSync(path.join(__dirname, 'test-server/server-supervisor.cjs'), path.join(output, 'server-supervisor.cjs'));
fs.cpSync(path.join(__dirname, 'test-server/supervisor-ui'), path.join(output, 'supervisor-ui'), { recursive: true });
for (const name of options.platform === 'linux-x64' ? ['bootstrap-runtime.sh', 'launch_server.sh'] : ['bootstrap-runtime.ps1', 'start-test-server.bat', 'launch_server.bat']) {
  fs.copyFileSync(path.join(__dirname, 'test-server', name), path.join(output, name));
}
fs.cpSync(path.join(__dirname, 'test-server/setup-ui'), path.join(output, 'setup-ui'), { recursive: true });
const launcher = options.platform === 'linux-x64' ? 'start-test-server.sh' : 'start-test-server.cmd';
fs.copyFileSync(path.join(__dirname, 'test-server', launcher), path.join(output, launcher));
fs.copyFileSync(path.resolve(__dirname, '../../skymp5-server/LICENSE'), path.join(output, 'LICENSE'));
fs.copyFileSync(path.resolve(__dirname, '../../THIRD_PARTY_LICENSES'), path.join(output, 'THIRD_PARTY_LICENSES'));
fs.writeFileSync(path.join(output, 'QUELLSTAND.txt'), `Build: ${metadata.buildId}\nBasis-Commit: ${metadata.sourceCommit}\nLokale Aenderungen: ${metadata.sourceDirty === false ? 'keine, sauberer CI-Checkout' : 'enthalten, nicht committet'}\nSHA256 Quell-Snapshot: ${metadata.sourceFingerprint}\nQuellen: ${metadata.sourceArchiveName || metadata.buildId + '-source.tar.gz'} (separat neben den Serverarchiven)\nLaufzeitdateien aus Build: ${metadata.runtimeBuildId || metadata.buildId}\nSHA256 Laufzeit-Quellstand: ${metadata.runtimeSourceFingerprint || metadata.sourceFingerprint}\n`);
fs.writeFileSync(path.join(output, 'release-info.json'), JSON.stringify({ version: metadata.version || metadata.buildId, commitSha: metadata.sourceCommit, builtAt: metadata.builtAt, source: metadata.source || 'local-test-build' }, null, 2) + '\n');

function sha256(file) {
  const fd = fs.openSync(file, 'r');
  const length = fs.fstatSync(fd).size;
  const digest = crypto.createHash('sha256');
  const buffer = Buffer.allocUnsafe(4 * 1024 * 1024);
  let position = 0;
  while (position < length) {
    const count = fs.readSync(fd, buffer, 0, Math.min(buffer.length, length - position), position);
    if (!count) throw new Error(`Unexpected end of ${file}`);
    digest.update(buffer.subarray(0, count)); position += count;
  }
  fs.closeSync(fd);
  return digest.digest('hex');
}
const files = [];
function scan(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (entry.isFile()) files.push({ path: path.relative(output, file).split(path.sep).join('/'), bytes: fs.statSync(file).size, sha256: sha256(file) });
    else throw new Error(`Unexpected non-file in test package: ${file}`);
  }
}
scan(output);
const manifest = {
  formatVersion: 1, purpose: 'server-test', installationMode: mode, platform: options.platform, nodeMinimum: 22,
  runtimeDependenciesBundled: true, runtimeBootstrap: 'node22-lts-private-runtime', processManager: 'packaged-supervisor', dashboardIndependent: true,
  discordHostedBy: 'dashboard',
  steamRequired: true, playerAuthProtocol: 'launcher-steam-webapi-v1', clientUpdateRequired: true,
  ...(mode === 'first-run' ? { setupMethod: 'browser-pin' } : {}),
  buildId: metadata.buildId, sourceCommit: metadata.sourceCommit, sourceFingerprint: metadata.sourceFingerprint,
  runtimeBuildId: metadata.runtimeBuildId || metadata.buildId,
  runtimeSourceFingerprint: metadata.runtimeSourceFingerprint || metadata.sourceFingerprint,
  nativeBuildId: metadata.nativeBuildId || metadata.runtimeBuildId || metadata.buildId,
  nativeSourceFingerprint: metadata.nativeSourceFingerprint || metadata.runtimeSourceFingerprint || metadata.sourceFingerprint,
  frontendBuildId: metadata.frontendBuildId || metadata.runtimeBuildId || metadata.buildId,
  frontendSourceFingerprint: metadata.frontendSourceFingerprint || metadata.runtimeSourceFingerprint || metadata.sourceFingerprint,
  sourceDirty: metadata.sourceDirty !== false, builtAt: metadata.builtAt, files,
};
fs.writeFileSync(path.join(output, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ output, platform: manifest.platform, sourceFingerprint: manifest.sourceFingerprint, files: files.length }));
