import { EventEmitter } from 'node:events';
import fs from 'node:fs';
const record = (event, data = {}) => {
  if (process.env.SKYMP_TEST_DISCORD_LOG) fs.appendFileSync(process.env.SKYMP_TEST_DISCORD_LOG, JSON.stringify({ event, pid: process.pid, role: process.env.SKYMP_MANAGED_ROLE, ...data }) + '\n');
};
export const GatewayIntentBits = { Guilds: 1, GuildMembers: 2 };
export const Events = { ClientReady: 'ready' };
export const control = {
  clients: [], messages: [], loginHook: null, sendHook: null,
  channelGuild: null, missingChannel: false,
};
export class Client extends EventEmitter {
  constructor(options) {
    super(); this.options = options; this.destroyed = false;
    control.clients.push(this);
    record('created', { intents: options.intents });
    this.channels = { fetch: async channelId => control.missingChannel ? null : ({
      guildId: control.channelGuild || '123456789012345678',
      send: async payload => {
        if (control.sendHook) await control.sendHook(payload);
        control.messages.push({ channelId, payload, client: control.clients.indexOf(this) });
        record('message', { channelId, payload });
      },
    }) };
  }
  async login(token) {
    this.token = token;
    if (control.loginHook) await control.loginHook(this);
    record('connected');
    if (!this.destroyed) this.emit('ready');
  }
  destroy() { this.destroyed = true; record('destroyed'); }
}
