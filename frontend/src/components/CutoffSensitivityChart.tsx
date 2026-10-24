import React from 'react';
import { CutoffSensitivityItem } from '../types';
import { TrendingDown } from 'lucide-react';

interface CutoffSensitivityChartProps {
  sensitivityData: CutoffSensitivityItem[];
  activeCutoff: string;
  onSelectCutoff: (cutoff: string) => void;
  isLoading: boolean;
}

export const CutoffSensitivityChart: React.FC<CutoffSensitivityChartProps> = ({
  sensitivityData,
  activeCutoff,
  onSelectCutoff,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 h-80 animate-pulse flex items-center justify-center">
        <div className="text-slate-500 font-mono text-xs">Computing cutoff sensitivity matrix...</div>
      </div>
    );
  }

  if (sensitivityData.length === 0) {
    return null;
  }

  const maxMAE = Math.max(...sensitivityData.map((d) => d.maeMW), 100);
  const minMAE = Math.min(...sensitivityData.map((d) => d.maeMW));
  const height = 220;
  const width = 600;
  const pad = { top: 20, right: 25, bottom: 35, left: 55 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const stepX = chartW / (sensitivityData.length - 1);
  const getY = (mae: number) => pad.top + chartH - ((mae - minMAE * 0.9) / (maxMAE * 1.05 - minMAE * 0.9)) * chartH;

  let pathD = '';
  sensitivityData.forEach((d, idx) => {
    const x = pad.left + idx * stepX;
    const y = getY(d.maeMW);
    pathD += idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
  });

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Decision Cutoff Timing vs Accuracy Trade-off
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Evaluating forecast error across D-1 cutoff times (05:00 to 17:00). Click any point to adopt cutoff.
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-mono text-slate-400">Current Cutoff: </span>
          <span className="text-xs font-mono font-bold text-amber-400">{activeCutoff}</span>
        </div>
      </div>

      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {/* Grid lines */}
          {[0, 0.5, 1].map((pct) => {
            const val = Math.round(minMAE * 0.9 + (maxMAE * 1.05 - minMAE * 0.9) * pct);
            const y = getY(val);
            return (
              <g key={pct}>
                <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#1e293b" strokeDasharray="2 2" />
                <text x={pad.left - 6} y={y + 4} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
                  {val} MW
                </text>
              </g>
            );
          })}

          {/* Sparkline curve */}
          <path d={pathD} fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

          {/* Interactive Dots for each cutoff */}
          {sensitivityData.map((d, idx) => {
            const x = pad.left + idx * stepX;
            const y = getY(d.maeMW);
            const isCurrent = d.cutoffTime === activeCutoff;

            return (
              <g
                key={d.cutoffTime}
                className="cursor-pointer group"
                onClick={() => onSelectCutoff(d.cutoffTime)}
              >
                {/* Hit area */}
                <circle cx={x} cy={y} r="14" fill="transparent" />

                {/* Visible dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={isCurrent ? 6 : 4}
                  fill={isCurrent ? '#f59e0b' : '#0f172a'}
                  stroke="#f59e0b"
                  strokeWidth={isCurrent ? 3 : 2}
                  className="transition-all group-hover:scale-125"
                />

                {isCurrent && (
                  <circle cx={x} cy={y} r="10" fill="none" stroke="#f59e0b" strokeWidth="1" strokeDasharray="2 2" />
                )}

                {/* X label */}
                <text
                  x={x}
                  y={pad.top + chartH + 18}
                  fill={isCurrent ? '#f59e0b' : '#64748b'}
                  fontSize="10"
                  fontWeight={isCurrent ? 'bold' : 'normal'}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {d.cutoffTime}
                </text>

                {/* Value tooltip label above point */}
                <text
                  x={x}
                  y={y - 10}
                  fill={isCurrent ? '#f59e0b' : '#94a3b8'}
                  fontSize="9"
                  fontWeight={isCurrent ? 'bold' : 'normal'}
                  textAnchor="middle"
                  fontFamily="monospace"
                >
                  {d.maeMW} MW
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/80 mt-2">
        <span>&larr; Earlier buying decision (more forecast uncertainty)</span>
        <span>Later buying decision (fresher meteorological telemetry) &rarr;</span>
      </div>
    </div>
  );
};
