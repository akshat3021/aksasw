import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, AlertTriangle } from 'lucide-react';
import { fetchDecisionBrief } from '../api';
import { DecisionBrief as DecisionBriefData } from '../types';

const MIN_DATE = '2026-01-02';
const MAX_DATE = '2026-02-01';

const W = 900;
const H = 320;
const M = { top: 16, right: 16, bottom: 34, left: 56 };

const fmtMW = (n: number | null | undefined) =>
  n === null || n === undefined ? '–' : Math.round(n).toLocaleString('en-GB');

const fmtUtc = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      }) + ' UTC'
    : '–';

const shiftDate = (iso: string, days: number): string => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

interface Props {
  cutoffTime: string;
}

export const DecisionBrief: React.FC<Props> = ({ cutoffTime }) => {
  const [date, setDate] = useState<string>('2026-01-15');
  const [brief, setBrief] = useState<DecisionBriefData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showActual, setShowActual] = useState<boolean>(true);
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
    return { p, x, y, line, band, ticks };
  }, [brief, showActual]);

  const hovered = brief && hover !== null ? brief.periods[hover] : null;

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    if (!brief) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = (e.clientX - rect.left) / rect.width;
    setHover(Math.min(brief.periods.length - 1, Math.max(0, Math.round(frac * (brief.periods.length - 1)))));
  };

  return (
    <section aria-label="Decision brief" className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous delivery day"
            disabled={date <= MIN_DATE}
            onClick={() => setDate(shiftDate(date, -1))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <label className="text-xs font-mono text-slate-400 flex items-center gap-2">
            Delivery day
            <input
              type="date"
              value={date}
              min={MIN_DATE}
              max={MAX_DATE}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </label>
          <button
            type="button"
            aria-label="Next delivery day"
            disabled={date >= MAX_DATE}
            onClick={() => setDate(shiftDate(date, 1))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        {brief && (
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Clock className="w-4 h-4 text-teal-400" />
            Decision taken {fmtUtc(brief.decisionTimestamp)} (UK = UTC in January)
          </div>
        )}
        <label className="ml-auto flex items-center gap-2 text-xs font-mono text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showActual} onChange={(e) => setShowActual(e.target.checked)} />
          Show actual (backtest only)
        </label>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-200 text-sm flex gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
        </div>
      )}

      {loading && !brief && <div className="h-80 rounded-xl bg-slate-900/60 border border-slate-800 animate-pulse" />}

      {brief && (
        <>
          {/* Latest-run banner: answers "which forecast do I actually have?" */}
          <div className="p-4 rounded-xl bg-teal-950/30 border border-teal-800/60 text-sm text-teal-100">
            Latest WINDFOR run available at the cutoff: <strong>{fmtUtc(brief.latestPublishTime)}</strong>
            {brief.forecastRunsUsed > 1 && <> (runs used span from {fmtUtc(brief.earliestPublishTime)})</>}.
            Anything published later is not available to the buyer and is excluded.
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Tile label="Mean forecast" value={`${fmtMW(brief.meanForecastMW)} MW`} note="Latest run at cutoff" />
            <Tile
              label="Bias-corrected mean"
              value={brief.hasHistory ? `${fmtMW(brief.meanCorrectedMW)} MW` : '–'}
              note={
                brief.hasHistory
                  ? `Forecast minus ${fmtMW(brief.estimatedBiasMW)} MW typical over-forecast (last ${brief.lookbackDays} days)`
                  : 'Needs one full prior day of actuals'
              }
            />
            <Tile
              label="Forecast error today (MAE)"
              value={`${fmtMW(brief.rawMaeMW)} MW`}
              note={brief.hasHistory ? `${fmtMW(brief.correctedMaeMW)} MW after bias correction` : 'Backtest, after delivery'}
            />
            <Tile
              label="Band coverage today"
              value={brief.bandCoveragePercent === null ? '–' : `${brief.bandCoveragePercent}%`}
              note="Actuals inside P10–P90 band"
            />
          </div>

          {!brief.hasHistory && (
            <div role="status" className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs">
              Fewer than one full day of actuals existed at decision time (actuals are only known up to D-2), so
              only the raw forecast is shown.
            </div>
          )}

          {/* Chart */}
          {chart && (
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-3">
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="w-full h-auto"
                role="img"
                aria-label={`Forecast versus actual wind generation for ${brief.deliveryDate}`}
              >
                {chart.ticks.map((t) => (
                  <g key={t}>
                    <line x1={M.left} x2={W - M.right} y1={chart.y(t)} y2={chart.y(t)} stroke="#1e293b" />
                    <text x={M.left - 8} y={chart.y(t) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                      {(t / 1000).toFixed(0)} GW
                    </text>
                  </g>
                ))}
                {[0, 6, 12, 18, 24, 30, 36, 42, 47].map((i) => (
                  <text key={i} x={chart.x(i)} y={H - 12} textAnchor="middle" fontSize="10" fill="#94a3b8">
                    {String(Math.floor(i / 2)).padStart(2, '0')}:{i % 2 ? '30' : '00'}
                  </text>
                ))}
                {chart.band && <polygon points={chart.band} fill="#14b8a6" opacity="0.15" />}
                <polyline points={chart.line((r) => r.forecastMW)} fill="none" stroke="#fbbf24" strokeWidth="2" />
                {brief.hasHistory && (
                  <polyline points={chart.line((r) => r.correctedForecastMW)} fill="none" stroke="#2dd4bf" strokeWidth="2" />
                )}
                {showActual && (
                  <polyline points={chart.line((r) => r.actualMW)} fill="none" stroke="#f8fafc" strokeWidth="1.5" strokeDasharray="4 3" />
                )}
                {hover !== null && (
                  <line x1={chart.x(hover)} x2={chart.x(hover)} y1={M.top} y2={H - M.bottom} stroke="#475569" />
                )}
                <rect
                  x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom}
                  fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)}
                />
              </svg>

              <div className="flex flex-wrap gap-x-5 gap-y-1 px-2 pt-1 text-[11px] font-mono text-slate-400">
                <Legend color="#fbbf24" label="Forecast at cutoff (raw)" />
                {brief.hasHistory && <Legend color="#2dd4bf" label="Bias-corrected" />}
                {brief.hasHistory && <Legend color="#14b8a6" label="P10–P90 band" faded />}
                {showActual && <Legend color="#f8fafc" label="Actual (FUELHH)" dashed />}
              </div>

              <div className="min-h-[2.5rem] px-2 pt-2 text-xs font-mono text-slate-300" aria-live="polite">
                {hovered ? (
                  <>
                    SP{hovered.settlementPeriod} · {fmtUtc(hovered.startTime)} · forecast {fmtMW(hovered.forecastMW)} MW
                    {brief.hasHistory && <> · corrected {fmtMW(hovered.correctedForecastMW)} MW · band {fmtMW(hovered.lowerMW)}–{fmtMW(hovered.upperMW)} MW</>}
                    {showActual && <> · actual {fmtMW(hovered.actualMW)} MW</>}
                    <br />
                    <span className="text-slate-500">Forecast run published {fmtUtc(hovered.publishTime)}</span>
                  </>
                ) : (
                  <span className="text-slate-500">Hover the chart for half-hour detail.</span>
                )}
              </div>
            </div>
          )}

          <p className="text-[11px] leading-relaxed text-slate-500">
            Method: the bias estimate is the mean forecast error over the previous {brief.lookbackDays} days of actuals
            available on D-1 (up to D-2). Band widths are the P10/P90 of corrected-forecast errors over all history
            available at that time. WINDFOR is hourly, so each :30 half-hour uses its hour&apos;s forecast. Actuals are shown only to
            backtest the method; they are not known when the decision is made.
          </p>
        </>
      )}
    </section>
  );
};

const Tile: React.FC<{ label: string; value: string; note: string }> = ({ label, value, note }) => (
  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5">
    <div className="text-xs font-medium text-slate-400">{label}</div>
    <div className="text-xl font-bold font-mono text-white my-1">{value}</div>
    <div className="text-[11px] leading-snug text-slate-500">{note}</div>
  </div>
);

const Legend: React.FC<{ color: string; label: string; dashed?: boolean; faded?: boolean }> = ({
  color, label, dashed, faded,
}) => (
  <span className="flex items-center gap-1.5">
    <span
      className="inline-block w-5"
      style={{
        height: faded ? 8 : 0,
        borderTop: faded ? undefined : `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        background: faded ? color : undefined,
        opacity: faded ? 0.3 : 1,
      }}
    />
    {label}
  </span>
);
