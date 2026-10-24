import React, { useState } from 'react';
import { PeriodRecord } from '../types';
import { BarChart2, Filter } from 'lucide-react';

interface ForecastChartProps {
  records: PeriodRecord[];
  isLoading: boolean;
  cutoffTime: string;
}

export const ForecastChart: React.FC<ForecastChartProps> = ({ records, isLoading, cutoffTime }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [spFilter, setSpFilter] = useState<'all' | 'night' | 'day' | 'peak'>('all');

  const filteredRecords = React.useMemo(() => {
    if (spFilter === 'night') return records.filter((r) => r.settlementPeriod >= 1 && r.settlementPeriod <= 16);
    if (spFilter === 'day') return records.filter((r) => r.settlementPeriod >= 17 && r.settlementPeriod <= 32);
    if (spFilter === 'peak') return records.filter((r) => r.settlementPeriod >= 33 && r.settlementPeriod <= 48);
    return records;
  }, [records, spFilter]);

  if (isLoading) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 h-96 animate-pulse flex items-center justify-center">
        <div className="text-slate-500 font-mono text-xs">Loading chart telemetry...</div>
      </div>
    );
  }

  if (filteredRecords.length === 0) {
    return (
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-sm">
        No forecast records available for the selected range.
      </div>
    );
  }

  // Calculate scales
  const maxActual = Math.max(...filteredRecords.map((r) => r.actualMW || 0), 1000);
  const maxForecast = Math.max(...filteredRecords.map((r) => r.forecastMW || 0), 1000);
  const maxVal = Math.ceil(Math.max(maxActual, maxForecast) * 1.1 / 1000) * 1000;

  const width = 1000;
  const height = 340;
  const padding = { top: 20, right: 30, bottom: 40, left: 60 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const pointsCount = filteredRecords.length;
  const stepX = pointsCount > 1 ? chartW / (pointsCount - 1) : chartW;

  const getY = (val: number) => padding.top + chartH - (val / maxVal) * chartH;
  const getX = (idx: number) => padding.left + idx * stepX;

  // Build SVG path strings
  let actualPath = '';
  let actualAreaPath = '';
  let forecastPath = '';

  filteredRecords.forEach((r, idx) => {
    const x = getX(idx);
    const yActual = getY(r.actualMW);
    const yForecast = getY(r.forecastMW ?? r.actualMW);

    if (idx === 0) {
      actualPath = `M ${x} ${yActual}`;
      actualAreaPath = `M ${x} ${padding.top + chartH} L ${x} ${yActual}`;
      forecastPath = `M ${x} ${yForecast}`;
    } else {
      actualPath += ` L ${x} ${yActual}`;
      actualAreaPath += ` L ${x} ${yActual}`;
      forecastPath += ` L ${x} ${yForecast}`;
    }
  });

  actualAreaPath += ` L ${padding.left + (pointsCount - 1) * stepX} ${padding.top + chartH} Z`;

  const hoveredRecord = hoveredIdx !== null ? filteredRecords[hoveredIdx] : null;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg shadow-black/20">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-teal-400" />
            <h3 className="text-sm font-semibold text-white tracking-wide">
              Wind Generation: Actual vs Day-Ahead Decision Forecast
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Comparing FUELHH metered outturn with WINDFOR published &le; {cutoffTime} (D-1)
          </p>
        </div>

        {/* SP Section Filters */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
          <Filter className="w-3 h-3 text-slate-500 ml-1.5" />
          <button
            type="button"
            onClick={() => setSpFilter('all')}
            className={`px-2 py-0.5 rounded text-[11px] ${
              spFilter === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            All SPs ({filteredRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setSpFilter('night')}
            className={`px-2 py-0.5 rounded text-[11px] ${
              spFilter === 'night' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            SP 1-16 (Night)
          </button>
          <button
            type="button"
            onClick={() => setSpFilter('day')}
            className={`px-2 py-0.5 rounded text-[11px] ${
              spFilter === 'day' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            SP 17-32 (Day)
          </button>
          <button
            type="button"
            onClick={() => setSpFilter('peak')}
            className={`px-2 py-0.5 rounded text-[11px] ${
              spFilter === 'peak' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
            }`}
          >
            SP 33-48 (Peak)
          </button>
        </div>
      </div>

      {/* SVG Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto cursor-crosshair select-none"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          <defs>
            <linearGradient id="actualGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
            const val = Math.round(maxVal * pct);
            const y = getY(val);
            return (
              <g key={pct}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  fill="#64748b"
                  fontSize="10"
                  textAnchor="end"
                  fontFamily="monospace"
                >
                  {val.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Actual Area */}
          <path d={actualAreaPath} fill="url(#actualGradient)" />

          {/* Actual Line (Emerald / Teal) */}
          <path
            d={actualPath}
            fill="none"
            stroke="#14b8a6"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Decision Forecast Line (Amber/Orange dashed line) */}
          <path
            d={forecastPath}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
            strokeDasharray="4 2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Invisible hover zones */}
          {filteredRecords.map((_, idx) => {
            const x = getX(idx);
            const w = Math.max(stepX, 4);
            return (
              <rect
                key={idx}
                x={x - w / 2}
                y={padding.top}
                width={w}
                height={chartH}
                fill="transparent"
                onMouseEnter={() => setHoveredIdx(idx)}
              />
            );
          })}

          {/* Hover indicator line & dot */}
          {hoveredIdx !== null && hoveredRecord && (
            <g>
              <line
                x1={getX(hoveredIdx)}
                y1={padding.top}
                x2={getX(hoveredIdx)}
                y2={padding.top + chartH}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              <circle
                cx={getX(hoveredIdx)}
                cy={getY(hoveredRecord.actualMW)}
                r="4.5"
                fill="#14b8a6"
                stroke="#030712"
                strokeWidth="2"
              />
              {hoveredRecord.forecastMW !== null && (
                <circle
                  cx={getX(hoveredIdx)}
                  cy={getY(hoveredRecord.forecastMW)}
                  r="4.5"
                  fill="#f59e0b"
                  stroke="#030712"
                  strokeWidth="2"
                />
              )}
            </g>
          )}

          {/* X-axis labels (Sample every N points) */}
          {filteredRecords.map((r, idx) => {
            const interval = Math.max(Math.floor(pointsCount / 8), 1);
            if (idx % interval !== 0 && idx !== pointsCount - 1) return null;
            const x = getX(idx);
            const label = r.startTime.slice(5, 16).replace('T', ' ');
            return (
              <text
                key={idx}
                x={x}
                y={padding.top + chartH + 18}
                fill="#64748b"
                fontSize="9"
                textAnchor="middle"
                fontFamily="monospace"
              >
                {label}
              </text>
            );
          })}
        </svg>

        {/* Hover Details Floating Banner */}
        {hoveredRecord && (
          <div className="mt-2.5 p-3 rounded-lg bg-slate-950/90 border border-slate-800 text-xs font-mono flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-slate-400">
                {hoveredRecord.settlementDate} (SP {hoveredRecord.settlementPeriod})
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-300 font-semibold">
                Start: {hoveredRecord.startTime.replace('Z', '').replace('T', ' ')} UTC
              </span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-teal-400" />
                <span className="text-slate-400">Actual:</span>
                <span className="text-teal-400 font-bold">{hoveredRecord.actualMW.toLocaleString()} MW</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                <span className="text-slate-400">Decision Forecast:</span>
                <span className="text-amber-400 font-bold">
                  {hoveredRecord.forecastMW !== null ? `${hoveredRecord.forecastMW.toLocaleString()} MW` : 'N/A'}
                </span>
              </div>

              {hoveredRecord.imbalanceMW !== null && (
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Imbalance (F - A):</span>
                  <span
                    className={`font-bold ${
                      hoveredRecord.imbalanceMW > 0 ? 'text-amber-400' : 'text-cyan-400'
                    }`}
                  >
                    {hoveredRecord.imbalanceMW > 0 ? `+${hoveredRecord.imbalanceMW}` : hoveredRecord.imbalanceMW} MW
                  </span>
                </div>
              )}

              {hoveredRecord.publishTime && (
                <span className="text-[11px] text-slate-500">
                  Published: {hoveredRecord.publishTime.replace('Z', '').replace('T', ' ')}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 mt-2 text-xs font-mono">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-teal-400 rounded-full" />
            <span className="text-slate-300">Actual Outturn (FUELHH)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-0.5 w-4 bg-amber-400 border-dashed border-t-2 border-amber-400" />
            <span className="text-slate-300">Decision Forecast (WINDFOR &le; {cutoffTime})</span>
          </div>
        </div>
        <div className="text-[11px] text-slate-500">
          Showing {filteredRecords.length} settlement periods
        </div>
      </div>
    </div>
  );
};
