import React, { useState } from 'react';
import { DailyMetricRecord } from '../types';
import { fmtDay, fmtMW } from './ui';

const W = 900;
const H = 260;
const M = { top: 12, right: 12, bottom: 30, left: 56 };
const HIGH = '#2563eb'; // forecast too high on average
const LOW = '#d97706'; // forecast too low on average

export const DailyErrorChart: React.FC<{ days: DailyMetricRecord[] }> = ({ days }) => {
  const [active, setActive] = useState<number | null>(null);
  if (days.length === 0) return null;

  const yMax = Math.ceil((Math.max(...days.map((d) => d.maeMW), 1000) * 1.1) / 1000) * 1000;
  const plotW = W - M.left - M.right;
  const slot = plotW / days.length;
  const barW = Math.max(Math.min(slot * 0.7, 28), 4);
  const y = (v: number) => H - M.bottom - (v / yMax) * (H - M.top - M.bottom);
  const ticks = Array.from({ length: yMax / 1000 + 1 }, (_, i) => i * 1000);
  const labelEvery = Math.ceil(days.length / 8);
  const d = active !== null ? days[active] : null;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
        aria-label="Average forecast error for each delivery day">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#64748b">
              {(t / 1000).toFixed(0)} GW
            </text>
          </g>
        ))}
        {days.map((day, i) => {
          const cx = M.left + slot * i + slot / 2;
          return (
            <g key={day.settlementDate} onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
              <rect x={M.left + slot * i} y={M.top} width={slot} height={H - M.top - M.bottom} fill="transparent" />
              <rect
                x={cx - barW / 2} y={y(day.maeMW)} width={barW} height={H - M.bottom - y(day.maeMW)} rx="2"
                fill={day.biasMW >= 0 ? HIGH : LOW} opacity={active === null || active === i ? 1 : 0.45}
              />
              {i % labelEvery === 0 && (
                <text x={cx} y={H - 10} textAnchor="middle" fontSize="11" fill="#64748b">
                  {new Date(`${day.settlementDate}T00:00:00Z`).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', timeZone: 'UTC',
                  })}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: HIGH }} />Forecast too high on average</span>
        <span className="flex items-center gap-2"><i className="inline-block h-3 w-3 rounded-sm" style={{ background: LOW }} />Forecast too low on average</span>
      </div>
      <div className="mt-2 min-h-[1.5rem] text-sm text-slate-700" aria-live="polite">
        {d ? (
          <>
            <strong>{fmtDay(d.settlementDate)}</strong>: off by {fmtMW(d.maeMW)} MW on average; forecast{' '}
            {d.biasMW >= 0 ? 'too high' : 'too low'} by {fmtMW(Math.abs(d.biasMW))} MW on average.
          </>
        ) : (
          <span className="text-slate-400">Hover over a bar for that day.</span>
        )}
      </div>
    </div>
  );
};
