import { MsgType } from '../../messages';
import type { CombinedController, Sp } from './clientListener';
import { packageRoot, signedPayload, validatePackage, type RuntimePackage } from '../../../../misc/plugin-runtime/contract.cjs';

export const PLUGIN_RUNTIME_API = 1;
const INDEX_PATH = 'Data/Platform/PluginRuntime/active.json';
interface Module { id: string; revision: string; manifest: RuntimePackage; manifestJson: string; root: string; cleanup: (() => void)[]; active: boolean; ui?: any; ack: boolean }
export interface RuntimeBindings {
  bindChat: (bridge: any) => () => void;
  bindUi: (bridge: any) => () => void;
  releaseChatFocus: () => void;
  focus: (focused: boolean) => void;
}
const safeScript = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
const hostName = (value: string) => value.replace(/^\[|\]$/g, '').toLowerCase();

export function assertPluginRuntimeReady(sp: Sp, host: string, port: number): void {
  if ((sp.settings['skymp5-client'] as any)?.['plugin-runtime-api'] !== 1) return;
  const state = sp.storage['pluginRuntimeState'] as any;
  if (!state?.ready || hostName(state.host) !== hostName(host) || state.port !== port) throw Error('Plugin runtime is not ready for this server. Prepare this server in the launcher before connecting.');
}

