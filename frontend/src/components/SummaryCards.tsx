import React from 'react';
import {
  TrendingUp,
  Percent,
  Zap,
  Scale,
  Activity,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { SummaryMetrics } from '../types';

interface SummaryCardsProps {
  metrics: SummaryMetrics | null;
  isLoading: boolean;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({ metrics, isLoading }) => {
  if (isLoading || !metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-28 bg-slate-900/60 border border-slate-800 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  const isOverforecast = metrics.biasMW > 0;
  const actualGWh = (metrics.totalActualMWh / 1000).toFixed(1);
  const forecastGWh = (metrics.totalForecastMWh / 1000).toFixed(1);
  const imbalanceGWh = (metrics.netImbalanceMWh / 1000).toFixed(1);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. MAE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Mean Abs Error</span>
          <span className="p-1 rounded bg-teal-500/10 text-teal-400">
            <Activity className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="my-1.5">
          <div className="text-xl font-bold font-mono text-white tracking-tight">
            {metrics.maeMW.toLocaleString()} <span className="text-xs font-normal text-slate-400">MW</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          Avg absolute deviation per SP
        </div>
      </div>

      {/* 2. WAPE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">WAPE Accuracy</span>
          <span className="p-1 rounded bg-blue-500/10 text-blue-400">
            <Percent className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="my-1.5">
          <div className="text-xl font-bold font-mono text-white tracking-tight">
            {metrics.wapePercent.toFixed(1)}<span className="text-xs font-normal text-slate-400">%</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          Weighted volume error
        </div>
      </div>

      {/* 3. RMSE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">RMSE Volatility</span>
          <span className="p-1 rounded bg-purple-500/10 text-purple-400">
            <TrendingUp className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="my-1.5">
          <div className="text-xl font-bold font-mono text-white tracking-tight">
            {metrics.rmseMW.toLocaleString()} <span className="text-xs font-normal text-slate-400">MW</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          Penalizes large outlier errors
        </div>
      </div>

      {/* 4. Bias */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Forecast Bias</span>
          <span className={`p-1 rounded ${isOverforecast ? 'bg-amber-500/10 text-amber-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
            <Compass className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="my-1.5">
          <div className={`text-xl font-bold font-mono tracking-tight ${isOverforecast ? 'text-amber-400' : 'text-cyan-400'}`}>
            {isOverforecast ? `+${metrics.biasMW}` : `${metrics.biasMW}`}{' '}
            <span className="text-xs font-normal text-slate-400">MW</span>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          {isOverforecast ? (
            <span className="flex items-center text-amber-400 font-medium">
              <ArrowUpRight className="w-3 h-3" /> Over-contracting
            </span>
          ) : (
            <span className="flex items-center text-cyan-400 font-medium">
              <ArrowDownRight className="w-3 h-3" /> Under-contracting
            </span>
          )}
        </div>
      </div>

      {/* 5. Total Energy Generated */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Actual Delivered</span>
          <span className="p-1 rounded bg-emerald-500/10 text-emerald-400">
            <Zap className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="my-1.5">
          <div className="text-xl font-bold font-mono text-emerald-400 tracking-tight">
            {actualGWh} <span className="text-xs font-normal text-slate-400">GWh</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400 font-mono">
          Forecast: {forecastGWh} GWh
        </div>
      </div>

      {/* 6. Net Imbalance */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Net Imbalance</span>
          <span className="p-1 rounded bg-slate-800 text-slate-300">
            <Scale className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className="my-1.5">
          <div className="text-xl font-bold font-mono text-white tracking-tight">
            {Number(imbalanceGWh) > 0 ? `+${imbalanceGWh}` : imbalanceGWh}{' '}
            <span className="text-xs font-normal text-slate-400">GWh</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-400">
          {metrics.overForecastPeriods} over / {metrics.underForecastPeriods} under
        </div>
      </div>
    </div>
  );
};
