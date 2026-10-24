"""
Unit tests for Wind Accuracy and Trading Metrics:
1. MAE, RMSE, WAPE, Bias calculation.
2. Energy MWh conversion (MW * 0.5h).
3. Over-forecast vs under-forecast counts.
4. Daily aggregation and diurnal settlement period profiles.
"""

import math
try:
    import pytest
except ImportError:
    pytest = None
from app.metrics_service import (
    compute_metrics_for_records,
    compute_daily_breakdown,
    compute_settlement_period_profile,
)


def test_compute_metrics_for_records():
    """Verify statistical formulas for MAE, RMSE, WAPE, Bias, and Energy."""
    records = [
        # Period 1: Actual 100, Forecast 120 -> Error +20, Abs 20, Sq 400
        {"actualMW": 100.0, "forecastMW": 120.0, "settlementPeriod": 1, "settlementDate": "2026-01-02"},
        # Period 2: Actual 200, Forecast 190 -> Error -10, Abs 10, Sq 100
        {"actualMW": 200.0, "forecastMW": 190.0, "settlementPeriod": 2, "settlementDate": "2026-01-02"},
        # Period 3: Actual 300, Forecast 300 -> Error 0, Abs 0, Sq 0
        {"actualMW": 300.0, "forecastMW": 300.0, "settlementPeriod": 3, "settlementDate": "2026-01-02"},
    ]

    metrics = compute_metrics_for_records(records)
    # MAE = (20 + 10 + 0) / 3 = 10.0 MW
    assert metrics["maeMW"] == 10.0
    # RMSE = sqrt((400 + 100 + 0) / 3) = sqrt(500/3) = 12.91 MW
    assert metrics["rmseMW"] == round(math.sqrt(500 / 3), 2)
    # WAPE = (30 / 600) * 100 = 5.0%
    assert metrics["wapePercent"] == 5.0
    # Bias = (+20 - 10 + 0) / 3 = +3.33 MW
    assert metrics["biasMW"] == 3.33

    # Total Actual MWh = 600 * 0.5 = 300.0 MWh
    assert metrics["totalActualMWh"] == 300.0
    # Total Forecast MWh = 610 * 0.5 = 305.0 MWh
    assert metrics["totalForecastMWh"] == 305.0
    # Net Imbalance MWh = +10 * 0.5 = +5.0 MWh
    assert metrics["netImbalanceMWh"] == 5.0

    assert metrics["overForecastPeriods"] == 1
    assert metrics["underForecastPeriods"] == 1
    assert metrics["exactPeriods"] == 1


def test_empty_or_unmatched_records():
    """Verify metrics return safe defaults on empty or unmatched records."""
    metrics = compute_metrics_for_records([])
    assert metrics["totalPeriods"] == 0
    assert metrics["matchedPeriods"] == 0
    assert metrics["maeMW"] == 0.0

    unmatched = [{"actualMW": 100.0, "forecastMW": None}]
    metrics2 = compute_metrics_for_records(unmatched)
    assert metrics2["totalPeriods"] == 1
    assert metrics2["matchedPeriods"] == 0


def test_daily_breakdown():
    """Verify aggregation by delivery date."""
    records = [
        {"settlementDate": "2026-01-02", "actualMW": 100.0, "forecastMW": 110.0},
        {"settlementDate": "2026-01-02", "actualMW": 200.0, "forecastMW": 190.0},
        {"settlementDate": "2026-01-03", "actualMW": 150.0, "forecastMW": 160.0},
    ]
    daily = compute_daily_breakdown(records)
    assert len(daily) == 2
    assert daily[0]["settlementDate"] == "2026-01-02"
    assert daily[0]["periodsCount"] == 2
    assert daily[1]["settlementDate"] == "2026-01-03"
    assert daily[1]["periodsCount"] == 1


def test_settlement_period_profile():
    """Verify that 48 half-hour settlement periods are correctly populated."""
    records = [
        {"settlementPeriod": 1, "actualMW": 1000.0, "forecastMW": 1100.0},
        {"settlementPeriod": 1, "actualMW": 1200.0, "forecastMW": 1300.0},
        {"settlementPeriod": 2, "actualMW": 800.0, "forecastMW": 750.0},
    ]
    profile = compute_settlement_period_profile(records)
    assert len(profile) == 48

    sp1 = profile[0]
    assert sp1["settlementPeriod"] == 1
    assert sp1["timeLabel"] == "00:00 - 00:30"
    assert sp1["meanActualMW"] == 1100.0
    assert sp1["meanForecastMW"] == 1200.0
    assert sp1["maeMW"] == 100.0
    assert sp1["biasMW"] == 100.0
    assert sp1["samplesCount"] == 2

    # Empty SP 48
    sp48 = profile[47]
    assert sp48["settlementPeriod"] == 48
    assert sp48["timeLabel"] == "23:30 - 24:00"
    assert sp48["samplesCount"] == 0
