const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { configure, isConfigured, validate } = require('./setup-server.cjs');

const launcherConnection = require('./launcher-connection.cjs');
const COOKIE = 'skymp_setup_session';
const securityHeaders = {
  'cache-control': 'no-store',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
};
const readSettings = root => JSON.parse(fs.readFileSync(path.join(root, 'server-settings.json'), 'utf8'));
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  Buffer.byteLength(a) === Buffer.byteLength(b) && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

function inspectInstallation(root, settings) {
  const data = path.resolve(root, settings.dataDir || 'data');
  const files = (settings.loadOrder || []).map(name => {
    // The shipped configuration supplies these names, never an HTTP path.
    if (path.basename(name) !== name) return { name, status: 'invalid' };
    let descriptor;
    try {
      descriptor = fs.openSync(path.join(data, name), 'r');
      const header = Buffer.alloc(4);
      const length = fs.readSync(descriptor, header, 0, 4, 0);
      return { name, status: length === 4 && header.toString() === 'TES4' ? 'ready' : 'invalid' };
    } catch (error) {
      return { name, status: error.code === 'ENOENT' ? 'missing' : 'unreadable' };
    } finally { if (descriptor !== undefined) fs.closeSync(descriptor); }
  });
  const runtimeReady = ['scam_native.node', 'dist_back/skymp5-server.js', 'ui/build.js', 'data/scripts']
    .every(name => fs.existsSync(path.join(root, name)));
  return { ready: files.length > 0 && files.every(file => file.status === 'ready') && runtimeReady, files, runtimeReady, dataDir: settings.dataDir || 'data' };
}

