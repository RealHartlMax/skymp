// Real HTTP regressions: access control, PIN rotation, data checks and restart safety.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createSetupServer } = require('../deploy/test-server/setup-web.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-browser-setup-'));
const input = { serverName: 'Browser test', port: 27777, uiPort: 28080, maxPlayers: 16, access: 'public', publicHost: '203.0.113.10', adminUser: 'owner', password: 'Browser-Test-Password!2026', passwordConfirm: 'Browser-Test-Password!2026' };
let checks = 0;
function fixture(name) {
  const dir = path.join(root, name);
  fs.mkdirSync(path.join(dir, 'data/scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'dist_back')); fs.mkdirSync(path.join(dir, 'ui'));
  for (const file of ['scam_native.node', 'dist_back/skymp5-server.js', 'ui/build.js']) fs.writeFileSync(path.join(dir, file), 'test-fixture');
  fs.writeFileSync(path.join(dir, 'server-settings.json'), JSON.stringify({ name: 'Before', uiPort: 8080, dataDir: 'data', loadOrder: ['Skyrim.esm'], keep: { world: true } }));
  return dir;
}
async function instance(name, timing = {}) {
  const dir = fixture(name), codes = [];
  const service = await createSetupServer(dir, { host: '127.0.0.1', port: 0, log: line => codes.push(/Einrichtungscode: (\d{4})/.exec(line)?.[1]), ...timing });
  const base = `http://127.0.0.1:${service.server.address().port}`;
  const request = (route, data, headers = {}) => fetch(base + '/api/setup/' + route, {
    method: data === undefined ? 'GET' : 'POST', headers: { origin: base, ...(data === undefined ? {} : { 'content-type': 'application/json' }), ...headers },
    body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(5000),
  });
  return { dir, service, base, request, codes };
}
(async () => {
  const active = new Set();
  try {
    const main = await instance('main'); active.add(main.service);
    const { request, codes, dir } = main;
    assert.match(codes[0], /^\d{4}$/);
    const page = await fetch(main.base + '/admin');
    assert.equal(page.status, 200);
    assert(page.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
    const html = await page.text(); assert(html.includes('Einrichtungscode')); assert(!html.includes('Einrichtungscode: ' + codes[0]));
    for (const asset of ['/setup.js', '/setup.css']) assert.equal((await fetch(main.base + asset)).status, 200);
    checks++;
    assert.equal((await request('state')).status, 401);
    assert.equal((await request('complete', input)).status, 401);
    assert.equal((await request('unlock', { code: codes[0] }, { origin: 'https://foreign.example' })).status, 403);
    assert.equal((await request('unlock', { code: codes[0] }, { 'sec-fetch-site': 'cross-site' })).status, 403);
    assert.equal((await fetch(main.base + '/api/admin/setup/bootstrap', { method: 'POST', headers: { origin: main.base } })).status, 404);
    checks++;
    const unlocked = await request('unlock', { code: codes[0] }); assert.equal(unlocked.status, 200);
    const cookieHeader = unlocked.headers.get('set-cookie');
    assert(cookieHeader.includes('HttpOnly')); assert(cookieHeader.includes('SameSite=Strict')); assert(cookieHeader.includes('Path=/api/setup'));
    const cookie = cookieHeader.split(';')[0];
    assert.equal((await request('unlock', { code: codes[0] })).status, 409, 'PIN is consumed');
    checks++;
    let state = await (await request('state', undefined, { cookie })).json();
    assert.equal(state.installation.ready, false); assert.equal(state.installation.files[0].status, 'missing');
    assert(state.csrf); assert.equal(state.code, undefined); assert.equal(state.pin, undefined);
    assert.equal((await request('complete', input, { cookie })).status, 403);
    const headers = { cookie, 'x-skymp-setup-csrf': state.csrf };
    assert.equal((await request('complete', input, { ...headers, origin: 'https://foreign.example' })).status, 403);
    assert.equal((await request('complete', input, headers)).status, 409, 'Missing masters must block completion');
    assert(!fs.existsSync(path.join(dir, 'data/admin-auth.json'))); checks++;
    fs.writeFileSync(path.join(dir, 'data/Skyrim.esm'), 'WRONG');
    state = await (await request('state', undefined, { cookie })).json();
    assert.equal(state.installation.files[0].status, 'invalid'); checks++;
    fs.writeFileSync(path.join(dir, 'data/Skyrim.esm'), 'TES4-master-test-fixture');
    state = await (await request('state', undefined, { cookie })).json(); assert.equal(state.installation.ready, true);
    assert.equal((await request('complete', { ...input, passwordConfirm: 'wrong' }, headers)).status, 400);
    assert(!fs.existsSync(path.join(dir, 'data/admin-auth.json'))); checks++;
    const complete = await request('complete', input, headers); assert.equal(complete.status, 200);
    assert.equal((await complete.json()).dashboard, 'http://203.0.113.10:28080/admin');
    await main.service.finished; active.delete(main.service);
    const auth = JSON.parse(fs.readFileSync(path.join(dir, 'data/admin-auth.json'), 'utf8'));
    assert.equal(auth.user, 'owner'); assert(!JSON.stringify(auth).includes(input.password));
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dir, 'server-settings.json'))).keep, { world: true });
    await assert.rejects(() => createSetupServer(dir), /bereits eingerichtet/); checks++;

    let clock = 100000;
    const rate = await instance('rate', { now: () => clock }); active.add(rate.service);
    const oldCode = rate.codes[0], wrong = oldCode === '0000' ? '9999' : '0000';
    for (let i = 0; i < 5; i++) assert.equal((await rate.request('unlock', { code: wrong }, { 'x-forwarded-for': '203.0.113.' + i })).status, 401);
    assert.equal((await rate.request('unlock', { code: oldCode })).status, 429, 'Global limit includes the correct code during cooldown');
    clock += 60001;
    assert.equal((await rate.request('unlock', { code: 'not-a-code' })).status, 401);
    assert.equal(rate.codes.length, 2);
    assert.equal((await rate.request('unlock', { code: rate.codes[1] })).status, 200); checks++;
    await rate.service.close(); active.delete(rate.service);

    clock = 200000;
    const expiry = await instance('expiry', { now: () => clock }); active.add(expiry.service);
    const expiredCode = expiry.codes[0]; clock += 600001;
    assert.equal((await expiry.request('unlock', { code: expiredCode })).status, 401);
    const signed = await expiry.request('unlock', { code: expiry.codes.at(-1) }); assert.equal(signed.status, 200);
    const staleCookie = signed.headers.get('set-cookie').split(';')[0]; clock += 1800001;
    assert.equal((await expiry.request('state', undefined, { cookie: staleCookie })).status, 401);
    assert.equal(expiry.codes.length, 3); checks++;
    await expiry.service.close(); active.delete(expiry.service);

    const abort = await instance('abort'); active.add(abort.service);
    const before = fs.readFileSync(path.join(abort.dir, 'server-settings.json'));
    await abort.service.close(); active.delete(abort.service);
    assert.deepEqual(fs.readFileSync(path.join(abort.dir, 'server-settings.json')), before);
    assert(!fs.existsSync(path.join(abort.dir, 'data/admin-auth.json'))); checks++;
    console.log(JSON.stringify({ ok: true, platform: process.platform, checks, scope: 'real HTTP, PIN single use/expiry/global attempt budget, origin/CSRF, master readiness, own account, no reinitialization, clean cancellation' }));
  } finally {
    for (const service of active) await service.close();
    assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith('skymp-browser-setup-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
