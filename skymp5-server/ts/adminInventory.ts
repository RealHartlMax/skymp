import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type Inventory = Record<string, unknown> & { entries: unknown[] };
export type InventoryFailure = 'PROFILE_NOT_RESOLVED' | 'INVENTORY_NOT_SAVED' | 'INVENTORY_STORAGE_UNSUPPORTED' | 'INVENTORY_UNAVAILABLE';
export class InventoryError extends Error {
  constructor(readonly code: InventoryFailure, readonly status: number) { super(code); }
}
export const validProfileId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) >= 0 && Number(value) <= 0x7fffffff;
const validActorId = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 0xffffffff;
const inventoryValue = (value: unknown): Inventory | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray((value as Inventory).entries)) return null;
  return value as Inventory;
};
const attempt = <T>(read: () => T, fallback: T): T => { try { return read(); } catch { return fallback; } };
interface SavedInventory { profileId: number; formDesc: string; inventory: Inventory; updatedAt: number; filePath: string }
interface Cache { checkedAt: number; directoryStamp: string; records: Map<number, SavedInventory>; unreadable: boolean }
const caches = new Map<string, Cache>();
const pending = new Map<string, Promise<Cache>>();
const MAX_SAVE_BYTES = 4 * 1024 * 1024;

async function scan(directory: string, directoryStamp: string): Promise<Cache> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  if (entries.length > 100000) throw new InventoryError('INVENTORY_UNAVAILABLE', 503);
  const records = new Map<number, SavedInventory>();
  let unreadable = false, totalBytes = 0;
  const candidates = entries.filter(entry => entry.isFile() && entry.name.endsWith('.json'));
  // Reads are asynchronous and bounded; an admin request must not synchronously scan the game world.
  for (let at = 0; at < candidates.length; at += 8) {
    await Promise.all(candidates.slice(at, at + 8).map(async entry => {
      const filePath = path.join(directory, entry.name);
      let file: fs.FileHandle | undefined;
      try {
        if ((await fs.lstat(filePath)).isSymbolicLink()) { unreadable = true; return; }
        file = await fs.open(filePath, 'r');
        const stat = await file.stat();
        if (!stat.isFile() || stat.size > MAX_SAVE_BYTES) { unreadable = true; return; }
        totalBytes += stat.size;
        if (totalBytes > 256 * 1024 * 1024) throw new InventoryError('INVENTORY_UNAVAILABLE', 503);
        const parsed = JSON.parse(await file.readFile('utf8'));
        const inventory = inventoryValue(parsed?.inv);
        if (!validProfileId(parsed?.profileId) || parsed.isDeleted === true || !inventory) return;
        const snapshot = { profileId: parsed.profileId, inventory, updatedAt: stat.mtimeMs, filePath,
          formDesc: typeof parsed.formDesc === 'string' ? parsed.formDesc : entry.name.slice(0, -5).replace(/_/g, ':') };
        if (!records.has(snapshot.profileId) || records.get(snapshot.profileId)!.updatedAt < snapshot.updatedAt) records.set(snapshot.profileId, snapshot);
      } catch (error) {
        if (error instanceof InventoryError) throw error;
        unreadable = true;
      } finally { await file?.close(); }
    }));
  }
  return { checkedAt: Date.now(), directoryStamp, records, unreadable };
}

