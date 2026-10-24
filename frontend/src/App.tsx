import React, { useState } from 'react';
import { Wind } from 'lucide-react';
import { AccuracyView } from './components/AccuracyView';
import { DecisionBrief } from './components/DecisionBrief';

type Tab = 'decision' | 'accuracy';

const TABS: { id: Tab; label: string }[] = [
  { id: 'decision', label: "Tomorrow's decision" },
  { id: 'accuracy', label: 'How accurate is it?' },
];

const CUTOFFS = ['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00'];

export const App: React.FC = () => {
  const [tab, setTab] = useState<Tab>('decision');
  const [cutoffTime, setCutoffTime] = useState<string>('09:00');

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="rounded-xl bg-blue-600 p-2 text-white"><Wind className="h-5 w-5" /></span>
            <div>
              <h1 className="text-lg font-semibold leading-tight">WindDesk</h1>
              <p className="text-xs text-slate-500">Day-ahead wind forecast check</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="cutoff" className="text-sm text-slate-600">
              Decide at
            </label>
            <select
              id="cutoff" value={cutoffTime} onChange={(e) => setCutoffTime(e.target.value)}
              title="Time on the day before delivery when you must decide (UK time)"
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CUTOFFS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-sm text-slate-500">day before</span>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 px-4 sm:px-6" aria-label="Views">
          {TABS.map((t) => (
            <button
              key={t.id} type="button" onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                tab === t.id
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {tab === 'decision' ? <DecisionBrief cutoffTime={cutoffTime} /> : <AccuracyView cutoffTime={cutoffTime} />}
      </main>

      <footer className="border-t border-slate-200 py-5 text-center text-xs text-slate-500">
        Data: Elexon BMRS (wind actuals FUELHH, wind forecasts WINDFOR) · January 2026 day-ahead decisions · UK time = UTC in January
      </footer>
    </div>
  );
};

export default App;
