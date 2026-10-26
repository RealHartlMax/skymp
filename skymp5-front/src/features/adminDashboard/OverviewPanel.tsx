import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ServerPerformancePanel } from './ServerPerformancePanel';
import './operations.scss';

interface Drops { from: number; to: number; observedFrom: number; total: number; expected: number; unexpected: number; reasons: { reason: string; count: number }[]; persistenceAvailable: boolean }
export function OverviewPanel({ canView }: { canView: boolean }) {
  const { t, i18n } = useTranslation();
  const text = (key: string, options?: Record<string, unknown>) => t(`adminDashboard.operations.${key}`, options);
  const [drops, setDrops] = useState<Drops | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!canView) return;
    let closed = false, timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;
    const load = async () => {
      controller = new AbortController(); const timeout = setTimeout(() => controller?.abort(), 10000);
      try {
        const response = await fetch('/api/admin/overview', { signal: controller.signal });
        if (!response.ok) throw Error();
        const body = await response.json();
        if (!closed) { setDrops(body.drops); setFailed(false); }
      } catch { if (!closed) { setFailed(true); setDrops(null); } }
      finally { clearTimeout(timeout); if (!closed) timer = setTimeout(load, 5000); }
    };
    void load(); return () => { closed = true; controller?.abort(); clearTimeout(timer); };
  }, [canView]);
  if (!canView) return <p>{text('metricsPermission')}</p>;
  const activity = <section className="server-performance__card overview-activity" aria-label={text('dropsTitle')} data-testid="overview-activity">
    <header><h4>{text('dropsTitle')}</h4><span className="server-performance__caption">{text('sixHours')}</span></header>
    {failed ? <p role="alert">{text('loadFailed')}</p> : !drops ? <p role="status">{text('loading')}</p> : <>
      <strong className="overview-activity__total">{drops.total}</strong><p>{text('dropsCount')}</p>
      <div className="overview-activity__counts"><span>{text('expected')}<b>{drops.expected}</b></span><span>{text('unexpected')}<b>{drops.unexpected}</b></span></div>
      {drops.total > 0 ? <><div className="overview-activity__bar" aria-hidden="true"><span style={{ width: `${100 * drops.expected / drops.total}%` }} /></div><ul>{drops.reasons.map(({ reason, count }) => <li key={reason}><span>{reason || text('unknownReason')}</span><b>{count}</b></li>)}</ul></> : <p className="overview-activity__empty">{text('noDrops')}</p>}
      <p className="server-performance__help">{text('observedSince', { time: new Date(drops.observedFrom).toLocaleString(i18n.language, { dateStyle: 'short', timeStyle: 'short' }) })}</p>
      {!drops.persistenceAvailable && <p className="server-performance__notice">{text('activityMemoryOnly')}</p>}
    </>}
  </section>;
  return <ServerPerformancePanel activity={activity} />;
}
