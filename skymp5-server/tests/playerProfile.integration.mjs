// Local HTTP regression: a WebSocket-visible player must have a profile before
// the REST player list has ever been requested. No game, Steam or VPS connection.
// Run from any directory: node skymp5-server/tests/playerProfile.integration.mjs
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
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-player-profile-'));
const output = process.env.SKYMP_PROFILE_UNIT_BUNDLE || path.join(temporary, 'profile-http.cjs');
const previousCwd = process.cwd();
const checks = [];
let listener;

try {
  if (!process.env.SKYMP_PROFILE_UNIT_BUNDLE) await esbuild.build({
    stdin: {
      contents: "export {createApp, adminAuthParse, setServer} from './ts/ui'; export {authenticateSteamTicket, SteamPlayerSessions} from './ts/playerAccess';",
      resolveDir: serverRoot,
      loader: 'ts',
    },
    outfile: output, absWorkingDir: serverRoot, bundle: true,
    platform: 'node', target: 'es2022', logLevel: 'silent',
    alias: { '@opentelemetry/api': './ts/shims/opentelemetry-api.js' },
    plugins: [{ name: 'expose-private-router-only-in-test', setup(build) {
      build.onLoad({ filter: /[\\/]ts[\\/]ui\.ts$/ }, args => ({
        contents: fs.readFileSync(args.path, 'utf8') + '\nexport {createApp, adminAuthParse};',
        loader: 'ts',
      }));
    } }],
  });
  esbuild.stop();
  process.chdir(temporary);
  const api = require(output);
  const password = crypto.randomBytes(24).toString('hex');
  const cfg = {
    name: 'Local profile regression', port: 7777, maxPlayers: 16,
    dataDir: path.join(temporary, 'data'), loadOrder: [], offlineMode: true,
    adminApi: { enabled: true }, adminUiAuth: { user: 'owner', password },
    adminUiUsers: { owner: { role: 'admin' } },
    playerAccess: { mode: 'guest', approvalRequired: false, steamApiKey: 'a'.repeat(32), steamAppId: 489830 },
  };
  fs.mkdirSync(cfg.dataDir);
  fs.writeFileSync(path.join(temporary, 'server-settings.json'), JSON.stringify(cfg));
  const joined = Date.now() - 120000;
  fs.writeFileSync(path.join(cfg.dataDir, 'admin-player-stats.json'), JSON.stringify([{
    userId: 2, firstJoinedAt: joined, lastConnectionAt: joined,
    totalPlayMs: 90000, activeSessionStartedAt: null,
    lastDisplayName: 'Offline player', identifiers: [], notes: 'Preserved offline note',
  }]));
  const connected = new Set([1]);
  const server = {
    get: (id, key) => id === 0 && key === 'onlinePlayers' ? [...connected].map(id => 0xff000000 + id) : undefined,
    getUserActor: id => connected.has(id) ? 0xff000000 + id : 0,
    getUserByActor: actor => connected.has(actor - 0xff000000) ? actor - 0xff000000 : -1,
    getActorName: () => 'Maximus', getUserIp: () => '127.0.0.1',
    getActorPos: () => [1, 2, 3], getActorCellOrWorld: () => 60,
    getUserGuid: id => `fixture-guid-${id}`, isConnected: id => connected.has(id), sendCustomPacket() {},
  };
  api.setServer(server);
  const settings = { ...cfg, allSettings: cfg };
  api.adminAuthParse(settings);
  const app = api.createApp(settings, () => listener.address().port);
  listener = http.createServer(app.callback());
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${listener.address().port}`;
  const headers = { authorization: 'Basic ' + Buffer.from(`owner:${password}`).toString('base64') };
  const request = (url, options = {}) => fetch(base + url, { ...options, headers: { ...headers, ...options.headers } });
  const put = body => ({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  const first = await request('/api/admin/players/1/profile');
  assert.equal(first.status, 200);
  const profile = await first.json();
  assert.equal(profile.displayName, 'Maximus'); assert.equal(profile.online, true);
  checks.push('live profile opens before the REST player list is requested');

  const restored = await (await request('/api/admin/players/2/profile')).json();
  assert.equal(restored.online, false); assert.equal(restored.playTimeSec, 90);
  assert.equal(restored.notes, 'Preserved offline note');
  checks.push('persisted null session stays offline without epoch-sized playtime');

  const steamId = '76561198000000000';
  const auth = await api.authenticateSteamTicket(cfg, 'ab'.repeat(128), steamId,
    async () => Response.json({ response: { params: { result: 'OK', steamid: steamId } } }), undefined, 'Hüter ÄÖÜ');
  const sessions = new api.SteamPlayerSessions(() => cfg, () => {});
  sessions.handle(1, 'loginWithSteam', { steamSession: auth.steamSession }, { svr: server });
  const verified = await (await request('/api/admin/players/1/profile')).json();
  assert.equal(verified.steamId, steamId); assert.equal(verified.playerName, 'Hüter ÄÖÜ');
  assert.equal(JSON.stringify(verified).includes(auth.steamSession), false);
  assert.equal(JSON.stringify(verified).includes(cfg.playerAccess.steamApiKey), false);
  checks.push('verified Steam identity is returned without private session or API key');

  assert.equal((await request('/api/admin/players/1/profile', put({
    identifiers: ['discord:123456789012345678'], notes: 'Notiz ÄÖÜ Довакин', steamId: '76561198000000001',
  }))).status, 200);
  const saved = await (await request('/api/admin/players/1/profile')).json();
  assert.deepEqual(saved.identifiers, ['discord:123456789012345678']);
  assert.equal(saved.notes, 'Notiz ÄÖÜ Довакин'); assert.equal(saved.steamId, steamId);
  checks.push('manual identifiers and Unicode notes cannot replace verified Steam identity');

  assert.equal((await request('/api/admin/players/1/profile', { headers: { authorization: '' } })).status, 401);
  cfg.adminUiCapabilities = { canViewLogs: false };
  assert.equal((await request('/api/admin/players/1/profile')).status, 403);
  assert.equal((await request('/api/admin/players/1/profile', put({ notes: 'forbidden' }))).status, 403);
  cfg.adminUiCapabilities = { canViewLogs: true };
  checks.push('authentication and profile permissions are required for read and write');

  assert.equal((await request('/api/admin/players/999/profile')).status, 404);
  for (const id of ['1.5', '-1', '9007199254740992']) {
    assert.equal((await request(`/api/admin/players/${id}/profile`)).status, 400);
    assert.equal((await request(`/api/admin/players/${id}/profile`, put({ notes: '' }))).status, 400);
  }
  checks.push('unknown players stay 404 and invalid user IDs are rejected');

  connected.add(3);
  assert.equal((await request('/api/admin/players/3/profile', put({ notes: 'First action is a write' }))).status, 200);
  assert.equal((await (await request('/api/admin/players/3/profile')).json()).notes, 'First action is a write');
  checks.push('first profile write also initializes a newly connected player');

  connected.delete(1); sessions.disconnect(1);
  const offline = await (await request('/api/admin/players/1/profile')).json();
  assert.equal(offline.online, false); assert.equal(offline.steamId, undefined);
  assert.equal(offline.notes, 'Notiz ÄÖÜ Довакин');
  checks.push('disconnect retains notes and clears online session identity');
  console.log(JSON.stringify({ ok: true, checks, skyrimStarted: false, externalServerContacted: false }, null, 2));
} finally {
  esbuild.stop();
  if (listener?.listening) await new Promise(resolve => listener.close(resolve));
  process.chdir(previousCwd);
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  assert(path.basename(temporary).startsWith('skymp-player-profile-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
