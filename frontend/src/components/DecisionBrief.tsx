import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchDecisionBrief } from '../api';
import { DecisionBrief as DecisionBriefData } from '../types';
import { Card, ErrorBanner, Skeleton, Stat, fmtDay, fmtMW, fmtUtc } from './ui';

const MIN_DATE = '2026-01-02';
const MAX_DATE = '2026-02-01';

const W = 900;
const H = 320;
const M = { top: 16, right: 16, bottom: 34, left: 56 };

const COLORS = { forecast: '#2563eb', adjusted: '#059669', actual: '#0f172a' };

const shiftDate = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

const mean = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export const DecisionBrief: React.FC<{ cutoffTime: string }> = ({ cutoffTime }) => {
  const [date, setDate] = useState<string>('2026-01-15');
  const [brief, setBrief] = useState<DecisionBriefData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showActual, setShowActual] = useState<boolean>(false);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDecisionBrief(date, cutoffTime)
      .then((b) => !cancelled && setBrief(b))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date, cutoffTime]);

  const stats = useMemo(() => {
    if (!brief) return null;
    const p = brief.periods;
    const pick = (f: (r: (typeof p)[number]) => number | null) =>
      p.map(f).filter((v): v is number => v !== null);
    return {
      lower: mean(pick((r) => r.lowerMW)),
      upper: mean(pick((r) => r.upperMW)),
      actual: mean(pick((r) => r.actualMW)),
    };
  }, [brief]);

  const chart = useMemo(() => {
    if (!brief) return null;
    const p = brief.periods;
    const values: number[] = [];
    p.forEach((r) => {
      [r.forecastMW, r.correctedForecastMW, r.lowerMW, r.upperMW, showActual ? r.actualMW : null].forEach(
        (v) => v !== null && values.push(v)
      );
    });
    const yMax = Math.ceil((Math.max(...values, 1000) * 1.05) / 2000) * 2000;
    const x = (i: number) => M.left + (i / Math.max(p.length - 1, 1)) * (W - M.left - M.right);
    const y = (v: number) => H - M.bottom - (v / yMax) * (H - M.top - M.bottom);
    const line = (get: (r: (typeof p)[number]) => number | null) =>
      p.map((r, i) => (get(r) === null ? null : `${x(i)},${y(get(r) as number)}`)).filter(Boolean).join(' ');
    const bandOk = brief.hasHistory && p.every((r) => r.lowerMW !== null && r.upperMW !== null);
    const band = bandOk
      ? [...p.map((r, i) => `${x(i)},${y(r.upperMW as number)}`),
         ...p.map((_, i) => `${x(p.length - 1 - i)},${y(p[p.length - 1 - i].lowerMW as number)}`)].join(' ')
      : null;
    const ticks = Array.from({ length: yMax / 2000 + 1 }, (_, i) => i * 2000);
    return { x, y, line, band, ticks };
  }, [brief, showActual]);

  const hovered = brief && hover !== null ? brief.periods[hover] : null;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!brief) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setHover(Math.min(brief.periods.length - 1, Math.max(0, Math.round(frac * (brief.periods.length - 1)))));
  };

  const biasWord = brief && brief.estimatedBiasMW >= 0 ? 'too high' : 'too low';

  return (
    <section aria-label="Decision for one delivery day" className="space-y-6">
      {/* Day picker */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button" aria-label="Previous day" disabled={date <= MIN_DATE}
          onClick={() => setDate(shiftDate(date, -1))}
          className="rounded-full border border-slate-300 bg-white p-2 hover:bg-slate-100 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-500" htmlFor="delivery-day">
            Delivery day
          </label>
          <input
            id="delivery-day" type="date" value={date} min={MIN_DATE} max={MAX_DATE}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="button" aria-label="Next day" disabled={date >= MAX_DATE}
          onClick={() => setDate(shiftDate(date, 1))}
          className="rounded-full border border-slate-300 bg-white p-2 hover:bg-slate-100 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {brief && (
          <p className="ml-auto text-sm text-slate-600">
            Buying for <strong>{fmtDay(brief.deliveryDate)}</strong>, decided {fmtUtc(brief.decisionTimestamp)}
          </p>
        )}
      </div>

      {error && <ErrorBanner message={error} />}
      {loading && !brief && (
        <div className="space-y-4"><Skeleton className="h-16" /><Skeleton className="h-80" /></div>
      )}

      {brief && stats && chart && (
        <>
          <div className="rounded-2xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-900">
            The forecast you would have had: published <strong>{fmtUtc(brief.latestPublishTime)}</strong>, the latest
            one available before the decision time. Anything published later is not used.
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Stat
              label="Published forecast (day average)"
              value={fmtMW(brief.meanForecastMW)} unit="MW"
              note="What the latest available forecast says for the day."
            />
            <Stat
              label="Adjusted forecast"
              tone="good"
              value={brief.hasHistory ? fmtMW(brief.meanCorrectedMW) : '–'}
              unit={brief.hasHistory ? 'MW' : undefined}
              note={
                brief.hasHistory
                  ? `Forecasts were about ${fmtMW(Math.abs(brief.estimatedBiasMW))} MW ${biasWord} over the previous ${brief.lookbackDays} days, so this corrects for it.`
                  : 'Needs at least one full day of earlier results, which the first delivery days do not have.'
              }
            />
            <Stat
              label="Likely range (day average)"
              value={brief.hasHistory ? `${fmtMW(stats.lower)} – ${fmtMW(stats.upper)}` : '–'}
              unit={brief.hasHistory ? 'MW' : undefined}
              note="Where actual wind output has usually landed relative to the adjusted forecast."
            />
          </div>

          <Card className="p-4 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Wind generation across the day</h2>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={showActual} onChange={(e) => setShowActual(e.target.checked)} />
                Show what actually happened
              </label>
            </div>

            <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
              aria-label={`Forecast versus actual wind generation for ${brief.deliveryDate}`}>
              {chart.ticks.map((t) => (
                <g key={t}>
                  <line x1={M.left} x2={W - M.right} y1={chart.y(t)} y2={chart.y(t)} stroke="#e2e8f0" />
                  <text x={M.left - 8} y={chart.y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">
                    {(t / 1000).toFixed(0)} GW
                  </text>
                </g>
              ))}
              {[0, 6, 12, 18, 24, 30, 36, 42, 47].map((i) => (
                <text key={i} x={chart.x(i)} y={H - 12} textAnchor="middle" fontSize="11" fill="#64748b">
                  {String(Math.floor(i / 2)).padStart(2, '0')}:{i % 2 ? '30' : '00'}
                </text>
              ))}
              {chart.band && <polygon points={chart.band} fill={COLORS.adjusted} opacity="0.14" />}
              <polyline points={chart.line((r) => r.forecastMW)} fill="none" stroke={COLORS.forecast} strokeWidth="2.5" />
              {brief.hasHistory && (
                <polyline points={chart.line((r) => r.correctedForecastMW)} fill="none" stroke={COLORS.adjusted} strokeWidth="2.5" />
              )}
              {showActual && (
                <polyline points={chart.line((r) => r.actualMW)} fill="none" stroke={COLORS.actual} strokeWidth="2" strokeDasharray="5 4" />
              )}
              {hover !== null && (
                <line x1={chart.x(hover)} x2={chart.x(hover)} y1={M.top} y2={H - M.bottom} stroke="#94a3b8" />
              )}
              <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom}
                fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
            </svg>

            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
              <Legend color={COLORS.forecast} label="Published forecast" />
              {brief.hasHistory && <Legend color={COLORS.adjusted} label="Adjusted forecast" />}
              {brief.hasHistory && <Legend color={COLORS.adjusted} label="Likely range" faded />}
              {showActual && <Legend color={COLORS.actual} label="Actual" dashed />}
            </div>

            <div className="mt-3 min-h-[2.5rem] text-sm text-slate-700" aria-live="polite">
              {hovered ? (
                <>
                  <strong>{fmtUtc(hovered.startTime).replace(' UTC', '')}</strong>: forecast {fmtMW(hovered.forecastMW)} MW
                  {brief.hasHistory && <>, adjusted {fmtMW(hovered.correctedForecastMW)} MW (range {fmtMW(hovered.lowerMW)} – {fmtMW(hovered.upperMW)})</>}
                  {showActual && <>, actual {fmtMW(hovered.actualMW)} MW</>}
                </>
              ) : (
                <span className="text-slate-400">Hover over the chart to see each half-hour.</span>
              )}
            </div>

            {showActual && stats.actual !== null && (
              <p className="mt-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
                Hindsight check: actual average was <strong>{fmtMW(stats.actual)} MW</strong>. The published forecast
                missed by {fmtMW(brief.rawMaeMW)} MW on average
                {brief.hasHistory && <>; the adjusted forecast by {fmtMW(brief.correctedMaeMW)} MW</>}.
              </p>
            )}
          </Card>

          {!brief.hasHistory && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Results are only known up to two days before delivery, so for the first delivery days there is not enough
              history to adjust the forecast. Only the published forecast is shown.
            </div>
          )}

          <details className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-800">How this is calculated</summary>
            <p className="mt-3 leading-relaxed">
              The adjustment is the average forecast error over the previous {brief.lookbackDays} days of results that
              are known at decision time (up to two days before delivery). The likely range comes from the 10th to
              90th percentile of errors over all results known at that time. The forecast data is hourly, so each
              half-hour uses the forecast for its hour. Actual output is shown only to check the method; it is not
              known when the decision is made.
            </p>
          </details>
        </>
      )}
    </section>
  );
};

const Legend: React.FC<{ color: string; label: string; dashed?: boolean; faded?: boolean }> = ({
  color, label, dashed, faded,
}) => (
  <span className="flex items-center gap-2">
    <span
      className="inline-block w-6"
      style={{
        height: faded ? 10 : 0,
        borderTop: faded ? undefined : `3px ${dashed ? 'dashed' : 'solid'} ${color}`,
        background: faded ? color : undefined,
        opacity: faded ? 0.2 : 1,
      }}
    />
    {label}
  </span>
);
