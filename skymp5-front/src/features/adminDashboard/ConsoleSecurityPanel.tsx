import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './consoleSecurity.scss';

interface Policy {
  mode: 'restricted' | 'development'; blockVanillaCheats: boolean; blockUnauthorizedServerCommands: true;
  monitorMovement: boolean; movementEnforcement: 'off' | 'monitor'; logViolations: boolean; logAllowedAdminCommands: boolean;
}
interface View {
  saved: Policy; active: Policy | null; revision: string; restartRequired: boolean | null;
  nativeSupported: boolean; diagnostics: string[];
  reports: { userId: number; at: number; supported: string[]; unsupported: string[] }[];
}
const fields = ['mode', 'blockVanillaCheats', 'blockUnauthorizedServerCommands', 'monitorMovement', 'movementEnforcement', 'logViolations', 'logAllowedAdminCommands'] as const;
export function ConsoleSecurityPanel({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const text = (key: string) => t('adminDashboard.consoleSecurity.' + key);
  const [view, setView] = useState<View | null>(null), [draft, setDraft] = useState<Policy | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const baseline = useRef<Policy | null>(null), revision = useRef(''), dirty = useRef(false);
  const saving = useRef(false), request = useRef(0);
  dirty.current = Boolean(draft && baseline.current && JSON.stringify(draft) !== JSON.stringify(baseline.current));
  useEffect(() => {
    const abort = new AbortController();
    const refresh = async () => {
      if (saving.current) return;
      const currentRequest = ++request.current;
      try {
        const response = await fetch('/api/admin/console-security', { signal: abort.signal, cache: 'no-store' });
        if (!response.ok) throw Error();
        const value: View = await response.json(); if (abort.signal.aborted || currentRequest !== request.current) return;
        setView(value); setMessage(current => current === 'loadFailed' ? '' : current);
        if (!dirty.current) { baseline.current = value.saved; revision.current = value.revision; setDraft(value.saved); }
      } catch { if (!abort.signal.aborted) setMessage('loadFailed'); }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 5000);
    return () => { abort.abort(); clearInterval(timer); };
  }, []);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (!draft || !canEdit || busy) return;
    saving.current = true; ++request.current;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/console-security', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: revision.current, consoleSecurity: draft }) });
      if (!response.ok) { setMessage(response.status === 409 ? 'conflict' : 'saveFailed'); return; }
      const value: View = await response.json(); baseline.current = value.saved; revision.current = value.revision;
      dirty.current = false; setView(value); setDraft(value.saved); setMessage('savedNextStart');
    } catch { setMessage('saveFailed'); } finally { saving.current = false; setBusy(false); }
  };
  const change = (patch: Partial<Policy>) => { if (draft) { setDraft({ ...draft, ...patch }); setMessage(''); } };
  const renderValue = (value: unknown) => value === undefined || value === null ? text('unknown') : typeof value === 'boolean' ? text(value ? 'yes' : 'no') : text(String(value));
  return <section className="console-security" aria-labelledby="console-security-title">
    <h3 id="console-security-title">{text('title')}</h3><p>{text('intro')}</p>
    {message && <p role="status">{text(message)}</p>}
    {!view || !draft ? <p>{text('loading')}</p> : <>
      {draft.mode === 'development' && <p className="console-security__warning" role="status">{text('developmentWarning')}</p>}
      {!view.nativeSupported && <p className="console-security__warning">{text('nativeUnknown')}</p>}
      {view.diagnostics.length > 0 && <p className="console-security__warning">{view.diagnostics.includes('LEGACY_CONSOLE_BYPASS_IGNORED') ? text('legacyWarning') : text('configurationWarning')}</p>}
      <p role="status">{view.restartRequired ? text('restartRequired') : view.active ? text('activeMatches') : text('inactive')}</p>
      <form onSubmit={event => void save(event)}>
        <fieldset disabled={!canEdit || busy}><legend>{text('configuration')}</legend>
          <label htmlFor="console-security-mode">{text('mode')}</label>
          <select id="console-security-mode" value={draft.mode} onChange={event => change(event.target.value === 'restricted' ? { mode: 'restricted', blockVanillaCheats: true } : { mode: 'development' })}>
            <option value="restricted">{text('restricted')}</option><option value="development">{text('development')}</option>
          </select>
          {(['blockVanillaCheats', 'logViolations', 'logAllowedAdminCommands', 'monitorMovement'] as const).map(key => <label className="console-security__checkbox" key={key}>
            <input type="checkbox" checked={draft[key]} disabled={key === 'blockVanillaCheats' && draft.mode === 'restricted'} onChange={event => change({ [key]: event.target.checked })} />{text(key)}
          </label>)}
          <label htmlFor="console-security-movement">{text('movementEnforcement')}</label>
          <select id="console-security-movement" disabled={!draft.monitorMovement} value={draft.movementEnforcement} onChange={event => change({ movementEnforcement: event.target.value as Policy['movementEnforcement'] })}>
            {(['off', 'monitor'] as const).map(mode => <option key={mode} value={mode}>{text(mode)}</option>)}
          </select><p>{text('movementLimit')}</p><p>{text('authorizationAlways')}</p>
          <button className="admin-dashboard__log-btn admin-dashboard__log-btn--primary" type="submit" disabled={!dirty.current}>{text(busy ? 'saving' : 'save')}</button>
        </fieldset>
      </form>
      <div className="console-security__comparison"><table><caption>{text('effectiveConfiguration')}</caption>
        <thead><tr><th>{text('setting')}</th><th>{text('stored')}</th><th>{text('active')}</th></tr></thead>
        <tbody>{fields.map(key => <tr key={key}><th scope="row">{text(key)}</th><td>{renderValue(view.saved[key])}</td><td>{renderValue(view.active?.[key])}</td></tr>)}</tbody>
      </table></div>
      <h4>{text('clientReports')}</h4><p>{text('clientReportsUnverified')}</p>
      {view.reports.length === 0 ? <p>{text('noReports')}</p> : <ul>{view.reports.map(report => <li key={report.userId}>
        {text('player')} {report.userId} · {new Date(report.at).toLocaleString()} · {text('reportedHooks')}: {report.supported.join(', ') || '—'}
        {report.unsupported.length > 0 && <> · {text('unsupported')}: {report.unsupported.join(', ')}</>}
      </li>)}</ul>}
    </>}
  </section>;
}
