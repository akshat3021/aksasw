import React from 'react';
import { Calendar, ChevronRight } from 'lucide-react';

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  onRangeChange: (from: string, to: string) => void;
  isLoading: boolean;
}

const PRESET_WINDOWS = [
  { label: 'Entire Window (31 Days)', from: '2026-01-02', to: '2026-02-01' },
  { label: 'Week 1 (2-8 Jan)', from: '2026-01-02', to: '2026-01-08' },
  { label: 'Week 2 (9-15 Jan)', from: '2026-01-09', to: '2026-01-15' },
  { label: 'Week 3 (16-22 Jan)', from: '2026-01-16', to: '2026-01-22' },
  { label: 'Week 4 (23-29 Jan)', from: '2026-01-23', to: '2026-01-29' },
  { label: 'Peak Wind (10 Jan)', from: '2026-01-10', to: '2026-01-10' },
  { label: 'Window End (30 Jan - 1 Feb)', from: '2026-01-30', to: '2026-02-01' },
];

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  dateFrom,
  dateTo,
  onRangeChange,
  isLoading,
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg shadow-black/20">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Power Delivery Window
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-mono">
              Jan 2026 Trading
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Decisions made 1-31 Jan 2026 for physical power delivery across 48 settlement periods daily.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PRESET_WINDOWS.map((preset) => {
            const isActive = dateFrom === preset.from && dateTo === preset.to;
            return (
              <button
                key={preset.label}
                type="button"
                disabled={isLoading}
                onClick={() => onRangeChange(preset.from, preset.to)}
                className={`text-xs px-2.5 py-1.5 rounded-lg font-mono transition-all ${
                  isActive
                    ? 'bg-teal-500 text-slate-950 font-bold shadow-md shadow-teal-500/20 ring-2 ring-teal-400/40'
                    : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50'
                }`}
              >
                {preset.label}
              </button>
            );
          })}

          <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-700">
            <input
              type="date"
              min="2026-01-02"
              max="2026-02-01"
              value={dateFrom}
              disabled={isLoading}
              onChange={(e) => onRangeChange(e.target.value, dateTo)}
              className="bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
            />
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            <input
              type="date"
              min="2026-01-02"
              max="2026-02-01"
              value={dateTo}
              disabled={isLoading}
              onChange={(e) => onRangeChange(dateFrom, e.target.value)}
              className="bg-transparent text-xs text-slate-200 font-mono focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
