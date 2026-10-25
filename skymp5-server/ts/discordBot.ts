import type { ManagedGameState } from './managedRuntime';
import { resolveDiscordSettings, validateDiscordSettings } from './discordConfig';
import { renderDiscordStatus } from './discordStatus';
type StatusPresentation = ReturnType<typeof renderDiscordStatus>;

export interface DiscordNotification {
  kind: 'login' | 'warning';
  content: string;
  guildId?: string;
  channelId?: string;
}
export interface DiscordBan {
  guildId: string;
  discordId: string;
  roleId: string;
}
export interface DiscordBotStatus {
  state: 'disabled' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  guildId: string;
  statusChannelId: string;
  warningsChannelId: string;
  lastError: string | null;
  lastMessageAt: string | null;
  queuedMessages: number;
}
export interface DiscordTransport {
  login(token: string): Promise<unknown>;
  destroy(): Promise<unknown> | void;
  send(guildId: string, channelId: string, content: string, presentation?: StatusPresentation): Promise<unknown>;
  on(event: string, listener: (...args: any[]) => void): void;
}
type TransportFactory = (watchMembers: boolean) => Promise<DiscordTransport>;

// Imported exclusively by the dashboard entry point, never by the native game.
const createTransport: TransportFactory = async watchMembers => {
  const { Client, GatewayIntentBits, Events } = await import('discord.js');
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, ...(watchMembers ? [GatewayIntentBits.GuildMembers] : [])],
    rest: { timeout: 10000, retries: 2 },
  });
  return {
    login: token => client.login(token),
    destroy: () => client.destroy(),
    on: (event, listener) => { client.on(event === 'ready' ? Events.ClientReady : event as any, listener); },
    send: async (guildId, channelId, content, presentation) => {
      const channel = await client.channels.fetch(channelId);
      if (!channel || !('guildId' in channel) || channel.guildId !== guildId || !('send' in channel)) {
        throw Object.assign(new Error('Channel must belong to the configured Discord server and support messages.'), { code: 'INVALID_CHANNEL' });
      }
      return channel.send({ content: content.slice(0, 1900),
        ...(presentation ? { embeds: [presentation.embed], components: presentation.components } : {}),
        allowedMentions: { parse: [] } });
    },
  };
};

const phrases = {
  de: {
    starting: 'Gameserver startet.', restarting: 'Gameserver wird neu gestartet.',
    running: 'Gameserver ist online.', restarted: 'Gameserver ist wieder online.',
    stopping: 'Gameserver wird gestoppt.', stopped: 'Gameserver wurde gestoppt.',
    crashed: 'Gameserver ist abgestürzt. Ein erneuter Start ist erforderlich.',
    failed: 'Gameserver konnte nicht gestartet werden.',
  },
  en: {
    starting: 'Game server is starting.', restarting: 'Game server is restarting.',
    running: 'Game server is online.', restarted: 'Game server is back online.',
    stopping: 'Game server is stopping.', stopped: 'Game server has stopped.',
    crashed: 'Game server crashed. Start it again through the dashboard.',
    failed: 'Game server failed to start.',
  },
  ru: {
    starting: 'Игровой сервер запускается.', restarting: 'Игровой сервер перезапускается.',
    running: 'Игровой сервер доступен.', restarted: 'Игровой сервер снова доступен.',
    stopping: 'Игровой сервер останавливается.', stopped: 'Игровой сервер остановлен.',
    crashed: 'Игровой сервер аварийно завершился. Требуется повторный запуск.',
    failed: 'Не удалось запустить игровой сервер.',
  },
};

export class DashboardDiscordBot {
  private settings: Record<string, unknown> = {};
  private fingerprint = '';
  private connectionFingerprint = '';
  private generation = 0;
  private transport: DiscordTransport | null = null;
  private retryTimer: NodeJS.Timeout | undefined;
  private queue: { guildId: string; channelId: string; content: string; presentation?: StatusPresentation }[] = [];
  private draining: Promise<void> | null = null;
  private game: ManagedGameState | null = null;
  private gameKey = '';
  private restartPending = false;
  private stopped = false;
  private online: number | null = null;
  private maxPlayers: number | null = null;
  private status: DiscordBotStatus = {
    state: 'disabled', guildId: '', statusChannelId: '', warningsChannelId: '',
    lastError: null, lastMessageAt: null, queuedMessages: 0,
  };

  constructor(private readonly options: {
    onBan: (ban: DiscordBan) => void;
    log?: (message: string) => void;
    createTransport?: TransportFactory;
    retryMs?: number;
  }) {}

  getStatus(): DiscordBotStatus { return { ...this.status, queuedMessages: this.queue.length }; }
  private log(message: string): void { (this.options.log || console.log)(`[Discord] ${message}`); }
  private failure(context: string, error?: any): void {
    // SDK errors can contain request headers; never log the object or its message.
    const code = String(error?.code ?? error?.name ?? 'UNKNOWN');
    this.status.lastError = `${context} (${/^[A-Z_0-9]{1,40}$/i.test(code) ? code : 'UNKNOWN'}). Check token, channel permissions and Gateway intents.`;
    this.log(this.status.lastError);
  }

