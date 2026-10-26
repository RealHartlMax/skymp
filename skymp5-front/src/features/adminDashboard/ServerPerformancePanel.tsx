import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { PerformancePoint, PerformanceView, RuntimeMetrics } from '../../../../skymp5-server/ts/serverPerformanceTypes';
import './serverPerformance.scss';

export type PerformanceMetric = 'tick' | 'cpu' | 'memory' | 'players' | 'eventLoop';
export const performanceValue = (point: PerformancePoint, metric: PerformanceMetric, secondary = false): number | null => {
  if (metric === 'tick') return point.ticks.count ? secondary ? point.ticks.maxMs : point.ticks.averageMs : null;
  if (metric === 'players') return secondary ? null : point.players;
  const runtime = secondary ? point.web : point.game;
  return runtime ? metric === 'cpu' ? runtime.cpuPercent : metric === 'memory' ? runtime.rssBytes / 1048576 : runtime.eventLoopMs : null;
};
export function performancePath(points: PerformancePoint[], metric: PerformanceMetric, secondary: boolean, from: number, to: number, max: number, width = 960): string {
  let result = '', previous: number | null = null;
  for (const point of points) {
    const value = performanceValue(point, metric, secondary);
    if (value === null || !Number.isFinite(value)) { previous = null; continue; }
    const x = 54 + Math.max(0, Math.min(1, (point.at - from) / Math.max(1, to - from))) * (width - 80);
    const y = 228 - Math.max(0, Math.min(1, value / max)) * 200;
    result += `${previous !== null && point.at - previous <= 60000 ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)} `;
    previous = point.at;
  }
  return result.trim();
}
const number = (value: number | null | undefined, digits = 1): string => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: digits }) : '—';
const emptyTicks = { count: 0, totalMs: 0, maxMs: 0, buckets: [] as number[] };

