import React, { useState } from 'react';
import { Clock, Check, AlertCircle } from 'lucide-react';

interface CutoffControllerProps {
  cutoffTime: string;
  onCutoffChange: (newCutoff: string) => void;
  isLoading: boolean;
}

const PRESETS = [
  { label: '07:00', time: '07:00' },
  { label: '08:00', time: '08:00' },
  { label: '09:00 (Default)', time: '09:00', isDefault: true },
  { label: '10:00', time: '10:00' },
  { label: '11:00', time: '11:00' },
  { label: '12:00', time: '12:00' },
];

export const CutoffController: React.FC<CutoffControllerProps> = ({
  cutoffTime,
  onCutoffChange,
  isLoading,
}) => {
  const [customInput, setCustomInput] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    if (!pattern.test(customInput.trim())) {
      setInputError('Must be HH:MM (e.g. 08:30)');
      return;
    }
    setInputError(null);
    onCutoffChange(customInput.trim());
    setCustomInput('');
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 shadow-lg shadow-black/20">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Day-Ahead Decision Cutoff
            </h2>
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono">
              Core Rule Control
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            For each delivery half-hour on Day D, only forecasts published by National Energy System Operator (NESO)
            at or before <span className="text-amber-400 font-mono font-medium">{cutoffTime} UK time on D-1</span> are considered.
            Forecasts published after this cutoff are strictly discarded.
          </p>
        </div>

        {/* Preset chips & Custom Input */}
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((preset) => {
            const isActive = cutoffTime === preset.time;
            return (
              <button
                key={preset.time}
                type="button"
                disabled={isLoading}
                onClick={() => onCutoffChange(preset.time)}
                className={`text-xs px-3 py-1.5 rounded-lg font-mono font-medium transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold ring-2 ring-amber-400/40'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/50'
                }`}
              >
                {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                {preset.label}
              </button>
            );
          })}

          {/* Custom Time Form */}
          <form onSubmit={handleCustomSubmit} className="flex items-center gap-1.5">
            <input
              type="text"
              placeholder="HH:MM"
              value={customInput}
              disabled={isLoading}
              onChange={(e) => {
                setCustomInput(e.target.value);
                if (inputError) setInputError(null);
              }}
              className="w-20 px-2 py-1 text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              disabled={isLoading || !customInput}
              className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-40"
            >
              Set
            </button>
          </form>
        </div>
      </div>

      {inputError && (
        <div className="flex items-center gap-1.5 text-xs text-rose-400 mt-2 font-mono">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>{inputError}</span>
        </div>
      )}
    </div>
  );
};
