'use strict';
// Dependency-free manager. Game actions never stop the independent dashboard child.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { fork } = require('node:child_process');
const ROOT = __dirname;
const IDLE_MS = 10 * 60 * 1000;
const COOKIE = 'skymp_admin_session';

function createSupervisor({ root = ROOT, args = process.argv.slice(2), entry = 'dist_back/skymp5-server.js', dashboardEntry = 'dist_back/skymp5-admin.js', startupTimeout = 180000, stopTimeout = 15000 } = {}) {
  const settings = () => JSON.parse(fs.readFileSync(path.join(root, 'server-settings.json'), 'utf8'));
  const initial = settings();
  const uiPort = Number(initial.uiPort || initial.port || 8080);
  const uiHost = initial.uiListenHost || '0.0.0.0';
  if (!Number.isInteger(uiPort) || uiPort < 1 || uiPort > 65535) throw Error('Invalid dashboard port');
  const auth = () => JSON.parse(fs.readFileSync(path.resolve(root, settings().dataDir || 'data', 'admin-auth.json'), 'utf8'));
  const fingerprint = () => crypto.createHash('sha256').update(JSON.stringify(auth())).digest('hex');
  const sessions = new Map();
  const sockets = new Set();
  const independentDashboard = fs.existsSync(path.resolve(root, dashboardEntry));
  let child = null, dashboard = null, dashboardPort = 0, backendPort = 0, state = 'stopped', desired = 'running', closing = false;
  let startedAt = null, lastExit = null, failedLogins = 0, loginBlockedUntil = 0, startupTimer, killTimer, loginBusy = false;
  let dashboardStartupTimer, dashboardKillTimer;
  let operation = 'start', reason = null, startupFailed = false, dashboardStopping = false;
  const gameLogs = [];
  const send = (target, message) => {
    if (target?.connected) { try { target.send(message, () => {}); } catch { /* Child exited between checks. */ } }
  };
  const currentGameState = () => ({ state, pid: child?.pid || null, gamePort: backendPort, dashboardPid: dashboard?.pid || null, startedAt, lastExit, operation, reason });
  const publishGameState = () => send(dashboard, { type: 'skymp:game-state', value: currentGameState() });
  const publicBackendPort = () => independentDashboard ? dashboardPort : state === 'running' ? backendPort : 0;
  const finishClose = () => {
    if (closing && !child && dashboard && !dashboardStopping) {
      dashboardStopping = true;
      const owned = dashboard;
      send(owned, { type: 'skymp:shutdown' });
      dashboardKillTimer = setTimeout(() => { if (dashboard === owned) owned.kill('SIGKILL'); }, stopTimeout);
    }
    if (closing && !child && !dashboard) { server.close(); for (const socket of sockets) socket.destroy(); }
  };
  const relayGameLog = (level, text) => {
    const message = { type: 'skymp:game-log', level, text: text.slice(-16000) };
    gameLogs.push(message); if (gameLogs.length > 250) gameLogs.shift();
    if (dashboardPort) send(dashboard, message);
  };
  const handleSharedMessage = (owned, message) => {
    if (!message || typeof message !== 'object') return;
    if (message.type === 'skymp:session' && /^[a-f0-9]{48}$/.test(message.id) && typeof message.user === 'string' && Number.isFinite(message.lastActivityAt)) {
      cleanup();
      try {
        if (Math.abs(Date.now() - message.lastActivityAt) < IDLE_MS && sessions.size < 1000) {
          sessions.set(message.id, { id: message.id, user: message.user, lastActivityAt: message.lastActivityAt, fingerprint: fingerprint() });
          send(owned === child ? dashboard : child, message);
        }
      } catch { /* Credential store is required for management sessions. */ }
    } else if (message.type === 'skymp:logout') {
      sessions.delete(message.id); send(owned === child ? dashboard : child, message);
    } else if (message.type === 'skymp:settings-changed') {
      send(owned === child ? dashboard : child, message);
    } else if (owned === dashboard && message.type === 'skymp:discord-ban') {
      send(child, { type: 'skymp:discord-ban', ban: message.ban });
    } else if (owned === dashboard && message.type === 'skymp:scheduled-announcement' && state === 'running' && typeof message.message === 'string' && message.message.length <= 500) {
      send(child, { type: 'skymp:scheduled-announcement', message: message.message });
    } else if (owned === child && message.type === 'skymp:discord-notification') {
      send(dashboard, { type: 'skymp:discord-notification', notification: message.notification });
    } else if (message.type === 'skymp:control' && ['start', 'stop', 'restart'].includes(message.action)) {
      const ok = !['starting', 'stopping'].includes(state) && control(message.action);
      send(owned, { type: 'skymp:control-result', id: message.id, ok: Boolean(ok), error: ok ? undefined : 'The game server is already in this state or a transition is in progress.' });
    }
  };
  const cleanup = () => {
    for (const [id, value] of sessions) if (Date.now() - value.lastActivityAt >= IDLE_MS) sessions.delete(id);
  };
  const sessionFor = req => {
    cleanup();
    const cookie = String(req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='));
    return cookie ? sessions.get(cookie.slice(COOKIE.length + 1)) : null;
  };
  const canControl = session => {
    try {
      const cfg = settings();
      const role = String(cfg.adminUiUsers?.[session?.user]?.role ?? cfg.adminUiRoles?.[session?.user] ?? 'admin').trim().toLowerCase();
      const roleOverride = cfg.adminUiRoleCapabilities?.[role]?.canConsole;
      const globalOverride = cfg.adminUiCapabilities?.canConsole;
      const permission = typeof globalOverride === 'boolean' ? globalOverride : typeof roleOverride === 'boolean' ? roleOverride : role === 'admin';
      return Boolean(session && session.user === auth().user && session.fingerprint === fingerprint() && permission);
    } catch { return false; }
  };
  const json = (res, status, body) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
    res.end(JSON.stringify(body));
  };
  const allowedWrite = req => {
    try {
      const origin = new URL(req.headers.origin);
      return ['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host &&
        String(req.headers['content-type']).split(';')[0].trim() === 'application/json' &&
        ['', 'same-origin', 'none'].includes(String(req.headers['sec-fetch-site'] || ''));
    } catch { return false; }
  };
  const body = async req => {
    const chunks = []; let bytes = 0;
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 8192) throw Error('Request too large');
      chunks.push(chunk);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid JSON');
    return value;
  };
  const stopChild = () => {
    if (!child || state === 'stopping') return;
    state = 'stopping'; backendPort = 0;
    publishGameState();
    clearTimeout(startupTimer);
    const owned = child;
    if (owned.connected) send(owned, { type: 'skymp:shutdown', reason: operation === 'restart' ? 'restart' : 'shutdown' });
    else owned.kill('SIGTERM');
    killTimer = setTimeout(() => {
      if (child === owned) owned.kill('SIGKILL');
    }, stopTimeout);
  };
  const startChild = () => {
    if (child || closing) return;
    desired = 'running'; state = 'starting'; backendPort = 0; reason = null; startupFailed = false;
    const owned = fork(path.resolve(root, entry), args, {
      cwd: root, execPath: process.execPath, windowsHide: true,
      env: { ...process.env, SKYMP_MANAGED_SERVER: '1', SKYMP_MANAGED_ROLE: 'game' },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    child = owned;
    for (const [stream, level, terminal] of [[owned.stdout, 'info', process.stdout], [owned.stderr, 'error', process.stderr]]) {
      stream.setEncoding('utf8'); stream.on('data', text => { terminal.write(text); relayGameLog(level, text); });
    }
    publishGameState();
    startupTimer = setTimeout(() => {
      if (child === owned && state === 'starting') { startupFailed = true; reason = 'startup-timeout'; desired = 'stopped'; stopChild(); }
    }, startupTimeout);
    owned.on('message', message => {
      if (child !== owned || !message || typeof message !== 'object') return;
      if (message.type === 'skymp:ready' && state === 'starting' && Number.isInteger(message.port) && message.port > 0 && message.port < 65536) {
        clearTimeout(startupTimer); backendPort = message.port; state = 'running'; startedAt = Date.now();
        cleanup();
        for (const session of sessions.values()) send(owned, { type: 'skymp:session', id: session.id, user: session.user, lastActivityAt: session.lastActivityAt });
        publishGameState();
        console.log(`[SkyMP] Game-Server bereit. Dashboard: http://${uiHost === '0.0.0.0' ? initial.publicHost || 'localhost' : uiHost}:${uiPort}/admin`);
      } else if (message.type === 'skymp:update' || message.type === 'skymp:performance') send(dashboard, message);
      else handleSharedMessage(owned, message);
    });
    owned.on('error', error => { console.error('[SkyMP] Game-Server konnte nicht gestartet werden:', error.message); desired = 'stopped'; });
    owned.on('exit', (code, signal) => {
      if (child !== owned) return;
      clearTimeout(startupTimer); clearTimeout(killTimer);
      child = null; backendPort = 0; lastExit = { code, signal, at: new Date().toISOString() };
      const plannedStop = state === 'stopping' && !startupFailed;
      if (state === 'starting') reason = 'startup-failed';
      state = plannedStop ? 'stopped' : 'crashed';
      relayGameLog(code === 0 ? 'info' : 'error', `[SkyMP] Game-Server ${state}; exit=${code}, signal=${signal || 'none'}\n`);
      publishGameState();
      if (closing) finishClose();
      else if (desired === 'running' && state !== 'crashed') startChild();
    });
  };
  const startDashboard = () => {
    if (!independentDashboard || dashboard || closing) return;
    const owned = fork(path.resolve(root, dashboardEntry), [], {
      cwd: root, execPath: process.execPath, windowsHide: true,
      env: { ...process.env, SKYMP_MANAGED_SERVER: '1', SKYMP_MANAGED_ROLE: 'dashboard' },
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
    });
    dashboard = owned;
    dashboardStartupTimer = setTimeout(() => { if (dashboard === owned && !dashboardPort) owned.kill('SIGKILL'); }, startupTimeout);
    owned.on('message', message => {
      if (dashboard !== owned || !message || typeof message !== 'object') return;
      if (message.type === 'skymp:ready' && Number.isInteger(message.port) && message.port > 0 && message.port < 65536) {
        clearTimeout(dashboardStartupTimer); dashboardPort = message.port;
        cleanup();
        for (const session of sessions.values()) send(owned, { type: 'skymp:session', id: session.id, user: session.user, lastActivityAt: session.lastActivityAt });
        publishGameState();
        for (const log of gameLogs) send(owned, log);
        console.log('[SkyMP] Unabhaengiges Admin-Dashboard bereit.');
      } else handleSharedMessage(owned, message);
    });
    owned.on('error', error => console.error('[SkyMP] Dashboard konnte nicht gestartet werden:', error.message));
    owned.on('exit', (code, signal) => {
      if (dashboard !== owned) return;
      clearTimeout(dashboardStartupTimer); clearTimeout(dashboardKillTimer);
      dashboard = null; dashboardPort = 0;
      if (!closing) console.error(`[SkyMP] Dashboard beendet (${code}, ${signal || 'none'}). Starter neu starten; der Game-Prozess wird dadurch nicht automatisch beendet.`);
      finishClose();
    });
  };
  const control = action => {
    if (closing) return false;
    if (action === 'start') { if (child) return false; operation = 'start'; startChild(); return true; }
    if (action === 'stop') { if (!child) return false; operation = 'stop'; desired = 'stopped'; stopChild(); return true; }
    if (action === 'restart') { operation = 'restart'; desired = 'running'; if (child) stopChild(); else startChild(); return true; }
    return false;
  };
  const proxy = (req, res) => {
    const upstream = http.request({ host: '127.0.0.1', port: publicBackendPort(), method: req.method, path: req.url, headers: req.headers }, response => {
      res.writeHead(response.statusCode, response.headers); response.pipe(res);
    });
    upstream.on('error', () => { if (!res.headersSent) json(res, 503, { ok: false, error: 'Game server is not ready', state }); else res.destroy(); });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  };
  const server = http.createServer(async (req, res) => {
    const route = new URL(req.url, 'http://localhost').pathname;
    try {
      if (route === '/api/admin/supervisor/state' && req.method === 'GET') {
        const session = sessionFor(req);
        if (!canControl(session)) return json(res, 401, { ok: false, error: 'Owner login required' });
        return json(res, 200, { ok: true, managed: true, state, canControl: true, user: session.user, pid: child?.pid || null, dashboardPid: dashboard?.pid || null, independentDashboard, startedAt, lastExit });
      }
      if (route === '/api/admin/supervisor/control' && req.method === 'POST') {
        if (!canControl(sessionFor(req))) return json(res, 401, { ok: false, error: 'Owner login required' });
        if (!allowedWrite(req)) return json(res, 403, { ok: false, error: 'Same-origin JSON required' });
        const { action } = await body(req);
        if (!['start', 'stop', 'restart'].includes(action)) return json(res, 400, { ok: false, error: 'Invalid action' });
        if (['starting', 'stopping'].includes(state)) return json(res, 409, { ok: false, error: 'An action is already in progress' });
        json(res, 202, { ok: true, action, queued: true });
        setTimeout(() => control(action), 50); return;
      }
      if (route.startsWith('/supervisor-assets/') && req.method === 'GET') {
        const name = route.slice('/supervisor-assets/'.length);
        if (!['app.js', 'app.css'].includes(name)) return json(res, 404, { ok: false });
        res.writeHead(200, { 'content-type': name.endsWith('.js') ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
        return fs.createReadStream(path.join(root, 'supervisor-ui', name)).pipe(res);
      }
      if (publicBackendPort()) return proxy(req, res);
      if (route === '/admin' && req.method === 'GET') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", 'x-content-type-options': 'nosniff' });
        return fs.createReadStream(path.join(root, 'supervisor-ui/index.html')).pipe(res);
      }
      if (route === '/api/admin/session/login' && req.method === 'POST') {
        if (!allowedWrite(req)) return json(res, 403, { ok: false, error: 'Same-origin JSON required' });
        if (loginBusy || Date.now() < loginBlockedUntil) { res.setHeader('retry-after', '60'); return json(res, 429, { ok: false, error: 'Too many attempts. Retry in one minute.' }); }
        const input = await body(req), stored = auth();
        const match = /^scrypt-v1\$(\d+)\$(\d+)\$(\d+)\$([a-f0-9]{16,128})\$([a-f0-9]{128})$/.exec(stored.passwordHash || '');
        if (!match || stored.algo !== 'scrypt-v1' || typeof input.password !== 'string' || input.password.length > 1024) return json(res, 401, { ok: false, error: 'Login failed' });
        const N = Number(match[1]), r = Number(match[2]), p = Number(match[3]);
        if (N < 1024 || N > 131072 || r < 1 || r > 16 || p < 1 || p > 4) throw Error('Unsupported credential parameters');
        loginBusy = true;
        let actual;
        try { actual = await new Promise((resolve, reject) => crypto.scrypt(input.password, match[4], 64, { N, r, p, maxmem: 256 * 1024 * 1024 }, (error, value) => error ? reject(error) : resolve(value))); }
        finally { loginBusy = false; }
        if (input.user !== stored.user || !crypto.timingSafeEqual(actual, Buffer.from(match[5], 'hex'))) {
          if (++failedLogins >= 5) { loginBlockedUntil = Date.now() + 60000; failedLogins = 0; }
          return json(res, 401, { ok: false, error: 'Login failed' });
        }
        failedLogins = 0; cleanup();
        const id = crypto.randomBytes(24).toString('hex');
        const session = { type: 'skymp:session', id, user: stored.user, lastActivityAt: Date.now() };
        sessions.set(id, { id, user: stored.user, lastActivityAt: session.lastActivityAt, fingerprint: fingerprint() });
        // A game can already be ready while the independent dashboard is still
        // starting. Mirror early logins now as well as at each child's ready.
        send(child, session); send(dashboard, session);
        res.setHeader('set-cookie', `${COOKIE}=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${req.socket.encrypted || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
        return json(res, 200, { ok: true, authenticated: true, user: stored.user });
      }
      if (route === '/api/admin/session/logout' && req.method === 'POST') {
        if (!allowedWrite(req)) return json(res, 403, { ok: false });
        const session = sessionFor(req);
        if (session) { sessions.delete(session.id); const message = { type: 'skymp:logout', id: session.id }; send(child, message); send(dashboard, message); }
        res.setHeader('set-cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
        return json(res, 200, { ok: true });
      }
      if (route === '/api/admin/session/touch' && req.method === 'POST') {
        if (!allowedWrite(req)) return json(res, 403, { ok: false });
        const session = sessionFor(req);
        if (!canControl(session)) return json(res, 401, { ok: false });
        session.lastActivityAt = Date.now();
        const message = { type: 'skymp:session', id: session.id, user: session.user, lastActivityAt: session.lastActivityAt };
        send(child, message); send(dashboard, message);
        return json(res, 200, { ok: true });
      }
      json(res, 503, { ok: false, error: 'Game server is stopped or starting; open /admin to manage it', state });
    } catch { if (!res.headersSent) json(res, 400, { ok: false, error: 'Request could not be processed' }); else res.destroy(); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('upgrade', (req, socket, head) => {
    const port = publicBackendPort();
    if (!port) return socket.destroy();
    const upstream = http.request({ host: '127.0.0.1', port, path: req.url, headers: req.headers });
    upstream.on('upgrade', (response, peer, buffered) => {
      socket.write(`HTTP/1.1 101 Switching Protocols\r\n${response.rawHeaders.reduce((lines, value, index, all) => index % 2 === 0 ? lines + `${value}: ${all[index + 1]}\r\n` : lines, '')}\r\n`);
      if (buffered.length) socket.write(buffered);
      if (head.length) peer.write(head);
      peer.on('error', () => socket.destroy()); socket.on('error', () => peer.destroy());
      peer.on('close', () => socket.destroy()); socket.on('close', () => peer.destroy());
      peer.pipe(socket); socket.pipe(peer);
    });
    upstream.on('response', response => {
      response.resume();
      socket.end(`HTTP/1.1 ${response.statusCode || 502} ${response.statusMessage || 'Bad Gateway'}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    });
    upstream.on('error', () => socket.destroy()); upstream.end();
  });
  const close = () => {
    if (closing) return;
    closing = true; desired = 'stopped'; operation = 'shutdown';
    if (child) stopChild();
    finishClose();
  };
  server.on('error', error => { console.error('[SkyMP] Dashboard-Port konnte nicht geoeffnet werden:', error.message); close(); process.exitCode = 1; });
  return { server, close, start: () => server.listen(uiPort, uiHost, () => { console.log(`[SkyMP] Prozesssteuerung auf TCP ${uiPort}; Strg+C beendet die Verwaltung und den Game-Server.`); startDashboard(); startChild(); }) };
}
if (require.main === module) {
  const supervisor = createSupervisor();
  process.on('SIGINT', supervisor.close); process.on('SIGTERM', supervisor.close);
  supervisor.start();
}
module.exports = { createSupervisor };
