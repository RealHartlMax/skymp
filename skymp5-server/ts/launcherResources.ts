import { createHash } from 'node:crypto';
import { constants, createReadStream, type Dirent } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const MAX_FILES = 10000;
const MAX_FILE_BYTES = 8 * 1024 ** 3;
const MAX_TOTAL_BYTES = 64 * 1024 ** 3;
const ASSETS = new Set(['.nif', '.dds', '.hkx', '.tri', '.btr', '.bto', '.wav', '.xwm', '.fuz', '.lip', '.strings', '.dlstrings', '.ilstrings', '.swf', '.gfx', '.seq', '.ttf', '.otf', '.png', '.jpg', '.jpeg', '.tga', '.bmp']);
const CONFIGS = new Set(['.ini', '.json', '.xml', '.txt', '.toml', '.yaml', '.yml']);
const RUNTIME_DLLS = new Set(['skyrimplatform.dll', 'mpclientplugin.dll']);
const UNPUBLISHED_DIRECTORIES = new Set(['fomod', 'modderresource', 'source']);
const UNPUBLISHED_FILES = /\.(?:psc|md|pdb|h|hpp|c|cpp)$/i;
const MODS_DIRECTORY = 'mods';

interface LocalFile { filename: string; size: number; crc32: number }
export interface LauncherResource {
  name: string;
  path: string;
  kind: 'mod' | 'archive' | 'script' | 'asset' | 'config' | 'skse-plugin';
  size: number;
  hash: string;
  downloadPath: string;
}
export interface LauncherManifest {
  version: '2' | '4';
  revision: string;
  generatedAt: string;
  totalSize: number;
  loadOrder: string[];
  requiredLocalFiles: LocalFile[];
  resources: LauncherResource[];
  runtimeSource?: string;
  skseGameVersion?: string;
}
interface Source { root: string; relative: string; target: string; mod?: string }
interface IndexedFile extends Source { fingerprint: string; resource: LauncherResource }
export interface ModFolderReport { name: string; plugins: string[]; active: boolean; dlls: string[]; files: number }
export interface ModScan {
  sources: Map<string, Source>;
  folders: ModFolderReport[];
  conflicts: { file: string; winner: string; loser: string }[];
  skipped: { mod: string; file: string }[];
}

