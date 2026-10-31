'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const DEFAULT_MASTER = 'https://api.skymp-worlds.net';
const DEFAULT_RUNTIME = 'https://update.skymp-worlds.net/client-runtime/catalog.json';
const fail = (field, message) => { const error = new Error(message); error.field = field; error.status = 400; throw error; };
function url(value, field, optional = false) {
  if (typeof value !== 'string' || value.length > 2048) fail(field, 'Invalid URL.');
  const text = value.trim();
  if (optional && !text) return '';
  let parsed;
  try { parsed = new URL(text); } catch { fail(field, 'Enter a complete HTTP(S) URL.'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || /[\s\\\x00-\x1f]/.test(text)) fail(field, 'Enter an HTTP(S) URL without credentials, query or fragment.');
  if (field === 'master' && parsed.pathname !== '/') fail(field, 'Master URL must be an origin without a path.');
  if (field === 'runtimeSource' && !/\/(?:catalog|runtime-manifest)\.json$/.test(parsed.pathname)) fail(field, 'Use a catalog.json or runtime-manifest.json URL.');
  return text.replace(/\/+$/, '');
}
function normalize(input, current = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('form', 'Invalid connection fields.');
  for (const field of ['master', 'serverUid', 'publicHost', 'runtimeSource']) {
    if (input[field] !== undefined && typeof input[field] !== 'string') fail(field, 'Expected a text field.');
  }
  const oldResources = current.launcherResources || {};
  const oldAccess = current.playerAccess || {};
  const authMode = input.authMode ?? (current.offlineMode === true ? 'offline' : oldAccess.mode === 'guest' ? (oldAccess.approvalRequired ? 'guestApproval' : 'guestOpen') : 'online');
  if (!['online', 'offline', 'guestOpen', 'guestApproval'].includes(authMode)) fail('authMode', 'Choose a supported player access mode.');
  const master = url(input.master ?? current.master ?? DEFAULT_MASTER, 'master');
  const serverUid = String(input.serverUid ?? current.serverUid ?? '').trim();
  if (serverUid && !/^[a-zA-Z0-9_-]{3,128}$/.test(serverUid)) fail('serverUid', 'Invalid public server ID.');
  if (typeof input.masterKey !== 'undefined' && typeof input.masterKey !== 'string') fail('masterKey', 'Invalid server key.');
  const masterKey = String(input.masterKey?.trim() || current.masterKey || '');
  if (masterKey && !/^[a-zA-Z0-9_-]{12,128}$/.test(masterKey)) fail('masterKey', 'Invalid private server key.');
  if (authMode === 'online' && !serverUid) fail('serverUid', 'Enter the public server ID from your Worlds dashboard.');
  if (authMode === 'online' && !masterKey) fail('masterKey', 'Enter the private key from your Worlds dashboard.');
  const publicHost = String(input.publicHost ?? current.publicHost ?? '').trim();
  const domain = /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/i;
  if (publicHost && !net.isIP(publicHost) && (!domain.test(publicHost) || /^[\d.]+$/.test(publicHost))) fail('publicHost', 'Enter an IP address or domain without a scheme, port or path.');
  if (['0.0.0.0', '::'].includes(publicHost)) fail('publicHost', 'Use a reachable address instead of a bind address.');
  if (authMode === 'online' && !publicHost) fail('publicHost', 'Enter the public game address.');
  const port = input.port ?? current.port ?? 7777;
  if (!/^\d+$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535) fail('port', 'Game port must be an integer from 1 to 65535.');
  const enabled = input.resourcesEnabled ?? oldResources.enabled ?? true;
  if (typeof enabled !== 'boolean') fail('resourcesEnabled', 'Invalid resource switch.');
  const { directory: _removedDirectory, ...keptResources } = oldResources;
  const runtimeSource = url(input.runtimeSource ?? oldResources.runtimeSource ?? DEFAULT_RUNTIME, 'runtimeSource', true);
  if (input.steamApiKey !== undefined && typeof input.steamApiKey !== 'string') fail('steamApiKey', 'Invalid Steam API key.');
  const steamApiKey = String(input.steamApiKey?.trim() || oldAccess.steamApiKey || current.steam_webApiKey || '');
  if (steamApiKey && !/^[a-f0-9]{32}$/i.test(steamApiKey)) fail('steamApiKey', 'Use a 32-character Steam Web API key.');
  return { master, masterKey, serverUid, offlineMode: authMode === 'offline', publicHost, port: Number(port),
    launcherResources: { ...keptResources, enabled, runtimeSource },
    playerAccess: { ...oldAccess, mode: authMode === 'online' ? 'account' : 'guest', approvalRequired: authMode === 'guestApproval', steamApiKey, steamAppId: oldAccess.steamAppId || 489830 } };
}
function read(file) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024) throw Error('Invalid settings file.');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Settings must be an object.');
  return parsed;
}
function revision(settings) { return crypto.createHash('sha256').update(JSON.stringify(settings)).digest('hex'); }
function describe(settings) {
  return { master: String(settings.master || DEFAULT_MASTER), serverUid: String(settings.serverUid || ''),
    authMode: settings.offlineMode === true ? 'offline' : settings.playerAccess?.mode === 'guest' ? (settings.playerAccess.approvalRequired ? 'guestApproval' : 'guestOpen') : 'online', publicHost: String(settings.publicHost || ''),
    port: settings.port || 7777, hasMasterKey: Boolean(settings.masterKey), hasSteamApiKey: Boolean(settings.playerAccess?.steamApiKey || settings.steam_webApiKey),
    resourcesEnabled: settings.launcherResources?.enabled !== false,
    runtimeSource: String(settings.launcherResources?.runtimeSource ?? DEFAULT_RUNTIME), revision: revision(settings) };
}
function atomicWrite(file, settings) {
  const temporary = file + '.tmp-' + crypto.randomBytes(8).toString('hex');
  try {
    fs.writeFileSync(temporary, JSON.stringify(settings, null, 2) + '\n', { flag:'wx', mode:0o600 });
    fs.renameSync(temporary, file);
  } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function locked(file, operation) {
  const lock = file + '.write-lock';
  let descriptor;
  const open = () => {
    const handle = fs.openSync(lock, 'wx', 0o600);
    try { fs.writeFileSync(handle, JSON.stringify({pid:process.pid})); }
    catch(error) { fs.closeSync(handle); fs.unlinkSync(lock); throw error; }
    return handle;
  };
  try { descriptor = open(); }
  catch {
    let abandoned = false;
    try {
      const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
      if (Number.isInteger(owner.pid) && owner.pid > 0) {
        try { process.kill(owner.pid, 0); } catch(error) { abandoned = error.code === 'ESRCH'; }
      }
    } catch { try { abandoned = Date.now() - fs.statSync(lock).mtimeMs > 30000; } catch {} }
    try {
      if (!abandoned) throw Error();
      fs.unlinkSync(lock); descriptor = open();
    } catch { const error = new Error('Settings are being changed. Reload and try again.'); error.status = 409; throw error; }
  }
  try { return operation(); }
  finally { fs.closeSync(descriptor); fs.unlinkSync(lock); }
}
function write(file, settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw Error('Settings must be an object.');
  return locked(file, () => { read(file); atomicWrite(file, settings); });
}
function save(file, input) {
  return locked(file, () => {
    const current = read(file);
    if (!input || input.revision !== revision(current)) { const error = new Error('Settings changed. Reload before saving.'); error.status = 409; throw error; }
    const next = { ...current, ...normalize(input, current) };
    const backup = file + '.before-launcher-' + crypto.randomBytes(6).toString('hex');
    fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL); fs.chmodSync(backup, 0o600);
    atomicWrite(file, next);
    return describe(next);
  });
}
function register(router, options) {
  const route = '/api/admin/launcher-connection';
  router.get(route, ctx => {
    if (!options.authorize(ctx)) return;
    ctx.set('Cache-Control', 'no-store');
    try { ctx.body = { ok:true, ...describe(read(options.file())) }; }
    catch { ctx.status = 500; ctx.body = { ok:false, error:'Connection settings cannot be read.' }; }
  });
  router.post(route, ctx => {
    if (!options.authorize(ctx)) return;
    ctx.set('Cache-Control', 'no-store');
    let sameOrigin = false;
    try { const origin = new URL(ctx.get('origin')); sameOrigin = ['http:', 'https:'].includes(origin.protocol) && origin.host === ctx.host; } catch {}
    if (!sameOrigin || ctx.get('content-type').split(';')[0].trim() !== 'application/json' || !['', 'same-origin', 'none'].includes(ctx.get('sec-fetch-site'))) {
      ctx.status = 403; ctx.body = { ok:false, error:'Save from the same server dashboard using JSON.' }; return;
    }
    try {
      const result = save(options.file(), ctx.request.body);
      ctx.body = { ok:true, restartRequired:true, ...result };
      options.onSaved?.();
    } catch (error) {
      ctx.status = error.status || 500;
      ctx.body = { ok:false, error: error.status ? error.message : 'Connection settings could not be saved.', ...(error.field ? { field:error.field } : {}) };
    }
  });
}
module.exports = { normalize, describe, read, write, save, register, DEFAULT_MASTER, DEFAULT_RUNTIME };
