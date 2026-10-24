import React from 'react';

export const fmtMW = (n: number | null | undefined): string =>
  n === null || n === undefined ? '–' : Math.round(n).toLocaleString('en-GB');

export const fmtUtc = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      }) + ' UTC'
    : '–';

export const fmtDay = (iso: string): string =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-2xl shadow-sm ${className}`}>{children}</div>
);

type Tone = 'neutral' | 'good' | 'warn';
const TONE: Record<Tone, string> = {
  neutral: 'text-slate-900',
  good: 'text-emerald-600',
  warn: 'text-amber-600',
};

export const Stat: React.FC<{ label: string; value: string; unit?: string; note: string; tone?: Tone }> = ({
  label, value, unit, note, tone = 'neutral',
}) => (
  <Card className="p-5">
    <div className="text-sm font-medium text-slate-500">{label}</div>
    <div className={`mt-1 text-3xl font-semibold tracking-tight ${TONE[tone]}`}>
      {value}
      {unit && <span className="ml-1.5 text-base font-normal text-slate-400">{unit}</span>}
    </div>
    <p className="mt-2 text-sm leading-snug text-slate-500">{note}</p>
  </Card>
);

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-28' }) => (
  <div className={`rounded-2xl bg-slate-200/70 animate-pulse ${className}`} />
);

export const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
    {message}
  </div>
);
