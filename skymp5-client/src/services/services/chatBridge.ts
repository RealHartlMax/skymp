import { MsgType } from '../../messages';
import type { CombinedController, Sp } from './clientListener';

// Uses the same browser and reliable CustomPacket path as the other services.
export class ChatBridge {
  private playing = false;
  private frontLoaded = false;
  private frontId: string | null = null;
  private ready = false;
  private deadline = 0;

  constructor(private sp: Sp, private controller: CombinedController, private closeFocus: () => void) {
    controller.on('browserMessage', event => {
      const [type, data] = event.arguments;
      if (type === 'skympChat:frontReady' && typeof data === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(data)) this.onFrontLoaded(data);
      else if (type === 'skympChat:close') this.close();
      else if (type === 'skympChat:send' && this.ready && typeof data === 'object' && data !== null) {
        const payload = data as { text?: unknown; requestId?: unknown };
        if (typeof payload.text === 'string' && payload.text.length <= 500 &&
            typeof payload.requestId === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(payload.requestId)) {
          this.send('send', { text: payload.text, requestId: payload.requestId });
        }
      }
    });
    controller.emitter.on('browserWindowLoaded', () => this.probeFront());
    controller.emitter.on('createActorMessage', event => {
      if (event.message.isMe) { this.playing = true; this.close(); this.requestReady(); }
    });
    controller.emitter.on('connectionAccepted', () => this.reset('connecting'));
    controller.emitter.on('connectionDisconnect', () => this.reset('disconnected'));
    controller.emitter.on('connectionFailed', () => this.reset('disconnected'));
    controller.emitter.on('connectionDenied', () => this.reset('disconnected'));
    controller.emitter.on('customPacketMessage', event => {
      const content = event.message.contentJsonDump;
      if (!this.playing || typeof content !== 'string' || content.length > 8192) return;
      try {
        const packet = JSON.parse(content);
        if (!packet || typeof packet !== 'object' || typeof packet.customPacketType !== 'string') return;
        switch (packet.customPacketType) {
          case 'skympChat:ready':
            if (packet.apiVersion !== 1 || typeof packet.epoch !== 'string' || packet.epoch.length > 64 ||
                !Number.isInteger(packet.maxMessageLength) || packet.maxMessageLength < 1 || packet.maxMessageLength > 500) return;
            this.ready = true; this.deadline = 0; this.dispatch(packet); break;
          case 'skympChat:message':
          case 'skympChat:ack':
            if (this.ready) this.dispatch(packet); break;
          case 'skympChat:unavailable':
            this.ready = false; this.close(); this.dispatch({ customPacketType: 'skympChat:status', status: 'unavailable' }); break;
        }
      } catch { /* Unrelated or malformed packets cannot break the browser service. */ }
    });
    controller.on('update', () => {
      if (this.deadline && Date.now() >= this.deadline) {
        this.deadline = 0;
        this.dispatch({ customPacketType: 'skympChat:status', status: 'unavailable' });
      }
    });
    // A client-script reload can happen after CEF has already loaded.
    controller.once('update', () => this.probeFront());
  }

  isPlaying() { return this.playing; }
  open(suppressEnter = false) { this.dispatch({ customPacketType: 'skympChat:open', suppressEnter }); }
  releaseOpenKey() { this.dispatch({ customPacketType: 'skympChat:releaseOpenKey' }); }
  close() {
    this.closeFocus();
    this.dispatch({ customPacketType: 'skympChat:close' });
  }
  private send(type: string, data: Record<string, unknown> = {}) {
    this.controller.emitter.emit('sendMessage', {
      message: { t: MsgType.CustomPacket, contentJsonDump: JSON.stringify({ customPacketType: `skympChat:${type}`, ...data }) },
      reliability: 'reliable',
    });
  }
  private dispatch(packet: Record<string, unknown>) {
    this.sp.browser.executeJavaScript(`window.dispatchEvent(new CustomEvent('skympChat:packet', {detail:${JSON.stringify(packet)}}))`);
  }
  private probeFront() {
    this.sp.browser.executeJavaScript("window.dispatchEvent(new Event('skympChat:probe'))");
  }
  private onFrontLoaded(frontId: string) {
    if (this.frontId === frontId) return;
    const reloaded = this.frontLoaded;
    this.frontId = frontId;
    this.frontLoaded = true;
    if (this.playing && reloaded) this.close();
    this.requestReady();
  }
  private requestReady() {
    if (!this.playing || !this.frontLoaded) return;
    this.ready = false;
    this.dispatch({ customPacketType: 'skympChat:status', status: 'connecting' });
    this.deadline = Date.now() + 5000;
    this.send('ready');
  }
  private reset(status: string) {
    this.playing = false; this.ready = false; this.deadline = 0; this.close();
    if (status === 'connecting') this.dispatch({ customPacketType: 'skympChat:status', status: 'disconnected' });
    this.dispatch({ customPacketType: 'skympChat:status', status });
  }
}
