import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { discordStatusDefaults, discordStatusPlaceholders, renderDiscordStatus, validateDiscordStatus } from '../../../../skymp5-server/ts/discordStatus';
import type { DiscordStatusEmbed, DiscordStatusConfig } from '../../../../skymp5-server/ts/discordStatus';
import './discordSettings.scss';

export interface DiscordSettingsValue {
  enabled: boolean; token: string; guildId: string; statusChannelId: string; warningsChannelId: string;
  statusEmbedEnabled?: boolean; statusEmbed?: DiscordStatusEmbed; statusConfig?: Partial<DiscordStatusConfig>;
}
type Draft = Omit<DiscordSettingsValue, 'statusEmbed' | 'statusConfig'> & { embedJson: string; configJson: string };
type Defaults = ReturnType<typeof discordStatusDefaults>;
type Status = { name: string; online: number; maxPlayers: number; uptimeSec: number; gameState?: string; discordBot?: { state: string; lastError: string | null } | null };
const toDraft = (value: DiscordSettingsValue, defaults: Defaults): Draft => ({
  enabled: value.enabled, token: value.token, guildId: value.guildId, statusChannelId: value.statusChannelId, warningsChannelId: value.warningsChannelId,
  statusEmbedEnabled: value.statusEmbedEnabled === true,
  embedJson: JSON.stringify(value.statusEmbed === undefined ? defaults.statusEmbed : value.statusEmbed, null, 2),
  configJson: JSON.stringify(value.statusConfig === undefined ? defaults.statusConfig : value.statusConfig, null, 2),
});
const validId = (value: string) => /^\d{17,20}$/.test(value.trim());

