import { Menu } from 'skyrimPlatform';
import type { CombinedController, Sp } from './clientListener';
import { MsgType } from '../../messages';

export const sessionNoticeKey = 'skymp.sessionEnded.v1';
const mainMenuKey = 'skymp.sessionEnd.mainMenu';
const reconnectKey = 'skymp.sessionEnd.reconnectUntil';
const reconnectWindowMs = 30000;
const reconnectDelayMs = 1000;
const reconnectLoginMs = 15000;
const reachMainMenuMs = 15000;
const kinds = ['kick', 'ban', 'restart', 'shutdown', 'connectionLost', 'connectionFailed', 'connectionDenied'] as const;
export type SessionEndKind = typeof kinds[number];
export interface SessionEndNotice {
  version: 1; id: string; kind: SessionEndKind; message: string; until: number | null;
  at: number; wasPlaying: boolean; acknowledged: boolean;
}
export function getSessionEndNotice(storage: Record<string, unknown>): SessionEndNotice | null {
  const value = storage[sessionNoticeKey] as SessionEndNotice | undefined;
  return value?.version === 1 && typeof value.id === 'string' && kinds.includes(value.kind) &&
    typeof value.message === 'string' && value.message.length <= 512 && typeof value.acknowledged === 'boolean' &&
    typeof value.wasPlaying === 'boolean' && Number.isSafeInteger(value.at) &&
    (value.until === null || Number.isSafeInteger(value.until) && value.until > 0 && value.until <= 8640000000000000) ? value : null;
}

/**
 * Core-owned terminal state. No Chat/UI-Core plugin is needed for disconnect handling.
 * Papyrus natives throw outside the update event, and update does not fire at the
 * main menu: menu state comes from menu events, and only quit/control calls use update.
 */
