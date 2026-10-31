import { MsgType } from '../../messages';
import type { CombinedController, Sp } from './clientListener';

const groups: [string, string[]][] = [
  ['tcl', ['tcl', 'ToggleCollision']], ['tgm', ['tgm', 'ToggleGodMode']],
  ['tim', ['tim', 'ToggleImmortalMode']], ['modav', ['modav', 'ModActorValue']],
  ['setav', ['setav', 'SetActorValue']], ['forceav', ['forceav', 'ForceActorValue']],
  ['setlevel', ['setlevel', 'SetLevel']], ['coc', ['coc', 'CenterOnCell']],
  ['moveto', ['moveto', 'MoveTo']], ['kill', ['kill', 'Kill']],
  ['resurrect', ['resurrect', 'Resurrect']], ['enable', ['enable', 'Enable']],
  ['unlock', ['unlock', 'Unlock']],
];
const serverCommands = ['additem', 'equipitem', 'placeatme', 'disable'];
const maxPendingHellos = 16;

/** Core transport and native-console hooks; deliberately independent from Chat/CEF. */
export class ConsoleSecurityClient {
  private blockVanilla = true;
  private allowed = new Set<string>();
  private supported = new Set<string>();
  private unsupported = new Set<string>();
  private playing = false;
  private requestIds: string[] = [];
  private nextHello = 0;
  private lastPolicy = 0;
  private lastReport = 0;
  private blockedAt = new Map<string, number>();
  constructor(private sp: Sp, private controller: CombinedController) {
    for (const event of ['connectionAccepted', 'connectionDisconnect', 'connectionDenied', 'connectionFailed'] as const)
      controller.emitter.on(event, () => this.reset());
    controller.emitter.on('createActorMessage', event => {
      if (event.message.isMe) { this.reset(); this.playing = true; this.nextHello = 0; }
    });
    controller.emitter.on('customPacketMessage', event => this.receive(event.message.contentJsonDump));
    controller.on('update', () => {
      const now = Date.now();
      if (this.lastPolicy && now - this.lastPolicy > 20000) { this.blockVanilla = true; this.allowed.clear(); this.lastPolicy = 0; }
      if (!this.playing || now < this.nextHello) return;
      this.nextHello = now + (this.lastPolicy ? 10000 : 1000);
      const requestId = `${now.toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
      // Replies may lag behind the next hello, so a few outstanding ids stay valid.
      this.requestIds = [...this.requestIds.slice(-(maxPendingHellos - 1)), requestId];
      this.send('hello', { requestId });
    });
  }
  private reset() {
    this.blockVanilla = true; this.allowed.clear(); this.playing = false;
    this.requestIds = []; this.lastPolicy = 0; this.nextHello = 0;
    this.blockedAt.clear();
  }
  private send(type: string, data: object) {
    this.controller.emitter.emit('sendMessage', { message: { t: MsgType.CustomPacket,
      contentJsonDump: JSON.stringify({ customPacketType: 'consoleSecurity:' + type, apiVersion: 1, ...data }) }, reliability: 'reliable' });
  }
  private receive(raw: unknown) {
    if (!this.playing || typeof raw !== 'string' || raw.length > 8192) return;
    try {
      const value = JSON.parse(raw), policy = value?.policy;
      const answered = this.requestIds.indexOf(value?.requestId);
      if (value?.customPacketType !== 'consoleSecurity:policy' || value.apiVersion !== 1 || answered < 0) return;
      if (!policy || !['restricted', 'development'].includes(policy.mode) || typeof policy.blockVanillaCheats !== 'boolean' || policy.blockUnauthorizedServerCommands !== true ||
          !Array.isArray(value.allowedServerCommands) || value.allowedServerCommands.length > 4 || !value.allowedServerCommands.every((name: unknown) => typeof name === 'string' && serverCommands.includes(name))) return;
      this.blockVanilla = policy.mode === 'restricted' || policy.blockVanillaCheats;
      this.requestIds = this.requestIds.slice(answered + 1);
      this.allowed = new Set(value.allowedServerCommands); this.lastPolicy = Date.now();
      if (this.lastPolicy - this.lastReport > 10000) {
        this.lastReport = this.lastPolicy;
        this.send('report', { supported: Array.from(this.supported), unsupported: Array.from(this.unsupported) });
      }
    } catch { /* Ignore unrelated/malformed custom packets; Chat keeps its own dispatcher. */ }
  }
  installHooks(forwarded: string[]) {
    for (const name of forwarded) this.supported.add(name);
    for (const name of serverCommands) if (!forwarded.includes(name)) this.unsupported.add(name);
    const installed = new Set<string>();
    for (const [name, aliases] of groups) {
      let command: ReturnType<Sp['findConsoleCommand']> = null;
      for (const alias of aliases) { try { command = this.sp.findConsoleCommand(alias); } catch {} if (command) break; }
      if (!command) { this.unsupported.add(name); continue; }
      const canonical = command.longName.toLowerCase();
      if (installed.has(canonical)) { this.supported.add(name); continue; }
      try {
        const previous = command.execute;
        command.execute = (...args: any[]) => {
          if (this.blockVanilla) { this.deny(name); return false; }
          try { return typeof previous === 'function' ? previous(...args) === true : true; } catch { return false; }
        };
        installed.add(canonical); this.supported.add(name);
      } catch { this.unsupported.add(name); }
    }
    this.sp.storage['consoleSecurityClient'] = { apiVersion: 1, supported: Array.from(this.supported), unsupported: Array.from(this.unsupported), verifiedByServer: false };
  }
  canForward(command: string) { return this.playing && this.lastPolicy > 0 && this.allowed.has(command); }
  deny(command: string) {
    const now = Date.now(), before = this.blockedAt.get(command) ?? 0;
    if (now - before < 1000) return;
    this.blockedAt.set(command, now);
    this.sp.printConsole('Console Security: ' + command + ' blocked by server policy.');
    if (this.playing) this.send('blocked', { command });
  }
}
