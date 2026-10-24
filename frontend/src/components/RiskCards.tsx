import React from 'react';
import { BiasCorrectionBacktest, SummaryMetrics } from '../types';

interface RiskCardsProps {
  summary: SummaryMetrics | null;
  backtest: BiasCorrectionBacktest | null;
  isLoading: boolean;
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-GB');

interface CardProps {
  title: string;
  value: string;
  unit?: string;
  caption: string;
  accent: string;
}

const Card: React.FC<CardProps> = ({ title, value, unit, caption, accent }) => (
  <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-1">
    <span className="text-xs font-medium text-slate-400">{title}</span>
    <div className={`text-xl font-bold font-mono tracking-tight ${accent}`}>
      {value} {unit && <span className="text-xs font-normal text-slate-400">{unit}</span>}
    </div>
    <p className="text-[11px] leading-snug text-slate-500">{caption}</p>
  </div>
);

export const RiskCards: React.FC<RiskCardsProps> = ({ summary, backtest, isLoading }) => {
  if (isLoading || !summary || !backtest) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const hasBacktest = backtest.daysEvaluated > 0;

  return (
    <section aria-label="Decision risk metrics" className="space-y-2">
      <h2 className="text-xs font-mono uppercase tracking-wider text-slate-400">
        Decision risk: how wrong can the forecast be?
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card
          title="P90 absolute error"
          value={fmt(summary.p90AbsErrorMW)}
          unit="MW"
          accent="text-amber-300"
          caption="9 in 10 half-hours are within this error of the forecast."
        />
        <Card
          title="P95 absolute error"
          value={fmt(summary.p95AbsErrorMW)}
          unit="MW"
          accent="text-rose-300"
          caption="Plan reserve for roughly this size of shortfall in a bad half-hour."
        />
        <Card
          title="Bias-corrected MAE (backtest)"
          value={hasBacktest ? fmt(backtest.correctedMaeMW) : '–'}
          unit={hasBacktest ? 'MW' : undefined}
          accent="text-teal-300"
          caption={
            hasBacktest
              ? `${backtest.maeImprovementPercent}% lower than raw (${fmt(backtest.rawMaeMW)} MW). Uses only actuals known on D-1, trailing ${backtest.lookbackDays} days.`
              : 'Not enough prior days in the selected range.'
          }
        />
        <Card
          title="P10–P90 band coverage"
          value={hasBacktest ? `${backtest.bandCoveragePercent}%` : '–'}
          accent="text-sky-300"
          caption="Share of actuals that fell inside the band (nominal target 80%). Band is slightly narrow; treat as indicative."
        />
      </div>
    </section>
  );
};
