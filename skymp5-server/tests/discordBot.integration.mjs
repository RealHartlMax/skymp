// Runs production bot/config/moderation code with a local Discord SDK substitute.
// No Discord connection or real messages are made.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const server = resolve(fileURLToPath(new URL('..', import.meta.url)));
const temporary = await mkdtemp(join(tmpdir(), 'skymp-discord-test-'));
const signals = new Map(['message', 'disconnect'].map(event => [event, new Set(process.listeners(event))]));
const descriptors = Object.fromEntries(['send', 'connected'].map(key => [key, Object.getOwnPropertyDescriptor(process, key)]));
const oldEnv = [process.env.SKYMP_MANAGED_SERVER, process.env.SKYMP_MANAGED_ROLE];
const checks = [], bots = [], logs = [], bans = [];
const guildId = '123456789012345678', statusChannelId = '223456789012345678', warningsChannelId = '323456789012345678';
const roleId = '423456789012345678', discordId = '523456789012345678', loginChannel = '623456789012345678';
const token = 'FAKE_LOCAL_TOKEN.NEVER_SENT_TO_DISCORD';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(label, fn) {
  for (let i = 0; i < 200; i++) { if (await fn()) return; await delay(5); }
  assert.fail('Timed out: ' + label);
}
try {
  const outfile = process.env.SKYMP_DISCORD_UNIT_BUNDLE || join(temporary, 'discord.cjs');
  if (!process.env.SKYMP_DISCORD_UNIT_BUNDLE) await build({
    stdin: { contents: `export { DashboardDiscordBot } from './ts/discordBot'; export * from './ts/discordConfig'; export * from './ts/discordStatus'; export { Settings } from './ts/settings'; export { DiscordBanSystem } from './ts/systems/discordBanSystem'; export { control } from 'discord.js';`, resolveDir: server },
    outfile, bundle: true, platform: 'node', format: 'cjs', logLevel: 'silent',
    alias: { 'discord.js': join(server, 'tests/fixtures/discordSdk.mjs') },
  });
  process.env.SKYMP_MANAGED_SERVER = '1'; process.env.SKYMP_MANAGED_ROLE = 'game';
  Object.defineProperty(process, 'connected', { configurable: true, value: true });
  Object.defineProperty(process, 'send', { configurable: true, value: () => {} });
  const { DashboardDiscordBot, DiscordBanSystem, Settings, resolveDiscordSettings, normalizeDiscordSettings, validateDiscordSettings, discordAuthorization, discordStatusDefaults, renderDiscordStatus, validateDiscordStatus, control } = createRequire(import.meta.url)(outfile);
  const cfg = {
    name: 'SkyMP local test', offlineMode: true, localeRouting: { defaultLanguage: 'de' },
    discordBot: { enabled: true, token: 'Bot ' + token, guildId, statusChannelId, warningsChannelId },
    discordAuth: { botToken: token, guilds: [{ guildId, banRoleId: roleId, eventLogChannelId: loginChannel, hideIpRoleId: roleId }, { guildId: '723456789012345678' }] },
  };
  assert.equal(discordAuthorization('Bot ' + token), 'Bot ' + token);
  assert.equal(discordAuthorization(token), 'Bot ' + token);
  const normalized = structuredClone(cfg); normalizeDiscordSettings(normalized);
  assert.equal(normalized.discordAuth.guilds.length, 2);
  assert.equal(normalized.discordAuth.guilds[0].banRoleId, roleId);
  assert.equal(normalized.discordAuth.guilds[0].hideIpRoleId, roleId);
  assert.equal(normalized.discordAuth.guilds[0].eventLogChannelId, loginChannel);
  assert.equal(normalized.discordAuth.botToken, token);
  assert.equal(validateDiscordSettings(normalized), null);
  assert(validateDiscordSettings({ discordBot: { enabled: true, token, guildId, statusChannelId: 'bad' } }));
  const fresh = {}; normalizeDiscordSettings(fresh); assert.equal(fresh.discordAuth, null); assert.equal(fresh.discordBot.enabled, false);
  assert.equal(resolveDiscordSettings({ discordAuth: cfg.discordAuth }).bot.enabled, true, 'Existing legacy bots remain enabled');
  assert.equal(resolveDiscordSettings({ ...cfg, discordBot: { ...cfg.discordBot, enabled: false } }).bot.enabled, false);
  const addedGuild = { discordBot: cfg.discordBot, joinAccess: { mode: 'discordMember' } }; normalizeDiscordSettings(addedGuild); assert.equal(addedGuild.discordAuth.guilds[0].guildId, guildId);
  const monitoringOnly = { discordBot: cfg.discordBot }; normalizeDiscordSettings(monitoringOnly); assert.equal(monitoringOnly.discordAuth, null, 'Monitoring must not change player access');
  checks.push('Configuration migrates legacy tokens and primary guilds, preserves multi-guild moderation/login settings, validates IDs and respects explicit disable');

  const defaults = discordStatusDefaults('de');
  assert.equal(validateDiscordStatus(defaults.statusEmbed, defaults.statusConfig), null);
  assert.equal(validateDiscordStatus({ title: '{{token}}' }, defaults.statusConfig), 'placeholder');
  assert.equal(validateDiscordStatus({ title: '{{masterKey}}' }, defaults.statusConfig), 'placeholder');
  assert.equal(validateDiscordStatus({ title: 'Title', fields: Array.from({ length: 26 }, () => ({ name: 'a', value: 'b' })) }, defaults.statusConfig), 'embed');
  assert.equal(validateDiscordStatus({ description: 'a'.repeat(4096), fields: [{ name: 'A', value: 'b'.repeat(1024) }, { name: 'B', value: 'c'.repeat(1024) }] }, defaults.statusConfig), 'size');
  for (const url of ['javascript:alert(1)', 'https://user:password@example.org/', 'file:///secret']) assert.equal(validateDiscordStatus(defaults.statusEmbed, { buttons: [{ label: 'Click', url }] }), 'url');
  assert.equal(validateDiscordStatus(defaults.statusEmbed, { onlineColor: 'green' }), 'config');
  assert.equal(validateDiscordStatus(defaults.statusEmbed, { buttons: Array.from({ length: 6 }, () => ({ label: 'Link', url: 'https://example.org' })) }), 'config');
  const context = { statusKey: 'running', serverName: '<script>doNotExecute()</script> @everyone', serverClients: 5, serverMaxClients: 32, serverAddress: 'play.example.org:7777', uptime: '1h 20m', timestamp: new Date().toISOString() };
  const preview = renderDiscordStatus(defaults.statusEmbed, defaults.statusConfig, context);
  assert.equal(preview.embed.title, context.serverName); assert.equal(preview.embed.fields[1].value, '5 / 32');
  assert.equal(preview.embed.color, 0x35cba7);
  for (const locale of ['de', 'en', 'ru', 'es', 'fr', 'it']) { const value = discordStatusDefaults(locale); assert.equal(validateDiscordStatus(value.statusEmbed, value.statusConfig), null); }
  checks.push('Shared preview/transport renderer validates placeholders, HTTP links, colors, 25 fields, 6000 characters and five buttons across six default languages; no secret placeholders');

  const makeBot = () => { const bot = new DashboardDiscordBot({ onBan: value => bans.push(value), log: value => logs.push(value), retryMs: 20 }); bots.push(bot); return bot; };
  const bot = makeBot();
  const state = (value, extra = {}) => ({ state: value, pid: ['running', 'starting', 'stopping'].includes(value) ? 100 : null, gamePort: 1, dashboardPid: 200, startedAt: 1, lastExit: null, operation: 'start', ...extra });
  bot.onGameState(state('starting'));
  await bot.configure(cfg);
  await until('initial message', () => control.messages.length === 1);
  assert.equal(bot.getStatus().state, 'connected');
  assert.equal(control.clients.length, 1); assert.equal(control.clients[0].token, token);
  assert.deepEqual(control.clients[0].options.intents, [1, 2]);
  assert.equal(control.messages[0].channelId, statusChannelId);
  assert.deepEqual(control.messages[0].payload.allowedMentions, { parse: [] });
  assert(control.messages[0].payload.content.includes('startet'));
  bot.onGameState(state('running')); bot.onGameState(state('running'));
  await until('running message', () => control.messages.length === 2);
  bot.onGameState(state('stopping', { operation: 'restart' }));
  bot.onGameState(state('stopped', { operation: 'restart' }));
  bot.onGameState(state('starting', { operation: 'restart', pid: 101 }));
  bot.onGameState(state('running', { operation: 'restart', pid: 101 }));
  await until('restart messages', () => control.messages.length === 4);
  assert(control.messages[2].payload.content.includes('neu gestartet'));
  assert(control.messages[3].payload.content.includes('wieder online'));
  assert.equal(control.clients.length, 1, 'Game restart must retain the same Discord connection');
  bot.onGameState(state('crashed', { lastExit: { code: 23, signal: null, at: 'now' } }));
  await until('crash message', () => control.messages.length === 5);
  assert(control.messages[4].payload.content.includes('abgestürzt'));
  bot.onGameState(state('crashed', { reason: 'startup-timeout', lastExit: { code: 0, signal: null, at: 'later' } }));
  await until('startup timeout', () => control.messages.length === 6);
  assert(control.messages[5].payload.content.includes('nicht gestartet'));
  checks.push('Bot connects in offline game mode; startup/running/restart/crash/startup-timeout are delivered once with no reconnect on game lifecycle changes');

  bot.notify({ kind: 'warning', content: 'Fixture warning @everyone' });
  bot.notify({ kind: 'login', content: 'Fixture login', guildId, channelId: loginChannel });
  bot.notify({ kind: 'login', content: 'Rejected arbitrary channel', guildId, channelId: statusChannelId });
  await until('warning and login', () => control.messages.length === 8);
  assert.equal(control.messages[6].channelId, warningsChannelId);
  assert.equal(control.messages[7].channelId, loginChannel);
  const member = roles => ({ id: discordId, guild: { id: guildId }, roles: { cache: new Map(roles.map(id => [id, { id }])) } });
  control.clients[0].emit('guildMemberUpdate', member([]), member(['823456789012345678', roleId]));
  control.clients[0].emit('guildMemberUpdate', member([roleId]), member([roleId]));
  assert.deepEqual(bans, [{ guildId, discordId, roleId }], 'Ban role must work when multiple roles were added at once');
  control.channelGuild = '923456789012345678';
  bot.notify({ kind: 'warning', content: 'Must never reach another guild' });
  await until('foreign guild error', () => bot.getStatus().lastError?.includes('INVALID_CHANNEL'));
  assert.equal(control.messages.length, 8);
  control.channelGuild = null;
  checks.push('Warnings and login logs use their own configured channels without pings; foreign guilds/channels are rejected and multi-role ban changes relay exactly once');

  control.clients[0].emit('shardDisconnect');
  bot.onGameState(state('stopped', { operation: 'stop' }));
  await delay(5); assert.equal(control.messages.length, 8);
  control.clients[0].emit('shardResume');
  await until('resume queue', () => control.messages.length === 9);
  control.sendHook = async () => { throw Object.assign(new Error('private ' + token), { code: 50013 }); };
  bot.notify({ kind: 'warning', content: 'delivery failure' });
  await until('send error', () => bot.getStatus().lastError?.includes('50013'));
  assert(!JSON.stringify(logs).includes(token));
  control.sendHook = null;
  await bot.configure({ ...cfg, discordBot: { ...cfg.discordBot, enabled: false } });
  assert.equal(bot.getStatus().state, 'disabled'); assert.equal(control.clients[0].destroyed, true);
  bot.onGameState(state('running', { pid: 300 }));
  bot.notify({ kind: 'warning', content: 'disabled' });
  await delay(10); assert.equal(control.messages.length, 9);
  checks.push('Disconnect queues resume safely; permission errors are visible without leaking tokens, and disabling closes the client and suppresses messages');

  let releaseLogin;
  control.loginHook = () => new Promise(resolve => { releaseLogin = resolve; });
  const pendingBot = makeBot(); const pendingConfigure = pendingBot.configure(cfg);
  await until('pending login', () => releaseLogin);
  await pendingBot.configure({ ...cfg, discordBot: { ...cfg.discordBot, enabled: false } });
  releaseLogin(); await pendingConfigure;
  assert.equal(pendingBot.getStatus().state, 'disabled');
  control.loginHook = async () => { throw Object.assign(new Error(token), { code: 'TokenInvalid' }); };
  const retryBot = makeBot(); const beforeRetries = control.clients.length;
  await retryBot.configure(cfg);
  await until('automatic bounded retry', () => control.clients.length >= beforeRetries + 2);
  await retryBot.configure({ ...cfg, discordBot: { ...cfg.discordBot, enabled: false } });
  const afterDisable = control.clients.length; await delay(60); assert.equal(control.clients.length, afterDisable);
  assert(!JSON.stringify(logs).includes(token)); control.loginHook = null;
  checks.push('In-flight login cannot reactivate a disabled bot; failed login retries independently and disable cancels retry timers');

  const gameSettings = { offlineMode: false, allSettings: structuredClone(cfg) };
  Settings.get = async () => gameSettings;
  const disabled = [], kicked = [];
  const ctx = { svr: {
    findFormsByPropertyValue: (key, value) => { assert.equal(key, 'private.indexed.discordId'); assert.equal(value, discordId); return [10, 20, 30]; },
    getUserByActor: id => id === 30 ? 65535 : 7,
    isConnected: id => id === 7,
    setEnabled: (id, enabled) => disabled.push([id, enabled]), kick: id => kicked.push(id),
  } };
  await new DiscordBanSystem().initAsync(ctx);
  process.emit('message', { type: 'skymp:discord-ban', ban: { guildId: 'foreign', discordId, roleId } });
  assert.equal(disabled.length, 0);
  process.emit('message', { type: 'skymp:discord-ban', ban: { guildId, discordId, roleId } });
  assert.deepEqual(disabled, [[10, false], [20, false], [30, false]]); assert.deepEqual(kicked, [7]);
  gameSettings.allSettings.discordBot.enabled = false;
  process.emit('message', { type: 'skymp:discord-ban', ban: { guildId, discordId, roleId } }); assert.equal(kicked.length, 1);
  checks.push('Game-side IPC validates configured guild/role, disables matching characters, kicks online users once and ignores disabled/untrusted moderation');

  const statusOnly = makeBot();
  await statusOnly.configure({ ...cfg, discordAuth: null });
  assert.deepEqual(control.clients.at(-1).options.intents, [1], 'Status notifications do not require privileged member intents');
  statusOnly.onGameState(state('stopped', { operation: 'shutdown' }));
  await statusOnly.close();
  assert.equal(control.clients.at(-1).destroyed, true);
  assert(control.messages.at(-1).payload.content.includes('gestoppt'));
  checks.push('Status-only bot requests no privileged intent and graceful shutdown flushes the final stopped message');

  const styled = makeBot();
  const styledCfg = { ...cfg, publicHost: 'play.example.org', port: 7777, discordAuth: null, discordBot: { ...cfg.discordBot,
    statusEmbedEnabled: true, statusEmbed: defaults.statusEmbed, statusConfig: { ...defaults.statusConfig, buttons: [{ label: 'Website', url: 'https://example.org/', emoji: '🌐' }] } } };
  styled.onGameState(state('running')); styled.onServerStatus({ online: 5, maxPlayers: 32 });
  let beforeMessage = control.messages.length;
  await styled.configure(styledCfg);
  await until('styled status delivery', () => control.messages.length > beforeMessage);
  const delivered = control.messages.at(-1).payload;
  assert.deepEqual(delivered.embeds[0].fields, preview.embed.fields.map((field, index) => index === 3 ? { ...field, value: delivered.embeds[0].fields[3].value } : field));
  assert.equal(delivered.embeds[0].color, 0x35cba7); assert.equal(delivered.components[0].components[0].style, 5);
  assert.deepEqual(delivered.allowedMentions, { parse: [] });
  const clientsBeforeEdit = control.clients.length; beforeMessage = control.messages.length;
  const edited = structuredClone(styledCfg); edited.discordBot.statusEmbed.description = 'New description: {{serverName}}';
  await styled.configure(edited);
  await until('live template change', () => control.messages.length > beforeMessage);
  assert.equal(control.clients.length, clientsBeforeEdit, 'Changing presentation must retain the connected bot');
  assert.equal(control.messages.at(-1).payload.embeds[0].description, 'New description: SkyMP local test');
  beforeMessage = control.messages.length; styled.onGameState(state('stopping', { operation: 'stop' }));
  await until('partial status color', () => control.messages.length > beforeMessage); assert.equal(control.messages.at(-1).payload.embeds[0].color, 0xe5b967);
  beforeMessage = control.messages.length; styled.onGameState(state('stopped', { operation: 'stop' }));
  await until('offline status color', () => control.messages.length > beforeMessage); assert.equal(control.messages.at(-1).payload.embeds[0].color, 0xe58e8e);
  assert.equal(control.messages.at(-1).payload.embeds[0].fields[1].value, '0 / 32');
  checks.push('Real transport receives the same rendered embed as preview, link buttons and disabled mentions; template changes retain the bot connection and lifecycle colors follow game state');
  console.log(JSON.stringify({ ok: true, checks, realDiscordConnected: false, realGameStarted: false }, null, 2));
} finally {
  await Promise.all(bots.map(bot => bot.close()));
  for (const [event, previous] of signals) for (const listener of process.listeners(event)) if (!previous.has(listener)) process.removeListener(event, listener);
  for (const [key, descriptor] of Object.entries(descriptors)) { if (descriptor) Object.defineProperty(process, key, descriptor); else delete process[key]; }
  ['SKYMP_MANAGED_SERVER', 'SKYMP_MANAGED_ROLE'].forEach((key, i) => { if (oldEnv[i] === undefined) delete process.env[key]; else process.env[key] = oldEnv[i]; });
  assert.equal(dirname(temporary), resolve(tmpdir())); assert(basename(temporary).startsWith('skymp-discord-test-'));
  await rm(temporary, { recursive: true, force: true, maxRetries: 4, retryDelay: 100 });
}
