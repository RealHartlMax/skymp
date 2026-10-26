// Real HTTP announcement regression with the native server's packet interface.
// No chat adapter, native game, Steam connection or external server is used.
// Run: node skymp5-server/tests/announcements.integration.mjs
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
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-announcement-test-'));
const bundle = path.join(temporary, 'announcement-http.cjs');
const previousCwd = process.cwd();
const checks = [];
let listener;

try {
  await esbuild.build({
    stdin: {
      contents: "export {createApp, adminAuthParse, setServer} from './ts/ui';",
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
    name: 'Announcement HTTP fixture', port: 7777, maxPlayers: 16, loadOrder: [],
    dataDir: path.join(temporary, 'data'), offlineMode: true, adminApi: { enabled: true },
    adminUiAuth: { user: 'owner', password: crypto.randomBytes(24).toString('hex') },
    adminUiUsers: { owner: { role: 'admin' } },
  };
  fs.mkdirSync(cfg.dataDir);
  fs.writeFileSync('server-settings.json', JSON.stringify(cfg));
  const connected = new Set([0, 7]);
  const actorId = id => 0xff000010 + id;
  const packets = [];
  // sendChatMessage/sendMessage deliberately do not exist on this fixture.
  api.setServer({
    get: (id, key) => id === 0 && key === 'onlinePlayers'
      ? [...connected].map(actorId).concat([actorId(0), 'invalid', NaN]) : undefined,
    getUserActor: id => connected.has(id) ? actorId(id) : 0,
    getUserByActor: actor => connected.has(actor - 0xff000010) ? actor - 0xff000010 : -1,
    sendCustomPacket: (userId, payload) => packets.push({ userId, payload: JSON.parse(payload) }),
  });
  const settings = { ...cfg, allSettings: cfg };
  api.adminAuthParse(settings);
  const app = api.createApp(settings, () => listener.address().port);
  listener = http.createServer(app.callback());
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${listener.address().port}`;
  const authorization = 'Basic ' + Buffer.from(`owner:${cfg.adminUiAuth.password}`).toString('base64');
  const post = (route, value, headers = {}) => fetch(base + route, {
    method: 'POST', headers: { authorization, 'Content-Type': 'application/json', origin: base, ...headers },
    body: JSON.stringify(value),
  });

  const message = 'Server-Neustart in 5 Minuten – ÄÖÜ Довакин!\nBitte sicher ausloggen.';
  let response = await post('/api/admin/announcement', { message: `  ${message}  `, reason: 'PRIVATE_ADMIN_REASON' });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, count: 2, userIds: [0, 7] });
  assert.equal(packets.length, 2);
  for (const [index, userId] of [0, 7].entries()) assert.deepEqual(packets[index], {
    userId, payload: { customPacketType: 'announcementToast', message, durationMs: 8000 },
  });
  assert(!JSON.stringify(packets).includes('PRIVATE_ADMIN_REASON'));
  checks.push('The dashboard API broadcasts the existing eight-second HUD packet to each unique online native user, including user 0, without optional chat adapters');

  const sent = packets.length;
  for (const value of [{ message: '' }, { message: '  \n  ' }, {}]) {
    assert.equal((await post('/api/admin/announcement', value)).status, 400);
  }
  assert.equal((await post('/api/admin/announcement', { message }, { authorization: '' })).status, 401);
  cfg.adminUiCapabilities = { canMessage: false };
  assert.equal((await post('/api/admin/announcement', { message })).status, 403);
  assert.equal(packets.length, sent);
  cfg.adminUiCapabilities = { canMessage: true };
  checks.push('Empty messages, missing authentication and missing message permission send no player packets');

  response = await post('/api/admin/console', { command: 'announce "Console announcement"' });
  assert.equal(response.status, 200);
  assert.equal(packets.length, sent + 2);
  assert.equal(packets.at(-1).payload.customPacketType, 'announcementToast');
  assert.equal(packets.at(-1).payload.message, 'Console announcement');
  checks.push('Console announcements continue using the same existing client packet handler');

  connected.clear();
  const beforeOffline = packets.length;
  response = await post('/api/admin/announcement', { message });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, count: 0, userIds: [] });
  assert.equal(packets.length, beforeOffline);
  checks.push('No connected players yields zero recipients and no packet');
  console.log(JSON.stringify({ ok: true, checks, skyrimStarted: false }, null, 2));
} finally {
  esbuild.stop();
  if (listener?.listening) await new Promise(resolve => listener.close(resolve));
  process.chdir(previousCwd);
  assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
  assert(path.basename(temporary).startsWith('skymp-announcement-test-'));
  fs.rmSync(temporary, { recursive: true, force: true });
}
