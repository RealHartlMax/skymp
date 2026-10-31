import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { validatePackage, type RuntimePackage } from '../../misc/plugin-runtime/contract.cjs';

const selectionFile = 'plugin-runtime-publication.json';
const selections = new Map<string, Selection[]>();
const MAX_MANIFEST = 256 * 1024;
type Selection = { name: string; version: string; pluginDir: string };
interface PackageFile { filename: string; bytes: number; sha256: string }
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const fingerprint = (stat: fs.Stats) => `${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
function regularFile(root: string, relative: string): string {
  if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) throw Error('Invalid plugin runtime path');
  let current = path.resolve(root);
  if (fs.lstatSync(current).isSymbolicLink()) throw Error('Plugin runtime symlink');
  for (const part of relative.split('/')) { current = path.join(current, part); if (fs.lstatSync(current).isSymbolicLink()) throw Error('Plugin runtime symlink'); }
  const actual = fs.realpathSync(current), rel = path.relative(fs.realpathSync(root), actual);
  if (rel.startsWith('..' + path.sep) || rel === '..' || path.isAbsolute(rel) || !fs.statSync(actual).isFile()) throw Error('Plugin runtime escapes its directory');
  return actual;
}

/** Persist the successful boot selection, not next-start dashboard checkboxes. */
export function publishPluginRuntimeSelection(dataDir: string, plugins: Selection[]): void {
  selections.set(path.resolve(dataDir), plugins);
  fs.mkdirSync(dataDir, { recursive: true });
  const destination = path.resolve(dataDir, selectionFile), temporary = destination + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify({ version: 1, plugins }) + '\n');
  fs.renameSync(temporary, destination);
}

export function publishStartedPluginRuntime(dataDir: string, plugin: Selection): void {
  publishPluginRuntimeSelection(dataDir, [...(selections.get(path.resolve(dataDir)) ?? []).filter(value => value.name !== plugin.name), plugin]);
}
export function removePublishedPluginRuntime(dataDir: string, name: string): void {
  publishPluginRuntimeSelection(dataDir, (selections.get(path.resolve(dataDir)) ?? []).filter(value => value.name !== name));
}
export function validatePluginRuntime(plugin: Selection): void {
  const own = JSON.parse(fs.readFileSync(regularFile(plugin.pluginDir, 'plugin.json'), 'utf8'));
  if (own.runtime === undefined) return;
  if (own.runtime !== 'Runtime/manifest.json') throw Error('Invalid plugin runtime declaration');
  const file = regularFile(plugin.pluginDir, own.runtime);
  if (fs.statSync(file).size > MAX_MANIFEST) throw Error('Plugin runtime manifest too large');
  const manifest = validatePackage(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (manifest.pluginId !== plugin.name || manifest.version !== plugin.version) throw Error('Plugin runtime identity mismatch');
  for (const entry of manifest.files) {
    const source = regularFile(path.join(plugin.pluginDir, 'Runtime'), entry.path);
    if (fs.statSync(source).size !== entry.size || digest(fs.readFileSync(source)) !== entry.sha256) throw Error('Plugin runtime file integrity failed');
  }
}

export class PluginRuntimeStore {
  private verified = new Map<string, { fingerprint: string; sha256: string }>();
  private files = new Map<string, { source: PackageFile; fingerprint: string }>();
  private manifests = new Map<string, Buffer>();
  private cached?: { at: number; selection: string; advertisement: any };
  constructor(private dataDir: string) {}
  advertisement() {
    const selectionPath = path.resolve(this.dataDir, selectionFile);
    if (!fs.existsSync(selectionPath)) { this.files.clear(); this.manifests.clear(); this.verified.clear(); this.cached = undefined; return { version: 1, revision: digest('[]'), packages: [] }; }
    const selection = fs.readFileSync(selectionPath, 'utf8');
    if (selection.length > MAX_MANIFEST) throw Error('Plugin runtime selection too large');
    if (this.cached && this.cached.selection === selection && Date.now() - this.cached.at < 2000) return this.cached.advertisement;
    const parsed = JSON.parse(selection);
    if (parsed.version !== 1 || !Array.isArray(parsed.plugins) || parsed.plugins.length > 128) throw Error('Invalid active plugin runtime selection');
    const files = new Map<string, { source: PackageFile; fingerprint: string }>(), manifests = new Map<string, Buffer>();
    const packages = [], seen = new Set<string>();
    let totalBytes = 0;
    for (const plugin of parsed.plugins as Selection[]) {
      const pluginRoot = path.resolve(plugin.pluginDir);
      // Only an explicitly declared Runtime/manifest.json is public; no plugin directory walk.
      const pluginManifestPath = regularFile(pluginRoot, 'plugin.json');
      const pluginManifest = JSON.parse(fs.readFileSync(pluginManifestPath, 'utf8'));
      if (pluginManifest.name !== plugin.name || pluginManifest.version !== plugin.version) throw Error('Plugin changed since game start; restart the game server');
      if (pluginManifest.runtime === undefined) continue;
      if (pluginManifest.runtime !== 'Runtime/manifest.json') throw Error('Plugin runtime must declare Runtime/manifest.json');
      const filename = regularFile(pluginRoot, 'Runtime/manifest.json');
      if (fs.statSync(filename).size > MAX_MANIFEST) throw Error('Plugin runtime manifest too large');
      const bytes = fs.readFileSync(filename), manifest: RuntimePackage = validatePackage(JSON.parse(bytes.toString('utf8')));
      if (manifest.pluginId !== plugin.name || manifest.version !== plugin.version || seen.has(plugin.name.toLowerCase())) throw Error('Plugin runtime identity mismatch');
      seen.add(plugin.name.toLowerCase());
      const revision = digest(bytes), root = path.join(pluginRoot, 'Runtime');
      for (const file of manifest.files) {
        const source = regularFile(root, file.path), stat = fs.statSync(source);
        const stamp = fingerprint(stat), previous = this.verified.get(source);
        const hash = previous?.fingerprint === stamp ? previous.sha256 : digest(fs.readFileSync(source));
        if (stat.size !== file.size || hash !== file.sha256) throw Error('Plugin runtime file differs from its manifest');
        this.verified.set(source, { fingerprint: stamp, sha256: hash });
        totalBytes += file.size;
        if (totalBytes > 256 * 1024 * 1024) throw Error('Active plugin runtimes exceed 256 MiB');
        const id = digest(revision + '\0' + file.path);
        files.set(id, { source: { filename: source, bytes: file.size, sha256: file.sha256 }, fingerprint: fingerprint(stat) });
      }
      manifests.set(revision, bytes);
      packages.push({ pluginId: plugin.name, version: plugin.version, manifestSha256: revision, manifestSize: bytes.length,
        downloadPath: 'api/launcher/plugin-runtime/manifests/' + revision });
    }
    const advertisement = { version: 1, revision: digest(JSON.stringify(packages)), packages };
    const activeFiles = new Set([...files.values()].map(entry => entry.source.filename));
    for (const filename of this.verified.keys()) if (!activeFiles.has(filename)) this.verified.delete(filename);
    this.files = files; this.manifests = manifests; this.cached = { at: Date.now(), selection, advertisement };
    return advertisement;
  }
  manifest(id: string, ctx: any) {
    this.advertisement();
    const bytes = /^[a-f0-9]{64}$/.test(id) ? this.manifests.get(id) : null;
    if (!bytes) { ctx.status = 404; return; }
    ctx.type = 'application/octet-stream'; ctx.set('X-Content-Type-Options', 'nosniff');
    ctx.set('Cache-Control', 'public, max-age=31536000, immutable'); ctx.set('Content-Length', String(bytes.length)); ctx.body = bytes;
  }
  download(id: string, ctx: any) {
    this.advertisement();
    const entry = /^[a-f0-9]{64}$/.test(id) ? this.files.get(id) : null;
    if (!entry) { ctx.status = 404; return; }
    const descriptor = fs.openSync(entry.source.filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
    try {
      if (fingerprint(fs.fstatSync(descriptor)) !== entry.fingerprint) { ctx.status = 409; this.cached = undefined; return; }
      ctx.type = 'application/octet-stream'; ctx.set('X-Content-Type-Options', 'nosniff');
      ctx.set('Content-Length', String(entry.source.bytes)); ctx.set('X-Resource-Hash', 'sha256:' + entry.source.sha256);
      ctx.set('Cache-Control', 'public, max-age=31536000, immutable');
      if (ctx.method !== 'HEAD') { ctx.body = fs.createReadStream(entry.source.filename, { fd: descriptor, autoClose: true }); return; }
    } finally { if (!ctx.body || ctx.method === 'HEAD') fs.closeSync(descriptor); }
  }
}

export function registerPluginRuntimes(router: any, dataDir: string): PluginRuntimeStore {
  const store = new PluginRuntimeStore(dataDir);
  const handle = (action: (ctx: any) => void) => (ctx: any) => {
    try { action(ctx); } catch (error) { console.error('[Plugin runtime] Publication failed:', error); ctx.status = 503; ctx.set('Cache-Control', 'no-store'); ctx.body = { code: 'PLUGIN_RUNTIME_UNAVAILABLE', error: 'Plugin runtime publication is invalid. Check the server log and restart after deployment.' }; }
  };
  router.get('/api/launcher/plugin-runtime/manifest', handle(ctx => { ctx.set('Cache-Control', 'no-store'); ctx.body = store.advertisement(); }));
  router.get('/api/launcher/plugin-runtime/manifests/:id', handle(ctx => store.manifest(ctx.params.id, ctx)));
  router.get('/api/launcher/plugin-runtime/files/:id', handle(ctx => store.download(ctx.params.id, ctx)));
  return store;
}
