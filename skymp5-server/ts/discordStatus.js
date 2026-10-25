// Pure shared renderer for the dashboard preview and the Discord transport.
// It receives an explicit public context, never server configuration or tokens.
const placeholders = ['serverName', 'statusString', 'statusKey', 'serverClients', 'serverMaxClients', 'serverAddress', 'uptime', 'timestamp'];
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const fail = code => { throw Object.assign(new Error('Invalid Discord status presentation'), { code }); };
const keys = (value, allowed, code) => { if (!object(value) || Object.keys(value).some(key => !allowed.includes(key))) fail(code); };
const string = (value, max, code = 'embed', required = true) => {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) fail(code);
  for (const match of value.matchAll(/\{\{([^{}]+)\}\}/g)) if (!placeholders.includes(match[1].trim())) fail('placeholder');
};
const url = value => {
  try { const parsed = new URL(value); return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password && value.length <= 512; } catch { return false; }
};
function discordStatusDefaults(language = 'en') {
  const labels = {
    de: ['Status', 'Spieler', 'Adresse', 'Laufzeit', '🟢 Online', '🟡 Startet / stoppt', '🔴 Offline'],
    en: ['Status', 'Players', 'Address', 'Uptime', '🟢 Online', '🟡 Starting / stopping', '🔴 Offline'],
    ru: ['Статус', 'Игроки', 'Адрес', 'Время работы', '🟢 Онлайн', '🟡 Запуск / остановка', '🔴 Офлайн'],
    es: ['Estado', 'Jugadores', 'Dirección', 'Tiempo activo', '🟢 En línea', '🟡 Iniciando / deteniendo', '🔴 Sin conexión'],
    fr: ['Statut', 'Joueurs', 'Adresse', 'Durée', '🟢 En ligne', '🟡 Démarrage / arrêt', '🔴 Hors ligne'],
    it: ['Stato', 'Giocatori', 'Indirizzo', 'Tempo attivo', '🟢 Online', '🟡 Avvio / arresto', '🔴 Offline'],
  }[String(language).split('-')[0]] || ['Status', 'Players', 'Address', 'Uptime', '🟢 Online', '🟡 Starting / stopping', '🔴 Offline'];
  return {
    statusEmbed: { title: '{{serverName}}', fields: [
      { name: labels[0], value: '{{statusString}}', inline: true },
      { name: labels[1], value: '{{serverClients}} / {{serverMaxClients}}', inline: true },
      { name: labels[2], value: '{{serverAddress}}', inline: true },
      { name: labels[3], value: '{{uptime}}', inline: true },
    ], footer: { text: 'SkyMP' }, timestamp: '{{timestamp}}' },
    statusConfig: { onlineString: labels[4], onlineColor: '#35CBA7', partialString: labels[5], partialColor: '#E5B967', offlineString: labels[6], offlineColor: '#E58E8E', buttons: [] },
  };
}
function check(embed, config) {
  if (JSON.stringify(embed)?.length > 16000 || JSON.stringify(config)?.length > 8000) fail('size');
  keys(embed, ['title', 'description', 'url', 'fields', 'footer', 'timestamp'], 'embed');
  if (!embed.title && !embed.description && !embed.fields?.length) fail('embed');
  if (embed.title !== undefined) string(embed.title, 256);
  if (embed.description !== undefined) string(embed.description, 4096);
  if (embed.url !== undefined && !url(embed.url)) fail('url');
  if (embed.fields !== undefined) {
    if (!Array.isArray(embed.fields) || embed.fields.length > 25) fail('embed');
    for (const field of embed.fields) {
      keys(field, ['name', 'value', 'inline'], 'embed'); string(field.name, 256); string(field.value, 1024);
      if (field.inline !== undefined && typeof field.inline !== 'boolean') fail('embed');
    }
  }
  if (embed.footer !== undefined) { keys(embed.footer, ['text'], 'embed'); string(embed.footer.text, 2048); }
  if (embed.timestamp !== undefined && embed.timestamp !== '{{timestamp}}' && (typeof embed.timestamp !== 'string' || !Number.isFinite(Date.parse(embed.timestamp)))) fail('embed');
  keys(config, ['onlineString', 'onlineColor', 'partialString', 'partialColor', 'offlineString', 'offlineColor', 'buttons'], 'config');
  for (const key of ['onlineString', 'partialString', 'offlineString']) if (config[key] !== undefined) {
    string(config[key], 100, 'config'); if (config[key].includes('{{')) fail('config');
  }
  for (const key of ['onlineColor', 'partialColor', 'offlineColor']) if (config[key] !== undefined && (typeof config[key] !== 'string' || !/^#[a-f0-9]{6}$/i.test(config[key]))) fail('config');
  if (config.buttons !== undefined) {
    if (!Array.isArray(config.buttons) || config.buttons.length > 5) fail('config');
    for (const button of config.buttons) {
      keys(button, ['label', 'url', 'emoji'], 'config'); string(button.label, 80, 'config');
      if (!url(button.url)) fail('url');
      if (button.label.includes('{{') || button.url.includes('{{')) fail('config');
      if (button.emoji !== undefined && (typeof button.emoji !== 'string' || !button.emoji.trim() || button.emoji.length > 32 || button.emoji.includes('{{'))) fail('config');
    }
  }
}
function validateDiscordStatus(embed, config) {
  try {
    check(embed, config);
    for (const statusKey of ['running', 'starting', 'stopped']) renderDiscordStatus(embed, config, { statusKey, serverName: 'S'.repeat(100), serverClients: 10000, serverMaxClients: 10000, serverAddress: 'A'.repeat(255), uptime: '999999h 59m', timestamp: '2026-10-25T12:00:00.000Z' });
    return null;
  } catch (error) { return ['size', 'embed', 'url', 'placeholder', 'config'].includes(error.code) ? error.code : 'embed'; }
}
function renderDiscordStatus(embed, config, context) {
  check(embed, config);
  const resolved = { ...discordStatusDefaults().statusConfig, ...config };
  const state = context.statusKey === 'running' ? 'online' : ['starting', 'stopping'].includes(context.statusKey) ? 'partial' : 'offline';
  const safe = Object.fromEntries(placeholders.map(key => [key, String(context[key] ?? '—')]));
  safe.statusString = resolved[state + 'String'];
  const replace = (value, max) => value.replace(/\{\{([^{}]+)\}\}/g, (_, key) => safe[key.trim()]).slice(0, max).trim() || '—';
  const rendered = { color: parseInt(resolved[state + 'Color'].slice(1), 16) };
  if (embed.title !== undefined) rendered.title = replace(embed.title, 256);
  if (embed.description !== undefined) rendered.description = replace(embed.description, 4096);
  if (embed.url) rendered.url = embed.url;
  if (embed.fields) rendered.fields = embed.fields.map(field => ({ name: replace(field.name, 256), value: replace(field.value, 1024), inline: field.inline === true }));
  if (embed.footer) rendered.footer = { text: replace(embed.footer.text, 2048) };
  if (embed.timestamp) rendered.timestamp = embed.timestamp === '{{timestamp}}' ? safe.timestamp : embed.timestamp;
  const count = (rendered.title?.length || 0) + (rendered.description?.length || 0) + (rendered.footer?.text.length || 0) + (rendered.fields || []).reduce((sum, field) => sum + field.name.length + field.value.length, 0);
  if (count > 6000) fail('size');
  const components = resolved.buttons.length ? [{ type: 1, components: resolved.buttons.map(button => ({ type: 2, style: 5, label: button.label, url: button.url,
    ...(button.emoji ? { emoji: /^\d{17,20}$/.test(button.emoji) ? { id: button.emoji } : { name: button.emoji } } : {}),
  })) }] : [];
  return { embed: rendered, components };
}
module.exports = { discordStatusDefaults, validateDiscordStatus, renderDiscordStatus, discordStatusPlaceholders: placeholders };
