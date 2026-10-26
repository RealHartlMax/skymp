import React, { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './operations.scss';

interface Config { enabled: boolean; timeZone: string; times: string[]; warningMinutes: number[] }
export interface ScheduleView { supported: boolean; config: Config; revision: string; nextAt: number | null; serverTimeZone: string; persistenceAvailable: boolean; error: string | null }

export function RestartScheduleSummary({ value, canEdit, onEdit, onChanged }: { value: ScheduleView | null | undefined; canEdit: boolean; onEdit: () => void; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const text = (key: string) => t(`adminDashboard.operations.${key}`);
  const [busy, setBusy] = useState(false), [error, setError] = useState(false);
  const next = value?.nextAt;
  const skip = async () => {
    if (!next || busy) return;
    setBusy(true); setError(false);
    try {
      const response = await fetch('/api/admin/server/restart-schedule/skip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nextAt: next }) });
      if (!response.ok) throw Error();
      onChanged();
    } catch { setError(true); onChanged(); } finally { setBusy(false); }
  };
  return <section className="restart-summary" aria-label={text('nextRestart')} data-testid="restart-summary">
    <h3>{text('nextRestart')}</h3>
    <p className={next ? 'restart-summary__next' : ''}>{next ? new Date(next).toLocaleString(i18n.language, { timeZone: value!.config.timeZone, dateStyle: 'short', timeStyle: 'short' }) : text('notScheduled')}</p>
    {next && <small>{value!.config.timeZone}</small>}
    {value?.error && <p role="status">{text('scheduleProblem')}</p>}
    <div><button type="button" onClick={onEdit}>{text(canEdit ? 'editSchedule' : 'viewSchedule')}</button>
      {canEdit && next && <button type="button" disabled={busy || !value?.persistenceAvailable} onClick={() => void skip()}>{text(busy ? 'saving' : 'skipNext')}</button>}</div>
    {error && <p role="alert">{text('requestFailed')}</p>}
  </section>;
}

export function RestartSchedulePanel({ canEdit, onChanged }: { canEdit: boolean; onChanged: () => void }) {
  const { t, i18n } = useTranslation();
  const text = (key: string, options?: Record<string, unknown>) => t(`adminDashboard.operations.${key}`, options);
  const id = useId();
  const [saved, setSaved] = useState<ScheduleView | null>(null), [draft, setDraft] = useState<Config | null>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setBusy(true); setMessage('');
    void fetch('/api/admin/server/restart-schedule', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error();
      const value: ScheduleView = await response.json();
      if (!controller.signal.aborted) { setSaved(value); setDraft(value.config); setFailed(false); }
    }).catch(() => { if (!controller.signal.aborted) { setFailed(true); setMessage('loadFailed'); } }).finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [reload]);
  const dirty = Boolean(saved && draft && JSON.stringify(saved.config) !== JSON.stringify(draft));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!draft || !saved || !canEdit || busy) return;
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/server/restart-schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: draft, revision: saved.revision }) });
      const value = await response.json();
      if (!response.ok) throw Error(value.error);
      setSaved(value); setDraft(value.config); setFailed(false); setMessage('saved'); onChanged();
    } catch (error) { setFailed(true); setMessage((error as Error).message === 'SCHEDULE_CHANGED' ? 'conflict' : (error as Error).message === 'INVALID_TIME_ZONE' ? 'invalidTimeZone' : 'saveFailed'); }
    finally { setBusy(false); }
  };
  return <section className="restart-settings" data-testid="restart-settings" aria-labelledby={`${id}-title`}>
    <header><div><h3 id={`${id}-title`}>{text('scheduleTitle')}</h3><p>{text('scheduleIntro')}</p></div><button type="button" disabled={busy || dirty} onClick={() => setReload(value => value + 1)}>{text('reload')}</button></header>
    {message && <p className="restart-settings__notice" role={failed ? 'alert' : 'status'}>{text(message)}</p>}
    {!saved && busy && <p role="status">{text('loading')}</p>}
    {saved && draft && <form onSubmit={event => void submit(event)}>
      {(!saved.supported || !saved.persistenceAvailable || saved.error) && <p className="restart-settings__notice" role="status">{text(!saved.supported ? 'unsupported' : 'scheduleProblem')}</p>}
      <fieldset disabled={!canEdit || busy || !saved.supported}>
        <legend className="admin-dashboard__sr-only">{text('scheduleTitle')}</legend>
        <div className="restart-settings__row"><label htmlFor={`${id}-enabled`}>{text('enabled')}</label><div><label className="restart-settings__switch"><input id={`${id}-enabled`} type="checkbox" role="switch" checked={draft.enabled} onChange={event => setDraft({ ...draft, enabled: event.target.checked })} /><span>{text(draft.enabled ? 'on' : 'off')}</span></label><p>{text('enabledHint')}</p></div></div>
        <div className="restart-settings__row"><label htmlFor={`${id}-zone`}>{text('timeZone')}</label><div><input id={`${id}-zone`} type="text" list={`${id}-zones`} value={draft.timeZone} required maxLength={100} onChange={event => setDraft({ ...draft, timeZone: event.target.value })} aria-describedby={`${id}-zone-help`} /><datalist id={`${id}-zones`}>{['UTC', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'Asia/Tokyo'].map(zone => <option key={zone} value={zone} />)}</datalist><p id={`${id}-zone-help`}>{text('timeZoneHint', { server: saved.serverTimeZone, browser: Intl.DateTimeFormat().resolvedOptions().timeZone })}</p></div></div>
        <div className="restart-settings__row"><span>{text('times')}</span><div className="restart-settings__times">{draft.times.map((time, index) => <div key={index}><input type="time" aria-label={text('timeNumber', { number: index + 1 })} value={time} required onChange={event => setDraft({ ...draft, times: draft.times.map((value, position) => position === index ? event.target.value : value) })} /><button type="button" aria-label={text('removeTime', { number: index + 1 })} onClick={() => setDraft({ ...draft, times: draft.times.filter((_, position) => position !== index) })}>{text('remove')}</button></div>)}<button type="button" disabled={draft.times.length >= 12} onClick={() => setDraft({ ...draft, times: [...draft.times, '04:00'] })}>{text('addTime')}</button><p>{text('timesHint')}</p></div></div>
        <div className="restart-settings__row"><span>{text('warnings')}</span><div className="restart-settings__warnings">{[30, 15, 10, 5, 1].map(minutes => <label key={minutes}><input type="checkbox" checked={draft.warningMinutes.includes(minutes)} onChange={event => setDraft({ ...draft, warningMinutes: event.target.checked ? [...draft.warningMinutes, minutes].sort((a, b) => b - a) : draft.warningMinutes.filter(value => value !== minutes) })} />{text('minutesBefore', { minutes })}</label>)}<p>{text('warningsHint')}</p></div></div>
      </fieldset>
      {saved.nextAt && <p className="restart-settings__notice">{text('nextRestart')}: {new Date(saved.nextAt).toLocaleString(i18n.language, { timeZone: saved.config.timeZone })} · {saved.config.timeZone}</p>}
      {!canEdit && <p>{text('readOnly')}</p>}
      <footer><span role="status">{text(dirty ? 'unsaved' : 'upToDate')}</span><div><button type="button" disabled={!dirty || busy} onClick={() => { setDraft(saved.config); setMessage(''); }}>{text('discard')}</button><button className="is-primary" type="submit" disabled={!canEdit || !saved.supported || busy || !dirty || (draft.enabled && !draft.times.length)}>{text(busy ? 'saving' : 'saveSchedule')}</button></div></footer>
    </form>}
  </section>;
}
