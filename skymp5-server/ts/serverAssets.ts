import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const LIMIT = 8 * 1024 * 1024;
const NAMES = { logo: 'logo.png', banner: 'banner.png' } as const;
type AssetName = keyof typeof NAMES;
interface Asset { path: string; sha256: string; size: number }
const cache = new Map<string, { stamp: string; bytes: Buffer; asset: Asset }>();

/** Root images belong to the operator; packaged defaults fill missing images. */
export async function readServerAsset(name: AssetName, root = process.cwd()) {
  let base = await fs.realpath(root);
  let filename = path.join(base, NAMES[name]);
  let stat;
  try { stat = await fs.lstat(filename); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    cache.delete(filename);
    const defaults = path.join(base, 'server-assets');
    try {
      const directory = await fs.lstat(defaults);
      if (!directory.isDirectory() || directory.isSymbolicLink() || await fs.realpath(defaults) !== defaults) throw Error('Invalid server asset directory');
      base = defaults;
      filename = path.join(base, NAMES[name]);
      stat = await fs.lstat(filename);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') { cache.delete(filename); return undefined; }
      throw error;
    }
  }
  if (stat.isSymbolicLink() || !stat.isFile() || stat.size < 33 || stat.size > LIMIT) throw Error('Invalid server PNG');
  if (path.dirname(await fs.realpath(filename)) !== base) throw Error('Server PNG escapes root');
  const stamp = `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
  const previous = cache.get(filename);
  if (previous?.stamp === stamp) return previous;
  const file = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  let bytes: Buffer;
  try {
    const opened = await file.stat();
    if (!opened.isFile() || opened.size !== stat.size || opened.mtimeMs !== stat.mtimeMs) throw Error('Server PNG changed');
    bytes = Buffer.alloc(opened.size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await file.read(bytes, offset, bytes.length - offset, offset);
      if (!result.bytesRead) break;
      offset += result.bytesRead;
    }
    if (offset !== opened.size || (await file.stat()).mtimeMs !== opened.mtimeMs) throw Error('Server PNG changed');
    bytes = bytes.subarray(0, offset);
  } finally { await file.close(); }
  if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || bytes.toString('ascii', 12, 16) !== 'IHDR') throw Error('Server image must be PNG');
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
  if (!width || !height || width > 8192 || height > 8192 || width * height > 16777216) throw Error('Server PNG dimensions exceed limit');
  const asset = { path: `/api/launcher/assets/${NAMES[name]}`, sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length };
  const result = { stamp, bytes, asset };
  cache.set(filename, result);
  return result;
}

export async function describeServerAssets(root = process.cwd()): Promise<Partial<Record<AssetName, Asset>>> {
  const result: Partial<Record<AssetName, Asset>> = {};
  for (const name of Object.keys(NAMES) as AssetName[]) {
    try {
      const entry = await readServerAsset(name, root);
      if (entry) result[name] = entry.asset;
    } catch { /* An invalid optional image must not disable the heartbeat or downloads. */ }
  }
  return result;
}

export function registerServerAssets(router: any, root = process.cwd()): void {
  router.get('/api/launcher/assets', async (ctx: any) => {
    ctx.set('Cache-Control', 'no-store');
    ctx.body = { version: 1, assets: await describeServerAssets(root) };
  });
  router.get('/api/launcher/assets/:name', async (ctx: any) => {
    const name = ctx.params.name === 'logo.png' ? 'logo' : ctx.params.name === 'banner.png' ? 'banner' : undefined;
    if (!name) { ctx.status = 404; return; }
    try {
      const entry = await readServerAsset(name, root);
      if (!entry) { ctx.status = 404; return; }
      if (ctx.query.v && ctx.query.v !== entry.asset.sha256) { ctx.status = 409; return; }
      const etag = `"${entry.asset.sha256}"`;
      ctx.set('ETag', etag);
      ctx.set('Cache-Control', 'public, max-age=60, must-revalidate');
      ctx.set('X-Content-Type-Options', 'nosniff');
      if (ctx.get('If-None-Match') === etag) { ctx.status = 304; return; }
      ctx.type = 'image/png';
      ctx.body = entry.bytes;
    } catch { ctx.status = 404; ctx.set('Cache-Control', 'no-store'); }
  });
}