  async configure(settings: Record<string, unknown>): Promise<void> {
    this.settings = settings;
    const config = resolveDiscordSettings(settings);
    const fingerprint = JSON.stringify(config);
    if (this.stopped || fingerprint === this.fingerprint) return;
    this.fingerprint = fingerprint;
    const connectionFingerprint = JSON.stringify({ enabled: config.bot.enabled, token: config.bot.token, guildId: config.bot.guildId, auth: config.auth });
    const error = validateDiscordSettings(settings);
    if (!error && config.bot.enabled && this.transport && connectionFingerprint === this.connectionFingerprint) {
      this.queue = [];
      this.status.guildId = config.bot.guildId; this.status.statusChannelId = config.bot.statusChannelId; this.status.warningsChannelId = config.bot.warningsChannelId;
      if (this.game) this.enqueueState(this.game, false);
      return;
    }
    this.connectionFingerprint = connectionFingerprint;
    const generation = ++this.generation;
    clearTimeout(this.retryTimer);
    this.queue = [];
    const previous = this.transport; this.transport = null;
    this.status = { ...this.status, state: 'disabled', lastError: null,
      guildId: config.bot.guildId, statusChannelId: config.bot.statusChannelId,
      warningsChannelId: config.bot.warningsChannelId };
    if (previous) await Promise.resolve(previous.destroy()).catch(() => {});
    if (generation !== this.generation || this.stopped || !config.bot.enabled) return;
    if (error) { this.status.state = 'error'; this.status.lastError = error; this.log(error); return; }
    // A configuration change announces the actual current state, not an old transition.
    if (this.game) this.enqueueState(this.game, false);
    await this.connect(generation);
  }

  private async connect(generation: number): Promise<void> {
    if (this.stopped || generation !== this.generation) return;
    this.status.state = 'connecting';
    const { bot, auth } = resolveDiscordSettings(this.settings);
    let transport: DiscordTransport | null = null;
    try {
      transport = await (this.options.createTransport || createTransport)(Boolean(auth?.guilds.some(guild => guild.banRoleId)));
      if (this.stopped || generation !== this.generation) { await transport.destroy(); return; }
      this.transport = transport;
      const current = () => !this.stopped && generation === this.generation && this.transport === transport;
      const ready = () => {
        if (!current()) return;
        this.status.state = 'connected'; this.status.lastError = null;
        this.log('Bot connected in the independent dashboard process.');
        void this.flush();
      };
      transport.on('ready', ready);
      transport.on('shardResume', ready);
      transport.on('shardReconnecting', () => { if (current()) this.status.state = 'reconnecting'; });
      transport.on('shardDisconnect', () => { if (current()) this.status.state = 'reconnecting'; });
      transport.on('error', error => { if (current()) this.failure('Discord connection error', error); });
      transport.on('shardError', error => { if (current()) this.failure('Discord Gateway error', error); });
      transport.on('guildMemberUpdate', (oldMember, newMember) => {
        if (!current() || !newMember?.id) return;
        const guild = auth?.guilds.find(item => item.guildId === newMember.guild?.id);
        if (guild?.banRoleId && newMember.roles?.cache.has(guild.banRoleId) && !oldMember?.roles?.cache.has(guild.banRoleId)) {
          this.options.onBan({ guildId: guild.guildId, discordId: newMember.id, roleId: guild.banRoleId });
        }
      });
      await transport.login(bot.token);
    } catch (error) {
      if (this.stopped || generation !== this.generation || (this.transport && this.transport !== transport)) return;
      this.status.state = 'error'; this.failure('Discord connection failed', error);
      this.transport = null;
      if (transport) await Promise.resolve(transport.destroy()).catch(() => {});
      this.retryTimer = setTimeout(() => { void this.connect(generation); }, this.options.retryMs ?? 30000);
      this.retryTimer.unref();
    }
  }

  onGameState(game: ManagedGameState): void {
    const key = JSON.stringify([game.state, game.pid, game.operation, game.lastExit]);
    if (key === this.gameKey) return;
    this.gameKey = key;
    const previous = this.game;
    if (game.pid && game.pid !== previous?.pid) this.maxPlayers = null;
    if (game.pid !== previous?.pid || game.state !== 'running') this.online = null;
    this.game = game;
    if (game.operation === 'restart') this.restartPending = true;
    // A planned restart's intermediate exit is not a second stop notification.
    if (!(game.state === 'stopped' && game.operation === 'restart')) {
      const repeatedRestart = this.restartPending && game.state === 'starting' && previous?.state === 'stopped';
      if (!repeatedRestart) this.enqueueState(game, this.restartPending);
    }
    if (game.state === 'running' || game.state === 'crashed' || (game.state === 'stopped' && game.operation !== 'restart')) this.restartPending = false;
  }