export function ServerPerformancePanel({ activity }: { activity?: React.ReactNode } = {}) {
  const { t, i18n } = useTranslation();
  const text = (key: string, options?: Record<string, unknown>) => t(`adminDashboard.performance.${key}`, options);
  const id = useId();
  const [data, setData] = useState<PerformanceView | null>(null);
  const [minutes, setMinutes] = useState(1440);
  const [metric, setMetric] = useState<PerformanceMetric>('tick');
  const [selectedAt, setSelectedAt] = useState<number | null>(null);
  const [error, setError] = useState(false);
  const chart = useRef<SVGSVGElement>(null);
  const [chartWidth, setChartWidth] = useState(960);
  useEffect(() => {
    if (!chart.current) return;
    const resize = () => setChartWidth(Math.max(240, Math.round(chart.current?.getBoundingClientRect().width || 960)));
    resize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(chart.current);
    window.addEventListener('resize', resize);
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); };
  }, [Boolean(data)]);
  useEffect(() => {
    let closed = false, timer: ReturnType<typeof setTimeout> | undefined, active: AbortController | undefined;
    const load = async () => {
      active = new AbortController(); const timeout = setTimeout(() => active?.abort(), 10000);
      try {
        const response = await fetch(`/api/admin/server-performance?minutes=${minutes}`, { signal: active.signal });
        if (!response.ok) { if (!closed && [401, 403].includes(response.status)) setData(null); throw Error('Performance unavailable'); }
        const value = await response.json();
        if (!value || !Array.isArray(value.points) || !value.live || !value.summary || !Array.isArray(value.bucketBoundsMs)) throw Error('Invalid performance response');
        if (!closed) { setData(value); setError(false); }
      } catch { if (!closed) setError(true); }
      finally { clearTimeout(timeout); if (!closed) timer = setTimeout(load, 5000); }
    };
    void load();
    return () => { closed = true; active?.abort(); if (timer) clearTimeout(timer); };
  }, [minutes]);
  const selected = selectedAt === null ? null : data?.points.find(point => point.at === selectedAt) || null;
  const points = data?.points || [];
  const maximum = useMemo(() => Math.max(metric === 'cpu' ? 100 : metric === 'players' ? 1 : metric === 'memory' ? 64 : 1, ...points.flatMap(point => [performanceValue(point, metric), performanceValue(point, metric, true)]).filter((value): value is number => value !== null && Number.isFinite(value))) * 1.1, [data, metric]);
  const tickData = selectedAt === null ? data?.histogram || emptyTicks : selected?.ticks || emptyTicks;
  const runtime = selectedAt === null ? data?.live : selected;
  const date = (at: number, full = false) => new Date(at).toLocaleString(i18n.language, full ? { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' } : { hour: '2-digit', minute: '2-digit' });
  const unit = metric === 'cpu' ? '%' : metric === 'memory' ? 'MiB' : metric === 'players' ? '' : 'ms';
  const setFromPointer = (event: React.MouseEvent<SVGSVGElement>) => {
    if (!data) return;
    const bounds = event.currentTarget.getBoundingClientRect(), ratio = Math.max(0, Math.min(1, ((event.clientX - bounds.left) / bounds.width * chartWidth - 54) / (chartWidth - 80)));
    const target = data.from + ratio * (data.to - data.from);
    setSelectedAt(Math.floor(target / 60000) * 60000);
  };
  const keySelection = (event: React.KeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setSelectedAt(null); return; }
    if (!points.length) return;
    const found = selectedAt === null ? -1 : points.findIndex(point => point.at >= selectedAt);
    const current = found < 0 ? points.length - 1 : found;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      setSelectedAt(points[event.key === 'Home' ? 0 : event.key === 'End' ? points.length - 1 : Math.max(0, Math.min(points.length - 1, current + (event.key === 'ArrowLeft' ? -1 : 1)))].at);
    }
  };
  const runtimeRow = (key: keyof RuntimeMetrics, label: string, suffix: string, divisor = 1) => <tr key={key}>
    <th scope="row">{text(label)}</th><td>{number(runtime?.game ? runtime.game[key] / divisor : null)} {suffix}</td><td>{number(runtime?.web ? runtime.web[key] / divisor : null)} {suffix}</td>
  </tr>;
  const cursor = data && selectedAt !== null ? 54 + Math.max(0, Math.min(1, (selectedAt - data.from) / Math.max(1, data.to - data.from))) * (chartWidth - 80) : null;
  const markers = [false, true].filter(secondary => !secondary || metric !== 'players').map(secondary => {
    const point = selectedAt === null ? [...points].reverse().find(point => performanceValue(point, metric, secondary) !== null) : selected;
    const value = point ? performanceValue(point, metric, secondary) : null;
    return point && value !== null ? <circle key={String(secondary)} cx={54 + Math.max(0, Math.min(1, (point.at - (data?.from || 0)) / Math.max(1, (data?.to || 0) - (data?.from || 0)))) * (chartWidth - 80)} cy={228 - Math.max(0, Math.min(1, value / maximum)) * 200} r="3" className={`server-performance__marker${secondary ? ' server-performance__marker--secondary' : ''}`} /> : null;
  });
  return <section className={`server-performance${activity ? ' server-performance--overview' : ''}`} data-testid="server-performance" aria-labelledby={`${id}-title`}>
    <header className="server-performance__heading"><div><h3 id={`${id}-title`}>{text('title')}</h3><p>{text('subtitle')}</p></div>
      <div className="server-performance__controls">
        <span className={`server-performance__mode ${error ? 'is-error' : selectedAt === null ? 'is-live' : ''}`} role="status">{error ? text('disconnected') : selectedAt === null ? text('live') : date(selectedAt, true)}</span>
        <label><span className="server-performance__sr-only">{text('range')}</span><select aria-label={text('range')} value={minutes} onChange={event => { setMinutes(Number(event.target.value)); setSelectedAt(null); }}><option value={60}>{text('hour')}</option><option value={360}>{text('sixHours')}</option><option value={1440}>{text('day')}</option></select></label>
        <button type="button" onClick={() => setSelectedAt(null)} disabled={selectedAt === null}>{text('returnLive')}</button>
      </div>
    </header>
    {error && <p role="alert" className="server-performance__notice">{text('loadError')}</p>}
    {!data ? <p className="server-performance__empty" role="status">{text(error ? 'loadError' : 'loading')}</p> : <>
      {!data.persistenceAvailable && <p className="server-performance__notice" role="status">{text('memoryOnly')}</p>}
      <div className="server-performance__summary">
        <article><span>{text('availability')}</span><strong>{number(data.summary.runningPercent, 2)}<small> %</small></strong><p>{text('coverage', { minutes: number(data.summary.observedMs / 60000, 0) })}</p></article>
        <article><span>{text('medianPlayers')}</span><strong>{number(data.summary.medianPlayers)}</strong><p>{text('minuteSamples')}</p></article>
        <article><span>{text('peakPlayers')}</span><strong>{number(data.summary.peakPlayers, 0)}</strong><p>{text('minuteSamples')}</p></article>
      </div>
      <div className="server-performance__top">
        {activity}
        <section className="server-performance__card" aria-labelledby={`${id}-stats`}>
          <header><h4 id={`${id}-stats`}>{text('processStats')}</h4>{selectedAt === null ? <span className={`server-performance__state ${data.gameState === 'running' ? 'is-online' : ''}`}>{text(`state_${data.gameState}`)}</span> : <span className="server-performance__caption">{text('selectedMinute')}</span>}</header>
          <div className="server-performance__player-line"><span>{selectedAt === null ? text('playersNow') : text('playersSelected')}</span><strong>{number(runtime?.players, 0)}</strong></div>
          {selectedAt !== null && !selected && <p className="server-performance__notice">{text('noSelection')}</p>}
          {selectedAt === null && data.gameState === 'running' && !data.telemetryFresh && <p className="server-performance__notice">{text('stale')}</p>}
          <table className="server-performance__runtime"><caption className="server-performance__sr-only">{text('processStats')}</caption><thead><tr><th scope="col"><span className="server-performance__sr-only">{text('metric')}</span></th><th scope="col">{data.mode === 'standalone' ? text('combinedProcess') : text('game')}</th><th scope="col">{text('web')}</th></tr></thead>
            <tbody>{runtimeRow('cpuPercent', 'cpu', '%')}{runtimeRow('rssBytes', 'rss', 'MiB', 1048576)}{runtimeRow('heapUsedBytes', 'heap', 'MiB', 1048576)}{runtimeRow('eventLoopMs', 'eventLoop', 'ms')}</tbody>
          </table><p className="server-performance__help">{text('cpuHelp')}</p>
        </section>
        <section className="server-performance__card" aria-labelledby={`${id}-distribution`}>
          <header><h4 id={`${id}-distribution`}>{text('distribution')}</h4><span className="server-performance__caption">{text(selectedAt === null ? 'lastMinute' : 'selectedMinute')}</span></header>
          <div className="server-performance__histogram" role="img" aria-label={text('histogramLabel', { count: tickData.count })}>
            {data.bucketBoundsMs.map((bound, index) => {
              const count = tickData.buckets[index] || 0, percent = tickData.count ? count / tickData.count * 100 : 0;
              const lower = index ? data.bucketBoundsMs[index - 1] : 0;
              const label = bound === null ? `> ${lower} ms` : `${lower}–${bound} ms`;
              return <div className="server-performance__histogram-row" key={index} title={`${label}: ${number(count, 0)} (${number(percent, 2)} %)`}><span>{label}</span><div className="server-performance__track"><span className={index >= 6 ? 'is-slow' : index >= 4 ? 'is-medium' : ''} style={{ width: `${percent}%` }} /></div><strong>{number(percent)} %</strong></div>;
            })}
          </div><p className="server-performance__help">{tickData.count ? text('tickCount', { count: tickData.count }) : text('noTicks')}</p>
        </section>
      </div>
      <section className="server-performance__card server-performance__chart-card" aria-labelledby={`${id}-history`}>
        <header><div><h4 id={`${id}-history`}>{text('history')}</h4><p className="server-performance__caption">{selectedAt === null ? text('chartHelp') : `${date(selectedAt, true)} · ${number(selected ? performanceValue(selected, metric) : null)} ${unit}`}</p></div>
          <label><span className="server-performance__sr-only">{text('metric')}</span><select aria-label={text('metric')} value={metric} onChange={event => setMetric(event.target.value as PerformanceMetric)}>{(['tick', 'cpu', 'memory', 'players', 'eventLoop'] as const).map(value => <option value={value} key={value}>{text(`metric_${value}`)}</option>)}</select></label>
        </header>
        <div className="server-performance__legend"><span>{text(metric === 'tick' ? 'tickAverage' : metric === 'players' ? 'playersNow' : 'game')}</span>{metric !== 'players' && <span>{text(metric === 'tick' ? 'tickPeak' : 'web')}</span>}<small>{unit}</small></div>
        <div className="server-performance__plot">
        <svg ref={chart} viewBox={`0 0 ${chartWidth} 270`} className="server-performance__chart" role="slider" tabIndex={points.length ? 0 : -1} aria-label={text('timelineLabel')} aria-describedby={`${id}-history-help`} aria-valuemin={data.from} aria-valuemax={data.to} aria-valuenow={selectedAt === null ? data.to : Math.max(data.from, Math.min(data.to, selectedAt))} aria-valuetext={selectedAt === null ? text('live') : date(selectedAt, true)} onClick={setFromPointer} onMouseMove={event => { if (event.buttons === 1) setFromPointer(event); }} onKeyDown={keySelection}>
          {[0, 0.25, 0.5, 0.75, 1].map(fraction => <g key={fraction}><line x1="54" x2={chartWidth - 26} y1={228 - fraction * 200} y2={228 - fraction * 200} className="server-performance__grid-line" /><text x="44" y={232 - fraction * 200} textAnchor="end">{number(maximum * fraction)}</text>{(chartWidth >= 480 || fraction === 0 || fraction === .5 || fraction === 1) && <text x={54 + fraction * (chartWidth - 80)} y="252" textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'}>{date(data.from + fraction * (data.to - data.from))}</text>}</g>)}
          <path d={performancePath(points, metric, false, data.from, data.to, maximum, chartWidth)} className="server-performance__series" />
          {metric !== 'players' && <path d={performancePath(points, metric, true, data.from, data.to, maximum, chartWidth)} className="server-performance__series server-performance__series--secondary" />}
          {markers}
          {cursor !== null && cursor >= 54 && cursor <= chartWidth - 26 && <line x1={cursor} x2={cursor} y1="22" y2="228" className="server-performance__cursor" />}
        </svg>
        {!points.some(point => performanceValue(point, metric) !== null || performanceValue(point, metric, true) !== null) && <p className="server-performance__empty-label">{text('noHistory')}</p>}
        </div>
        <p id={`${id}-history-help`} className="server-performance__help">{text('historyHelp')}</p>
      </section>
    </>}
  </section>;
}
