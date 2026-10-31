export type SessionEndKind = 'kick' | 'ban' | 'restart' | 'shutdown';
type Server = any;
const services = new WeakMap<object, PlayerSessionEnd>();
const cleanMessage = (value: unknown) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, 512) : '';

/** Sends a final reliable notice, then closes exactly the captured connection. */
export class PlayerSessionEnd {
  private generations = new Map<number, number>();
  private pending = new Map<number, { timer: NodeJS.Timeout; kind: SessionEndKind }>();
  private lastPing = new Map<number, number>();
  private nativeKick: (userId: number) => void;
  constructor(private server: Server) {
    this.nativeKick = server.kick.bind(server);
    server.on('connect', (userId: number) => { this.cancel(userId); this.lastPing.delete(userId); this.generations.set(userId, (this.generations.get(userId) ?? 0) + 1); });
    server.on('disconnect', (userId: number) => { this.cancel(userId); this.lastPing.delete(userId); this.generations.set(userId, (this.generations.get(userId) ?? 0) + 1); });
    server.on('customPacket', (userId: number, raw: string) => {
      if (typeof raw !== 'string' || raw.length > 256 || !server.isConnected(userId)) return;
      try {
        const value = JSON.parse(raw), now = Date.now();
        if (value?.customPacketType !== 'skymp:sessionPing' || value.version !== 1 || typeof value.nonce !== 'string' ||
            !/^[a-z0-9_]{1,96}$/.test(value.nonce) || now - (this.lastPing.get(userId) ?? 0) < 1000) return;
        this.lastPing.set(userId, now);
        server.sendCustomPacket(userId, JSON.stringify({ customPacketType: 'skymp:sessionPong', version: 1, nonce: value.nonce }));
      } catch { /* Unrelated and malformed custom packets are not session controls. */ }
    });
  }
  private cancel(userId: number) { const before = this.pending.get(userId); if (before) clearTimeout(before.timer); this.pending.delete(userId); }
  end(userId: number, kind: SessionEndKind = 'kick', message = '', until: number | null = null) {
    if (!Number.isSafeInteger(userId) || userId < 0 || userId >= 65535 || !this.server.isConnected(userId)) return;
    const before = this.pending.get(userId);
    if (before?.kind === 'ban' && kind !== 'ban') return;
    this.cancel(userId);
    const generation = this.generations.get(userId) ?? 0;
    let guid: string | undefined;
    try { guid = this.server.getUserGuid?.(userId); } catch {}
    try {
      this.server.sendCustomPacket(userId, JSON.stringify({ customPacketType: 'skymp:sessionEnd', version: 1,
        kind, message: cleanMessage(message), until: kind === 'ban' && Number.isSafeInteger(until) && until! > 0 ? until : null }));
    } catch { console.warn('[session] Final notice could not be delivered for userId=' + userId); }
    const timer = setTimeout(() => {
      this.pending.delete(userId);
      if ((this.generations.get(userId) ?? 0) !== generation || !this.server.isConnected(userId)) return;
      try { if (guid !== undefined && this.server.getUserGuid?.(userId) !== guid) return; this.nativeKick(userId); }
      catch { console.warn('[session] Connection close failed for userId=' + userId); }
    }, 150);
    timer.unref?.(); this.pending.set(userId, { timer, kind });
  }
  shutdown(kind: 'restart' | 'shutdown') {
    const users = new Set(this.generations.keys());
    try {
      const actors = this.server.get(0, 'onlinePlayers');
      if (Array.isArray(actors)) for (const actor of actors) {
        const userId = this.server.getUserByActor(actor);
        if (this.server.getUserActor(userId) === actor) users.add(userId);
      }
    } catch { /* Connected sessions are still covered by native connect events. */ }
    for (const userId of users) this.end(userId, kind);
  }
}

export function installPlayerSessionEnd(server: Server) {
  let service = services.get(server);
  if (!service) {
    service = new PlayerSessionEnd(server); services.set(server, service);
    const owned = service;
    Object.defineProperty(server, 'kick', { configurable: true, writable: true, value: (userId: number) => owned.end(userId) });
  }
  return service;
}
export function endPlayerSession(server: Server, userId: number, kind: SessionEndKind, message = '', until: number | null = null) {
  installPlayerSessionEnd(server).end(userId, kind, message, until);
}