  onServerStatus(value: any): void {
    if (this.game?.state !== 'running') return;
    if (Number.isInteger(value?.online) && value.online >= 0 && value.online <= 10000) this.online = value.online;
    if (Number.isInteger(value?.maxPlayers) && value.maxPlayers > 0 && value.maxPlayers <= 10000) this.maxPlayers = value.maxPlayers;
  }

  private enqueueState(game: ManagedGameState, restart: boolean): void {
    const { bot } = resolveDiscordSettings(this.settings);
    if (!bot.enabled || !bot.statusChannelId) return;
    const locale = String((this.settings.localeRouting as any)?.defaultLanguage || 'en');
    const words = phrases[locale as keyof typeof phrases] || phrases.en;
    const key = game.state === 'stopping' && game.operation === 'restart' ? 'restarting'
      : game.state === 'running' && restart ? 'restarted'
      : game.state === 'crashed' && game.reason?.startsWith('startup-') ? 'failed'
      : game.state;
    const name = String(this.settings.name || 'SkyMP').replace(/[\r\n]/g, ' ').slice(0, 100);
    const detail = game.state === 'crashed' && game.lastExit
      ? ` (exit=${game.lastExit.code ?? 'unknown'}, signal=${game.lastExit.signal || 'none'})` : '';
    let presentation: StatusPresentation | undefined;
    if (bot.statusEmbedEnabled) {
      const elapsed = game.state === 'running' && game.startedAt ? Math.max(0, Math.floor((Date.now() - game.startedAt) / 1000)) : 0;
      const host = typeof (this.settings.publicHost || this.settings.externalHost) === 'string' ? String(this.settings.publicHost || this.settings.externalHost).trim().slice(0, 255) : '';
      try {
        presentation = renderDiscordStatus(bot.statusEmbed!, bot.statusConfig!, {
          statusKey: game.state, serverName: name, serverClients: game.state === 'running' ? this.online ?? '—' : game.state === 'stopped' || game.state === 'crashed' ? 0 : '—',
          serverMaxClients: this.maxPlayers ?? (Number.isInteger(this.settings.maxPlayers) ? this.settings.maxPlayers as number : '—'),
          serverAddress: host ? `${host.includes(':') ? `[${host}]` : host}:${Number(this.settings.port) || 7777}` : '—',
          uptime: `${Math.floor(elapsed / 3600)}h ${Math.floor(elapsed % 3600 / 60)}m`, timestamp: new Date().toISOString(),
        });
      } catch { this.status.lastError = 'Discord status template could not be rendered. Check its size and fields.'; this.log(this.status.lastError); }
    }
    this.enqueue(bot.guildId, bot.statusChannelId, `${name}: ${words[key]}${detail}`, presentation);
  }

  notify(notification: DiscordNotification): void {
    const { bot, auth } = resolveDiscordSettings(this.settings);
    if (!bot.enabled || !notification || typeof notification.content !== 'string') return;
    if (notification.kind === 'warning' && bot.warningsChannelId) {
      this.enqueue(bot.guildId, bot.warningsChannelId, notification.content);
    } else if (notification.kind === 'login') {
      const guild = auth?.guilds.find(item => item.guildId === notification.guildId && item.eventLogChannelId === notification.channelId);
      if (guild?.eventLogChannelId) this.enqueue(guild.guildId, guild.eventLogChannelId, notification.content);
    }
  }

  private enqueue(guildId: string, channelId: string, content: string, presentation?: StatusPresentation): void {
    if (this.stopped) return;
    if (this.queue.length >= 50) { this.queue.shift(); this.log('Notification queue full; oldest unsent message discarded.'); }
    this.queue.push({ guildId, channelId, content: content.slice(0, 1900), presentation });
    void this.flush();
  }
  private flush(): Promise<void> {
    if (this.draining) return this.draining;
    const generation = this.generation;
    const work = async () => {
      while (this.queue.length && this.transport && this.status.state === 'connected' && generation === this.generation) {
        const item = this.queue.shift()!;
        try {
          await this.transport.send(item.guildId, item.channelId, item.content, item.presentation);
          if (generation === this.generation) { this.status.lastMessageAt = new Date().toISOString(); this.status.lastError = null; }
        } catch (error) { if (generation === this.generation) this.failure('Discord message delivery failed', error); }
      }
    };
    this.draining = work().finally(() => { this.draining = null; if (this.queue.length && this.status.state === 'connected') void this.flush(); });
    return this.draining;
  }

  async close(): Promise<void> {
    clearTimeout(this.retryTimer);
    // Supervisor sends the final game state before the dashboard shutdown message.
    await Promise.race([this.flush(), new Promise(resolve => { const timer = setTimeout(resolve, 1100); timer.unref(); })]);
    this.stopped = true; ++this.generation; this.queue = [];
    const transport = this.transport; this.transport = null;
    this.status.state = 'disabled';
    if (transport) await Promise.resolve(transport.destroy()).catch(() => {});
  }
}
