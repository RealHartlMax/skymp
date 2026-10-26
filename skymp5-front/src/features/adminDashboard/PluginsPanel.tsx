import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './plugins.scss';

type RuntimeState = 'starting' | 'running' | 'failed' | 'stopped';
type DiscoveryMode = 'safe' | 'prompt' | 'auto';
type PendingWrite = { kind: 'plugin'; name: string } | { kind: 'all' } | { kind: 'mode' };
const isMode = (value: unknown): value is DiscoveryMode => ['safe', 'prompt', 'auto'].includes(value as string);
interface ServerPlugin {
  name: string;
  pluginPath: string;
  version: string;
  startupEnabled: boolean;
  manifestPresent: boolean;
  runtimeStatus: { status: RuntimeState; pid?: number; message?: string } | null;
}

export function PluginsPanel({ canView, canEdit, active = true }: { canView: boolean; canEdit: boolean; active?: boolean }) {
  const { t } = useTranslation();
  const text = (key: string, options?: Record<string, unknown>) => t(`adminDashboard.plugins.${key}`, options);
  const [plugins, setPlugins] = useState<ServerPlugin[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [saving, setSaving] = useState<PendingWrite | null>(null);
  const [mode, setMode] = useState<DiscoveryMode | null>(null);
  const [notice, setNotice] = useState<'saved' | 'allSaved' | 'modeSaved' | 'saveFailed' | 'forbidden' | null>(null);
  const [enabledCount, setEnabledCount] = useState(0);
  const [search, setSearch] = useState('');
  const mutation = useRef<AbortController | null>(null);

  useEffect(() => () => { mutation.current?.abort(); mutation.current = null; }, []);
  useEffect(() => {
    if (!active || !canView || saving) return;
    let closed = false;
    let pending = false;
    let controller: AbortController | undefined;
    const load = async () => {
      if (pending) return;
      pending = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const options = { credentials: 'same-origin' as const, cache: 'no-store' as const, signal: controller.signal };
        const [response, policyResponse] = await Promise.all([
          fetch('/api/admin/plugins', options), fetch('/api/admin/plugins/settings', options),
        ]);
        if (!response.ok) throw Error();
        const data: ServerPlugin[] = await response.json();
        if (!Array.isArray(data)) throw Error();
        const policy = policyResponse.ok ? await policyResponse.json() : null;
        if (!closed) {
          setPlugins(data.slice().sort((a, b) => a.name.localeCompare(b.name)));
          setMode(isMode(policy?.mode) ? policy.mode : null);
          setLoadFailed(false);
        }
      } catch {
        if (!closed) setLoadFailed(true);
      } finally {
        clearTimeout(timeout);
        pending = false;
        if (!closed) setLoading(false);
      }
    };
    void load();
    const interval = setInterval(() => void load(), 5000);
    return () => { closed = true; controller?.abort(); clearInterval(interval); };
  }, [active, canView, saving, refresh]);

  async function write(pending: PendingWrite, url: string, method: 'PATCH' | 'POST' | 'PUT', body: unknown) {
    if (!canEdit || saving || loading) return;
    const controller = new AbortController();
    mutation.current = controller;
    setSaving(pending);
    setNotice(null);
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, {
        method, credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setNotice(response.status === 403 ? 'forbidden' : 'saveFailed');
        return;
      }
      const data = await response.json();
      if (data.ok !== true) throw Error();
      if (mutation.current !== controller) return;
      if (pending.kind === 'plugin') {
        if (typeof data.startupEnabled !== 'boolean') throw Error();
        setPlugins(previous => previous?.map(entry => entry.name === pending.name
          ? { ...entry, startupEnabled: data.startupEnabled } : entry) || null);
        setNotice('saved');
      } else if (pending.kind === 'all') {
        if (!Array.isArray(data.names) || typeof data.count !== 'number') throw Error();
        const enabled = new Set(data.names);
        setPlugins(previous => previous?.map(entry => enabled.has(entry.name)
          ? { ...entry, startupEnabled: true } : entry) || null);
        setEnabledCount(data.count);
        setNotice('allSaved');
      } else {
        if (!isMode(data.mode)) throw Error();
        setMode(data.mode);
        setNotice('modeSaved');
      }
    } catch {
      if (mutation.current === controller) setNotice('saveFailed');
    } finally {
      clearTimeout(timeout);
      if (mutation.current === controller) { mutation.current = null; setSaving(null); }
    }
  }

  const matches = (plugins || []).filter(plugin =>
    `${plugin.name} ${plugin.pluginPath}`.toLowerCase().includes(search.trim().toLowerCase()));
  const disabledCount = (plugins || []).filter(plugin => !plugin.startupEnabled && plugin.manifestPresent).length;
  const busy = loading || Boolean(saving);
  return <section className="server-plugins" data-testid="server-plugins" aria-labelledby="server-plugins-title">
    <header>
      <div><h2 id="server-plugins-title">{text('title')}</h2><p>{text('intro')}</p></div>
      <div className="server-plugins__actions">
        <button type="button" className="server-plugins__enable-all" disabled={!canView || !canEdit || busy || disabledCount === 0}
          onClick={() => void write({ kind: 'all' }, '/api/admin/plugins/enable-all', 'POST', {})}>{text('enableAll', { count: disabledCount })}</button>
        <button type="button" disabled={!canView || busy} onClick={() => { setLoading(true); setRefresh(value => value + 1); }}>{text('refresh')}</button>
      </div>
    </header>
    {!canView ? <p>{text('noPermission')}</p> : <>
      <p className="server-plugins__hint">{text('discoveryHint')} <code>Plugins/&lt;Name&gt;/plugin.json</code></p>
      <p>{text('restartHint')}</p>
      {mode ? <label className="server-plugins__policy">{text('newPlugins')}
        <select value={mode} disabled={!canEdit || busy}
          onChange={event => void write({ kind: 'mode' }, '/api/admin/plugins/settings', 'PUT', { mode: event.target.value })}>
          <option value="safe">{text('modeSafe')}</option><option value="auto">{text('modeAuto')}</option><option value="prompt">{text('modePrompt')}</option>
        </select><small>{text('modeHint')}</small>
      </label> : plugins && <p role="alert">{text('modeUnavailable')}</p>}
      {!canEdit && <p>{text('readOnly')}</p>}
      {notice && <p className="server-plugins__notice" role={notice === 'saveFailed' || notice === 'forbidden' ? 'alert' : 'status'}>{text(notice, { count: enabledCount })}</p>}
      {loadFailed && <p className="server-plugins__notice" role="alert">{text('loadFailed')}</p>}
      {loading && !plugins && <p role="status">{text('loading')}</p>}
      {plugins && <>
        <label className="server-plugins__search">{text('search')}<input type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
        {plugins.length === 0 ? <p>{text('empty')}</p> : matches.length === 0 ? <p>{text('noMatches')}</p> :
          <ul className="server-plugins__list">{matches.map(plugin => {
            const runtime = plugin.runtimeStatus;
            return <li key={plugin.name} className="server-plugins__entry" data-plugin={plugin.name}>
              <div className="server-plugins__details">
                <h3>{plugin.name} <span>{text('version', { version: plugin.version })}</span></h3>
                <code>{plugin.pluginPath}</code>
                {!plugin.manifestPresent && <p className="server-plugins__error">{text('missingManifest')}</p>}
                {runtime?.message && <p className="server-plugins__message">{runtime.message}</p>}
              </div>
              <div className="server-plugins__state">
                <span>{text('runtime')}</span>
                <strong className={`server-plugins__badge server-plugins__badge--${runtime?.status || 'unknown'}`}>{text(runtime?.status || 'unknown')}</strong>
                {runtime?.pid && <small>PID {runtime.pid}</small>}
              </div>
              <div className="server-plugins__startup">
                <span>{text('startup')}<small>{text(plugin.startupEnabled ? 'enabled' : 'disabled')}</small></span>
                <button type="button" disabled={!canEdit || busy || (!plugin.manifestPresent && !plugin.startupEnabled)}
                  onClick={() => void write({ kind: 'plugin', name: plugin.name }, `/api/admin/plugins/${encodeURIComponent(plugin.name)}`, 'PATCH', { startupEnabled: !plugin.startupEnabled })}
                  aria-label={`${text(plugin.startupEnabled ? 'disable' : 'enable')}: ${plugin.name}`}>
                  {saving?.kind === 'plugin' && saving.name === plugin.name ? text('saving') : text(plugin.startupEnabled ? 'disable' : 'enable')}
                </button>
              </div>
            </li>;
          })}</ul>}
      </>}
    </>}
  </section>;
}