async function readSavedInventory(settings: Record<string, any>, profileId: number): Promise<SavedInventory> {
  if ((settings.databaseDriver ?? 'file') !== 'file') throw new InventoryError('INVENTORY_STORAGE_UNSUPPORTED', 409);
  // dataDir contains masters/admin state; native FileDatabase uses databaseName (default: world).
  const directory = path.resolve(typeof settings.databaseName === 'string' ? settings.databaseName : 'world', 'changeForms');
  let stat;
  try {
    stat = await fs.lstat(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new InventoryError('INVENTORY_UNAVAILABLE', 503);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new InventoryError('INVENTORY_NOT_SAVED', 404);
    if (error instanceof InventoryError) throw error;
    throw new InventoryError('INVENTORY_UNAVAILABLE', 503);
  }
  const stamp = `${stat.ino}:${stat.mtimeMs}:${stat.ctimeMs}`;
  let cache = caches.get(directory);
  if (!cache || cache.directoryStamp !== stamp || Date.now() - cache.checkedAt > 5000) {
    let request = pending.get(directory);
    if (!request) {
      request = scan(directory, stamp).then(value => {
        if (caches.size > 8) caches.clear();
        caches.set(directory, value); return value;
      }).finally(() => { pending.delete(directory); });
      pending.set(directory, request);
    }
    cache = await request;
  }
  const result = cache.records.get(profileId);
  if (!result) throw new InventoryError(cache.unreadable ? 'INVENTORY_UNAVAILABLE' : 'INVENTORY_NOT_SAVED', cache.unreadable ? 503 : 404);
  return result;
}

export async function readAdminInventory(options: {
  server: any; settings: Record<string, any>; userId: number; online: boolean;
  profileId: number | null; lastActorId?: number | null;
}) {
  const { server, userId, online } = options;
  const actorId = online ? attempt(() => Number(server.getUserActor(userId)), 0) : 0;
  const liveProfile = validActorId(actorId) ? attempt(() => server.get(actorId, 'profileId'), null) : null;
  const profileId = validProfileId(liveProfile) ? liveProfile : options.profileId;
  if (!validProfileId(profileId)) throw new InventoryError('PROFILE_NOT_RESOLVED', 409);
  const actorInventory = (id: number) => attempt(() => server.get(id, 'profileId') === profileId ? inventoryValue(server.get(id, 'inventory')) : null, null);
  const live = validActorId(actorId) ? actorInventory(actorId) : null;
  if (live) return { ok: true, userId, actorId, profileId, source: 'online', updatedAt: Date.now(), entryCount: live.entries.length, inventory: live };
  const actors: unknown = attempt(() => server.getActorsByProfileId(profileId), []);
  if (Array.isArray(actors)) {
    const ids = actors.filter(validActorId).slice(0, 128);
    const preferred = options.lastActorId;
    const selected = validActorId(preferred) && ids.includes(preferred) ? preferred : ids.length === 1 ? ids[0] : null;
    const inventory = selected ? actorInventory(selected) : null;
    if (inventory) return { ok: true, userId, actorId: selected, profileId, source: 'offline-memory', updatedAt: Date.now(), entryCount: inventory.entries.length, inventory };
  }
  try {
    const saved = await readSavedInventory(options.settings, profileId);
    return { ok: true, userId, actorId: 0, profileId, source: 'offline-file', updatedAt: saved.updatedAt,
      formDesc: saved.formDesc, entryCount: saved.inventory.entries.length, inventory: saved.inventory };
  } catch (error) {
    if (error instanceof InventoryError) throw error;
    throw new InventoryError('INVENTORY_UNAVAILABLE', 503);
  }
}

export function requireOnlinePlayer(ctx: any, onlineIds: number[], profile: (userId: number) => unknown): boolean {
  const userId = Number(ctx.params.userId);
  if (!Number.isSafeInteger(userId) || userId < 0) {
    ctx.status = 400; ctx.body = { ok: false, code: 'INVALID_USER_ID' }; return false;
  }
  if (!onlineIds.includes(userId)) {
    ctx.status = 409; ctx.body = { ok: false, code: 'PLAYER_OFFLINE' }; return false;
  }
  const expected = ctx.request.body?.expectedProfileId;
  if (expected !== undefined && (!validProfileId(expected) || expected !== profile(userId))) {
    ctx.status = 409; ctx.body = { ok: false, code: 'PLAYER_SESSION_CHANGED' }; return false;
  }
  return true;
}
