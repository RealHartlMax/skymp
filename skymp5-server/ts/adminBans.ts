import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomBytes } from 'node:crypto';

export interface AdminBan {
  banId: string; profileId: number | null; userId: number; expiresAt: number | null; reason: string;
}
const stores = new Map<string, AdminBans>();
const validProfile = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 2147483647;
const validUser = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) < 65535;
const validExpiry = (value: unknown): value is number | null => value === null || Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 8640000000000000;

/** Reuses admin-bans.json. Legacy slot-only entries remain visible but grant no identity. */
export class AdminBans {
  private records = new Map<string, AdminBan>();
  constructor(private filename: string) {
    if (!fs.existsSync(filename)) return;
    const stat = fs.lstatSync(filename);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw Error('Invalid admin ban store');
    const raw = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (Array.isArray(raw)) {
      for (const entry of raw) {
        const [userId, expiresAt] = Array.isArray(entry) ? entry : [entry, null];
        if (!validUser(userId) || !validExpiry(expiresAt)) throw Error('Invalid legacy admin ban');
        this.records.set('legacy:' + userId, { banId: 'legacy:' + userId, profileId: null, userId, expiresAt, reason: '' });
      }
    } else {
      if (raw?.version !== 2 || !Array.isArray(raw.bans)) throw Error('Invalid admin ban store version');
      for (const entry of raw.bans) {
        if (!entry || !validUser(entry.userId) || !validExpiry(entry.expiresAt) || entry.profileId !== null && !validProfile(entry.profileId) ||
            typeof entry.reason !== 'string' || entry.reason.length > 512 || entry.banId !== (entry.profileId === null ? 'legacy:' + entry.userId : 'profile:' + entry.profileId)) throw Error('Invalid admin ban record');
        this.records.set(entry.banId, { ...entry });
      }
    }
  }
  list(): AdminBan[] { this.cleanupExpired(); return [...this.records.values()].map(entry => ({ ...entry })); }
  forProfile(profileId: number): AdminBan | null {
    this.cleanupExpired(); const entry = this.records.get('profile:' + profileId); return entry ? { ...entry } : null;
  }
  ban(userId: number, profileId: number, expiresAt: number | null, reason: string): AdminBan {
    if (!validUser(userId) || !validProfile(profileId) || !validExpiry(expiresAt)) throw Error('Ban requires an authenticated server profile');
    const entry = { banId: 'profile:' + profileId, profileId, userId, expiresAt,
      reason: String(reason).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, 512) };
    const previous = this.records.get(entry.banId); this.records.set(entry.banId, entry);
    try { this.save(); } catch (error) { if (previous) this.records.set(entry.banId, previous); else this.records.delete(entry.banId); throw error; }
    return { ...entry };
  }
  remove(selector: string): boolean {
    if (!/^(?:(?:profile|legacy):)?\d{1,10}$/.test(selector)) throw Error('Invalid ban identifier');
    let id = selector;
    if (!selector.includes(':')) {
      const matches = this.list().filter(entry => entry.userId === Number(selector));
      if (matches.length > 1) throw Error('Ambiguous userId; use profile:<profileId> or legacy:<userId>');
      id = matches[0]?.banId ?? '';
    }
    const previous = this.records.get(id); if (!previous) return false;
    this.records.delete(id); try { this.save(); } catch (error) { this.records.set(id, previous); throw error; } return true;
  }
  cleanupExpired() {
    const now = Date.now();
    for (const [id, entry] of this.records) if (entry.expiresAt !== null && entry.expiresAt <= now) this.records.delete(id);
  }
  private save() {
    this.cleanupExpired(); fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    const temporary = this.filename + '.' + process.pid + '.' + randomBytes(8).toString('hex') + '.tmp';
    try { fs.writeFileSync(temporary, JSON.stringify({ version: 2, bans: [...this.records.values()] }, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); fs.renameSync(temporary, this.filename); }
    catch (error) { try { fs.unlinkSync(temporary); } catch {} throw error; }
  }
}
export function getAdminBans(dataDir: string) {
  const filename = path.resolve(dataDir, 'admin-bans.json'); let store = stores.get(filename);
  if (!store) { store = new AdminBans(filename); stores.set(filename, store); } return store;
}
export function banConnectedPlayer(server: any, dataDir: string, userId: number, expiresAt: number | null, reason: string) {
  const actorId = server.getUserActor(userId);
  if (!actorId || !server.isConnected(userId) || server.getUserByActor(actorId) !== userId) throw Error('Player is not connected');
  const profileId = server.get(actorId, 'profileId');
  return getAdminBans(dataDir).ban(userId, profileId, expiresAt, reason);
}
