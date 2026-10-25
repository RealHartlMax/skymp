import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

type Settings = Record<string, unknown>;
type Issue = 'missing' | 'invalid' | 'duplicate' | 'publicationOnly';
export interface ModEntry {
  name: string; source: 'server' | 'publication' | 'configured'; size: number;
  masters: string[]; master: boolean; issue?: Issue;
}
export class ModOrderError extends Error {
  constructor(readonly code: string, readonly status = 400, readonly plugin = '', readonly dependency = '') { super(code); }
}
const validName = (value: unknown): value is string => typeof value === 'string' && Buffer.byteLength('Data/' + value, 'utf8') <= 240 && !/[\\/<>:"|?*\x00-\x1f]/.test(value) && !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])\./i.test(value) && !/[. ]$/.test(value) && /\.(esm|esp|esl)$/i.test(value);
const key = (value: string) => value.toLowerCase();
const same = (a: string[], b: string[]) => a.length === b.length && a.every((name, i) => key(name) === key(b[i] || ''));

async function header(file: string): Promise<{ masters: string[]; master: boolean; fingerprint: string; size: number }> {
  const handle = await fs.open(file, 'r');
  try {
    const stat = await handle.stat();
    if (!stat.isFile() || stat.size < 24) throw Error('invalid TES4 header');
    const record = Buffer.alloc(24); await handle.read(record, 0, 24, 0);
    const length = record.readUInt32LE(4);
    if (record.toString('ascii', 0, 4) !== 'TES4' || length > 1024 * 1024 || length + 24 > stat.size) throw Error('invalid TES4 record');
    const data = Buffer.alloc(length); const result = await handle.read(data, 0, length, 24);
    if (result.bytesRead !== length) throw Error('short TES4 header');
    const masters: string[] = [];
    for (let offset = 0, extended = 0; offset < length;) {
      if (offset + 6 > length) throw Error('invalid subrecord');
      const tag = data.toString('ascii', offset, offset + 4), short = data.readUInt16LE(offset + 4);
      offset += 6; const size = extended || short; extended = 0;
      if (offset + size > length) throw Error('invalid subrecord size');
      if (tag === 'XXXX') { if (size !== 4) throw Error('invalid extended subrecord'); extended = data.readUInt32LE(offset); }
      if (tag === 'MAST') {
        const bytes = data.subarray(offset, offset + size);
        if (!bytes.length || bytes[bytes.length - 1] !== 0) throw Error('invalid master name');
        let name = bytes.subarray(0, -1).toString('utf8');
        if (name.includes('\uFFFD')) name = bytes.subarray(0, -1).toString('latin1');
        if (!validName(name) || masters.some(value => key(value) === key(name))) throw Error('invalid master name');
        masters.push(name);
      }
      offset += size;
    }
    const fingerprint = createHash('sha256').update(record).update(data).update(`${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`).digest('hex');
    return {masters, master: Boolean(record.readUInt32LE(8) & 1) || /\.(esm|esl)$/i.test(file), fingerprint, size: stat.size};
  } finally { await handle.close(); }
}

export async function inspectModOrder(settings: Settings) {
  const dataDir = path.resolve(String(settings.dataDir || './data'));
  const config = settings.launcherResources as {directory?: string} | undefined;
  const publication = path.join(path.resolve(config?.directory || './client-resources'), 'Data');
  const configured = Array.isArray(settings.loadOrder) ? settings.loadOrder.filter((value): value is string => typeof value === 'string') : [];
  const order = configured.map(value => path.basename(value));
  const entries = new Map<string, ModEntry>(), fingerprints: string[] = [];
  const scan = async (root: string, source: 'server' | 'publication') => {
    let files: import('node:fs').Dirent[];
    try { if ((await fs.lstat(root)).isSymbolicLink()) throw new ModOrderError('INVALID_DIRECTORY', 503); files = await fs.readdir(root, {withFileTypes: true}); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
    if (files.length > 20000) throw new ModOrderError('SCAN_LIMIT', 503);
    for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
      if (!validName(file.name) || !file.isFile() || file.isSymbolicLink()) continue;
      if (entries.size >= 4096) throw new ModOrderError('SCAN_LIMIT', 503);
      const id = key(file.name), prior = entries.get(id);
      if (prior && source === 'publication') continue;
      if (prior) { prior.issue = 'duplicate'; fingerprints.push('duplicate:' + file.name); continue; }
      const entry: ModEntry = {name: file.name, source, size: 0, masters: [], master: /\.(esm|esl)$/i.test(file.name)};
      try {
        const info = await header(path.join(root, file.name));
        entry.size = info.size; entry.masters = info.masters; entry.master = info.master; fingerprints.push(file.name + ':' + info.fingerprint);
        if (source === 'publication') entry.issue = 'publicationOnly';
      } catch { entry.issue = 'invalid'; fingerprints.push('invalid:' + file.name); }
      entries.set(id, entry);
    }
  };
  await scan(dataDir, 'server'); if (publication !== dataDir) await scan(publication, 'publication');
  for (const name of order) {
    if (!entries.has(key(name))) entries.set(key(name), {name, source: 'configured', size: 0, masters: [], master: /\.(esm|esl)$/i.test(name), issue: 'missing'});
  }
  let activeOrder: string[] = [];
  try { const manifest = JSON.parse(await fs.readFile(path.join(dataDir, 'manifest.json'), 'utf8')); if (Array.isArray(manifest.loadOrder)) activeOrder = manifest.loadOrder.filter((value: unknown) => typeof value === 'string'); } catch {}
  const revision = createHash('sha256').update(JSON.stringify({configured, dataDir, publication, fingerprints})).digest('hex');
  return {ok: true, revision, loadOrder: order, activeOrder, restartRequired: !same(order, activeOrder), dataDirectory: String(settings.dataDir || './data'), publicationDirectory: path.join(config?.directory || './client-resources', 'Data'), entries: [...entries.values()]};
}

export function validateModOrder(input: unknown, snapshot: Awaited<ReturnType<typeof inspectModOrder>>): string[] {
  if (!Array.isArray(input) || !input.length || input.length > 4096 || !input.every(validName)) throw new ModOrderError('INVALID_ORDER');
  const names = input as string[], positions = new Map<string, number>(), entries = new Map(snapshot.entries.map(entry => [key(entry.name), entry]));
  if (key(names[0]) !== 'skyrim.esm') throw new ModOrderError('BASE_FIRST');
  for (const [index, name] of names.entries()) {
    if (positions.has(key(name))) throw new ModOrderError('DUPLICATE_PLUGIN', 400, name);
    positions.set(key(name), index);
  }
  let regular = false;
  for (const [index, name] of names.entries()) {
    const entry = entries.get(key(name));
    if (!entry || entry.issue) throw new ModOrderError(entry?.issue === 'publicationOnly' ? 'SERVER_COPY_REQUIRED' : 'INVALID_PLUGIN', 400, name);
    if (regular && entry.master) throw new ModOrderError('MASTER_ORDER', 400, name);
    if (!entry.master) regular = true;
    for (const master of entry.masters) {
      const before = positions.get(key(master));
      if (before === undefined || before >= index) throw new ModOrderError('DEPENDENCY_ORDER', 400, name, master);
    }
  }
  return names.map(name => entries.get(key(name))!.name);
}

export function registerModLoadOrder(router: any, options: {read: () => Settings; write: (settings: Settings) => void; authorize: (ctx: any, write: boolean) => boolean}) {
  let queue = Promise.resolve();
  const failure = (ctx: any, error: unknown) => {
    const known = error instanceof ModOrderError;
    ctx.status = known ? error.status : 503;
    ctx.body = {ok: false, code: known ? error.code : 'STORAGE_ERROR', ...(known ? {plugin: error.plugin, dependency: error.dependency} : {})};
  };
  router.get('/api/admin/resources/load-order', async (ctx: any) => {
    if (!options.authorize(ctx, false)) return;
    ctx.set('Cache-Control', 'no-store');
    try { ctx.body = await inspectModOrder(options.read()); } catch (error) { failure(ctx, error); }
  });
  router.post('/api/admin/resources/load-order', async (ctx: any) => {
    if (!options.authorize(ctx, true)) return;
    ctx.set('Cache-Control', 'no-store');
    let origin = false;
    try { const url = new URL(ctx.get('origin')); origin = ['http:', 'https:'].includes(url.protocol) && url.host === ctx.host; } catch {}
    if (!origin || ctx.get('content-type').split(';')[0].trim() !== 'application/json' || !['', 'same-origin', 'none'].includes(ctx.get('sec-fetch-site'))) { ctx.status = 403; ctx.body = {ok: false, code: 'SAME_ORIGIN_REQUIRED'}; return; }
    const body = ctx.request.body;
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(name => !['revision', 'loadOrder'].includes(name)) || typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision) || JSON.stringify(body).length > 1024 * 1024) { ctx.status = 400; ctx.body = {ok: false, code: 'INVALID_ORDER'}; return; }
    const before = queue; let release!: () => void; queue = new Promise<void>(resolve => { release = resolve; });
    await before;
    try {
      const settings = options.read(), snapshot = await inspectModOrder(settings);
      if (body.revision !== snapshot.revision) throw new ModOrderError('STALE_ORDER', 409);
      const order = validateModOrder(body.loadOrder, snapshot);
      // Preserve original configured paths and every unrelated setting/private key.
      const original = new Map((Array.isArray(settings.loadOrder) ? settings.loadOrder : []).filter((value): value is string => typeof value === 'string').map(value => [key(path.basename(value)), value]));
      const latest = options.read();
      if (JSON.stringify([latest.loadOrder, latest.dataDir, latest.launcherResources]) !== JSON.stringify([settings.loadOrder, settings.dataDir, settings.launcherResources])) throw new ModOrderError('STALE_ORDER', 409);
      latest.loadOrder = order.map(name => {
        const prior = original.get(key(name));
        return prior && (path.isAbsolute(prior) || /[\\/]/.test(prior)) ? prior : name;
      });
      options.write(latest);
      ctx.body = {...await inspectModOrder(latest), restartRequired: true};
    } catch (error) { failure(ctx, error); } finally { release(); }
  });
}
