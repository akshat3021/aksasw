import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchHealth,
  fetchForecasts,
  fetchSummaryMetrics,
  fetchSettlementPeriodProfile,
  fetchCutoffSensitivity,
  fetchBiasCorrection,
} from './api';
import {
  BiasCorrectionBacktest,
  CutoffSensitivityItem,
  HealthInfo,
  PeriodRecord,
  SettlementPeriodProfileRecord,
  SummaryMetrics,
} from './types';
import { Header } from './components/Header';
import { CutoffController } from './components/CutoffController';
import { DateRangePicker } from './components/DateRangePicker';
import { SummaryCards } from './components/SummaryCards';
import { RiskCards } from './components/RiskCards';
import { DecisionBrief } from './components/DecisionBrief';
import { ForecastChart } from './components/ForecastChart';
import { CutoffSensitivityChart } from './components/CutoffSensitivityChart';
import { SettlementPeriodProfile } from './components/SettlementPeriodProfile';
import { ScheduleTable } from './components/ScheduleTable';
import {
  BarChart3,
  ClipboardList,
  TrendingDown,
  Layers,
  Table,
  RefreshCw,
  AlertTriangle,
  Info,
} from 'lucide-react';

export const App: React.FC = () => {
  const [cutoffTime, setCutoffTime] = useState<string>('09:00');
  const [dateFrom, setDateFrom] = useState<string>('2026-01-02');
  const [dateTo, setDateTo] = useState<string>('2026-02-01');

  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [summary, setSummary] = useState<SummaryMetrics | null>(null);
  const [forecasts, setForecasts] = useState<PeriodRecord[]>([]);
  const [profile, setProfile] = useState<SettlementPeriodProfileRecord[]>([]);
  const [sensitivity, setSensitivity] = useState<CutoffSensitivityItem[]>([]);
  const [backtest, setBacktest] = useState<BiasCorrectionBacktest | null>(null);

  const [activeTab, setActiveTab] = useState<'brief' | 'chart' | 'sensitivity' | 'profile' | 'table'>('brief');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initial health check
  useEffect(() => {
    fetchHealth()
      .then(setHealth)
      .catch((err) => console.warn('Health check issue:', err));
  }, []);

  // Main data fetcher
  const loadPortalData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, fcRes, profRes, sensRes, btRes] = await Promise.all([
        fetchSummaryMetrics(dateFrom, dateTo, cutoffTime),
        fetchForecasts(dateFrom, dateTo, cutoffTime),
        fetchSettlementPeriodProfile(dateFrom, dateTo, cutoffTime),
        fetchCutoffSensitivity(dateFrom, dateTo),
        fetchBiasCorrection(dateFrom, dateTo, cutoffTime),
      ]);
      setSummary(sumRes);
      setForecasts(fcRes);
      setProfile(profRes);
      setSensitivity(sensRes);
      setBacktest(btRes);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err?.message || 'Failed to communicate with portal backend.');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo, cutoffTime]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  const handleRangeChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Header health={health} cutoffTime={cutoffTime} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-5">
        {/* Error notification banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-200 text-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadPortalData()}
              className="px-3 py-1 rounded-lg bg-rose-900/60 hover:bg-rose-800 text-white text-xs font-mono"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top Controls: Cutoff Controller & Date Range Picker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CutoffController
            cutoffTime={cutoffTime}
            onCutoffChange={setCutoffTime}
            isLoading={isLoading}
          />
          <DateRangePicker
            dateFrom={dateFrom}
            dateTo={dateTo}
            onRangeChange={handleRangeChange}
            isLoading={isLoading}
          />
        </div>

        {/* Summary Executive KPI Cards */}
        <SummaryCards metrics={summary} isLoading={isLoading} />
        <RiskCards summary={summary} backtest={backtest} isLoading={isLoading} />

        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex flex-wrap items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('brief')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium font-mono transition-colors ${
                activeTab === 'brief'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Decision Brief</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chart')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium font-mono transition-colors ${
                activeTab === 'chart'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Range Curve</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sensitivity')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium font-mono transition-colors ${
                activeTab === 'sensitivity'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              <span>Cutoff Sensitivity</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium font-mono transition-colors ${
                activeTab === 'profile'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Diurnal Profile</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium font-mono transition-colors ${
                activeTab === 'table'
                  ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Table className="w-4 h-4" />
              <span>Trading Schedule ({forecasts.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => loadPortalData()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono border border-slate-800 disabled:opacity-40"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-teal-400' : ''}`} />
            <span className="hidden sm:inline">Refresh data</span>
          </button>
        </div>

        {/* Tab Content Panels */}
        {activeTab === 'brief' && <DecisionBrief cutoffTime={cutoffTime} />}

        {activeTab === 'chart' && (
          <div className="space-y-4">
            <ForecastChart
              records={forecasts}
              isLoading={isLoading}
              cutoffTime={cutoffTime}
            />
          </div>
        )}

        {activeTab === 'sensitivity' && (
          <div className="space-y-4">
            <CutoffSensitivityChart
              sensitivityData={sensitivity}
              activeCutoff={cutoffTime}
              onSelectCutoff={(newCutoff) => setCutoffTime(newCutoff)}
              isLoading={isLoading}
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <div className="space-y-4">
            <SettlementPeriodProfile
              profile={profile}
              isLoading={isLoading}
            />
          </div>
        )}

        {activeTab === 'table' && (
          <div className="space-y-4">
            <ScheduleTable
              records={forecasts}
              isLoading={isLoading}
              cutoffTime={cutoffTime}
            />
          </div>
        )}

        {/* Info Explainer Footer Card */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-400 space-y-2 font-mono">
          <div className="flex items-center gap-2 text-slate-300 font-semibold">
            <Info className="w-4 h-4 text-teal-400" />
            <span>Trading Desk Policy & Dataset Verification</span>
          </div>
          <p className="leading-relaxed">
            This portal strictly adheres to GB power market day-ahead buying protocol. Actual wind generation is ingested
            from Elexon BMRS <code className="text-teal-300 bg-slate-950 px-1 py-0.5 rounded">FUELHH</code> (fuelType=WIND).
            Day-ahead decision forecasts are selected from <code className="text-amber-300 bg-slate-950 px-1 py-0.5 rounded">WINDFOR</code>.
            By core mandate, any forecast published after the decision cutoff ({cutoffTime} on D-1) is strictly suppressed to prevent lookahead bias.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 mt-8 text-center text-xs font-mono text-slate-500">
        GridBrick Wind Desk &bull; Data: Elexon BMRS (FUELHH, WINDFOR) &bull; January 2026 day-ahead decisions
      </footer>
    </div>
  );
};

export default App;
