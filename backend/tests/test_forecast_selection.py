"""
Unit tests for Core Forecast Selection Rule:
1. Latest forecast published <= cutoff is selected.
2. Forecasts published after cutoff are NEVER used.
3. Cutoff time is configurable (e.g. 09:00 vs 07:00 vs 12:00).
4. Top-of-hour and half-hour settlement period matching.
"""

from datetime import date
try:
    import pytest
except ImportError:
    pytest = None
from app.forecast_service import (
    compute_cutoff_timestamp,
    normalize_to_hour_start,
    select_decision_forecasts,
    merge_forecasts_and_actuals,
)


def test_compute_cutoff_timestamp():
    """Verify D-1 cutoff timestamp calculation."""
    # Delivery on 2026-01-02, default cutoff 09:00 -> 2026-01-01T09:00:00Z
    ts1 = compute_cutoff_timestamp(date(2026, 1, 2), "09:00")
    assert ts1 == "2026-01-01T09:00:00Z"

    # Delivery on 2026-01-15, cutoff 07:30 -> 2026-01-14T07:30:00Z
    ts2 = compute_cutoff_timestamp(date(2026, 1, 15), "07:30")
    assert ts2 == "2026-01-14T07:30:00Z"

    # Delivery on 2026-02-01, cutoff 11:00 -> 2026-01-31T11:00:00Z
    ts3 = compute_cutoff_timestamp(date(2026, 2, 1), "11:00")
    assert ts3 == "2026-01-31T11:00:00Z"


def test_normalize_to_hour_start():
    """Verify half-hourly timestamps map to top-of-hour."""
    assert normalize_to_hour_start("2026-01-02T14:30:00Z") == "2026-01-02T14:00:00Z"
    assert normalize_to_hour_start("2026-01-02T00:00:00Z") == "2026-01-02T00:00:00Z"
    assert normalize_to_hour_start("2026-01-02T23:30:00Z") == "2026-01-02T23:00:00Z"


def test_select_decision_forecast_picks_latest_before_cutoff():
    """
    Test that when multiple forecasts exist before cutoff,
    the latest one is picked, and ones after cutoff are ignored.
    """
    target_start_time = "2026-01-02T10:00:00Z"
    # Target delivery day is 2026-01-02, so D-1 is 2026-01-01. Cutoff 09:00 -> 2026-01-01T09:00:00Z
    windfor_records = [
        # Published well before cutoff
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T03:30:00Z",
            "startTime": target_start_time,
            "generation": 10000.0,
        },
        # Published closer to cutoff (latest valid forecast)
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T08:30:00Z",
            "startTime": target_start_time,
            "generation": 12000.0,
        },
        # Published exactly at cutoff (valid, must be considered)
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T09:00:00Z",
            "startTime": target_start_time,
            "generation": 12500.0,
        },
        # Published AFTER cutoff (10:30) - MUST NEVER BE USED!
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T10:30:00Z",
            "startTime": target_start_time,
            "generation": 15000.0,
        },
        # Published on delivery day (intraday) - MUST NEVER BE USED!
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-02T06:00:00Z",
            "startTime": target_start_time,
            "generation": 99999.0,
        },
    ]

    result = select_decision_forecasts(windfor_records, [target_start_time], cutoff_time_str="09:00")
    assert target_start_time in result
    selected = result[target_start_time]

    # Must be the forecast at 09:00 (latest <= cutoff)
    assert selected["forecastMW"] == 12500.0
    assert selected["publishTime"] == "2026-01-01T09:00:00Z"


def test_strictly_never_use_forecast_published_after_cutoff():
    """
    If the only available forecasts were published after cutoff,
    no forecast should be selected (result empty for that target).
    """
    target = "2026-01-02T12:00:00Z"
    windfor_records = [
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T09:30:00Z",  # After 09:00 cutoff!
            "startTime": target,
            "generation": 14000.0,
        },
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T12:30:00Z",  # After 09:00 cutoff!
            "startTime": target,
            "generation": 16000.0,
        },
    ]

    result = select_decision_forecasts(windfor_records, [target], cutoff_time_str="09:00")
    # Must NOT select anything!
    assert target not in result


def test_configurable_cutoff_time():
    """Test changing cutoff time from 08:00 to 11:00 changes the decision forecast."""
    target = "2026-01-02T15:00:00Z"
    windfor_records = [
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T07:30:00Z",
            "startTime": target,
            "generation": 8000.0,
        },
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T10:30:00Z",
            "startTime": target,
            "generation": 9500.0,
        },
    ]

    # With 08:00 cutoff, only 07:30 is eligible
    result_08 = select_decision_forecasts(windfor_records, [target], cutoff_time_str="08:00")
    assert result_08[target]["forecastMW"] == 8000.0
    assert result_08[target]["publishTime"] == "2026-01-01T07:30:00Z"

    # With 11:00 cutoff, 10:30 becomes eligible and is picked
    result_11 = select_decision_forecasts(windfor_records, [target], cutoff_time_str="11:00")
    assert result_11[target]["forecastMW"] == 9500.0
    assert result_11[target]["publishTime"] == "2026-01-01T10:30:00Z"


def test_half_hour_mapped_to_hour_forecast():
    """Test that a half-hour target (e.g. 14:30) correctly picks the forecast for 14:00."""
    target_sp1 = "2026-01-02T14:00:00Z"
    target_sp2 = "2026-01-02T14:30:00Z"
    windfor_records = [
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T08:30:00Z",
            "startTime": "2026-01-02T14:00:00Z",
            "generation": 11500.0,
        }
    ]

    result = select_decision_forecasts(windfor_records, [target_sp1, target_sp2], cutoff_time_str="09:00")
    assert target_sp1 in result
    assert target_sp2 in result
    assert result[target_sp1]["forecastMW"] == 11500.0
    assert result[target_sp2]["forecastMW"] == 11500.0


def test_merge_forecasts_and_actuals():
    """Test merging actuals and forecasts and calculating imbalance and error."""
    fuelhh_records = [
        {
            "dataset": "FUELHH",
            "publishTime": "2026-01-03T00:00:00Z",
            "startTime": "2026-01-02T14:00:00Z",
            "settlementDate": "2026-01-02",
            "settlementPeriod": 29,
            "fuelType": "WIND",
            "generation": 10000.0,
        }
    ]
    windfor_records = [
        {
            "dataset": "WINDFOR",
            "publishTime": "2026-01-01T08:30:00Z",
            "startTime": "2026-01-02T14:00:00Z",
            "generation": 11200.0,
        }
    ]

    merged = merge_forecasts_and_actuals(fuelhh_records, windfor_records, cutoff_time_str="09:00")
    assert len(merged) == 1
    row = merged[0]
    assert row["actualMW"] == 10000.0
    assert row["forecastMW"] == 11200.0
    # Imbalance: Forecast - Actual = +1200.0 MW (Over-forecast)
    assert row["imbalanceMW"] == 1200.0
    assert row["absoluteErrorMW"] == 1200.0
    assert row["percentageError"] == 12.0
