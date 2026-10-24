"""
Pydantic schemas and validation models for the Wind Power Forecast Portal.
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class PeriodRecord(BaseModel):
    """Single 30-minute settlement period with actual, decision forecast, and error metrics."""
    startTime: str = Field(description="ISO UTC start timestamp of the half hour")
    settlementDate: str = Field(description="Delivery date (YYYY-MM-DD)")
    settlementPeriod: int = Field(ge=1, le=48, description="Settlement Period (1-48)")
    actualMW: float = Field(description="Actual wind generation from FUELHH (MW)")
    forecastMW: Optional[float] = Field(default=None, description="Decision wind forecast from WINDFOR (MW)")
    publishTime: Optional[str] = Field(default=None, description="Publish timestamp of chosen decision forecast")
    imbalanceMW: Optional[float] = Field(default=None, description="Forecast Error: Forecast - Actual (MW)")
    absoluteErrorMW: Optional[float] = Field(default=None, description="|Forecast - Actual| (MW)")
    percentageError: Optional[float] = Field(default=None, description="Absolute percentage error relative to actual")


class DailyMetricRecord(BaseModel):
    """Aggregated accuracy metrics for a single delivery day."""
    settlementDate: str
    maeMW: float = Field(description="Mean Absolute Error (MW)")
    rmseMW: float = Field(description="Root Mean Square Error (MW)")
    wapePercent: float = Field(description="Weighted Absolute Percentage Error (%)")
    biasMW: float = Field(description="Mean Error / Bias: Forecast - Actual (MW)")
    totalActualMWh: float = Field(description="Total actual energy delivered (MWh = sum(MW * 0.5h))")
    totalForecastMWh: float = Field(description="Total forecast energy contracted (MWh)")
    netImbalanceMWh: float = Field(description="Net imbalance volume (MWh)")
    periodsCount: int = Field(description="Number of settlement periods evaluated")


class SummaryMetrics(BaseModel):
    """Overall executive metrics summary across the selected window."""
    deliveryDateFrom: str
    deliveryDateTo: str
    cutoffTimeUsed: str
    totalPeriods: int
    matchedPeriods: int
    maeMW: float
    rmseMW: float
    wapePercent: float
    biasMW: float
    totalActualMWh: float
    totalForecastMWh: float
    netImbalanceMWh: float
    overForecastPeriods: int
    underForecastPeriods: int
    exactPeriods: int
    p50AbsErrorMW: float
    p90AbsErrorMW: float
    p95AbsErrorMW: float
    p10ErrorMW: float = Field(description="10th percentile of signed error (forecast - actual)")
    p90ErrorMW: float = Field(description="90th percentile of signed error (forecast - actual)")


class SettlementPeriodProfileRecord(BaseModel):
    """Diurnal profile for a specific settlement period (1 to 48) averaged across delivery days."""
    settlementPeriod: int
    timeLabel: str = Field(description="Half-hour time label, e.g. '00:00 - 00:30'")
    meanActualMW: float
    meanForecastMW: float
    maeMW: float
    biasMW: float
    samplesCount: int


class CutoffSensitivityItem(BaseModel):
    """Metric performance at a specific cutoff time."""
    cutoffTime: str
    maeMW: float
    rmseMW: float
    wapePercent: float
    biasMW: float
    matchedPeriods: int


class BiasCorrectionBacktest(BaseModel):
    """Out-of-sample backtest of subtracting the trailing mean error (known at decision time)."""
    daysEvaluated: int
    lookbackDays: int
    rawMaeMW: float
    correctedMaeMW: float
    correctedRmseMW: float
    correctedBiasMW: float
    maeImprovementPercent: float
    bandCoveragePercent: float = Field(description="Share of actuals inside the P10-P90 band (nominal 80%)")


class BriefPeriod(BaseModel):
    startTime: str
    settlementPeriod: int
    forecastMW: Optional[float]
    publishTime: Optional[str]
    correctedForecastMW: Optional[float]
    lowerMW: Optional[float]
    upperMW: Optional[float]
    actualMW: Optional[float] = Field(description="Backtest only: not known on D-1")


class DecisionBrief(BaseModel):
    """What the buyer sees for one delivery day at the decision cutoff."""
    deliveryDate: str
    cutoffTime: str
    decisionTimestamp: str = Field(description="UTC instant of the decision (D-1 at cutoff)")
    hasHistory: bool
    historyDays: float
    lookbackDays: int
    estimatedBiasMW: float
    periods: List[BriefPeriod]
    meanForecastMW: float
    meanCorrectedMW: float
    earliestPublishTime: Optional[str]
    latestPublishTime: Optional[str]
    forecastRunsUsed: int
    rawMaeMW: float
    correctedMaeMW: float
    bandCoveragePercent: Optional[float]
