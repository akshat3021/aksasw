import {
  BiasCorrectionBacktest,
  CutoffSensitivityItem,
  DecisionBrief,
  DailyMetricRecord,
  HealthInfo,
  PeriodRecord,
  SettlementPeriodProfileRecord,
  SummaryMetrics,
} from './types';

// In production / Vercel, the API is served under /api or via VERCEL_URL / relative path
const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

export async function fetchHealth(): Promise<HealthInfo> {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`Health check failed: ${res.statusText}`);
  return res.json();
}

export async function fetchForecasts(
  dateFrom: string,
  dateTo: string,
  cutoffTime: string,
  settlementPeriod?: number
): Promise<PeriodRecord[]> {
  const params = new URLSearchParams({
    delivery_date_from: dateFrom,
    delivery_date_to: dateTo,
    cutoff_time: cutoffTime,
  });
  if (settlementPeriod !== undefined) {
    params.set('settlement_period', settlementPeriod.toString());
  }

  const res = await fetch(`${BASE_URL}/api/forecasts?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch forecasts: ${res.statusText}`);
  return res.json();
}

export async function fetchSummaryMetrics(
  dateFrom: string,
  dateTo: string,
  cutoffTime: string
): Promise<SummaryMetrics> {
  const params = new URLSearchParams({
    delivery_date_from: dateFrom,
    delivery_date_to: dateTo,
    cutoff_time: cutoffTime,
  });

  const res = await fetch(`${BASE_URL}/api/metrics/summary?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch summary metrics: ${res.statusText}`);
  return res.json();
}

export async function fetchDailyMetrics(
  dateFrom: string,
  dateTo: string,
  cutoffTime: string
): Promise<DailyMetricRecord[]> {
  const params = new URLSearchParams({
    delivery_date_from: dateFrom,
    delivery_date_to: dateTo,
    cutoff_time: cutoffTime,
  });

  const res = await fetch(`${BASE_URL}/api/metrics/daily?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch daily metrics: ${res.statusText}`);
  return res.json();
}

export async function fetchSettlementPeriodProfile(
  dateFrom: string,
  dateTo: string,
  cutoffTime: string
): Promise<SettlementPeriodProfileRecord[]> {
  const params = new URLSearchParams({
    delivery_date_from: dateFrom,
    delivery_date_to: dateTo,
    cutoff_time: cutoffTime,
  });

  const res = await fetch(`${BASE_URL}/api/settlement-periods/profile?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch settlement period profile: ${res.statusText}`);
  return res.json();
}

export async function fetchCutoffSensitivity(
  dateFrom: string,
  dateTo: string
): Promise<CutoffSensitivityItem[]> {
  const params = new URLSearchParams({
    delivery_date_from: dateFrom,
    delivery_date_to: dateTo,
  });

  const res = await fetch(`${BASE_URL}/api/metrics/cutoff-sensitivity?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch cutoff sensitivity: ${res.statusText}`);
  return res.json();
}

export async function fetchBiasCorrection(
  dateFrom: string,
  dateTo: string,
  cutoffTime: string
): Promise<BiasCorrectionBacktest> {
  const params = new URLSearchParams({
    delivery_date_from: dateFrom,
    delivery_date_to: dateTo,
    cutoff_time: cutoffTime,
  });
  const res = await fetch(`${BASE_URL}/api/metrics/bias-correction?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch bias-correction backtest: ${res.statusText}`);
  return res.json();
}

export async function fetchDecisionBrief(
  deliveryDate: string,
  cutoffTime: string
): Promise<DecisionBrief> {
  const params = new URLSearchParams({ delivery_date: deliveryDate, cutoff_time: cutoffTime });
  const res = await fetch(`${BASE_URL}/api/decision-brief?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch decision brief: ${res.statusText}`);
  return res.json();
}
