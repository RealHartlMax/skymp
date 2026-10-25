// Real loopback HTTP routes with fixed Valve responses; never contacts Steam or a VPS.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-steam-errors-'));
const output = process.env.SKYMP_STEAM_UNIT_BUNDLE || path.join(root, 'player-access.cjs');
if (!process.env.SKYMP_STEAM_UNIT_BUNDLE) require('esbuild').buildSync({ entryPoints: [path.resolve('../skymp5-server/ts/playerAccess.ts')], outfile: output, bundle: true, platform: 'node', target: 'es2022', logLevel: 'silent' });
const { registerPlayerAccess } = require(output);
const Koa = require('koa'), Router = require('koa-router'), body = require('koa-body');
const apiKey = 'a'.repeat(32), steamId = '76561198000000000';
const settings = { dataDir: path.join(root, 'data'), publicHost: 'test.example', playerAccess: { mode: 'guest', approvalRequired: true, steamApiKey: apiKey } };
const warnings = [], originalWarn = console.warn, checks = [];
console.warn = (...values) => warnings.push(values.join(' '));
let server, serial = 1, upstream;
const ticket = () => (serial++).toString(16).padStart(256, '0');
const success = () => Response.json({ response: { params: { result: 'OK', steamid: steamId } } });
const app = new Koa(), router = new Router();
app.use(body({ jsonLimit: '32kb' }));
registerPlayerAccess(router, { settings: () => settings, authorize: ctx => { ctx.status = 401; return false; }, fetch: async (url, options) => {
  const target = new URL(url);
  assert.equal(target.origin, 'https://api.steampowered.com');
  assert.equal(target.searchParams.get('appid'), '489830');
  assert.equal(target.searchParams.get('key'), apiKey);
  assert.equal(options.redirect, 'error');
  return upstream();
} });
app.use(router.routes());
try {
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  const request = async (payload = { steamId, ticket: ticket() }) => {
    const response = await fetch(base + '/api/launcher/auth/steam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    for (const secret of [apiKey, payload.ticket, steamId, settings.dataDir, 'PRIVATE_UPSTREAM_DETAILS']) if (secret) assert(!JSON.stringify(data).includes(secret), 'Error responses must not reflect secrets or internal paths');
    assert.equal(data.ok, false);
    return { response, data };
  };
  settings.playerAccess.steamApiKey = '';
  let result = await request(); assert.equal(result.response.status, 503); assert.equal(result.data.code, 'STEAM_KEY_MISSING');
  settings.playerAccess.steamApiKey = apiKey;
  for (const status of [401, 403]) {
    upstream = () => new Response('PRIVATE_UPSTREAM_DETAILS', { status });
    result = await request(); assert.equal(result.response.status, 503); assert.equal(result.data.code, 'STEAM_KEY_REJECTED'); assert.equal(result.data.upstreamStatus, status);
  }
  checks.push('Missing key and Valve HTTP 401/403 have separate stable codes; no generic player-ticket rejection or secret reflection');
  upstream = () => new Response('', { status: 429 });
  result = await request(); assert.equal(result.response.status, 429); assert.equal(result.data.code, 'STEAM_RATE_LIMITED'); assert.equal(result.response.headers.get('retry-after'), '60');
  upstream = () => new Response('', { status: 500 });
  result = await request(); assert.equal(result.response.status, 503); assert.equal(result.data.code, 'STEAM_UNAVAILABLE'); assert.equal(result.data.upstreamStatus, 500);
  upstream = () => { throw new Error('PRIVATE_UPSTREAM_DETAILS'); };
  result = await request(); assert.equal(result.data.code, 'STEAM_UNAVAILABLE'); assert(!('upstreamStatus' in result.data));
  upstream = () => new Response('not-json PRIVATE_UPSTREAM_DETAILS');
  result = await request(); assert.equal(result.response.status, 503); assert.equal(result.data.code, 'STEAM_RESPONSE_INVALID');
  checks.push('Valve limits, HTTP failure, network failure and invalid JSON remain distinguishable without leaking the upstream response');
  upstream = () => Response.json({ response: { error: { errorcode: 105, errordesc: 'Identity parameter did not match' } } });
  result = await request(); assert.equal(result.response.status, 401); assert.equal(result.data.code, 'STEAM_TICKET_AUDIENCE_MISMATCH'); assert.equal(result.data.steamErrorCode, 105);
  assert(!('steamDescription' in result.data)); assert(warnings.at(-1).includes('steamDescription="Identity parameter did not match"'));
  upstream = () => Response.json({ response: { error: { errorcode: 105, errordesc: 'Invalid ticket' } } });
  result = await request(); assert.equal(result.response.status, 401); assert.equal(result.data.code, 'STEAM_TICKET_REJECTED');
  checks.push('Audience mismatch uses its own stable code only for the matching Valve diagnosis; other ticket failures remain rejected');
  upstream = () => Response.json({ response: { error: { errorcode: 101, errordesc: 'Invalid ticket' } } });
  result = await request(); assert.equal(result.response.status, 401); assert.equal(result.data.code, 'STEAM_TICKET_REJECTED'); assert.equal(result.data.steamErrorCode, 101);
  assert(!('steamDescription' in result.data)); assert(!('steamErrorDescription' in result.data));
  assert(warnings.at(-1).endsWith('steamDescription="Invalid ticket"'));
  const sensitiveTicket = ticket();
  upstream = () => Response.json({ response: { error: { errorcode: 101, errordesc: `Invalid ticket ${apiKey}\nTicket: ${sensitiveTicket}\r\nSteam: ${steamId} https://private.example/steam?key=${apiKey}` } } });
  result = await request({ steamId, ticket: sensitiveTicket }); assert.equal(result.data.code, 'STEAM_TICKET_REJECTED');
  const redacted = warnings.at(-1);
  assert(redacted.includes('[redacted]')); assert(redacted.includes('[redacted-url]'));
  for (const secret of [apiKey, sensitiveTicket, steamId, 'https://private.example']) assert(!redacted.includes(secret));
  assert(!/[\r\n\t]/.test(redacted));
  upstream = () => Response.json({ response: { error: { errorcode: 101, errordesc: 'Invalid ticket '.repeat(25) } } });
  result = await request(); assert.equal(result.data.code, 'STEAM_TICKET_REJECTED');
  assert.equal(JSON.parse(warnings.at(-1).split(' steamDescription=')[1]).length, 160);
  upstream = () => Response.json({ response: { error: { errorcode: 101, errordesc: 'x'.repeat(513) } } });
  result = await request(); assert.equal(result.data.code, 'STEAM_TICKET_REJECTED');
  assert(!warnings.at(-1).includes('steamDescription='));
  checks.push('Operator-only Valve explanations redact keys, tickets, Steam IDs and URLs, remove control characters, cap output and omit oversized input; public responses stay fixed');
  upstream = () => Response.json({ response: { error: { errorcode: 'PRIVATE_UPSTREAM_DETAILS' } } });
  result = await request(); assert.equal(result.data.code, 'STEAM_TICKET_REJECTED'); assert(!('steamErrorCode' in result.data));
  upstream = success;
  result = await request({ steamId: '76561198000000001', ticket: ticket() }); assert.equal(result.data.code, 'STEAM_TICKET_INVALID');
  result = await request({ steamId, ticket: 'malformed' }); assert.equal(result.response.status, 401); assert.equal(result.data.code, 'STEAM_TICKET_INVALID');
  checks.push('Ticket rejection forwards only a numeric Steam code; malformed tickets and forged Steam IDs stay rejected');
  const payload = { steamId, ticket: ticket() };
  const accepted = await fetch(base + '/api/launcher/auth/steam', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  assert.equal(accepted.status, 200); const auth = await accepted.json(); assert.equal(auth.status, 'pending'); assert.match(auth.steamSession, /^[a-f0-9]{64}$/);
  result = await request(payload); assert.equal(result.response.status, 401); assert.equal(result.data.code, 'STEAM_TICKET_REPLAY');
  const directory = settings.dataDir;
  settings.dataDir = path.join(root, 'not-a-directory'); fs.writeFileSync(settings.dataDir, 'storage failure fixture');
  result = await request(); assert.equal(result.response.status, 503); assert.equal(result.data.code, 'STEAM_STORAGE_UNAVAILABLE');
  settings.dataDir = directory;
  checks.push('Verified guest access still creates a pending session; replay stays rejected; a real filesystem write failure is a server-storage error');
  for (let i = 0; i < 31; i++) result = await request({ ticket: 'invalid' });
  assert.equal(result.response.status, 429); assert.equal(result.data.code, 'STEAM_RATE_LIMITED');
  for (const line of warnings) {
    const match = line.match(/^\[PlayerAccess\] Steam authentication failed: code=STEAM_[A-Z_]+(?: upstreamHttp=\d+)?(?: steamErrorCode=\d+)?(?: steamDescription=(.+))?$/);
    assert(match);
    if (match[1]) {
      const description = JSON.parse(match[1]); assert.equal(typeof description, 'string');
      assert(description.length <= 160); assert(!/[^\x20-\x7e]|https?:\/\//i.test(description));
    }
    for (const secret of [apiKey, steamId, auth.steamSession, 'PRIVATE_UPSTREAM_DETAILS', root]) assert(!line.includes(secret));
  }
  checks.push('Local retry limits use a fixed code; dashboard warnings use codes, numeric diagnostics and optional bounded sanitized operator explanations');
  console.log(JSON.stringify({ ok: true, checks, realSteamContacted: false, liveVpsModified: false, skyrimStarted: false }));
} finally {
  console.warn = originalWarn;
  if (server) await new Promise(resolve => server.close(resolve));
  assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir())); assert(path.basename(root).startsWith('skymp-steam-errors-'));
  fs.rmSync(root, { recursive: true, force: true });
}