/** SkyMPPluginRuntimeLoader/v1. Downloads/activation are owned by the launcher. */
export class PluginRuntimeLoader {
  readonly implementation = 'SkyMPPluginRuntimeLoader/v1';
  private modules: Module[] = [];
  private allowed = true;
  private focused: string | null = null;
  private dismissers = new Map<string, () => void>();
  private indexHash = '';
  private peer = '';
  private failedIndex = '';
  private uiDeadline = 0;
  private hostLoaded = false;
  private listeners: (() => void)[] = [];
  private io: any;
  constructor(private sp: Sp, private controller: CombinedController, private bindings: RuntimeBindings) {
    const previous = sp.storage['pluginRuntimeDispose'];
    if (typeof previous === 'function') previous();
    sp.storage['pluginRuntimeDispose'] = () => { this.reset(); for (const dispose of this.listeners.splice(0).reverse()) dispose(); };
    const on = (name: any, handler: any) => { (controller.emitter as any).on(name, handler); this.listeners.push(() => (controller.emitter as any).off(name, handler)); };
    on('pluginRuntimeBeforeConnect', (peer: any) => this.activate(peer.hostName, peer.port));
    for (const event of ['connectionDisconnect', 'connectionFailed', 'connectionDenied'] as const) on(event, () => this.reset());
    on('browserWindowLoaded', () => { this.hostLoaded = true; this.installUi(); });
    const browserListener = controller.on('browserMessage', event => this.browserMessage(event.arguments));
    this.listeners.push(() => sp.unsubscribe(browserListener));
    const updateListener = controller.on('update', () => {
      if (this.uiDeadline && Date.now() >= this.uiDeadline && this.modules.some(module => module.ui && !module.ack)) this.failUi('UI host did not confirm activation');
    });
    this.listeners.push(() => sp.unsubscribe(updateListener));
    on('customPacketMessage', (event: any) => {
      const raw = event.message.contentJsonDump;
      if (typeof raw !== 'string' || raw.length > 65536) return;
      try {
        const packet = JSON.parse(raw);
        if (packet.customPacketType !== 'pluginRuntime' || packet.apiVersion !== 1 || !this.modules.some(module => module.active && module.id === packet.pluginId)) return;
        this.execute(`window.SkyMPPluginRuntime?.receive(${safeScript(packet.pluginId)},${safeScript(packet.payload)})`);
      } catch { /* Unrelated packets remain owned by their existing services. */ }
    });
  }
  isFocused() { return this.focused !== null; }
  dismiss() {
    if (!this.focused) return false;
    const id = this.focused;
    this.dismissers.get(id)?.();
    this.execute(`window.SkyMPPluginRuntime?.dismiss(${safeScript(id)})`);
    this.requestFocus(id, false); return true;
  }
  setAllowed(allowed: boolean) {
    this.allowed = allowed;
    if (!allowed && this.focused) this.requestFocus(this.focused, false);
    this.execute(`window.SkyMPPluginRuntime?.setAllowed(${allowed})`);
  }
  private execute(source: string) { this.sp.browser.executeJavaScript(source); }
  private requestFocus(id: string, focused: boolean) {
    if (focused && (!this.allowed || !this.modules.some(module => module.id === id && module.active))) return;
    if (focused) {
      const previous = this.focused;
      if (previous && previous !== id) { this.dismissers.get(previous)?.(); this.execute(`window.SkyMPPluginRuntime?.dismiss(${safeScript(previous)})`); }
      this.focused = id; this.bindings.focus(true);
    }
    else if (this.focused === id) { this.focused = null; this.bindings.focus(false); }
  }
  private nativeIo() {
    if (this.io) return this.io;
    const nativeRequire = (globalThis as any).require;
    if (typeof nativeRequire !== 'function') throw Error('The installed native client does not expose the verified Node module loader');
    this.io = { fs: nativeRequire('node:fs'), path: nativeRequire('node:path'), crypto: nativeRequire('node:crypto'), url: nativeRequire('node:url'), require: nativeRequire, process: nativeRequire('node:process') };
    return this.io;
  }
  private checked(relative: string) {
    const { fs, path, process } = this.nativeIo();
    const game = fs.realpathSync(process.cwd());
    let filename = game;
    for (const part of relative.split('/')) {
      if (!part || part === '.' || part === '..' || part.includes('\\') || part.includes(':')) throw Error('Unsafe runtime file path');
      filename = path.join(filename, part);
      if (fs.lstatSync(filename).isSymbolicLink()) throw Error('Runtime files cannot be symlinks');
    }
    if (!filename.startsWith(game + path.sep) || !fs.statSync(filename).isFile()) throw Error('Invalid runtime file');
    return filename;
  }
  private activate(host: string, port: number) {
    const settings = this.sp.settings['skymp5-client'] as any;
    if (settings?.['plugin-runtime-api'] !== 1) return;
    const expected = settings['plugin-runtime-index-sha256'];
    const peer = hostName(host) + ':' + port;
    if (expected && expected === this.failedIndex) return;
    if (this.indexHash === expected && this.peer === peer && (this.sp.storage['pluginRuntimeState'] as any)?.ready) return;
    this.reset();
    try {
      const { fs, crypto, require: nativeRequire } = this.nativeIo();
      const hash = (bytes: any) => crypto.createHash('sha256').update(bytes).digest('hex');
      if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) throw Error('Missing launcher runtime index hash');
      const bytes = fs.readFileSync(this.checked(INDEX_PATH));
      if (bytes.length > 8 * 1024 * 1024 || hash(bytes) !== expected) throw Error('Runtime index integrity failed');
      const index = JSON.parse(bytes.toString('utf8'));
      if (index.formatVersion !== 1 || hostName(index.server?.host ?? '') !== hostName(host) || index.server.port !== port || !Array.isArray(index.packages) || index.packages.length > 128) throw Error('Runtime index does not match the selected server');
      const publishers = settings['plugin-runtime-publishers'] ?? {};
      const ids = new Set<string>();
      for (const installed of index.packages) {
        const manifest = validatePackage(JSON.parse(installed.manifestJson));
        if (ids.has(manifest.pluginId) || hash(Buffer.from(installed.manifestJson, 'utf8')) !== installed.revision) throw Error('Runtime package identity/integrity failed');
        ids.add(manifest.pluginId);
        const signature = manifest.signature, key = signature && publishers[signature.keyId];
        if (!signature || typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw Error('Plugin publisher is not trusted');
        const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(key, 'hex')]);
        if (!crypto.verify(null, Buffer.from(signedPayload(manifest)), crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' }), Buffer.from(signature.value, 'hex'))) throw Error('Plugin publisher signature failed');
        const root = packageRoot(manifest.pluginId, installed.revision);
        for (const file of manifest.files) {
          const actual = fs.readFileSync(this.checked(root + file.path));
          if (actual.length !== file.size || hash(actual) !== file.sha256) throw Error('Plugin runtime file integrity failed');
        }
        this.modules.push({ id: manifest.pluginId, revision: installed.revision, manifest, manifestJson: installed.manifestJson, root, cleanup: [], active: true, ack: false });
      }
      // Every package is verified before any downloaded client code is evaluated.
      for (const module of this.modules) {
        if (module.manifest.entrypoints.client) {
          const entry = nativeRequire(this.checked(module.root + module.manifest.entrypoints.client));
          if (entry?.apiVersion !== 1 || typeof entry.activate !== 'function') throw Error('Plugin client entry must export apiVersion 1 and activate(api)');
          const dispose = entry.activate(this.context(module));
          if (dispose !== undefined && typeof dispose !== 'function') throw Error('Plugin activate must return a synchronous cleanup function');
          if (dispose) module.cleanup.push(dispose);
        }
      }
      this.indexHash = expected; this.peer = peer;
      this.sp.storage['pluginRuntimeState'] = { ready: true, host, port, indexHash: expected, implementation: this.implementation };
      this.installUi();
    } catch (error) {
      this.reset();
      this.sp.storage['pluginRuntimeState'] = { ready: false, host, port, error: String(error) };
      this.sp.printConsole('[Plugin runtime] ' + String(error));
    }
  }
  private context(module: Module) {
    const cleanup = module.cleanup;
    const guard = (fn: (...args: any[]) => any) => (...args: any[]) => module.active ? fn(...args) : undefined;
    const subscribe = (once: boolean, event: any, fn: any) => {
      if (cleanup.length >= 256) throw Error('Plugin listener limit exceeded');
      const wrapped = guard(fn), id = (once ? this.controller.once : this.controller.on)(event, wrapped);
      if (id !== undefined && id !== null) cleanup.push(() => this.sp.unsubscribe(id));
      return id;
    };
    const handlers = new Map<string, Map<Function, Function>>();
    const emitter = {
      on: (event: string, fn: any) => {
        if (cleanup.length >= 256) throw Error('Plugin listener limit exceeded');
        const callbacks = handlers.get(event) ?? new Map<Function, Function>();
        if (callbacks.has(fn)) return;
        const wrapped = guard(fn); callbacks.set(fn, wrapped); handlers.set(event, callbacks);
        (this.controller.emitter as any).on(event, wrapped);
        cleanup.push(() => { (this.controller.emitter as any).off(event, wrapped); callbacks.delete(fn); });
      },
      off: (event: string, fn: Function) => {
        const wrapped = handlers.get(event)?.get(fn);
        if (wrapped) { (this.controller.emitter as any).off(event, wrapped); handlers.get(event)!.delete(fn); }
      },
      emit: guard((event: any, payload: any) => (this.controller.emitter as any).emit(event, payload)),
    };
    return Object.freeze({ apiVersion: 1, pluginId: module.id, sp: this.sp,
      controller: { on: (event: any, fn: any) => subscribe(false, event, fn), once: (event: any, fn: any) => subscribe(true, event, fn), emitter },
      constants: { CustomPacket: MsgType.CustomPacket },
      bindChat: (bridge: any) => { if (module.id !== 'skymp-chat') throw Error('Chat bridge owner mismatch'); cleanup.push(this.bindings.bindChat(bridge)); },
      bindUi: (bridge: any) => { if (module.id !== 'skymp-ui-core') throw Error('UI bridge owner mismatch'); cleanup.push(this.bindings.bindUi(bridge)); },
      releaseChatFocus: guard(() => this.bindings.releaseChatFocus()),
      requestFocus: guard((focused: boolean) => this.requestFocus(module.id, focused)),
      onDismiss: (fn: () => void) => { this.dismissers.set(module.id, guard(fn)); cleanup.push(() => this.dismissers.delete(module.id)); },
      onDispose: (fn: () => void) => { if (typeof fn !== 'function' || cleanup.length >= 256) throw Error('Invalid cleanup callback'); cleanup.push(fn); },
      send: guard((payload: unknown) => this.send(module.id, payload)),
    });
  }
  private installUi() {
    const { fs, url } = this.io ?? {};
    if (!fs) return;
    this.execute(`window.SkyMPPluginRuntime?.setManaged(${(this.sp.settings['skymp5-client'] as any)?.['plugin-runtime-managed'] !== false})`);
    this.execute('window.SkyMPPluginRuntime?.reset()');
    for (const module of this.modules) {
      const entry = module.manifest.entrypoints.ui;
      if (!entry) continue;
      const css = (module.manifest.entrypoints.styles ?? []).map(file => fs.readFileSync(this.checked(module.root + file), 'utf8')).join('\n');
      const assets: Record<string, string> = {};
      for (const file of module.manifest.files) assets[file.path] = url.pathToFileURL(this.checked(module.root + file.path)).href;
      module.ui = { id: module.id, revision: module.revision, code: fs.readFileSync(this.checked(module.root + entry), 'utf8'), css, assets };
      module.ack = false;
      this.execute(`window.SkyMPPluginRuntime?.install(${safeScript(module.ui)})`);
    }
    this.uiDeadline = this.hostLoaded && this.modules.some(module => module.ui) ? Date.now() + 10000 : 0;
    this.setAllowed(this.allowed);
  }
  private failUi(reason: string) {
    this.failedIndex = this.indexHash;
    this.sp.printConsole('[Plugin runtime] ' + reason + '. Restart Skyrim after correcting the package.');
    this.reset();
    this.sp.mpClientPlugin.destroyClient();
  }
  private send(id: string, payload: unknown) {
    const packet = JSON.stringify({ customPacketType: 'pluginRuntime', apiVersion: 1, pluginId: id, payload });
    if (packet.length > 65536) throw Error('Plugin UI message too large');
    this.controller.emitter.emit('sendMessage', { message: { t: MsgType.CustomPacket, contentJsonDump: packet }, reliability: 'reliable' });
  }
  private browserMessage(args: unknown[]) {
    const [type, payload] = args as any[];
    if (type === 'skympPluginUi:hostReady' && payload?.apiVersion === 1) { this.hostLoaded = true; this.installUi(); return; }
    if (!payload || typeof payload !== 'object') return;
    const module = this.modules.find(value => value.active && value.id === payload.pluginId && value.revision === payload.revision);
    if (!module) return;
    if (type === 'skympPluginUi:installed') {
      module.ack = payload.ok === true;
      if (!module.ack) this.failUi('UI activation failed: ' + module.id);
      else if (this.modules.every(value => !value.ui || value.ack)) this.uiDeadline = 0;
    } else if (type === 'skympPluginUi:focus' && typeof payload.focused === 'boolean') this.requestFocus(module.id, payload.focused);
    else if (type === 'skympPluginUi:message' && this.allowed) this.send(module.id, payload.payload);
  }
  private reset() {
    if (this.focused) { this.focused = null; this.bindings.focus(false); }
    for (const module of this.modules.slice().reverse()) {
      module.active = false;
      for (const dispose of module.cleanup.slice().reverse()) { try { dispose(); } catch { /* Continue cleaning other modules. */ } }
    }
    this.modules = []; this.dismissers.clear(); this.indexHash = ''; this.peer = ''; this.uiDeadline = 0;
    this.sp.storage['pluginRuntimeState'] = { ready: false };
    this.execute('window.SkyMPPluginRuntime?.reset()');
  }
}
