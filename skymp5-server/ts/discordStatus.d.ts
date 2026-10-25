export interface DiscordStatusEmbed {
  title?: string;
  description?: string;
  url?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}
export interface DiscordStatusConfig {
  onlineString: string; onlineColor: string;
  partialString: string; partialColor: string;
  offlineString: string; offlineColor: string;
  buttons: { label: string; url: string; emoji?: string }[];
}
export interface DiscordStatusContext {
  statusKey: string;
  serverName: string;
  serverClients: string | number;
  serverMaxClients: string | number;
  serverAddress: string;
  uptime: string;
  timestamp: string;
}
export function discordStatusDefaults(language?: string): { statusEmbed: DiscordStatusEmbed; statusConfig: DiscordStatusConfig };
export function validateDiscordStatus(embed: unknown, config: unknown): string | null;
export function renderDiscordStatus(embed: DiscordStatusEmbed, config: Partial<DiscordStatusConfig>, context: DiscordStatusContext): {
  embed: DiscordStatusEmbed & { color: number };
  components: { type: number; components: { type: number; style: number; label: string; url: string; emoji?: { id?: string; name?: string } }[] }[];
};
export const discordStatusPlaceholders: string[];