class ResourceError extends Error {
  constructor(message: string, readonly status = 503) { super(message); }
}
const fail = (message: string): never => { throw new ResourceError(message); };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const fingerprint = (stat: { size: number; mtimeMs: number; ctimeMs: number; ino: number }) => `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
const sameNames = (a: string[], b: string[]) => a.length === b.length && a.every((name, index) => name.toLowerCase() === b[index]?.toLowerCase());

export function officialGameFile(name: string): boolean {
  return /^(?:skyrim|update|dawnguard|hearthfires|dragonborn)(?:\.esm|\.bsa| - .*)$/i.test(name)
    || /^cc.*\.(?:esm|esl|bsa)$/i.test(name);
}

/** Paths are installed on Windows even when the file host runs Linux. */
export function validateClientPath(value: string): void {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 240 || !value.startsWith('Data/') || value.includes('\\')) fail('Client paths must be relative Data/ paths, at most 240 UTF-8 bytes.');
  for (const part of value.split('/')) {
    const stem = part.split('.')[0];
    if (!part || part === '.' || part === '..' || /[<>:"|?*\x00-\x1f]/.test(part) || /[. ]$/.test(part) || /^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/i.test(stem)) fail(`Invalid Windows resource path: ${value}`);
  }
  const lower = value.toLowerCase();
  if (lower.startsWith('data/platform/') || lower.includes('auth-data') || lower.includes('.skymp') || officialGameFile(path.posix.basename(value))) fail(`Protected client file cannot be distributed as a mod: ${value}`);
}

function resourceKind(target: string): LauncherResource['kind'] {
  validateClientPath(target);
  const ext = path.posix.extname(target).toLowerCase();
  if (['.esm', '.esp', '.esl'].includes(ext)) {
    if (target.split('/').length !== 2) fail(`Plugins must be directly inside Data/: ${target}`);
    return 'mod';
  }
  if (ext === '.bsa') {
    if (target.split('/').length !== 2) fail(`Archives must be directly inside Data/: ${target}`);
    return 'archive';
  }
  if (ext === '.pex' && target.toLowerCase().startsWith('data/scripts/')) return 'script';
  if (ext === '.dll' && /^data\/skse\/plugins\/[^/]+$/i.test(target)) {
    if (RUNTIME_DLLS.has(path.posix.basename(target).toLowerCase())) fail(`Runtime DLLs cannot be replaced by a mod: ${target}`);
    return 'skse-plugin';
  }
  if (ASSETS.has(ext)) return 'asset';
  if (CONFIGS.has(ext)) return 'config';
  return fail(`Unsupported mod file: ${target}.`);
}

/** Folders in configured order first, the rest alphabetically; a later folder wins conflicts. */
export async function orderedModFolders(dataDir: string, preferred?: unknown): Promise<string[]> {
  const root = path.join(dataDir, MODS_DIRECTORY);
  let entries: Dirent[];
  try {
    if ((await fs.lstat(root)).isSymbolicLink()) fail('data/mods must be a regular directory.');
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
  const folders = entries.filter(entry => {
    if (entry.isSymbolicLink()) fail('Symlinks are not supported in client resources.');
    return entry.isDirectory() && !entry.name.startsWith('.');
  }).map(entry => entry.name).sort((a, b) => a.localeCompare(b, 'en'));
  const wanted = Array.isArray(preferred) ? preferred.filter((name): name is string => typeof name === 'string') : [];
  return [...new Set([...wanted.filter(name => folders.includes(name)), ...folders])];
}

async function listModFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  let scanned = 0;
  const walk = async (relative: string, depth: number): Promise<void> => {
    if (depth > 16) fail('Client resource directory is too deep.');
    for (const entry of await fs.readdir(relative ? path.join(root, relative) : root, { withFileTypes: true })) {
      if (++scanned > MAX_FILES * 2) fail('Client resource directory has too many entries.');
      if (entry.name.startsWith('.')) continue;
      const next = relative ? relative + '/' + entry.name : entry.name;
      if (entry.isSymbolicLink()) fail('Symlinks are not supported in client resources.');
      if (entry.isDirectory()) { if (!(depth === 0 && UNPUBLISHED_DIRECTORIES.has(entry.name.toLowerCase()))) await walk(next, depth + 1); continue; }
      if (!entry.isFile()) fail('Client resources must be regular files.');
      files.push(next);
    }
  };
  await walk('', 0);
  return files;
}

/** Maps data/mods/<mod>/<file> to the flat Data/<file> path that Skyrim and SKSE load from. */
export async function scanModFolders(options: { dataDir: string; loadOrder: string[]; modFolders?: unknown; skseFolders?: unknown }): Promise<ModScan> {
  const names = new Set(options.loadOrder.map(name => path.basename(String(name).replace(/\\/g, '/')).toLowerCase()));
  const allowDlls = new Set(Array.isArray(options.skseFolders) ? options.skseFolders : []);
  const scan: ModScan = { sources: new Map(), folders: [], conflicts: [], skipped: [] };
  for (const mod of await orderedModFolders(options.dataDir, options.modFolders)) {
    const root = path.join(options.dataDir, MODS_DIRECTORY, mod);
    const files = await listModFiles(root);
    const plugins = files.filter(file => /^[^/]+\.(?:esm|esp|esl)$/i.test(file));
    const active = !plugins.length || plugins.some(file => names.has(file.toLowerCase()));
    const dlls = files.filter(file => /^skse\/plugins\/[^/]+\.dll$/i.test(file));
    scan.folders.push({ name: mod, plugins, active, dlls, files: files.length });
    if (!active) continue;
    for (const file of files) {
      if (UNPUBLISHED_FILES.test(file)) continue;
      const target = 'Data/' + file;
      let kind: LauncherResource['kind'];
      try { kind = resourceKind(target); }
      catch (error) { if (!(error instanceof ResourceError)) throw error; scan.skipped.push({ mod, file }); continue; }
      if (kind === 'mod' && !names.has(file.toLowerCase())) continue;
      if (kind === 'skse-plugin' && !allowDlls.has(mod)) { scan.skipped.push({ mod, file }); continue; }
      const key = target.toLowerCase(), previous = scan.sources.get(key);
      if (previous) scan.conflicts.push({ file: target, winner: mod, loser: previous.mod || '' });
      if (!previous && scan.sources.size >= MAX_FILES) fail('Too many client resources.');
      scan.sources.set(key, { root, relative: file, target, mod });
    }
  }
  return scan;
}

async function checkedFile(root: string, relative: string): Promise<string> {
  // Both source paths come from the operator's folders, never from a URL parameter.
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === '..' || part === '.')) fail('Invalid resource source path.');
  let current = root;
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if ((await fs.lstat(current)).isSymbolicLink()) fail('Symlinks are not supported in client resources.');
  }
  const [realRoot, realFile] = await Promise.all([fs.realpath(root), fs.realpath(current)]);
  const rel = path.relative(realRoot, realFile);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) fail('Resource source escapes its root.');
  return realFile;
}

export type LauncherResourceOptions = { dataDir: string; loadOrder: string[]; modFolders?: string[]; skseFolders?: string[]; skseGameVersion?: string; enabled?: boolean; runtimeSource?: string };

let clientResourcesWarned = false;
/** The removed directory is never published; operators must move its files to data/mods. */
async function warnAboutClientResources(): Promise<void> {
  if (clientResourcesWarned) return;
  clientResourcesWarned = true;
  try { if ((await fs.readdir(path.resolve('client-resources/Data'))).length) console.warn('[launcher] client-resources is no longer published. Move its files to data/mods/<mod>/.'); }
  catch { /* A server without the old directory has nothing to migrate. */ }
}

/** Public download surface is separate from the dashboard's diagnostic scanner. */
export class LauncherResourceStore {
  private cached?: { manifest: LauncherManifest; files: Map<string, IndexedFile>; at: number };
  private pending?: Promise<NonNullable<LauncherResourceStore['cached']>>;
  private hashes = new Map<string, { fingerprint: string; hash: string }>();
  private readonly dataDir: string;
  constructor(private readonly options: LauncherResourceOptions) {
    this.dataDir = path.resolve(options.dataDir);
  }

  private async hash(source: Source): Promise<{ hash: string; size: number; fingerprint: string }> {
    const file = await checkedFile(source.root, source.relative);
    const stat = await fs.stat(file);
    if (!stat.isFile() || !Number.isSafeInteger(stat.size) || stat.size > MAX_FILE_BYTES) fail(`Resource is not a supported file: ${source.target}`);
    const key = fingerprint(stat);
    const cached = this.hashes.get(file);
    if (cached?.fingerprint === key) return { hash: cached.hash, size: stat.size, fingerprint: key };
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    if (fingerprint(await fs.stat(file)) !== key) fail(`Resource changed while hashing: ${source.target}. Retry after publication finishes.`);
    const value = hash.digest('hex');
    this.hashes.set(file, { fingerprint: key, hash: value });
    return { hash: value, size: stat.size, fingerprint: key };
  }

  private async build(): Promise<NonNullable<LauncherResourceStore['cached']>> {
    if (this.options.enabled === false) throw new ResourceError('Launcher downloads are disabled.', 404);
    const loadOrder = this.options.loadOrder.map(name => String(name).split(/[\\/]/).pop() || '');
    const names = new Set<string>();
    for (const name of loadOrder) {
      if (!name || /[<>:"|?*\x00-\x1f]/.test(name) || !/\.(?:esm|esp|esl)$/i.test(name) || names.has(name.toLowerCase())) fail('Server loadOrder contains an invalid/duplicate plugin.');
      names.add(name.toLowerCase());
    }
    if (!loadOrder.length || loadOrder.length > 4096) fail('Server must declare a nonempty loadOrder.');
    let game: { versionMajor: number; loadOrder: string[]; mods: LocalFile[] };
    try { game = JSON.parse(await fs.readFile(path.join(this.dataDir, 'manifest.json'), 'utf8')); }
    catch { return fail('Game manifest is missing or invalid. Restart the server to regenerate data/manifest.json.'); }
    if (game.versionMajor !== 1 || !Array.isArray(game.mods) || !Array.isArray(game.loadOrder) || !sameNames(loadOrder, game.loadOrder)) fail('Game manifest and active server loadOrder differ. Restart the server to regenerate the manifest.');
    const requiredLocalFiles: LocalFile[] = [];
    for (const entry of game.mods) {
      if (!officialGameFile(entry.filename)) continue;
      if (path.basename(entry.filename) !== entry.filename || /[\\/]/.test(entry.filename) || !Number.isSafeInteger(entry.size) || entry.size < 1 || !Number.isInteger(entry.crc32) || entry.crc32 < -2147483648 || entry.crc32 > 4294967295) fail('Invalid local-game requirement in the game manifest.');
      if (requiredLocalFiles.some(file => file.filename.toLowerCase() === entry.filename.toLowerCase())) fail('Duplicate local-game requirement.');
      requiredLocalFiles.push({ filename: entry.filename, size: entry.size, crc32: entry.crc32 });
    }
    for (const name of loadOrder.filter(officialGameFile)) {
      if (!requiredLocalFiles.some(file => file.filename.toLowerCase() === name.toLowerCase())) fail(`Game manifest has no checksum for required local file: ${name}`);
    }
    await warnAboutClientResources();
    const scan = await scanModFolders({ ...this.options, dataDir: this.dataDir, loadOrder });
    const sources = scan.sources;
    const add = (source: Source) => {
      resourceKind(source.target);
      const key = source.target.toLowerCase();
      if (sources.has(key)) fail(`Duplicate client destination (Windows ignores case): ${source.target}`);
      if (sources.size >= MAX_FILES) fail('Too many client resources.');
      sources.set(key, source);
    };
    const dataEntries = await fs.readdir(this.dataDir, { withFileTypes: true });
    // Plugins outside data/mods stay supported. Publish only custom load-order files,
    // never game masters, server scripts, credentials, DLLs or arbitrary dataDir files.
    const configured = new Map(this.options.loadOrder.map(entry => [path.posix.basename(String(entry).replace(/\\/g, '/')).toLowerCase(), String(entry).replace(/\\/g, '/')]));
    for (const name of loadOrder.filter(name => !officialGameFile(name))) {
      const target = 'Data/' + name;
      if (!sources.has(target.toLowerCase())) add({ root: this.dataDir, relative: configured.get(name.toLowerCase()) || name, target });
      const stem = name.replace(/\.[^.]+$/, '').toLowerCase();
      for (const entry of dataEntries) {
        const lower = entry.name.toLowerCase();
        if ((lower === stem + '.bsa' || (lower.startsWith(stem + ' - ') && lower.endsWith('.bsa'))) && !sources.has(('Data/' + entry.name).toLowerCase())) add({ root: this.dataDir, relative: entry.name, target: 'Data/' + entry.name });
      }
    }
    for (const source of sources.values()) {
      if (resourceKind(source.target) === 'mod' && !names.has(path.posix.basename(source.target).toLowerCase())) fail(`Published plugin is absent from server loadOrder: ${source.target}`);
    }
    const resources: LauncherResource[] = [], files = new Map<string, IndexedFile>();
    let totalSize = 0;
    for (const source of [...sources.values()].sort((a, b) => a.target.localeCompare(b.target, 'en'))) {
      const content = await this.hash(source);
      totalSize += content.size;
      if (!Number.isSafeInteger(totalSize) || totalSize > MAX_TOTAL_BYTES) fail('Client mod package exceeds 64 GiB.');
      const id = digest(source.target.toLowerCase() + '\0' + content.hash);
      const resource: LauncherResource = { name: path.posix.basename(source.target), path: source.target, kind: resourceKind(source.target), size: content.size, hash: 'sha256:' + content.hash, downloadPath: 'api/launcher/files/' + id };
      resources.push(resource); files.set(id, { ...source, fingerprint: content.fingerprint, resource });
    }
    const runtimeSource = this.options.runtimeSource?.trim();
    if (runtimeSource) {
      let url: URL;
      try { url = new URL(runtimeSource); } catch { return fail('runtimeSource must be an absolute HTTP(S) runtime-manifest.json URL.'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) fail('runtimeSource must not contain credentials, query parameters or fragments.');
    }
    const skseGameVersion = String(this.options.skseGameVersion || '').trim();
    const hasDlls = resources.some(resource => resource.kind === 'skse-plugin');
    if (hasDlls && !/^\d+\.\d+\.\d+\.\d+$/.test(skseGameVersion)) fail('SKSE plugins require launcherResources.skseGameVersion, for example 1.6.1170.0.');
    // Old launchers must reject executable mod files, not silently skip them.
    const stable = { version: (hasDlls ? '4' : '2') as '2' | '4', totalSize, loadOrder, requiredLocalFiles, resources, ...(runtimeSource ? { runtimeSource } : {}), ...(hasDlls ? { skseGameVersion } : {}) };
    const manifest = { ...stable, revision: digest(JSON.stringify(stable)), generatedAt: new Date().toISOString() };
    // Bound the hash cache to the current publication, including data-only custom plugins.
    if (this.hashes.size > MAX_FILES * 2) this.hashes.clear();
    return { manifest, files, at: Date.now() };
  }

  private async snapshot(): Promise<NonNullable<LauncherResourceStore['cached']>> {
    if (this.cached && Date.now() - this.cached.at < 2000) return this.cached;
    if (!this.pending) this.pending = this.build().then(value => (this.cached = value)).finally(() => { this.pending = undefined; });
    return this.pending;
  }
  async manifest(): Promise<LauncherManifest> { return (await this.snapshot()).manifest; }

  async download(id: string, ctx: any): Promise<void> {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new ResourceError('Invalid resource ID.', 400);
    const entry = (await this.snapshot()).files.get(id);
    if (!entry) throw new ResourceError('Resource revision no longer exists; refresh the manifest.', 404);
    const source = await checkedFile(entry.root, entry.relative);
    const file = await fs.open(source, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    let streaming = false;
    try {
      const stat = await file.stat();
      if (fingerprint(stat) !== entry.fingerprint) { this.cached = undefined; throw new ResourceError('Resource changed; refresh the manifest.', 409); }
      const etag = '"' + entry.resource.hash + '"';
      ctx.set('ETag', etag); ctx.set('X-Resource-Hash', entry.resource.hash);
      ctx.set('Accept-Ranges', 'bytes'); ctx.set('Cache-Control', 'public, max-age=31536000, immutable');
      ctx.set('X-Content-Type-Options', 'nosniff');
      ctx.set('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(entry.resource.name));
      if (ctx.get('If-None-Match') === etag) { ctx.status = 304; return; }
      let start = 0, end = stat.size - 1;
      const range = ctx.method === 'GET' ? ctx.get('Range') : '';
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]) || stat.size === 0) { ctx.set('Content-Range', `bytes */${stat.size}`); throw new ResourceError('Invalid byte range.', 416); }
        if (!match[1]) start = Math.max(0, stat.size - Number(match[2]));
        else { start = Number(match[1]); if (match[2]) end = Math.min(Number(match[2]), end); }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= stat.size) { ctx.set('Content-Range', `bytes */${stat.size}`); throw new ResourceError('Invalid byte range.', 416); }
        ctx.set('Content-Range', `bytes ${start}-${end}/${stat.size}`);
      }
      ctx.status = range ? 206 : 200; ctx.type = 'application/octet-stream';
      ctx.set('Content-Length', String(stat.size === 0 ? 0 : end - start + 1));
      if (ctx.method === 'HEAD') return;
      ctx.body = file.createReadStream(stat.size === 0 ? {} : { start, end });
      streaming = true;
    } finally { if (!streaming) await file.close(); }
  }
}

export function registerLauncherResources(router: any, options: LauncherResourceOptions | (() => LauncherResourceOptions), pluginRuntime?: () => unknown): LauncherResourceStore {
  const readOptions = () => typeof options === 'function' ? options() : options;
  let currentOptions = JSON.stringify(readOptions());
  let store = new LauncherResourceStore(JSON.parse(currentOptions));
  const currentStore = () => {
    const next = JSON.stringify(readOptions());
    if (next !== currentOptions) { store = new LauncherResourceStore(JSON.parse(next)); currentOptions = next; }
    return store;
  };
  const handler = (action: (ctx: any) => Promise<void>) => async (ctx: any) => {
    try { await action(ctx); }
    catch (error) {
      ctx.status = error instanceof ResourceError ? error.status : 503;
      ctx.set('Cache-Control', 'no-store');
      ctx.body = { error: error instanceof ResourceError ? error.message : 'Client resources could not be read. Check the publication directory and server log.' };
    }
  };
  router.get('/api/launcher/manifest', handler(async ctx => {
    ctx.set('Cache-Control', 'no-store');
    const manifest = await currentStore().manifest();
    const modules = pluginRuntime?.() as { version: number; revision: string; packages: unknown[] } | undefined;
    // Old launchers must reject a required executable-package extension, not silently ignore it.
    ctx.body = modules ? { ...manifest, version: manifest.version === '4' ? '4' : modules.packages.length ? '3' : '2',
      revision: digest(manifest.revision + '\0' + modules.revision), pluginRuntime: modules } : manifest;
  }));
  router.get('/api/launcher/files/:id', handler(ctx => currentStore().download(String(ctx.params.id), ctx)));
  return store;
}
