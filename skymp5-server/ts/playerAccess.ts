import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { SystemContext } from './systems/system';

type Config = Record<string, any>;
type Principal = { id: string; profileId: number; status: 'pending' | 'approved' | 'blocked'; name: string; createdAt: string; lastSeenAt: string };
type SteamSession = { steamId: string; expires: number; playerName?: string };
type Store = { version: 1; nextProfileId: number; principals: Record<string, Principal>; sessions: Record<string, SteamSession>; tickets: Record<string, number>; accounts: Record<string, string> };
const sha = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const fresh = (): Store => ({ version: 1, nextProfileId: 2000000000, principals: {}, sessions: {}, tickets: {}, accounts: {} });
const validSteamId = (value: unknown): value is string => typeof value === 'string' && /^[0-9]{17}$/.test(value) && BigInt(value) >= 76561197960265728n && BigInt(value) <= 76561202255233023n;

export function playerAccessPolicy(settings: Config) {
  const value = settings.playerAccess || {};
  const id = String(settings.serverUid || (settings.publicHost || 'server') + ':' + (settings.port || 7777));
  // A compact generic service name avoids long/structured identity handling in
  // Steam clients. Hash the full instance ID so truncation cannot merge servers.
  const ticketIdentity = 'skymp' + sha('skymp:steam-web-api:v2:' + id).slice(0, 24);
  return { mode: value.mode === 'guest' || settings.offlineMode === true ? 'guest' : 'account', approvalRequired: value.approvalRequired === true,
    steamApiKey: String(value.steamApiKey ?? settings.steam_webApiKey ?? ''), steamAppId: Number(value.steamAppId || 489830), ticketIdentity };
}

export function validatePlayerAccess(settings: Config): string | null {
  const value = settings.playerAccess;
  if (value === undefined) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'playerAccess must be an object.';
  if (!['guest', 'account'].includes(value.mode)) return 'Choose guest or account access.';
  if (value.approvalRequired !== undefined && typeof value.approvalRequired !== 'boolean') return 'Invalid approval setting.';
  if (value.steamApiKey && !/^[a-f0-9]{32}$/i.test(String(value.steamApiKey))) return 'Enter a valid 32-character Steam Web API key, or leave it empty.';
  if (value.steamAppId !== undefined && (!Number.isInteger(value.steamAppId) || value.steamAppId < 1 || value.steamAppId > 4294967295)) return 'Invalid Steam App ID.';
  return null;
}

function storeFile(settings: Config) { return path.resolve(String(settings.dataDir || 'data'), 'player-access.json'); }
function readStore(file: string): Store {
  if (!fs.existsSync(file)) return fresh();
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 16 * 1024 * 1024) throw Error('Invalid player access store');
  const result = JSON.parse(fs.readFileSync(file, 'utf8')) as Store;
  if (result.version !== 1 || !result.principals || !result.sessions || !result.tickets || !result.accounts || !Number.isSafeInteger(result.nextProfileId)) throw Error('Invalid player access store');
  return result;
}

