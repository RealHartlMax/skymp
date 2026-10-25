const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { createSupervisor } = require('../deploy/test-server/server-supervisor.cjs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'skymp-supervisor-test-'));
const password = crypto.randomBytes(24).toString('hex');
const user = 'owner';
const checks = [];
let manager;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  try {
    const reservation = net.createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve));
    fs.mkdirSync(path.join(root, 'data'));
    fs.cpSync(path.resolve(__dirname, '../deploy/test-server/supervisor-ui'), path.join(root, 'supervisor-ui'), { recursive: true });
    const cfg = { uiPort: port, uiListenHost: '127.0.0.1', dataDir: 'data', adminUiUsers: { owner: { role: 'admin' } } };
    const file = path.join(root, 'server-settings.json');
    fs.writeFileSync(file, JSON.stringify(cfg));
    const salt = crypto.randomBytes(16).toString('hex');
    fs.writeFileSync(path.join(root, 'data/admin-auth.json'), JSON.stringify({ user, algo: 'scrypt-v1', passwordHash: `scrypt-v1$16384$8$1$${salt}$${crypto.scryptSync(password, salt, 64).toString('hex')}` }));
    fs.writeFileSync(path.join(root, 'fixture.cjs'), `
const http = require('node:http'), crypto = require('node:crypto');
const server = http.createServer((req, res) => {
  if(req.url === '/login') {
    const id = crypto.randomBytes(24).toString('hex');
    process.send({ type:'skymp:session', id, user:'owner', lastActivityAt:Date.now() });
    res.setHeader('set-cookie', 'skymp_admin_session='+id+'; Path=/; HttpOnly');
  }
  if(req.url === '/crash') { res.end('crashing'); setTimeout(()=>process.exit(7), 30); return; }
  if(req.url === '/logout') { const id=(req.headers.cookie||'').split('=')[1]; process.send({type:'skymp:logout',id}); }
  res.setHeader('content-type','text/plain'); res.end('proxy:'+req.url);
});
server.on('upgrade',(req,socket)=>{
  const accept=crypto.createHash('sha1').update(req.headers['sec-websocket-key']+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Accept: '+accept+'\\r\\n\\r\\n');
  socket.on('data',()=>socket.end(Buffer.from([0x88,0])));
});
server.listen(0,'127.0.0.1',()=>process.send({type:'skymp:ready',port:server.address().port}));
process.on('message',value=>{if(value.type==='skymp:shutdown')process.exit(0)});
process.on('disconnect',()=>process.exit(0));
`);
    manager = createSupervisor({ root, entry: 'fixture.cjs', args: [], stopTimeout: 1500 });
    let publicListeningEvents = 0, publicCloseEvents = 0;
    manager.server.on('listening', () => publicListeningEvents++);
    manager.server.on('close', () => publicCloseEvents++);
    manager.start();
    const base = `http://127.0.0.1:${port}`;
    const request = (route, init) => fetch(base + route, { ...init, signal: AbortSignal.timeout(5000) });
    let cookie = '';
    const post = (route, value, origin = base) => request(route, { method: 'POST', headers: { cookie, origin, 'content-type': 'application/json' }, body: JSON.stringify(value) });
    const wait = async (expected, previousPid) => {
      for (let i = 0; i < 100; i++) {
        const result = await request('/api/admin/supervisor/state', { headers: { cookie } });
        if (result.ok) { const value = await result.json(); if (value.state === expected && (previousPid === undefined || value.pid !== previousPid)) return value; }
        await delay(50);
      }
      assert.fail('Expected manager state: ' + expected);
    };
    for (let i = 0; i < 100; i++) { try { const response = await request('/login'); if ((await response.text()) === 'proxy:/login') { cookie = response.headers.get('set-cookie').split(';')[0]; break; } } catch {} await delay(50); }
    assert(cookie); const first = await wait('running');
    const originalWebAddress = manager.server.address();
    const assertWebListenerRetained = () => {
      assert.equal(manager.server.listening, true, 'Game controls must retain the public web listener');
      assert.deepEqual(manager.server.address(), originalWebAddress);
      assert.equal(publicListeningEvents, 1, 'Game controls must not rebind the public web port');
      assert.equal(publicCloseEvents, 0, 'Game controls must not close the public web listener');
    };
    assertWebListenerRetained();
    assert.equal((await request('/api/admin/supervisor/state')).status, 401);
    assert.equal((await post('/api/admin/supervisor/control', { action: 'stop' }, 'https://other.example')).status, 403);
    assert.equal((await post('/api/admin/supervisor/control', { action: '../anything' })).status, 400);
    checks.push('Untrusted requests, cross-origin writes and arbitrary commands are rejected');
    const ws = new WebSocket(base.replace('http:', 'ws:') + '/ws');
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    ws.close(); await new Promise(resolve => ws.addEventListener('close', resolve, { once: true }));
    checks.push('HTTP and WebSocket upgrades are forwarded to the owned loopback child');
    assert.equal((await post('/api/admin/supervisor/control', { action: 'stop' })).status, 202);
    const stopped = await wait('stopped');
    assert.equal(stopped.pid, null);
    assertWebListenerRetained();
    assert((await (await request('/admin')).text()).includes('Serversteuerung'));
    assert.equal((await request('/supervisor-assets/app.js')).status, 200);
    assert.equal((await request('/supervisor-assets/../../../server-settings.json')).status, 503);
    assert.equal((await request('/api/launcher/manifest')).status, 503);
    checks.push('Stop retains management on the original HTTP port; only allowlisted public UI assets are served');
    const badLogin = await post('/api/admin/session/login', { user, password: password + 'bad' }); assert.equal(badLogin.status, 401);
    const login = await post('/api/admin/session/login', { user, password }); assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];
    await wait('stopped');
    cfg.adminUiCapabilities = { canConsole: false }; fs.writeFileSync(file, JSON.stringify(cfg));
    assert.equal((await post('/api/admin/supervisor/control', { action: 'start' })).status, 401);
    delete cfg.adminUiCapabilities; fs.writeFileSync(file, JSON.stringify(cfg));
    checks.push('Stopped-server owner login verifies scrypt and respects current capability overrides');
    assert.equal((await post('/api/admin/supervisor/control', { action: 'start' })).status, 202);
    const second = await wait('running'); assert.notEqual(second.pid, first.pid);
    assertWebListenerRetained();
    assert.equal((await post('/api/admin/supervisor/control', { action: 'restart' })).status, 202);
    const restarted = await wait('running', second.pid); assert(restarted.pid);
    assertWebListenerRetained();
    checks.push('Stop, start and restart retain one uninterrupted public web listener; restart replaces only the child PID');
    await request('/crash'); await wait('crashed');
    assertWebListenerRetained();
    assert.equal((await request('/admin')).status, 200);
    assert.equal((await post('/api/admin/supervisor/control', { action: 'start' })).status, 202);
    await wait('running');
    assertWebListenerRetained();
    checks.push('Crash retains management; explicit start launches a new child without an automatic crash loop');
    const relogin = await request('/login'); cookie = relogin.headers.get('set-cookie').split(';')[0]; await wait('running');
    await request('/logout', { headers: { cookie } }); await delay(100);
    assert.equal((await request('/api/admin/supervisor/state', { headers: { cookie } })).status, 401);
    checks.push('Child logout invalidates the mirrored management session');
    console.log(JSON.stringify({ ok: true, platform: process.platform, checks, gameStarted: false }));
  } finally {
    if (manager) { manager.close(); await delay(1800); }
    assert.equal(path.dirname(root), path.resolve(os.tmpdir())); assert(path.basename(root).startsWith('skymp-supervisor-test-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
