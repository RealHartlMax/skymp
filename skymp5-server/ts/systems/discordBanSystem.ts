import { Settings } from '../settings';
import { isManagedRuntime, onManagedMessage } from '../managedRuntime';
import { resolveDiscordSettings, isDiscordId } from '../discordConfig';
import { System, SystemContext } from './system';
import { endPlayerSession } from '../playerSessionEnd';

type Mp = any; // TODO

export class DiscordBanSystem implements System {
  systemName = 'DiscordBanSystem';

  constructor() {}

  async initAsync(ctx: SystemContext): Promise<void> {
    const settingsObject = await Settings.get();

    // Only the dashboard connects to Discord. Moderation arrives over private IPC.
    if (!isManagedRuntime() || settingsObject.offlineMode) return;
    onManagedMessage(message => {
      if (message?.type !== 'skymp:discord-ban') return;
      const ban = message.ban;
      if (!ban || !isDiscordId(String(ban.discordId || ''))) return;
      const { bot, auth } = resolveDiscordSettings(settingsObject.allSettings || {});
      if (!bot.enabled || !auth?.guilds.some(guild => guild.guildId === ban.guildId && guild.banRoleId === ban.roleId)) return;
      const mp = ctx.svr as unknown as Mp;
      const forms = mp.findFormsByPropertyValue('private.indexed.discordId', ban.discordId) as number[];
      const users = new Set<number>();
      for (const formId of forms) {
        const userId = mp.getUserByActor(formId);
        if (Number.isInteger(userId) && userId >= 0 && ctx.svr.isConnected(userId)) users.add(userId);
        ctx.svr.setEnabled(formId, false);
      }
      for (const userId of users) endPlayerSession(ctx.svr, userId, 'ban');
      console.log(`[Discord] Ban role applied: ${forms.length} characters disabled, ${users.size} connections closed.`);
    });
  }
}
