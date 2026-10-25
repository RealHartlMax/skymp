import type { DiscordAuthSettings, DiscordGuildConfig } from './settings';
import { discordStatusDefaults, validateDiscordStatus } from './discordStatus';
import type { DiscordStatusEmbed, DiscordStatusConfig } from './discordStatus';

export interface DiscordBotSettings {
  enabled: boolean;
  token: string;
  guildId: string;
  statusChannelId: string;
  warningsChannelId: string;
  statusEmbedEnabled?: boolean;
  statusEmbed?: DiscordStatusEmbed;
  statusConfig?: Partial<DiscordStatusConfig>;
}

const object = (value: unknown): Record<string, any> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
export const discordToken = (value: unknown): string => text(value).replace(/^Bot\s+/i, '').trim();
export const discordAuthorization = (value: unknown): string => `Bot ${discordToken(value)}`;
export const isDiscordId = (value: string): boolean => /^\d{17,20}$/.test(value);

// Retain existing multi-guild configurations and per-guild moderation settings.
// The dashboard's single guild is the primary guild for status/warning messages.
export function resolveDiscordSettings(settings: Record<string, unknown>): {
  bot: DiscordBotSettings;
  auth: DiscordAuthSettings | null;
} {
  const raw = object(settings.discordBot);
  const legacy = object(settings.discordAuth);
  const guilds: DiscordGuildConfig[] = [];
  for (const entry of Array.isArray(legacy.guilds) ? legacy.guilds : []) {
    const guild = object(entry);
    const guildId = text(guild.guildId);
    if (guildId && !guilds.some(item => item.guildId === guildId)) {
      guilds.push({ ...guild, guildId });
    }
  }
  const token = discordToken(raw.token ?? legacy.botToken);
  const guildId = text(raw.guildId ?? legacy.guildId ?? guilds[0]?.guildId);
  const primary = guilds.find(guild => guild.guildId === guildId);
  const defaults = discordStatusDefaults(object(settings.localeRouting).defaultLanguage);
  const bot: DiscordBotSettings = {
    // Old installations without discordBot keep their existing bot enabled.
    // An explicit false is authoritative; offlineMode only controls game login.
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : Boolean(token && guilds.length),
    token,
    guildId,
    statusChannelId: text(raw.statusChannelId ?? legacy.eventLogChannelId ?? primary?.eventLogChannelId),
    warningsChannelId: text(raw.warningsChannelId ?? legacy.eventLogChannelId),
    statusEmbedEnabled: raw.statusEmbedEnabled === true,
    statusEmbed: raw.statusEmbed === undefined ? defaults.statusEmbed : raw.statusEmbed,
    statusConfig: raw.statusConfig === undefined ? defaults.statusConfig : raw.statusConfig,
  };
  // Merely enabling server monitoring must not impose Discord membership on
  // players. Only existing login integrations or explicit Discord access modes
  // acquire a discordAuth guild list.
  const joinMode = object(settings.joinAccess).mode;
  const loginConfigured = guilds.length > 0 || Boolean(text(legacy.guildId)) || ['discordMember', 'discordRoles'].includes(joinMode);
  if (loginConfigured && guildId && !primary) guilds.push({ guildId });
  return { bot, auth: loginConfigured && (token || guilds.length) ? { ...legacy, botToken: token, guilds } : null };
}

export function normalizeDiscordSettings(settings: Record<string, unknown>): DiscordBotSettings {
  const { bot, auth } = resolveDiscordSettings(settings);
  settings.discordBot = bot;
  settings.discordAuth = auth;
  return bot;
}

export function validateDiscordSettings(settings: Record<string, unknown>): string | null {
  const { bot, auth } = resolveDiscordSettings(settings);
  const presentationError = validateDiscordStatus(bot.statusEmbed, bot.statusConfig);
  if (presentationError) return `Invalid Discord status presentation (${presentationError}).`;
  if (!bot.enabled) return null;
  if (!bot.token || !isDiscordId(bot.guildId)) return 'Discord bot requires a token and a valid Discord server ID.';
  for (const id of [bot.statusChannelId, bot.warningsChannelId]) {
    if (id && !isDiscordId(id)) return 'Discord channel IDs must contain 17 to 20 digits.';
  }
  for (const guild of auth?.guilds || []) {
    if (!isDiscordId(guild.guildId)) return 'Invalid Discord server ID in discordAuth.guilds.';
    for (const id of [guild.banRoleId, guild.hideIpRoleId, guild.eventLogChannelId]) {
      if (id && !isDiscordId(id)) return 'Invalid Discord role/channel ID in discordAuth.guilds.';
    }
  }
  return null;
}
