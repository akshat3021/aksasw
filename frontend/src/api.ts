import {
  BiasCorrectionBacktest,
  DailyMetricRecord,
  DecisionBrief,
  SummaryMetrics,
} from './types';

// Same-origin in production (Docker / Vercel); proxied to :8000 by Vite in development.
const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

async function getJson<T>(path: string, params: Record<string, string>): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}?${new URLSearchParams(params).toString()}`);
  if (!res.ok) throw new Error(`Request failed (${res.status}). Please try again.`);
  return res.json();
}

const range = (from: string, to: string, cutoff: string) => ({
  delivery_date_from: from,
  delivery_date_to: to,
  cutoff_time: cutoff,
});

export const fetchSummaryMetrics = (from: string, to: string, cutoff: string) =>
  getJson<SummaryMetrics>('/api/metrics/summary', range(from, to, cutoff));

export const fetchDailyMetrics = (from: string, to: string, cutoff: string) =>
  getJson<DailyMetricRecord[]>('/api/metrics/daily', range(from, to, cutoff));

export const fetchBiasCorrection = (from: string, to: string, cutoff: string) =>
  getJson<BiasCorrectionBacktest>('/api/metrics/bias-correction', range(from, to, cutoff));

export const fetchDecisionBrief = (deliveryDate: string, cutoff: string) =>
  getJson<DecisionBrief>('/api/decision-brief', { delivery_date: deliveryDate, cutoff_time: cutoff });
