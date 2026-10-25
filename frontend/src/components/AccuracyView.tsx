import React, { useEffect, useState } from 'react';
import { fetchBiasCorrection, fetchDailyMetrics, fetchSummaryMetrics } from '../api';
import { BiasCorrectionBacktest, DailyMetricRecord, SummaryMetrics } from '../types';
import { DailyErrorChart } from './DailyErrorChart';
import { Card, ErrorBanner, Skeleton, Stat, fmtMW } from './ui';

const PERIODS = [
  { label: 'Whole month (2 Jan – 1 Feb)', from: '2026-01-02', to: '2026-02-01' },
  { label: '2 – 8 Jan', from: '2026-01-02', to: '2026-01-08' },
  { label: '9 – 15 Jan', from: '2026-01-09', to: '2026-01-15' },
  { label: '16 – 22 Jan', from: '2026-01-16', to: '2026-01-22' },
  { label: '23 – 29 Jan', from: '2026-01-23', to: '2026-01-29' },
  { label: '30 Jan – 1 Feb', from: '2026-01-30', to: '2026-02-01' },
];

export const AccuracyView: React.FC<{ cutoffTime: string }> = ({ cutoffTime }) => {
  const [period, setPeriod] = useState<number>(0);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [backtest, setBacktest] = useState<BiasCorrectionBacktest | null>(null);
  const [daily, setDaily] = useState<DailyMetricRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { from, to } = PERIODS[period];
    setLoading(true);
    setError(null);
    Promise.all([
      fetchSummaryMetrics(from, to, cutoffTime),
      fetchBiasCorrection(from, to, cutoffTime),
      fetchDailyMetrics(from, to, cutoffTime),
    ])
      .then(([s, b, d]) => {
        if (cancelled) return;
        setSummary(s);
        setBacktest(b);
        setDaily(d);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [period, cutoffTime]);

  const ready = summary && backtest && !loading;
  const overShare = summary
    ? Math.round((summary.overForecastPeriods / Math.max(summary.overForecastPeriods + summary.underForecastPeriods, 1)) * 100)
    : 0;
  const tooHigh = !!summary && summary.biasMW >= 0;

  const hasBt = !!backtest && backtest.daysEvaluated > 0;
  const improved = !!backtest && backtest.maeImprovementPercent >= 0;

  return (
    <section aria-label="Forecast accuracy" className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="period" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Period
          </label>
          <select
            id="period" value={period} onChange={(e) => setPeriod(Number(e.target.value))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PERIODS.map((p, i) => <option key={p.label} value={i}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {error && <ErrorBanner message={error} />}
      {!ready && !error && (
        <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
      )}

      {ready && summary && backtest && (
        <>
          <Card className="p-6">
            <p className="text-lg leading-relaxed text-slate-800">
              The forecast available at {cutoffTime} the day before was off by{' '}
              <strong>{fmtMW(summary.maeMW)} MW</strong> on average ({summary.wapePercent}% of actual wind output).
              It was <strong>too {tooHigh ? 'high' : 'low'} in {tooHigh ? overShare : 100 - overShare}%</strong> of half-hours,
              by {fmtMW(Math.abs(summary.biasMW))} MW on average.
            </p>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Average error" value={fmtMW(summary.maeMW)} unit="MW"
              note="Typical size of the miss in each half-hour."
            />
            <Stat
              label="Usual direction" tone="warn"
              value={`${summary.biasMW > 0 ? '+' : ''}${fmtMW(summary.biasMW)}`} unit="MW"
              note={tooHigh ? 'Forecast usually over-estimates wind output.' : 'Forecast usually under-estimates wind output.'}
            />
            <Stat
              label="Bad-case miss" value={fmtMW(summary.p90AbsErrorMW)} unit="MW"
              note={`In 9 of 10 half-hours the miss is smaller than this (worst 1 in 20: over ${fmtMW(summary.p95AbsErrorMW)} MW).`}
            />
            <Stat
              label="Error after adjusting" tone="good"
              value={hasBt ? fmtMW(backtest.correctedMaeMW) : '–'} unit={hasBt ? 'MW' : undefined}
              note={
                !hasBt
                  ? 'Not enough earlier days in this period to test.'
                  : improved
                    ? `${backtest.maeImprovementPercent}% smaller than the raw forecast (${fmtMW(backtest.rawMaeMW)} MW), using only results known the day before.`
                    : `${Math.abs(backtest.maeImprovementPercent)}% larger than the raw forecast (${fmtMW(backtest.rawMaeMW)} MW) in this period, so the adjustment did not help here.`
              }
            />
          </div>

          <Card className="p-4 sm:p-6">
            <h2 className="mb-3 text-base font-semibold">Average error by delivery day</h2>
            <DailyErrorChart days={daily} />
          </Card>

          <Card className="p-6">
            <h2 className="text-base font-semibold">What this means for buying</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700">
              {summary.biasMW > 0 && (
                <li>
                  Plan on about <strong>{fmtMW(summary.biasMW)} MW less wind</strong> than the forecast says; that is how
                  much it has run too high on average.
                </li>
              )}
              <li>
                Keep margin for a miss of up to about <strong>{fmtMW(summary.p90AbsErrorMW)} MW</strong> in a typical bad
                half-hour.
              </li>
              {hasBt && improved && (
                <li>
                  Correcting for recent bias reduced the average error by{' '}
                  <strong>{backtest.maeImprovementPercent}%</strong> over {backtest.daysEvaluated} tested days.
                  {backtest.bandCoveragePercent < 80 && ` The likely range held ${backtest.bandCoveragePercent}% of the time (aim: 80%), so treat it as a guide.`}
                </li>
              )}
            </ul>
          </Card>

          <details className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-800">More metrics</summary>
            <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              <Metric label="Mean absolute error (MAE)" value={`${fmtMW(summary.maeMW)} MW`} />
              <Metric label="Root mean square error (RMSE)" value={`${fmtMW(summary.rmseMW)} MW`} />
              <Metric label="Mean error / bias (forecast − actual)" value={`${summary.biasMW > 0 ? '+' : ''}${fmtMW(summary.biasMW)} MW`} />
              <Metric label="Error as % of actual output (WAPE)" value={`${summary.wapePercent}%`} />
              <Metric label="Median miss (P50)" value={`${fmtMW(summary.p50AbsErrorMW)} MW`} />
              <Metric label="90th / 95th percentile miss" value={`${fmtMW(summary.p90AbsErrorMW)} / ${fmtMW(summary.p95AbsErrorMW)} MW`} />
              <Metric label="Half-hours compared" value={`${summary.matchedPeriods.toLocaleString('en-GB')} of ${summary.totalPeriods.toLocaleString('en-GB')}`} />
              <Metric label="Forecast too high / too low" value={`${summary.overForecastPeriods.toLocaleString('en-GB')} / ${summary.underForecastPeriods.toLocaleString('en-GB')} half-hours`} />
            </dl>
            <p className="mt-3 text-xs text-slate-500">
              Half-hours without an eligible forecast are left out of every metric; the count above shows if any were.
            </p>
          </details>
        </>
      )}
    </section>
  );
};

const Metric: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 border-b border-slate-100 py-1">
    <dt>{label}</dt>
    <dd className="font-medium text-slate-900">{value}</dd>
  </div>
);