function updateStore<T>(settings: Config, operation: (store: Store) => T): T {
  const file = storeFile(settings);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = file + '.lock';
  let handle: number;
  try { handle = fs.openSync(lock, 'wx', 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    let abandoned = false;
    try {
      const owner = JSON.parse(fs.readFileSync(lock, 'utf8'));
      if (Number.isInteger(owner.pid) && owner.pid > 0) {
        try { process.kill(owner.pid, 0); } catch (probe) { abandoned = (probe as NodeJS.ErrnoException).code === 'ESRCH'; }
      }
    } catch { /* An incomplete lock may still be being created. */ }
    if (!abandoned) throw Error('Player access is being updated; retry shortly.');
    fs.unlinkSync(lock); handle = fs.openSync(lock, 'wx', 0o600);
  }
  const temporary = file + '.tmp-' + crypto.randomBytes(8).toString('hex');
  try {
    fs.writeFileSync(handle, JSON.stringify({ pid: process.pid }));
    const store = readStore(file);
    for (const [key, session] of Object.entries(store.sessions)) if (session.expires < Date.now()) delete store.sessions[key];
    for (const [key, expires] of Object.entries(store.tickets)) if (expires < Date.now()) delete store.tickets[key];
    const result = operation(store);
    fs.writeFileSync(temporary, JSON.stringify(store, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    fs.renameSync(temporary, file);
    return result;
  } finally {
    fs.closeSync(handle);
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    fs.unlinkSync(lock);
  }
}

function principal(store: Store, steamId: string, approvalRequired: boolean): Principal {
  const id = 'steam:' + steamId;
  let entry = store.principals[id];
  if (!entry) {
    if (Object.keys(store.principals).length >= 10000 || store.nextProfileId > 2147483647) throw Error('Player registry is full.');
    const now = new Date().toISOString();
    entry = store.principals[id] = { id, profileId: store.nextProfileId++, status: approvalRequired ? 'pending' : 'approved', name: 'Steam ' + steamId, createdAt: now, lastSeenAt: now };
  }
  if (!approvalRequired && entry.status === 'pending') entry.status = 'approved';
  entry.lastSeenAt = new Date().toISOString();
  return entry;
}

export function listPlayerAccess(settings: Config): Principal[] {
  return Object.values(readStore(storeFile(settings)).principals).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}
export function changePlayerAccess(settings: Config, id: string, action: string): Principal {
  if (!/^steam:[0-9]{17}$/.test(id) || !['approve', 'block', 'pending'].includes(action)) throw Error('Invalid player access action.');
  return updateStore(settings, store => {
    const value = store.principals[id];
    if (!value) throw Error('Player identity not found.');
    value.status = action === 'approve' ? 'approved' : action === 'block' ? 'blocked' : 'pending';
    return { ...value };
  });
}
export function bindSteamAccount(settings: Config, master: string, profileId: number, steamId: string) {
  const account = sha(new URL(master).origin + ':' + profileId);
  updateStore(settings, store => {
    if (store.accounts[account] && store.accounts[account] !== steamId) throw Error('This account is already linked to another Steam identity.');
    store.accounts[account] = steamId;
  });
}

export class SteamVerificationError extends Error {
  constructor(code: string, public upstreamStatus?: number, public steamErrorCode?: number, public steamErrorDescription?: string) { super(code); }
}

// Valve's Web API error numbers are not the Steam client EResult enum. Keep the
// actual explanation in the operator log, without reflecting it to public clients.
function steamErrorDescription(value: unknown, secrets: unknown[]): string | undefined {
  if (typeof value !== 'string' || value.length > 512) return undefined;
  let description = value;
  for (const secret of secrets) {
    if (typeof secret === 'string' && secret.length >= 8) {
      const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      description = description.replace(new RegExp(escaped, 'gi'), '[redacted]');
    }
  }
  description = description
    .replace(/https?:\/\/[^\s]+/gi, '[redacted-url]')
    .replace(/\b[a-f0-9]{16,}\b/gi, '[redacted]')
    .replace(/\b[a-z0-9+/_=-]{32,}\b/gi, '[redacted]')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\s+/g, ' ').trim();
  return description ? description.slice(0, 160) : undefined;
}

export function validatePlayerName(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw Error('PLAYER_NAME_INVALID');
  const name = value.trim();
  if (!name) return undefined;
  if ([...name].length > 32 || Buffer.byteLength(name, 'utf8') > 128 || /[\u0000-\u001f\u007f-\u009f<>\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/u.test(name)) throw Error('PLAYER_NAME_INVALID');
  return name;
}

export async function authenticateSteamTicket(settings: Config, ticket: unknown, claimedId?: unknown, request: typeof fetch = fetch, ticketIdentity?: unknown, playerName?: unknown) {
  const displayName = validatePlayerName(playerName);
  const policy = playerAccessPolicy(settings);
  // Compatibility: old launchers omit this echo. Never use a client-supplied
  // audience for verification; the current server policy remains authoritative.
  if (ticketIdentity !== undefined && ticketIdentity !== policy.ticketIdentity) throw Error('STEAM_POLICY_CHANGED');
  if (!/^[a-f0-9]{32}$/i.test(policy.steamApiKey)) throw Error('STEAM_KEY_MISSING');
  if (typeof ticket !== 'string' || ticket.length < 32 || ticket.length > 16384 || ticket.length % 2 || !/^[a-f0-9]+$/i.test(ticket)) throw Error('STEAM_TICKET_INVALID');
  const ticketHash = sha(ticket.toLowerCase());
  if (readStore(storeFile(settings)).tickets[ticketHash] > Date.now()) throw Error('STEAM_TICKET_REPLAY');
  const url = new URL('https://api.steampowered.com/ISteamUserAuth/AuthenticateUserTicket/v1/');
  url.searchParams.set('key', policy.steamApiKey); url.searchParams.set('appid', String(policy.steamAppId));
  url.searchParams.set('ticket', ticket); url.searchParams.set('identity', policy.ticketIdentity);
  let response: Response;
  try { response = await request(url.href, { signal: AbortSignal.timeout(10000), redirect: 'error' }); }
  catch { throw new SteamVerificationError('STEAM_UNAVAILABLE'); }
  if (response.status === 401 || response.status === 403) throw new SteamVerificationError('STEAM_KEY_REJECTED', response.status);
  if (response.status === 429) throw new SteamVerificationError('STEAM_RATE_LIMITED', response.status);
  if (!response.ok) throw new SteamVerificationError('STEAM_UNAVAILABLE', response.status);
  let result: any;
  try { result = await response.json(); }
  catch { throw new SteamVerificationError('STEAM_RESPONSE_INVALID', response.status); }
  const steamId = result?.response?.params?.steamid;
  if (result?.response?.error || result?.response?.params?.result !== 'OK') {
    const value = result?.response?.error?.errorcode;
    const audienceMismatch = value === 105 && result?.response?.error?.errordesc === 'Identity parameter did not match';
    throw new SteamVerificationError(audienceMismatch ? 'STEAM_TICKET_AUDIENCE_MISMATCH' : 'STEAM_TICKET_REJECTED', response.status,
      Number.isInteger(value) && value >= 0 && value <= 0xffffffff ? value : undefined,
      steamErrorDescription(result?.response?.error?.errordesc, [policy.steamApiKey, ticket, claimedId]));
  }
  if (!validSteamId(steamId) || (claimedId !== undefined && claimedId !== steamId)) throw Error('STEAM_TICKET_INVALID');
  const steamSession = crypto.randomBytes(32).toString('hex');
  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const entry = updateStore(settings, store => {
    if (store.tickets[ticketHash] > Date.now()) throw Error('STEAM_TICKET_REPLAY');
    if (Object.keys(store.sessions).length >= 10000) throw Error('STEAM_SESSIONS_FULL');
    store.tickets[ticketHash] = expires;
    const identity = principal(store, steamId, policy.mode === 'guest' && policy.approvalRequired);
    if (displayName) identity.name = displayName;
    // Snapshot the name in this authenticated session. Another launcher cannot
    // rename an already connected session by submitting a newer display name.
    store.sessions[sha(steamSession)] = { steamId, expires, playerName: displayName || identity.name };
    return { ...identity };
  });
  return { steamId, steamSession, expiresAt: expires, accountLoginRequired: policy.mode === 'account', approvalRequired: policy.approvalRequired, status: entry.status, playerName: entry.name };
}

export function registerPlayerAccess(router: any, options: { settings: () => Config; authorize: (ctx: any) => boolean; fetch?: typeof fetch }) {
  const attempts = new Map<string, { at: number; count: number }>();
  router.get('/api/launcher/auth-policy', (ctx: any) => {
    const policy = playerAccessPolicy(options.settings());
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { version: 2, steamRequired: true, steamConfigured: /^[a-f0-9]{32}$/i.test(policy.steamApiKey), steamAppId: policy.steamAppId,
      ticketIdentity: policy.ticketIdentity, accountLoginRequired: policy.mode === 'account', approvalRequired: policy.approvalRequired };
  });
  router.post('/api/launcher/auth/steam', async (ctx: any) => {
    ctx.set('Cache-Control', 'no-store');
    if (!ctx.is('application/json')) { ctx.status = 415; ctx.body = { ok: false, error: 'JSON required.' }; return; }
    const ip = String(ctx.ip || 'unknown'), now = Date.now();
    for (const [key, value] of attempts) if (now - value.at > 60000) attempts.delete(key);
    let attempt = attempts.get(ip);
    if (!attempt) { if (attempts.size >= 2048) { ctx.status = 429; ctx.body = { ok: false, code: 'STEAM_RATE_LIMITED', error: 'Retry Steam authentication shortly.' }; return; } attempt = { at: now, count: 0 }; attempts.set(ip, attempt); }
    if (++attempt.count > 30) { ctx.status = 429; ctx.body = { ok: false, code: 'STEAM_RATE_LIMITED', error: 'Retry Steam authentication shortly.' }; return; }
    try { ctx.body = { ok: true, ...await authenticateSteamTicket(options.settings(), ctx.request.body?.ticket, ctx.request.body?.steamId, options.fetch, ctx.request.body?.ticketIdentity, ctx.request.body?.playerName) }; }
    catch (error) {
      const known = ['STEAM_KEY_MISSING', 'STEAM_TICKET_INVALID', 'STEAM_TICKET_REPLAY', 'STEAM_SESSIONS_FULL', 'STEAM_POLICY_CHANGED', 'PLAYER_NAME_INVALID'];
      const reported = (error as Error)?.message;
      const code = error instanceof SteamVerificationError || known.includes(reported) ? reported : 'STEAM_STORAGE_UNAVAILABLE';
      const upstreamStatus = error instanceof SteamVerificationError ? error.upstreamStatus : undefined;
      const steamErrorCode = error instanceof SteamVerificationError ? error.steamErrorCode : undefined;
      const steamDescription = error instanceof SteamVerificationError ? error.steamErrorDescription : undefined;
      ctx.status = code === 'PLAYER_NAME_INVALID' ? 400 : code === 'STEAM_RATE_LIMITED' ? 429 : code === 'STEAM_POLICY_CHANGED' ? 409 : ['STEAM_TICKET_INVALID', 'STEAM_TICKET_REPLAY', 'STEAM_TICKET_REJECTED', 'STEAM_TICKET_AUDIENCE_MISMATCH'].includes(code) ? 401 : 503;
      if (ctx.status === 429) ctx.set('Retry-After', '60');
      // Bound and redact the upstream explanation before logging; never log keys,
      // tickets, session data, URLs, or the entire upstream response.
      console.warn('[PlayerAccess] Steam authentication failed: code=' + code + (upstreamStatus !== undefined ? ' upstreamHttp=' + upstreamStatus : '') + (steamErrorCode !== undefined ? ' steamErrorCode=' + steamErrorCode : '') + (steamDescription ? ' steamDescription=' + JSON.stringify(steamDescription) : ''));
      ctx.body = { ok: false, code, error: code === 'STEAM_KEY_MISSING' ? 'Server administrator must configure the Steam Web API key.' : code === 'STEAM_KEY_REJECTED' ? 'Steam rejected the server API key or its permissions.' : code === 'STEAM_RATE_LIMITED' ? 'Retry Steam authentication shortly.' : code === 'STEAM_UNAVAILABLE' ? 'Steam authentication is temporarily unavailable.' : code === 'STEAM_STORAGE_UNAVAILABLE' || code === 'STEAM_SESSIONS_FULL' ? 'Server cannot save the Steam session.' : 'Steam authentication failed. Request a fresh ticket in the launcher.', ...(upstreamStatus !== undefined ? { upstreamStatus } : {}), ...(steamErrorCode !== undefined ? { steamErrorCode } : {}) };
    }
  });
  router.get('/api/admin/player-access', (ctx: any) => {
    if (!options.authorize(ctx)) return;
    ctx.set('Cache-Control', 'no-store');
    try { ctx.body = { ok: true, entries: listPlayerAccess(options.settings()) }; }
    catch { ctx.status = 503; ctx.body = { ok: false, error: 'Player access list unavailable.' }; }
  });
  router.post('/api/admin/player-access', (ctx: any) => {
    if (!options.authorize(ctx)) return;
    let sameOrigin = false;
    try { sameOrigin = new URL(ctx.get('origin')).host === ctx.host; } catch { /* Required for browser writes. */ }
    if (!sameOrigin || ctx.get('content-type').split(';')[0] !== 'application/json') { ctx.status = 403; ctx.body = { ok: false }; return; }
    ctx.set('Cache-Control', 'no-store');
    try { ctx.body = { ok: true, entry: changePlayerAccess(options.settings(), String(ctx.request.body?.id || ''), String(ctx.request.body?.action || '')) }; }
    catch { ctx.status = 400; ctx.body = { ok: false, error: 'Player access could not be changed. Reload and retry.' }; }
  });
}

const liveSessions = new WeakMap<object, SteamPlayerSessions>();
/** Authenticated operator-only metadata, never an identity chosen by a game packet. */
export function getSteamPlayerInfo(server: object, userId: number): { steamId?: string; playerName?: string } {
  return liveSessions.get(server)?.info(server, userId) || {};
}
export class SteamPlayerSessions {
  private verified = new Map<number, { steamId: string; token: string; guid: string; allowed: boolean; lastPoll: number }>();
  private active = new Map<string, { userId: number; guid: string }>();
  constructor(private settings: () => Config, private allowed: (ctx: SystemContext, userId: number, profileId: number) => void) {}
  disconnect(userId: number) {
    this.verified.delete(userId);
    for (const [steamId, active] of this.active) if (active.userId === userId) this.active.delete(steamId);
  }
  getSteamId(ctx: SystemContext, userId: number): string | undefined {
    const session = this.verified.get(userId);
    if (!session || session.guid !== ctx.svr.getUserGuid(userId)) return undefined;
    try {
      const store = readStore(storeFile(this.settings()));
      const token = store.sessions[session.token], entry = store.principals['steam:' + session.steamId];
      return token && token.expires >= Date.now() && entry && entry.status !== 'blocked' ? session.steamId : undefined;
    } catch { return undefined; }
  }
  info(server: any, userId: number): { steamId?: string; playerName?: string } {
    const verified = this.verified.get(userId);
    if (!verified || !server.isConnected(userId) || verified.guid !== server.getUserGuid(userId)) return {};
    try {
      const store = readStore(storeFile(this.settings())), session = store.sessions[verified.token], identity = store.principals['steam:' + verified.steamId];
      if (!session || session.expires < Date.now() || session.steamId !== verified.steamId || !identity || identity.status === 'blocked') return {};
      return { steamId: verified.steamId, playerName: validatePlayerName(session.playerName) || identity.name };
    } catch { return {}; }
  }
  claim(ctx: SystemContext, userId: number): boolean {
    const session = this.verified.get(userId), steamId = this.getSteamId(ctx, userId);
    if (!steamId || session?.allowed) return false;
    const active = this.active.get(steamId);
    if (active && ctx.svr.isConnected(active.userId) && ctx.svr.getUserGuid(active.userId) === active.guid) {
      this.send(ctx, userId, { customPacketType: 'playerAuthResult', state: 'duplicate' }); return false;
    }
    this.active.set(steamId, { userId, guid: ctx.svr.getUserGuid(userId) }); session!.allowed = true;
    return true;
  }
  private send(ctx: SystemContext, userId: number, value: Config) { ctx.svr.sendCustomPacket(userId, JSON.stringify(value)); }
  handle(userId: number, type: string, data: Config, ctx: SystemContext): boolean {
    if (!['loginWithSteam', 'steamLoginStatus'].includes(type)) return false;
    try {
      liveSessions.set(ctx.svr, this);
      const guid = ctx.svr.getUserGuid(userId), settings = this.settings();
      if (type === 'loginWithSteam') {
        const token = String(data.steamSession || '');
        if (!/^[a-f0-9]{64}$/.test(token)) throw Error('Invalid session');
        const session = readStore(storeFile(settings)).sessions[sha(token)];
        if (!session || session.expires < Date.now() || !validSteamId(session.steamId)) throw Error('Expired session');
        const old = this.verified.get(userId);
        if (old?.guid === guid && old.allowed) return true;
        this.verified.set(userId, { steamId: session.steamId, token: sha(token), guid, allowed: false, lastPoll: 0 });
      }
      const verified = this.verified.get(userId);
      if (!verified || verified.guid !== guid) throw Error('Unknown connection');
      if (verified.allowed || Date.now() - verified.lastPoll < 1000) return true;
      verified.lastPoll = Date.now();
      const store = readStore(storeFile(settings)), session = store.sessions[verified.token], entry = store.principals['steam:' + verified.steamId];
      if (!session || session.expires < Date.now() || !entry) throw Error('Expired session');
      if (entry.status === 'blocked') this.send(ctx, userId, { customPacketType: 'playerAuthResult', state: 'blocked', id: entry.id });
      else if (playerAccessPolicy(settings).mode === 'guest') {
        if (playerAccessPolicy(settings).approvalRequired && entry.status !== 'approved') this.send(ctx, userId, { customPacketType: 'playerAuthResult', state: 'pending', id: entry.id });
        else if (this.claim(ctx, userId)) this.allowed(ctx, userId, entry.profileId);
      } else this.send(ctx, userId, { customPacketType: 'playerAccountRequired' });
    } catch { this.send(ctx, userId, { customPacketType: 'playerAuthResult', state: 'error' }); }
    return true;
  }
}