export class SessionEndClient {
  private notice: SessionEndNotice | null;
  private playing = false;
  private controlsOwned = false;
  private mainMenu = false;
  private loading = false;
  private nextQuit = 0;
  private nextRender = 0;
  private reconnectUntil = 0;
  private nextReconnect = 0;
  private heartbeatActive = false;
  private heartbeatDeadline = 0;
  private nextHeartbeat = 0;
  private lastTick = 0;
  private wasLoading = false;
  private pendingPings = new Map<string, number>();
  constructor(private sp: Sp, private controller: CombinedController, private stopTransport: () => void,
    private retry: () => void) {
    this.notice = getSessionEndNotice(sp.storage);
    if (this.notice?.acknowledged && !this.isBlocked(this.notice)) { delete sp.storage[sessionNoticeKey]; this.notice = null; }
    this.playing = this.notice?.wasPlaying === true || Number((sp.storage['worldModel'] as any)?.playerCharacterFormIdx ?? -1) >= 0;
    this.controlsOwned = sp.storage['skymp.sessionEnd.controlsOwned'] === true;
    this.mainMenu = sp.storage[mainMenuKey] === true;
    this.reconnectUntil = Number(sp.storage[reconnectKey]) || 0;
    if (this.reconnectUntil) this.nextReconnect = Date.now() + reconnectDelayMs;
    controller.emitter.on('createActorMessage', event => {
      if (event.message.isMe && !this.notice) { this.playing = true; this.stopReconnect(); }
    });
    controller.emitter.on('connectionAccepted', () => {
      if (this.reconnectUntil) { this.setReconnectUntil(Math.max(this.reconnectUntil, Date.now() + reconnectLoginMs)); this.nextReconnect = 0; }
    });
    controller.emitter.on('connectionDisconnect', () => this.lost('connectionLost', false));
    controller.emitter.on('connectionFailed', () => this.lost('connectionFailed'));
    controller.emitter.on('connectionDenied', event => {
      // authService owns the password dialog; a refused reconnect has nothing left to retry.
      if (this.reconnectUntil) this.end('connectionDenied');
      else if (!/invalid password/i.test(event.error)) this.lost('connectionDenied');
    });
    controller.emitter.on('customPacketMessage', event => this.packet(event.message.contentJsonDump));
    controller.emitter.on('browserWindowLoaded', () => { this.nextRender = 0; this.render(); });
    controller.on('browserMessage', event => this.browserMessage(event.arguments));
    controller.on('menuOpen', event => this.onMenu(event.name, true));
    controller.on('menuClose', event => this.onMenu(event.name, false));
    controller.on('update', () => this.update());
    controller.on('tick', () => this.tick());
    if (this.notice) controller.once('tick', () => {
      this.stopTransport(); this.controller.emitter.emit('sessionEnded', { active: !this.notice?.acknowledged });
      this.controller.emitter.emit('connectionDisconnect', {});
    });
  }
  isStopped() { return this.notice !== null; }
  beginConnection() {
    if (this.reconnectUntil) return;
    this.notice = null; this.playing = this.playing && !this.mainMenu; this.nextQuit = 0;
    delete this.sp.storage[sessionNoticeKey];
    this.heartbeatActive = false; this.pendingPings.clear(); this.lastTick = 0; this.nextHeartbeat = 0;
    this.controller.emitter.emit('sessionEnded', { active: false });
    this.sp.browser.executeJavaScript('window.SkympSessionUi?.hide()');
  }
  end(kind: SessionEndKind, message = '', until: number | null = null, emitDisconnect = true) {
    if (this.notice) return;
    this.stopReconnect();
    this.notice = { version: 1, id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2),
      kind, message: message.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, 512),
      until, at: Date.now(), wasPlaying: this.playing || !this.mainMenu, acknowledged: false };
    this.sp.storage[sessionNoticeKey] = this.notice;
    this.stopTransport();
    this.controller.emitter.emit('sessionEnded', { active: true });
    if (emitDisconnect) this.controller.emitter.emit('connectionDisconnect', {});
    this.nextRender = 0;
  }
  stopReconnect() {
    if (!this.reconnectUntil) return;
    this.setReconnectUntil(0); this.nextReconnect = 0;
    this.sp.browser.executeJavaScript('window.SkympSessionUi?.reconnecting(false)');
  }
  private lost(kind: SessionEndKind, emitDisconnect = true) {
    if (this.notice) return;
    if (this.reconnectUntil) { this.nextReconnect = Date.now() + reconnectDelayMs; return; }
    if (!this.playing || this.mainMenu) { this.end(kind, '', null, emitDisconnect); return; }
    this.setReconnectUntil(Date.now() + reconnectWindowMs);
    this.nextReconnect = Date.now() + reconnectDelayMs;
    this.heartbeatActive = false; this.pendingPings.clear();
    this.sp.browser.setVisible(true);
    this.sp.browser.executeJavaScript('window.SkympSessionUi?.reconnecting(true)');
    if (emitDisconnect) this.controller.emitter.emit('connectionDisconnect', {});
  }
  private setReconnectUntil(value: number) {
    this.reconnectUntil = value;
    if (value) this.sp.storage[reconnectKey] = value; else delete this.sp.storage[reconnectKey];
  }
  private packet(raw: unknown) {
    if (this.notice || typeof raw !== 'string' || raw.length > 4096) return;
    try {
      const value = JSON.parse(raw);
      if (value?.customPacketType === 'skymp:sessionPong' && value.version === 1 && typeof value.nonce === 'string') {
        const sent = this.pendingPings.get(value.nonce);
        if (sent !== undefined && Date.now() - sent <= 15000) {
          this.pendingPings.delete(value.nonce); this.heartbeatActive = true; this.heartbeatDeadline = Date.now() + 15000;
        }
        return;
      }
      if (value?.customPacketType === 'skymp:sessionEnd' && value.version === 1 &&
          ['kick', 'ban', 'restart', 'shutdown'].includes(value.kind) &&
          (value.message === undefined || typeof value.message === 'string' && value.message.length <= 512) &&
          (value.until === undefined || value.until === null || Number.isSafeInteger(value.until) && value.until > 0 && value.until <= 8640000000000000)) {
        this.end(value.kind, value.message ?? '', value.until ?? null);
      } else if (value?.customPacketType === 'loginFailedBanned' ||
          value?.customPacketType === 'playerAuthResult' && value.state === 'blocked') {
        this.end('ban');
      }
    } catch { /* Other plugins keep their existing packet dispatch. */ }
  }
  private onMenu(name: string, open: boolean) {
    if (name === Menu.Loading) this.loading = open;
    if (name === Menu.Main) { this.mainMenu = open; this.sp.storage[mainMenuKey] = open; this.nextRender = 0; }
  }
  private isBlocked(notice: SessionEndNotice) {
    return notice.kind === 'ban' && (notice.until === null || notice.until > Date.now());
  }
  /** Actions unlock at the main menu, or after a quit that never completed. */
  private canAct(notice: SessionEndNotice) {
    return this.mainMenu || !notice.wasPlaying || Date.now() - notice.at > reachMainMenuMs;
  }
  private tick() {
    const now = Date.now();
    if (this.notice) {
      if (now >= this.nextRender) { this.nextRender = now + 1000; this.render(); }
      return;
    }
    if (this.reconnectUntil) {
      if (now >= this.reconnectUntil) this.end('connectionLost');
      else if (this.nextReconnect && now >= this.nextReconnect) { this.nextReconnect = 0; this.retry(); }
      return;
    }
    this.heartbeat(now);
  }
  private heartbeat(now: number) {
    if (!this.playing || !this.sp.mpClientPlugin.isConnected()) return;
    const gap = this.lastTick ? now - this.lastTick : 0; this.lastTick = now;
    if (this.loading) { this.wasLoading = true; return; }
    if (this.wasLoading || gap > 5000) {
      this.wasLoading = false; this.heartbeatDeadline = now + 15000; this.pendingPings.clear(); this.nextHeartbeat = 0;
    }
    // Only a server which answered API 1 enables this watchdog. Loading/client
    // stalls get a fresh probe window; old servers retain native timeout handling.
    if (this.heartbeatActive && now > this.heartbeatDeadline) { this.lost('connectionLost'); return; }
    if (now < this.nextHeartbeat) return;
    this.nextHeartbeat = now + 3000;
    this.pendingPings.forEach((sent, nonce) => { if (now - sent > 15000) this.pendingPings.delete(nonce); });
    const nonce = now.toString(36) + '_' + Math.random().toString(36).slice(2);
    this.pendingPings.set(nonce, now);
    this.controller.emitter.emit('sendMessage', { message: { t: MsgType.CustomPacket,
      contentJsonDump: JSON.stringify({ customPacketType: 'skymp:sessionPing', version: 1, nonce }) }, reliability: 'reliable' });
  }
  private releaseControls() {
    if (!this.controlsOwned) return;
    try { this.sp.Game.enablePlayerControls(true, true, true, true, true, true, true, true, 0); this.controlsOwned = false; delete this.sp.storage['skymp.sessionEnd.controlsOwned']; }
    catch { /* Retry after the engine has completed the menu transition. */ }
  }
  private update() {
    this.onMenu(Menu.Main, this.sp.Ui.isMenuOpen(Menu.Main));
    if (!this.notice || this.mainMenu) { this.releaseControls(); return; }
    if (!this.notice.wasPlaying) return;
    const now = Date.now();
    if (!this.controlsOwned) {
      try { this.sp.Game.disablePlayerControls(true, true, true, true, true, true, true, true, 0); this.controlsOwned = true; this.sp.storage['skymp.sessionEnd.controlsOwned'] = true; } catch {}
    }
    if (now >= this.nextQuit) {
      this.nextQuit = now + 3000;
      try { this.sp.Game.quitToMainMenu(); }
      catch { this.sp.printConsole('SkyMP: returning to the main menu after the connection ended.'); }
    }
  }
  private render() {
    if (this.reconnectUntil) { this.sp.browser.executeJavaScript('window.SkympSessionUi?.reconnecting(true)'); return; }
    if (!this.notice || this.notice.acknowledged) return;
    this.sp.browser.setVisible(true); this.sp.browser.setFocused(true);
    const value = { ...this.notice, mainMenu: this.canAct(this.notice) };
    this.sp.browser.executeJavaScript('window.SkympSessionUi?.show(' + JSON.stringify(value) + ')');
  }
  private browserMessage(args: unknown[]) {
    if (!this.notice || this.notice.acknowledged || args[1] !== this.notice.id || !this.canAct(this.notice)) return;
    const blocked = this.isBlocked(this.notice);
    if (args[0] === 'sessionEnd:retry' && !blocked) {
      this.beginConnection(); this.retry(); return;
    }
    if (args[0] !== 'sessionEnd:dismiss') return;
    if (blocked) { this.notice.acknowledged = true; this.sp.storage[sessionNoticeKey] = this.notice; }
    else { this.notice = null; delete this.sp.storage[sessionNoticeKey]; }
    this.controller.emitter.emit('sessionEnded', { active: false });
    this.sp.browser.executeJavaScript('window.SkympSessionUi?.hide()');
    this.sp.browser.setFocused(false); this.sp.browser.setVisible(false);
  }
}
