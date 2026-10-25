// This entry point intentionally never imports scampNative or the game bootstrap.
import { Settings } from './settings';
import { main, setDashboardDiscordBot } from './ui';
import { DashboardDiscordBot } from './discordBot';
import { onManagedMessage, publishDiscordBan } from './managedRuntime';
import * as fs from 'fs';

Settings.get().then(settings => {
  const bot = new DashboardDiscordBot({ onBan: publishDiscordBan });
  setDashboardDiscordBot(bot);
  void bot.configure(settings.allSettings || {});
  onManagedMessage(message => {
    if (message?.type === 'skymp:game-state') bot.onGameState(message.value);
    if (message?.type === 'skymp:discord-notification') bot.notify(message.notification);
    if (message?.type === 'skymp:update' && message.updateType === 'status') bot.onServerStatus(message.data);
    if (message?.type === 'skymp:settings-changed') {
      try { void bot.configure(JSON.parse(fs.readFileSync('server-settings.json', 'utf8'))); }
      catch { console.error('[Discord] Could not reload server-settings.json.'); }
    }
  });
  process.once('SIGTERM', () => { void bot.close(); });
  process.once('SIGINT', () => { void bot.close(); });
  main(settings);
}).catch(error => {
  console.error('[SkyMP] Dashboard startup failed:', error);
  process.exit(1);
});
