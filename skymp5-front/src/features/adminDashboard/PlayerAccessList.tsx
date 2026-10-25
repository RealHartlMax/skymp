import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Entry { id: string; name: string; profileId: number; status: 'pending' | 'approved' | 'blocked'; lastSeenAt: string }
const order = { pending: 0, approved: 1, blocked: 2 };
const sorted = (entries: Entry[]) => entries.slice().sort((a, b) => order[a.status] - order[b.status] || b.lastSeenAt.localeCompare(a.lastSeenAt));

export function PlayerAccessList() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [message, setMessage] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(false);
  const changing = useRef(false);
  const request = useRef<AbortController | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (!mounted.current || changing.current || request.current) return;
    const controller = new AbortController(); request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setLoading(true);
    try {
      const response = await fetch('/api/admin/player-access', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (data.ok !== true || !Array.isArray(data.entries) || !data.entries.every((entry: Entry) =>
        entry && /^steam:[0-9]{17}$/.test(entry.id) && ['pending', 'approved', 'blocked'].includes(entry.status) && typeof entry.name === 'string' && typeof entry.lastSeenAt === 'string')) throw Error();
      if (mounted.current && request.current === controller) { setEntries(sorted(data.entries)); setLoaded(true); setMessage(''); }
    } catch {
      if (mounted.current && request.current === controller) setMessage(t('adminDashboard.apiError'));
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) { request.current = null; if (mounted.current) setLoading(false); }
    }
  }, [t]);
  useEffect(() => {
    mounted.current = true; void load();
    const refresh = () => { if (document.visibilityState !== 'hidden') void load(); };
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted.current = false; window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      request.current?.abort(); request.current = null;
      mutation.current?.abort(); mutation.current = null;
    };
  }, [load]);
  const change = async (id: string, action: 'approve' | 'block') => {
    if (changing.current) return;
    changing.current = true; request.current?.abort(); request.current = null;
    setLoading(false); setBusy(true); setMessage('');
    const controller = new AbortController(); mutation.current = controller;
    let updated = false;
    try {
      const response = await fetch('/api/admin/player-access', { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action }) });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (data.ok !== true || data.entry?.id !== id || data.entry?.status !== (action === 'approve' ? 'approved' : 'blocked')) throw Error();
      if (mounted.current) { setEntries(previous => sorted(previous.map(entry => entry.id === id ? data.entry : entry))); updated = true; }
    } catch { if (mounted.current) setMessage(t('adminDashboard.apiError')); }
    finally {
      changing.current = false; mutation.current = null;
      if (mounted.current) { setBusy(false); if (updated) void load(); }
    }
  };
  const search = query.trim().toLowerCase();
  const visible = entries.filter(entry => `${entry.id} ${entry.name}`.toLowerCase().includes(search));
  const pending = entries.filter(entry => entry.status === 'pending').length;
  return <div className="admin-dashboard__steam-players" data-testid="steam-player-access" aria-busy={loading || busy}>
    <div className="admin-dashboard__panel-toolbar">
      <span>{t('adminDashboard.steamPlayersTitle')}</span>
      <span className="admin-dashboard__panel-badge" role="status" aria-live="polite">{t('adminDashboard.steamStatus_pending')}: {pending}</span>
      <button type="button" className="admin-dashboard__log-btn" onClick={() => void load()} disabled={busy || loading}>{t('adminDashboard.refresh')}</button>
    </div>
    <p className="admin-dashboard__cfg-hint">{t('adminDashboard.steamPlayersHint')}</p>
    <input type="search" className="admin-dashboard__search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('adminDashboard.steamPlayersSearch')} aria-label={t('adminDashboard.steamPlayersSearch')} />
    {message && <p role="alert">{message}</p>}
    {!loaded && loading && !message && <p role="status">{t('adminDashboard.loading')}</p>}
    {loaded && !message && !visible.length && <p className="admin-dashboard__cfg-hint">{t(entries.length ? 'adminDashboard.noMatch' : 'adminDashboard.steamPlayersEmpty')}</p>}
    {visible.map(entry => <article key={entry.id} className="admin-dashboard__steam-player" data-status={entry.status}>
      <div><a href={`https://steamcommunity.com/profiles/${entry.id.slice(6)}`} target="_blank" rel="noreferrer">{entry.id}</a>
        <span>{t(`adminDashboard.steamStatus_${entry.status}`)} · {new Date(entry.lastSeenAt).toLocaleString()}</span></div>
      <div className="admin-dashboard__panel-toolbar-right">
        <button type="button" className="admin-dashboard__log-btn" aria-label={`${t('adminDashboard.steamApprove')} ${entry.id}`} disabled={busy || entry.status === 'approved'} onClick={() => void change(entry.id, 'approve')}>{t('adminDashboard.steamApprove')}</button>
        <button type="button" className="admin-dashboard__log-btn" aria-label={`${t('adminDashboard.steamBlock')} ${entry.id}`} disabled={busy || entry.status === 'blocked'} onClick={() => void change(entry.id, 'block')}>{t('adminDashboard.steamBlock')}</button>
      </div>
    </article>)}
  </div>;
}
