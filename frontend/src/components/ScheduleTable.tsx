import React, { useState, useMemo } from 'react';
import { PeriodRecord } from '../types';
import {
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface ScheduleTableProps {
  records: PeriodRecord[];
  isLoading: boolean;
  cutoffTime: string;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({ records, isLoading, cutoffTime }) => {
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'over' | 'under'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 24;

  const filtered = useMemo(() => {
    return records.filter((r) => {
      // Type filter
      if (filterType === 'over' && (r.imbalanceMW === null || r.imbalanceMW <= 0.05)) return false;
      if (filterType === 'under' && (r.imbalanceMW === null || r.imbalanceMW >= -0.05)) return false;

      // Search query
      if (search) {
        const query = search.toLowerCase();
        const matchesDate = r.settlementDate.toLowerCase().includes(query);
        const matchesSP = `sp ${r.settlementPeriod}`.includes(query) || `sp${r.settlementPeriod}`.includes(query);
        const matchesTime = r.startTime.toLowerCase().includes(query);
        if (!matchesDate && !matchesSP && !matchesTime) return false;
      }
      return true;
    });
  }, [records, filterType, search]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const pageRecords = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const exportCSV = () => {
    const headers = [
      'Settlement Date',
      'Settlement Period',
      'Start Time (UTC)',
      'Actual Outturn MW (FUELHH)',
      `Decision Forecast MW (WINDFOR <= ${cutoffTime})`,
      'Forecast Publish Time (NESO)',
      'Imbalance MW (Forecast - Actual)',
      'Absolute Error MW',
      'Error Percent (%)',
    ];

    const rows = filtered.map((r) => [
      r.settlementDate,
      r.settlementPeriod,
      r.startTime,
      r.actualMW,
      r.forecastMW ?? '',
      r.publishTime ?? '',
      r.imbalanceMW ?? '',
      r.absoluteErrorMW ?? '',
      r.percentageError ?? '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `gridbrick_wind_forecast_cutoff_${cutoffTime.replace(':', '')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-lg shadow-black/20">
      {/* Table Header Controls */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-wide">
            Settlement Period Trading Log
          </h3>
          <p className="text-xs text-slate-400 mt-0.5 font-mono">
            Full 30-minute schedule with WINDFOR &le; {cutoffTime} D-1 decision forecasts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter by date or SP..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 text-xs font-mono bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 w-48"
            />
          </div>

          {/* Imbalance Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => {
                setFilterType('all');
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded text-[11px] ${
                filterType === 'all' ? 'bg-slate-800 text-white font-medium' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({records.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterType('over');
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded text-[11px] ${
                filterType === 'over' ? 'bg-amber-500/20 text-amber-400 font-medium' : 'text-slate-400 hover:text-amber-400'
              }`}
            >
              Over-forecast
            </button>
            <button
              type="button"
              onClick={() => {
                setFilterType('under');
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded text-[11px] ${
                filterType === 'under' ? 'bg-cyan-500/20 text-cyan-400 font-medium' : 'text-slate-400 hover:text-cyan-400'
              }`}
            >
              Under-forecast
            </button>
          </div>

          {/* Export CSV button */}
          <button
            type="button"
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border border-teal-500/30 text-xs font-mono font-medium transition-colors disabled:opacity-40"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[11px]">
              <th className="py-2.5 px-3 font-semibold">Delivery Date</th>
              <th className="py-2.5 px-3 font-semibold text-center">SP</th>
              <th className="py-2.5 px-3 font-semibold">Time Window (UTC)</th>
              <th className="py-2.5 px-3 font-semibold text-right">Actual MW</th>
              <th className="py-2.5 px-3 font-semibold text-right">Decision Forecast</th>
              <th className="py-2.5 px-3 font-semibold text-right">Imbalance (F-A)</th>
              <th className="py-2.5 px-3 font-semibold text-right">Abs Error</th>
              <th className="py-2.5 px-3 font-semibold text-right">Error %</th>
              <th className="py-2.5 px-3 font-semibold text-center">Direction</th>
              <th className="py-2.5 px-3 font-semibold">NESO Published</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={10} className="py-3 px-3">
                    <div className="h-4 bg-slate-800/50 rounded w-full" />
                  </td>
                </tr>
              ))
            ) : pageRecords.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-500">
                  No settlement records match your filters.
                </td>
              </tr>
            ) : (
              pageRecords.map((r, idx) => {
                const isOver = r.imbalanceMW !== null && r.imbalanceMW > 0.05;
                const isUnder = r.imbalanceMW !== null && r.imbalanceMW < -0.05;
                const startTimeFmt = r.startTime.slice(11, 16);

                return (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-slate-300">{r.settlementDate}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                        SP{r.settlementPeriod}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{startTimeFmt} UTC</td>
                    <td className="py-2.5 px-3 text-right font-bold text-teal-400">
                      {r.actualMW.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-amber-400">
                      {r.forecastMW !== null ? r.forecastMW.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {r.imbalanceMW !== null ? (
                        <span className={`font-semibold ${isOver ? 'text-amber-400' : isUnder ? 'text-cyan-400' : 'text-slate-400'}`}>
                          {r.imbalanceMW > 0 ? `+${r.imbalanceMW}` : r.imbalanceMW}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-300">
                      {r.absoluteErrorMW !== null ? r.absoluteErrorMW.toLocaleString() : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-400">
                      {r.percentageError !== null ? `${r.percentageError}%` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isOver ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          OVER
                        </span>
                      ) : isUnder ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                          UNDER
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          EXACT
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {r.publishTime ? r.publishTime.slice(11, 16) : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="p-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400 bg-slate-950/40">
        <div>
          Showing {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1} to{' '}
          {Math.min(page * pageSize, filtered.length)} of {filtered.length} half-hours
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
