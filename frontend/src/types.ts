export interface PeriodRecord {
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
  actualMW: number;
  forecastMW: number | null;
  publishTime: string | null;
  imbalanceMW: number | null;
  absoluteErrorMW: number | null;
  percentageError: number | null;
}

export interface DailyMetricRecord {
  settlementDate: string;
  maeMW: number;
  rmseMW: number;
  wapePercent: number;
  biasMW: number;
  totalActualMWh: number;
  totalForecastMWh: number;
  netImbalanceMWh: number;
  periodsCount: number;
}

export interface SummaryMetrics {
  deliveryDateFrom: string;
  deliveryDateTo: string;
  cutoffTimeUsed: string;
  totalPeriods: number;
  matchedPeriods: number;
  maeMW: number;
  rmseMW: number;
  wapePercent: number;
  biasMW: number;
  totalActualMWh: number;
  totalForecastMWh: number;
  netImbalanceMWh: number;
  overForecastPeriods: number;
  underForecastPeriods: number;
  exactPeriods: number;
  p50AbsErrorMW: number;
  p90AbsErrorMW: number;
  p95AbsErrorMW: number;
  p10ErrorMW: number;
  p90ErrorMW: number;
}

export interface SettlementPeriodProfileRecord {
  settlementPeriod: number;
  timeLabel: string;
  meanActualMW: number;
  meanForecastMW: number;
  maeMW: number;
  biasMW: number;
  samplesCount: number;
}

export interface CutoffSensitivityItem {
  cutoffTime: string;
  maeMW: number;
  rmseMW: number;
  wapePercent: number;
  biasMW: number;
  matchedPeriods: number;
}

export interface HealthInfo {
  status: string;
  service: string;
  fuelhhRecordsCount: number;
  windforRecordsCount: number;
  defaultCutoff: string;
  deliveryWindow: {
    from: string;
    to: string;
  };
}

export interface BiasCorrectionBacktest {
  daysEvaluated: number;
  lookbackDays: number;
  rawMaeMW: number;
  correctedMaeMW: number;
  correctedRmseMW: number;
  correctedBiasMW: number;
  maeImprovementPercent: number;
  bandCoveragePercent: number;
}

export interface BriefPeriod {
  startTime: string;
  settlementPeriod: number;
  forecastMW: number | null;
  publishTime: string | null;
  correctedForecastMW: number | null;
  lowerMW: number | null;
  upperMW: number | null;
  actualMW: number | null;
}

export interface DecisionBrief {
  deliveryDate: string;
  cutoffTime: string;
  decisionTimestamp: string;
  hasHistory: boolean;
  historyDays: number;
  lookbackDays: number;
  estimatedBiasMW: number;
  periods: BriefPeriod[];
  meanForecastMW: number;
  meanCorrectedMW: number;
  earliestPublishTime: string | null;
  latestPublishTime: string | null;
  forecastRunsUsed: number;
  rawMaeMW: number;
  correctedMaeMW: number;
  bandCoveragePercent: number | null;
}
