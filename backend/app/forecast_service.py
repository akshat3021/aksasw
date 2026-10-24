"""
Core forecast selection and processing service.
Enforces the Day-Ahead Decision Cutoff rule strictly:
For each target startTime, the 'decision forecast' is the latest forecast with
publishTime <= decision cutoff (default 09:00 UK time on D-1, configurable).
Never use forecasts published after the cutoff.
"""

from datetime import date, datetime, timedelta
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd

from .data_loader import load_fuelhh_wind_data, load_windfor_data


def compute_cutoff_timestamp(delivery_date: date, cutoff_time_str: str) -> str:
    """
    Compute ISO UTC timestamp for the decision cutoff.
    The day-ahead decision is made on Day D-1 at cutoff_time (UK local time / GMT in Jan).
    Example: delivery_date=2026-01-02, cutoff_time='09:00' -> '2026-01-01T09:00:00Z'
    """
    d_minus_1 = delivery_date - timedelta(days=1)
    parts = cutoff_time_str.split(":")
    hour, minute = int(parts[0]), int(parts[1])
    dt = datetime(d_minus_1.year, d_minus_1.month, d_minus_1.day, hour, minute, 0)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def normalize_to_hour_start(start_time_iso: str) -> str:
    """
    Normalize a half-hourly ISO timestamp to its top-of-hour timestamp.
    Example: '2026-01-02T14:30:00Z' -> '2026-01-02T14:00:00Z'
    """
    return start_time_iso[:14] + "00:00Z"


def select_decision_forecasts(
    windfor_records: List[Dict[str, Any]],
    target_start_times: List[str],
    cutoff_time_str: str = "09:00",
) -> Dict[str, Dict[str, Any]]:
    """
    For each target startTime, select the latest forecast with publishTime <= cutoff.
    Returns { target_startTime: {'forecastMW': float, 'publishTime': str} }.

    Guarantees:
    1. Only forecasts with publishTime <= the D-1 cutoff are considered
       (so forecasts published after the decision, incl. re-runs, are never used).
    2. Among eligible forecasts the latest publishTime wins.
    3. An exact startTime match is preferred; otherwise a :30 target uses the
       forecast of the hour it falls in (WINDFOR is hourly, FUELHH half-hourly).

    Vectorised: a join of targets to their candidate forecasts (~15 per hour)
    instead of per-target DataFrame scans.
    """
    if not windfor_records or not target_start_times:
        return {}

    wf = pd.DataFrame(windfor_records)
    if wf.empty or not {"publishTime", "startTime", "generation"}.issubset(wf.columns):
        return {}
    wf = wf[["startTime", "publishTime", "generation"]]

    targets = pd.DataFrame({"target": list(dict.fromkeys(target_start_times))})
    targets["date"] = targets["target"].str[:10]
    targets["hour"] = targets["target"].map(normalize_to_hour_start)
    cutoff_by_date = {
        d: compute_cutoff_timestamp(date.fromisoformat(d), cutoff_time_str)
        for d in targets["date"].unique()
    }
    targets["cutoff"] = targets["date"].map(cutoff_by_date)

    exact = targets.merge(wf, left_on="target", right_on="startTime").assign(prio=0)
    hourly = targets.merge(wf, left_on="hour", right_on="startTime").assign(prio=1)
    cand = pd.concat([exact, hourly], ignore_index=True)
    # ISO-8601 'Z' strings of identical format compare chronologically.
    cand = cand[cand["publishTime"] <= cand["cutoff"]]
    if cand.empty:
        return {}

    cand = cand[cand["prio"] == cand.groupby("target")["prio"].transform("min")]
    best = cand.sort_values("publishTime").groupby("target", sort=False).last()

    return {
        target: {"forecastMW": float(row["generation"]), "publishTime": str(row["publishTime"])}
        for target, row in best.iterrows()
    }


def merge_forecasts_and_actuals(
    fuelhh_wind_records: List[Dict[str, Any]],
    windfor_records: List[Dict[str, Any]],
    cutoff_time_str: str = "09:00",
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    settlement_period: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Merge FUELHH actual wind generation with decision forecasts.
    Filters by optional delivery date range and settlement period.
    Computes imbalance and error metrics for each half-hour.
    """
    if not fuelhh_wind_records:
        return []

    df_actuals = pd.DataFrame(fuelhh_wind_records)

    # Date filter
    if date_from:
        df_actuals = df_actuals[df_actuals["settlementDate"] >= date_from.isoformat()]
    if date_to:
        df_actuals = df_actuals[df_actuals["settlementDate"] <= date_to.isoformat()]
    if settlement_period is not None:
        df_actuals = df_actuals[df_actuals["settlementPeriod"] == settlement_period]

    if df_actuals.empty:
        return []

    target_start_times = df_actuals["startTime"].tolist()
    forecasts = select_decision_forecasts(windfor_records, target_start_times, cutoff_time_str)

    results: List[Dict[str, Any]] = []
    for _, row in df_actuals.iterrows():
        st = str(row["startTime"])
        actual_mw = float(row["generation"])
        fc = forecasts.get(st)

        rec: Dict[str, Any] = {
            "startTime": st,
            "settlementDate": str(row["settlementDate"]),
            "settlementPeriod": int(row["settlementPeriod"]),
            "actualMW": round(actual_mw, 1),
            "forecastMW": None,
            "publishTime": None,
            "imbalanceMW": None,
            "absoluteErrorMW": None,
            "percentageError": None,
        }

        if fc is not None:
            f_mw = round(float(fc["forecastMW"]), 1)
            imb_mw = round(f_mw - actual_mw, 1)  # Forecast - Actual
            abs_err = round(abs(f_mw - actual_mw), 1)
            pct_err = round((abs_err / actual_mw * 100.0), 2) if actual_mw > 0 else None

            rec["forecastMW"] = f_mw
            rec["publishTime"] = fc["publishTime"]
            rec["imbalanceMW"] = imb_mw
            rec["absoluteErrorMW"] = abs_err
            rec["percentageError"] = pct_err

        results.append(rec)

    return results


@lru_cache(maxsize=64)
def _merged_full_window(cutoff_time_str: str) -> Tuple[Dict[str, Any], ...]:
    """Merged records for the whole dataset at a cutoff (memoised; treat as read-only)."""
    return tuple(
        merge_forecasts_and_actuals(
            load_fuelhh_wind_data(), load_windfor_data(), cutoff_time_str=cutoff_time_str
        )
    )


def get_merged_records(
    cutoff_time_str: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    settlement_period: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Cached merged records, filtered by delivery date range and settlement period."""
    lo = date_from.isoformat() if date_from else "0000-00-00"
    hi = date_to.isoformat() if date_to else "9999-99-99"
    return [
        r
        for r in _merged_full_window(cutoff_time_str)
        if lo <= r["settlementDate"] <= hi
        and (settlement_period is None or r["settlementPeriod"] == settlement_period)
    ]