/** A small, temporary HTTP service. No game socket or admin bootstrap runs here. */
async function createSetupServer(root, options = {}) {
  const settings = readSettings(root);
  if (isConfigured(root, settings)) throw new Error('Server ist bereits eingerichtet.');
  const now = options.now || Date.now;
  const log = options.log || console.log;
  const codeLifetime = options.codeLifetime || 10 * 60 * 1000;
  const sessionLifetime = options.sessionLifetime || 30 * 60 * 1000;
  const cooldown = options.cooldown || 60 * 1000;
  let code, lastCode, expiresAt, attempts = 0, blockedUntil = 0, session, completed = false, closing = false;
  let resolveFinished;
  const finished = new Promise(resolve => { resolveFinished = resolve; });
  function rotateCode() {
    do { code = crypto.randomInt(10000).toString().padStart(4, '0'); } while (code === lastCode);
    lastCode = code;
    attempts = 0; expiresAt = now() + codeLifetime; blockedUntil = 0;
    log(`Einrichtungscode: ${code}`);
  }
  function updateCode() {
    if (session && now() >= session.expiresAt) { session = undefined; rotateCode(); }
    if (!session && ((blockedUntil && now() >= blockedUntil) || (!blockedUntil && now() >= expiresAt))) rotateCode();
  }
  function authenticated(req) {
    const cookie = (req.headers.cookie || '').split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='));
    return session && now() < session.expiresAt && equal(cookie?.slice(COOKIE.length + 1), session.token);
  }
  function sameOrigin(req) {
    try {
      const origin = new URL(req.headers.origin);
      return ['http:', 'https:'].includes(origin.protocol) && origin.host === req.headers.host &&
        (!req.headers['sec-fetch-site'] || ['same-origin', 'none'].includes(req.headers['sec-fetch-site']));
    } catch { return false; }
  }
  function send(res, status, value, headers = {}) {
    res.writeHead(status, { ...securityHeaders, 'content-type': 'application/json; charset=utf-8', ...headers });
    res.end(JSON.stringify(value));
  }
  async function body(req) {
    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new Error('JSON-Anfrage erforderlich.');
    let size = 0; const chunks = [];
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 16 * 1024) throw new Error('Anfrage ist zu groß.');
      chunks.push(chunk);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new Error('Ungültige JSON-Anfrage.'); }
  }
  const assets = new Map([
    ['/', ['setup.html', 'text/html']], ['/admin', ['setup.html', 'text/html']], ['/setup', ['setup.html', 'text/html']],
    ['/password-fields.js', ['password-fields.js', 'text/javascript']], ['/setup.js', ['setup.js', 'text/javascript']], ['/setup.css', ['setup.css', 'text/css']],
  ].map(([route, [file, type]]) => [route, { data: fs.readFileSync(path.join(__dirname, 'setup-ui', file)), type }]));
  const server = http.createServer(async (req, res) => {
    try {
      if (completed) return send(res, 409, { error: 'Einrichtung bereits abgeschlossen.' });
      updateCode();
      const route = new URL(req.url, 'http://setup.invalid').pathname;
      if (req.method === 'GET' && assets.has(route)) {
        const asset = assets.get(route);
        res.writeHead(200, { ...securityHeaders, 'content-type': asset.type + '; charset=utf-8' });
        return res.end(asset.data);
      }
      if (req.method === 'GET' && route === '/favicon.ico') { res.writeHead(204, securityHeaders); return res.end(); }
      if (req.method === 'POST') {
        if (!sameOrigin(req)) return send(res, 403, { error: 'Einrichtung nur von derselben Browser-Adresse erlaubt.' });
        if (route === '/api/setup/unlock') {
          // A global attempt budget applies across all IPs and headers.
          if (blockedUntil > now()) return send(res, 429, { error: 'Zu viele Versuche. Nach einer Minute erscheint ein neuer Code im Terminal.' }, { 'retry-after': String(Math.ceil((blockedUntil - now()) / 1000)) });
          if (session) return send(res, 409, { error: 'Einrichtung wurde bereits in einem Browser freigegeben. Dort fortfahren oder auf einen neuen Code warten.' });
          const input = await body(req);
          if (typeof input?.code !== 'string' || !/^\d{4}$/.test(input.code) || !equal(input.code, code)) {
            if (++attempts >= 5) { blockedUntil = now() + cooldown; expiresAt = 0; code = undefined; }
            return send(res, 401, { error: 'Code ungültig oder abgelaufen. Den aktuellen vierstelligen Code aus dem Terminal eingeben.' });
          }
          code = undefined; // One use, even when another browser knows the old PIN.
          session = { token: crypto.randomBytes(32).toString('hex'), csrf: crypto.randomBytes(32).toString('hex'), expiresAt: now() + sessionLifetime };
          return send(res, 200, { ok: true }, { 'set-cookie': `${COOKIE}=${session.token}; HttpOnly; SameSite=Strict; Path=/api/setup; Max-Age=${Math.floor(sessionLifetime / 1000)}` });
        }
      }
      if (!route.startsWith('/api/setup/')) return send(res, 404, { error: 'Nicht gefunden.' });
      if (!authenticated(req)) return send(res, 401, { error: 'Bitte zuerst den Einrichtungscode eingeben.' });
      if (route === '/api/setup/state' && req.method === 'GET') {
        return send(res, 200, {
          csrf: session.csrf, expiresAt: session.expiresAt, startAfterSetup: Boolean(options.startAfterSetup),
          defaults: { serverName: settings.name || 'SkyMP Test Server', port: settings.port || 7777, uiPort: settings.uiPort || 8080, maxPlayers: settings.maxPlayers || 16 },
          launcher: launcherConnection.describe(readSettings(root)),
          installation: inspectInstallation(root, readSettings(root)),
        });
      }
      if (route === '/api/setup/complete' && req.method === 'POST') {
        if (!equal(req.headers['x-skymp-setup-csrf'], session.csrf)) return send(res, 403, { error: 'Browser-Freigabe fehlt. Seite neu laden.' });
        const input = await body(req);
        try { validate(input); if (input.launcher) launcherConnection.normalize({ ...input.launcher, publicHost: input.access === 'local' ? '127.0.0.1' : input.publicHost, port: input.port }, readSettings(root)); } catch (error) { return send(res, 400, { error: error.message }); }
        if (!inspectInstallation(root, readSettings(root)).ready) return send(res, 409, { error: 'Spieldaten oder Paketdateien fehlen. Bitte zuerst die Dateien prüfen.' });
        let result;
        try { result = configure(root, input); }
        catch { return send(res, 409, { error: 'Einrichtung konnte nicht gespeichert werden. Schreibrechte oder eine bestehende Einrichtung prüfen. Vorhandene Daten werden nicht ersetzt.' }); }
        completed = true; session = undefined;
        // When an SSH tunnel uses a different local port, retain its browser address.
        const host = new URL('http://' + req.headers.host);
        const isLoopback = ['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname);
        const sameHost = input.access === 'public' ? String(input.publicHost).trim().toLowerCase() === host.hostname.toLowerCase() : isLoopback;
        if (sameHost && Number(input.uiPort) === Number(settings.uiPort || 8080)) result.dashboard = new URL('/admin', req.headers.origin).href;
        const resultBody = { ok: true, ...result, startAfterSetup: Boolean(options.startAfterSetup), reachableFromBrowser: input.access === 'public' || isLoopback };
        res.once('finish', () => { close(resultBody); });
        return send(res, 200, resultBody, { 'connection': 'close', 'set-cookie': `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/setup; Max-Age=0` });
      }
      return send(res, 404, { error: 'Nicht gefunden.' });
    } catch { if (!res.headersSent && !res.destroyed) send(res, 400, { error: 'Anfrage konnte nicht verarbeitet werden.' }); }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 1000;
  let ticker;
  function close(result) {
    if (closing) return finished;
    closing = true; clearInterval(ticker);
    server.close(() => { resolveFinished(result); });
    server.closeIdleConnections();
    // Do not let abandoned sockets prevent handing the port to the game server.
    const force = setTimeout(() => server.closeAllConnections(), 300);
    force.unref();
    return finished;
  }
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    // First-run HTTP must be reachable on a remote VPS before configuring the final binding.
    server.listen(options.port ?? settings.uiPort ?? 8080, options.host || '0.0.0.0', resolve);
  });
  rotateCode();
  ticker = setInterval(updateCode, 1000); ticker.unref();
  return { server, finished, close };
}

async function runBrowserSetup(root, options = {}) {
  const service = await createSetupServer(root, options);
  console.log(`Browser-Ersteinrichtung: http://<SERVER-IP>:${service.server.address().port}/admin (lokal: http://127.0.0.1:${service.server.address().port}/admin)`);
  const stop = () => { process.exitCode = 130; service.close(); };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try { return await service.finished; }
  finally { process.removeListener('SIGINT', stop); process.removeListener('SIGTERM', stop); }
}

module.exports = { createSetupServer, inspectInstallation, runBrowserSetup };