export function DiscordSettingsPanel({ active, canEdit, status, onSaved }: {
  active: boolean; canEdit: boolean; status: Status | null; onSaved: (value: DiscordSettingsValue) => void;
}) {
  const { t, i18n } = useTranslation();
  const text = (key: string) => t(`adminDashboard.discordSettings.${key}`);
  const id = useId();
  const [draft, setDraft] = useState<Draft | null>(null), [saved, setSaved] = useState<Draft | null>(null);
  const [defaults, setDefaults] = useState<Defaults>(() => discordStatusDefaults(i18n.language));
  const [address, setAddress] = useState('—'), [loading, setLoading] = useState(false), [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(''), [failed, setFailed] = useState(false), [reveal, setReveal] = useState(false);
  const [previewState, setPreviewState] = useState('live');
  const alive = useRef(false), request = useRef<AbortController | null>(null), loaded = useRef(false);
  const onSavedRef = useRef(onSaved); onSavedRef.current = onSaved;
  useEffect(() => { alive.current = true; return () => { alive.current = false; request.current?.abort(); }; }, []);
  const load = async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setMessage(''); setReveal(false);
    try {
      const response = await fetch('/api/admin/discord/settings', { signal: controller.signal, cache: 'no-store' });
      if (!response.ok) { if ([401, 403].includes(response.status)) { if (alive.current) { setDraft(null); setSaved(null); } throw Error('permission'); } throw Error('loadError'); }
      const value = await response.json();
      if (!value.discordBot || !value.defaults) throw Error('loadError');
      if (!alive.current || controller.signal.aborted) return;
      const next = toDraft(value.discordBot, value.defaults);
      setDefaults(value.defaults); setDraft(next); setSaved(next); setAddress(value.serverAddress || '—'); loaded.current = true; setFailed(false);
    } catch (error) { if (alive.current && !controller.signal.aborted) { setFailed(true); setMessage((error as Error).message === 'permission' ? 'permission' : 'loadError'); } }
    finally { if (alive.current && !controller.signal.aborted) setLoading(false); }
  };
  useEffect(() => { if (active && !loaded.current && !loading) void load(); }, [active]);
  const dirty = draft && saved && JSON.stringify(draft) !== JSON.stringify(saved);
  const state = previewState === 'live' ? status?.gameState || 'stopped' : previewState;
  const parsed = useMemo(() => {
    if (!draft) return { error: '', presentation: null, embed: null, config: null };
    let embed: DiscordStatusEmbed, config: Partial<DiscordStatusConfig>;
    try { embed = JSON.parse(draft.embedJson); config = JSON.parse(draft.configJson); } catch { return { error: 'json', presentation: null, embed: null, config: null }; }
    const error = validateDiscordStatus(embed, config);
    if (error) return { error, presentation: null, embed, config };
    try {
      const seconds = state === 'running' ? Math.max(0, status?.uptimeSec || 0) : 0;
      return { error: '', embed, config, presentation: renderDiscordStatus(embed, config, {
        statusKey: state, serverName: (status?.name || 'SkyMP').slice(0, 100), serverClients: state === 'running' ? status?.online ?? '—' : ['stopped', 'crashed'].includes(state) ? 0 : '—',
        serverMaxClients: status?.maxPlayers || '—', serverAddress: address, uptime: `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`, timestamp: new Date().toISOString(),
      }) };
    } catch { return { error: 'size', presentation: null, embed, config }; }
  }, [draft, state, status?.name, status?.online, status?.maxPlayers, status?.uptimeSec, address]);
  const credentialsError = !draft?.enabled ? '' : !draft.token.replace(/^Bot\s+/i, '').trim() ? 'token' : !validId(draft.guildId) ? 'guild' : [draft.statusChannelId, draft.warningsChannelId].some(value => value.trim() && !validId(value)) ? 'channel' : '';
  const validation = parsed.error || credentialsError;
  const change = (changes: Partial<Draft>) => { setDraft(previous => previous ? { ...previous, ...changes } : previous); setMessage(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!draft || validation || !canEdit || saving) return;
    setSaving(true); setMessage(''); setFailed(false);
    const controller = new AbortController(); request.current = controller;
    try {
      const value: DiscordSettingsValue = { enabled: draft.enabled, token: draft.token.trim(), guildId: draft.guildId.trim(), statusChannelId: draft.statusChannelId.trim(), warningsChannelId: draft.warningsChannelId.trim(), statusEmbedEnabled: draft.statusEmbedEnabled, statusEmbed: parsed.embed!, statusConfig: parsed.config! };
      const response = await fetch('/api/admin/discord/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ discordBot: value }), signal: controller.signal });
      if (!response.ok) { if ([401, 403].includes(response.status)) { setDraft(null); setSaved(null); throw Error('permission'); } throw Error('saveError'); }
      const body = await response.json(); if (!body.discordBot) throw Error('saveError');
      if (!alive.current) return;
      const next = toDraft(body.discordBot, defaults); setDraft(next); setSaved(next); setReveal(false); setMessage('saved'); onSavedRef.current(body.discordBot);
    } catch (error) { if (alive.current && !controller.signal.aborted) { setFailed(true); setMessage((error as Error).message === 'permission' ? 'permission' : 'saveError'); } }
    finally { if (alive.current) setSaving(false); }
  };
  const field = (key: 'token' | 'guildId' | 'statusChannelId' | 'warningsChannelId', label: string, hint: string, required = false) => <div className="discord-settings__row">
    <div><label htmlFor={`${id}-${key}`}>{text(label)}</label>{required && <small className="discord-settings__required">{text('required')}</small>}</div>
    <div><div className="discord-settings__secret"><input id={`${id}-${key}`} type={key === 'token' && !reveal ? 'password' : 'text'} autoComplete={key === 'token' ? 'new-password' : 'off'} spellCheck={false}
      value={draft![key]} maxLength={key === 'token' ? 512 : 20} inputMode={key === 'token' ? undefined : 'numeric'} aria-required={required && draft!.enabled} aria-describedby={`${id}-${key}-help`}
      onChange={event => change({ [key]: event.target.value })} />{key === 'token' && <button type="button" aria-pressed={reveal} onClick={() => setReveal(!reveal)}>{text(reveal ? 'hideToken' : 'showToken')}</button>}</div>
      <p id={`${id}-${key}-help`} className="discord-settings__help">{text(hint)} {key === 'token' ? <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">{text('developerPortal')}</a> : <a href="https://support.discord.com/hc/en-us/articles/206346498-Where-can-I-find-my-User-Server-Message-ID" target="_blank" rel="noopener noreferrer">{text('copyIds')}</a>}</p>
    </div>
  </div>;
  const editor = (key: 'embedJson' | 'configJson', title: string, hint: string) => <div className="discord-settings__row discord-settings__row--editor">
    <div><label htmlFor={`${id}-${key}`}>{text(title)}</label><small className="discord-settings__format">JSON</small></div>
    <div><textarea id={`${id}-${key}`} value={draft![key]} spellCheck={false} autoComplete="off" rows={key === 'embedJson' ? 17 : 12} maxLength={key === 'embedJson' ? 16000 : 8000}
      aria-describedby={`${id}-${key}-help`} aria-invalid={Boolean(parsed.error)} onChange={event => change({ [key]: event.target.value })} />
      <div className="discord-settings__editor-actions"><button type="button" onClick={() => change({ [key]: saved![key] })} disabled={draft![key] === saved![key]}>{text('discard')}</button>
        <button type="button" onClick={() => change({ [key]: JSON.stringify(key === 'embedJson' ? defaults.statusEmbed : defaults.statusConfig, null, 2) })}>{text('reset')}</button></div>
      <p id={`${id}-${key}-help`} className="discord-settings__help">{text(hint)}</p>
    </div>
  </div>;
  return <section className="discord-settings" data-testid="discord-settings" aria-labelledby={`${id}-title`}>
    <header className="discord-settings__heading"><div><h3 id={`${id}-title`}>{text('title')}</h3><p>{text('intro')}</p></div><button type="button" onClick={() => void load()} disabled={loading || saving || Boolean(dirty)}>{text('reload')}</button></header>
    {message && <p className={`discord-settings__notice${failed ? ' is-error' : ''}`} role={failed ? 'alert' : 'status'}>{text(message)}</p>}
    {loading && <p role="status">{text('loading')}</p>}
    {draft && saved && <form onSubmit={event => void submit(event)}>
      <fieldset disabled={!canEdit || loading || saving}>
        <legend className="discord-settings__sr-only">{text('title')}</legend>
        <div className="discord-settings__card">
          <div className="discord-settings__row"><label htmlFor={`${id}-enabled`}>{text('bot')}</label><div>
            <label className="discord-settings__switch" htmlFor={`${id}-enabled`}><input type="checkbox" role="switch" id={`${id}-enabled`} checked={draft.enabled} onChange={event => change({ enabled: event.target.checked })} /><span aria-hidden="true" /><strong>{text(draft.enabled ? 'enabled' : 'disabled')}</strong></label>
            <p className="discord-settings__help">{text('enableHint')}</p><p className="discord-settings__connection" role="status" data-testid="discord-bot-status">{text('connection')}: {t(`adminDashboard.discordState_${status?.discordBot?.state || 'unavailable'}`)}</p>
            {status?.discordBot?.lastError && <p className="discord-settings__notice is-error">{status.discordBot.lastError}</p>}
          </div></div>
          {field('token', 'token', 'tokenHint', true)}{field('guildId', 'guild', 'guildHint', true)}{field('statusChannelId', 'statusChannel', 'statusHint')}{field('warningsChannelId', 'warningsChannel', 'warningsHint')}
          <div className="discord-settings__row"><label htmlFor={`${id}-embeds`}>{text('useEmbed')}</label><div><label className="discord-settings__switch" htmlFor={`${id}-embeds`}><input type="checkbox" role="switch" id={`${id}-embeds`} checked={draft.statusEmbedEnabled} onChange={event => change({ statusEmbedEnabled: event.target.checked })} /><span aria-hidden="true" /><strong>{text(draft.statusEmbedEnabled ? 'enabled' : 'disabled')}</strong></label><p className="discord-settings__help">{text('embedHint')}</p></div></div>
          {editor('embedJson', 'embedJson', 'embedEditorHint')}{editor('configJson', 'configJson', 'configHint')}
          <div className="discord-settings__row"><span>{text('placeholders')}</span><div className="discord-settings__placeholders">{discordStatusPlaceholders.map(value => <code key={value}>{`{{${value}}}`}</code>)}</div></div>
        </div>
      </fieldset>
      {validation && <p role="alert" className="discord-settings__notice is-error">{text(`error_${validation}`)}</p>}
      {!canEdit && <p className="discord-settings__notice">{text('permission')}</p>}
      <div className="discord-settings__save"><span role="status">{text(dirty ? 'unsaved' : 'upToDate')}</span><div className="discord-settings__editor-actions"><button type="button" disabled={!dirty || saving || loading} onClick={() => { setDraft(saved); setMessage(''); setReveal(false); }}>{text('discard')}</button><button type="submit" className="is-primary" disabled={!canEdit || loading || saving || Boolean(validation) || !dirty}>{text(saving ? 'saving' : 'save')}</button></div></div>
    </form>}
    {draft && saved && <section className="discord-settings__preview" aria-labelledby={`${id}-preview`}>
      <header><div><h4 id={`${id}-preview`}>{text('preview')}</h4><p>{text('previewHint')}</p></div><label className="discord-settings__preview-select"><span>{text('previewState')}</span><select value={previewState} onChange={event => setPreviewState(event.target.value)}>{['live', 'running', 'starting', 'stopped'].map(value => <option key={value} value={value}>{text(`preview_${value}`)}</option>)}</select></label></header>
      {parsed.presentation ? <><article className="discord-settings__embed" style={{ borderLeftColor: `#${parsed.presentation.embed.color.toString(16).padStart(6, '0')}` }}>
        {parsed.presentation.embed.title && <h5>{parsed.presentation.embed.title}</h5>}{parsed.presentation.embed.description && <p>{parsed.presentation.embed.description}</p>}
        <dl>{parsed.presentation.embed.fields?.map((value, index) => <div key={index} className={value.inline ? 'is-inline' : ''}><dt>{value.name}</dt><dd>{value.value}</dd></div>)}</dl>
        {parsed.presentation.embed.footer && <small>{parsed.presentation.embed.footer.text}</small>}
      </article><div className="discord-settings__preview-links">{parsed.presentation.components.flatMap(row => row.components).map((button, index) => <a key={index} href={button.url} target="_blank" rel="noopener noreferrer">{button.emoji?.name} {button.label}</a>)}</div></> : <p className="discord-settings__help">{text('previewInvalid')}</p>}
    </section>}
  </section>;
}
