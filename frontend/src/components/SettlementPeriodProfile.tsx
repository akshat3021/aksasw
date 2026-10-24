import React from 'react';
import { SettlementPeriodProfileRecord } from '../types';
import { Sun, Moon, Zap } from 'lucide-react';

interface SettlementPeriodProfileProps {
  profile: SettlementPeriodProfileRecord[];
  isLoading: boolean;
}

export const SettlementPeriodProfile: React.FC<SettlementPeriodProfileProps> = ({
  profile,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 h-72 animate-pulse flex items-center justify-center">
        <div className="text-slate-500 font-mono text-xs">Computing 48-period diurnal profile...</div>
      </div>
    );
  }

  if (profile.length === 0) {
    return null;
  }

  const maxMAE = Math.max(...profile.map((p) => p.maeMW), 100);
  const height = 180;
  const width = 800;
  const pad = { top: 15, right: 20, bottom: 30, left: 45 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const barWidth = Math.max(chartW / 48 - 3, 2);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg shadow-black/20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Diurnal Settlement Profile (SP 1 to 48)
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Mean Absolute Error (MW) across the 48 half-hour market settlement periods.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1 text-[11px]">
            <Moon className="w-3 h-3 text-indigo-400" /> SP 1-14: Night
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <Sun className="w-3 h-3 text-amber-400" /> SP 15-34: Day
          </span>
          <span className="flex items-center gap-1 text-[11px]">
            <Moon className="w-3 h-3 text-indigo-400" /> SP 35-48: Evening
          </span>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Grid lines */}
          {[0, 0.5, 1].map((pct) => {
            const val = Math.round(maxMAE * pct);
            const y = pad.top + chartH - (val / maxMAE) * chartH;
            return (
              <g key={pct}>
                <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#1e293b" strokeDasharray="2 2" />
                <text x={pad.left - 6} y={y + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                  {val}
                </text>
              </g>
            );
          })}

          {/* Bars for each settlement period */}
          {profile.map((p, idx) => {
            const x = pad.left + idx * (chartW / 48);
            const barH = (p.maeMW / maxMAE) * chartH;
            const y = pad.top + chartH - barH;
            const isPeak = (p.settlementPeriod >= 16 && p.settlementPeriod <= 22) || (p.settlementPeriod >= 34 && p.settlementPeriod <= 38);

            return (
              <g key={p.settlementPeriod} className="group cursor-pointer">
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barH}
                  rx="1.5"
                  fill={isPeak ? '#0d9488' : '#334155'}
                  className="transition-colors group-hover:fill-teal-400"
                />

                {/* X labels on key periods */}
                {(p.settlementPeriod === 1 || p.settlementPeriod % 8 === 0 || p.settlementPeriod === 48) && (
                  <text
                    x={x + barWidth / 2}
                    y={pad.top + chartH + 16}
                    fill="#64748b"
                    fontSize="9"
                    textAnchor="middle"
                    fontFamily="monospace"
                  >
                    SP{p.settlementPeriod}
                  </text>
                )}

                {/* Tooltip on hover */}
                <title>
                  {`SP ${p.settlementPeriod} (${p.timeLabel}): MAE ${p.maeMW} MW, Bias ${p.biasMW > 0 ? '+' : ''}${p.biasMW} MW, Actual ${p.meanActualMW} MW`}
                </title>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
