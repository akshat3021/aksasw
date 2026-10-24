import React from 'react';
import { Wind, ShieldCheck, Clock } from 'lucide-react';
import { HealthInfo } from '../types';

interface HeaderProps {
  health: HealthInfo | null;
  cutoffTime: string;
}

export const Header: React.FC<HeaderProps> = ({ health, cutoffTime }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <Wind className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                GridBrick <span className="text-teal-400 font-medium">WindDesk</span>
              </h1>
              <span className="text-[10px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full bg-slate-800 text-teal-400 border border-teal-500/20 font-semibold">
                UK Day-Ahead
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Day-ahead wind forecast & accuracy portal (Elexon BMRS)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-950/70 border border-slate-800 text-slate-300">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-slate-400">Decision Cutoff:</span>
            <span className="text-amber-400 font-bold">{cutoffTime} UK (D-1)</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-950/70 border border-slate-800 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-slate-400">Data Source:</span>
            <span className="text-teal-300">Elexon FUELHH & WINDFOR</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-950/70 border border-slate-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-300 text-[11px]">
              {health ? `${health.fuelhhRecordsCount.toLocaleString()} SPs Live` : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
