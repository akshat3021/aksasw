"""
Statistical and performance metrics service for wind buying team.
Calculates MAE, RMSE, WAPE, Bias, Energy MWh, and cutoff sensitivity.
"""

import math
from datetime import date
from typing import Any, Dict, List, Optional

import numpy as np


def compute_metrics_for_records(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute accuracy metrics from a list of merged settlement period records.
    Only periods with both actualMW and forecastMW are evaluated.
    """
    valid = [r for r in records if r.get("forecastMW") is not None and r.get("actualMW") is not None]
    total_count = len(records)
    matched_count = len(valid)

    if not valid:
        return {
            "totalPeriods": total_count,
            "matchedPeriods": 0,
            "maeMW": 0.0,
            "rmseMW": 0.0,
            "wapePercent": 0.0,
            "biasMW": 0.0,
            "totalActualMWh": 0.0,
            "totalForecastMWh": 0.0,
            "netImbalanceMWh": 0.0,
            "overForecastPeriods": 0,
            "underForecastPeriods": 0,
            "exactPeriods": 0,
            "p50AbsErrorMW": 0.0,
            "p90AbsErrorMW": 0.0,
            "p95AbsErrorMW": 0.0,
            "p10ErrorMW": 0.0,
            "p90ErrorMW": 0.0,
        }

    actuals = [r["actualMW"] for r in valid]
    forecasts = [r["forecastMW"] for r in valid]
    errors = [f - a for f, a in zip(forecasts, actuals)]
    abs_errors = [abs(e) for e in errors]
    squared_errors = [e * e for e in errors]

    sum_abs = sum(abs_errors)
    sum_actual = sum(actuals)
    sum_sq = sum(squared_errors)
    sum_err = sum(errors)
    n = len(valid)

    mae = sum_abs / n
    rmse = math.sqrt(sum_sq / n)
    wape = (sum_abs / sum_actual * 100.0) if sum_actual > 0 else 0.0
    bias = sum_err / n

    # In 30-min settlement, 1 MW for 30 mins = 0.5 MWh
    total_actual_mwh = sum_actual * 0.5
    total_forecast_mwh = sum(forecasts) * 0.5
    net_imbalance_mwh = sum_err * 0.5

    over_count = sum(1 for e in errors if e > 0.05)
    under_count = sum(1 for e in errors if e < -0.05)
    exact_count = n - over_count - under_count

    return {
        "totalPeriods": total_count,
        "matchedPeriods": matched_count,
        "maeMW": round(mae, 2),
        "rmseMW": round(rmse, 2),
        "wapePercent": round(wape, 2),
        "biasMW": round(bias, 2),
        "totalActualMWh": round(total_actual_mwh, 1),
        "totalForecastMWh": round(total_forecast_mwh, 1),
        "netImbalanceMWh": round(net_imbalance_mwh, 1),
        "overForecastPeriods": over_count,
        "underForecastPeriods": under_count,
        "exactPeriods": exact_count,
        # Tail-risk view: how big can the error get? (abs = size, signed = direction)
        "p50AbsErrorMW": round(float(np.percentile(abs_errors, 50)), 1),
        "p90AbsErrorMW": round(float(np.percentile(abs_errors, 90)), 1),
        "p95AbsErrorMW": round(float(np.percentile(abs_errors, 95)), 1),
        "p10ErrorMW": round(float(np.percentile(errors, 10)), 1),
        "p90ErrorMW": round(float(np.percentile(errors, 90)), 1),
    }


def compute_daily_breakdown(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Group merged records by settlementDate and compute daily metrics."""
    if not records:
        return []

    # Group records by settlementDate
    by_date: Dict[str, List[Dict[str, Any]]] = {}
    for r in records:
        by_date.setdefault(r["settlementDate"], []).append(r)

    daily_list: List[Dict[str, Any]] = []
    for d_str in sorted(by_date.keys()):
        day_records = by_date[d_str]
        m = compute_metrics_for_records(day_records)
        daily_list.append({
            "settlementDate": d_str,
            "maeMW": m["maeMW"],
            "rmseMW": m["rmseMW"],
            "wapePercent": m["wapePercent"],
            "biasMW": m["biasMW"],
            "totalActualMWh": m["totalActualMWh"],
            "totalForecastMWh": m["totalForecastMWh"],
            "netImbalanceMWh": m["netImbalanceMWh"],
            "periodsCount": m["matchedPeriods"],
        })

    return daily_list


def compute_settlement_period_profile(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Compute diurnal error profile across the 48 settlement periods.
    Provides average actual, forecast, MAE, and bias for each half hour of the day.
    """
    if not records:
        return []

    by_sp: Dict[int, List[Dict[str, Any]]] = {}
    for r in records:
        sp = r.get("settlementPeriod")
        if sp is not None:
            by_sp.setdefault(sp, []).append(r)

    profile: List[Dict[str, Any]] = []
    for sp in range(1, 49):
        sp_records = by_sp.get(sp, [])
        valid = [r for r in sp_records if r.get("forecastMW") is not None and r.get("actualMW") is not None]

        # Generate time label: e.g. SP 1 is 00:00 - 00:30, SP 48 is 23:30 - 24:00
        start_min_total = (sp - 1) * 30
        end_min_total = sp * 30
        start_h, start_m = divmod(start_min_total, 60)
        end_h, end_m = divmod(end_min_total, 60)
        time_label = f"{start_h:02d}:{start_m:02d} - {end_h:02d}:{end_m:02d}"

        if not valid:
            profile.append({
                "settlementPeriod": sp,
                "timeLabel": time_label,
                "meanActualMW": 0.0,
                "meanForecastMW": 0.0,
                "maeMW": 0.0,
                "biasMW": 0.0,
                "samplesCount": 0,
            })
            continue

        actuals = [r["actualMW"] for r in valid]
        forecasts = [r["forecastMW"] for r in valid]
        errors = [f - a for f, a in zip(forecasts, actuals)]
        abs_errors = [abs(e) for e in errors]

        n = len(valid)
        profile.append({
            "settlementPeriod": sp,
            "timeLabel": time_label,
            "meanActualMW": round(sum(actuals) / n, 1),
            "meanForecastMW": round(sum(forecasts) / n, 1),
            "maeMW": round(sum(abs_errors) / n, 1),
            "biasMW": round(sum(errors) / n, 1),
            "samplesCount": n,
        })

    return profile


# ---------------------------------------------------------------------------
# Bias correction using ONLY information available at decision time.
# A decision for delivery day D is taken on D-1 morning, when actuals are only
# known up to the end of D-2. So the trailing window ends at D-2.
# ---------------------------------------------------------------------------

def _valid(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [r for r in records if r.get("forecastMW") is not None and r.get("actualMW") is not None]


def _history_errors(
    valid: List[Dict[str, Any]], delivery: date, lookback_days: Optional[int]
) -> List[float]:
    """Signed errors (forecast - actual) known at decision time: days <= D-2.
    lookback_days=None means all available history (expanding window)."""
    errors: List[float] = []
    for r in valid:
        age = (delivery - date.fromisoformat(r["settlementDate"])).days
        if age >= 2 and (lookback_days is None or age < 2 + lookback_days):
            errors.append(r["forecastMW"] - r["actualMW"])
    return errors


def _correction_params(
    valid: List[Dict[str, Any]], delivery: date, lookback_days: int
) -> Optional[Dict[str, float]]:
    """
    Bias and band widths for a delivery day, from data available at decision time.
    - bias: mean error over the trailing `lookback_days` (adapts quickly to regime changes)
    - band: P10/P90 of the corrected-forecast residuals over ALL available history
      (a 7-day window was backtested and under-covered: 69% vs 80% nominal).
    Returns None when less than one full day of history exists.
    """
    recent = _history_errors(valid, delivery, lookback_days)
    if len(recent) < 48:
        return None
    bias = sum(recent) / len(recent)
    residuals = [e - bias for e in _history_errors(valid, delivery, None)]
    return {
        "bias": bias,
        "q_hi": float(np.percentile(residuals, 90)),
        "q_lo": float(np.percentile(residuals, 10)),
        "history_days": len(recent) / 48,
    }


def compute_rolling_bias_correction(
    all_records: List[Dict[str, Any]],
    eval_from: date,
    eval_to: date,
    lookback_days: int = 7,
) -> Dict[str, Any]:
    """
    Out-of-sample backtest: for each delivery day in [eval_from, eval_to], subtract the
    mean error of the previous `lookback_days` days (ending D-2) from the forecast.
    Days with no history are skipped. `all_records` must span the full dataset so
    history can come from before eval_from.
    """
    valid = _valid(all_records)
    by_day: Dict[str, List[Dict[str, Any]]] = {}
    for r in valid:
        by_day.setdefault(r["settlementDate"], []).append(r)

    raw_abs: List[float] = []
    corrected_errors: List[float] = []
    inside = total = 0
    days_evaluated = 0
    for day_str in sorted(by_day):
        d = date.fromisoformat(day_str)
        if not (eval_from <= d <= eval_to):
            continue
        params = _correction_params(valid, d, lookback_days)
        if params is None:
            continue
        days_evaluated += 1
        for r in by_day[day_str]:
            err = r["forecastMW"] - r["actualMW"]
            corrected = r["forecastMW"] - params["bias"]
            raw_abs.append(abs(err))
            corrected_errors.append(err - params["bias"])
            lower = max(corrected - params["q_hi"], 0.0)
            upper = corrected - params["q_lo"]
            total += 1
            inside += lower <= r["actualMW"] <= upper

    if not corrected_errors:
        return {
            "daysEvaluated": 0, "lookbackDays": lookback_days,
            "rawMaeMW": 0.0, "correctedMaeMW": 0.0, "correctedRmseMW": 0.0,
            "correctedBiasMW": 0.0, "maeImprovementPercent": 0.0, "bandCoveragePercent": 0.0,
        }

    n = len(corrected_errors)
    raw_mae = sum(raw_abs) / n
    corr_mae = sum(abs(e) for e in corrected_errors) / n
    return {
        "daysEvaluated": days_evaluated,
        "lookbackDays": lookback_days,
        "rawMaeMW": round(raw_mae, 1),
        "correctedMaeMW": round(corr_mae, 1),
        "correctedRmseMW": round(math.sqrt(sum(e * e for e in corrected_errors) / n), 1),
        "correctedBiasMW": round(sum(corrected_errors) / n, 1),
        "maeImprovementPercent": round((raw_mae - corr_mae) / raw_mae * 100.0, 1) if raw_mae > 0 else 0.0,
        # Share of actuals inside the nominal P10-P90 band (nominal target: 80%).
        "bandCoveragePercent": round(inside / total * 100.0, 1),
    }


def compute_decision_brief(
    all_records: List[Dict[str, Any]],
    delivery_date: date,
    lookback_days: int = 7,
) -> Dict[str, Any]:
    """
    Decision brief for one delivery day: the forecast the buyer sees at the cutoff,
    a bias-corrected view, and a P10-P90 band for the *corrected* forecast, both
    estimated from data available at decision time (actuals up to D-2).
    Actuals are included for the backtest only (they are unknown on D-1).
    """
    valid = _valid(all_records)
    day = sorted(
        (r for r in all_records if r["settlementDate"] == delivery_date.isoformat()),
        key=lambda r: r["startTime"],
    )
    params = _correction_params(valid, delivery_date, lookback_days)
    has_history = params is not None
    bias = params["bias"] if params else 0.0
    # actual ≈ corrected - residual  =>  P10(actual) uses P90(residual) and vice versa
    q_hi = params["q_hi"] if params else 0.0
    q_lo = params["q_lo"] if params else 0.0

    periods: List[Dict[str, Any]] = []
    for r in day:
        fc: Optional[float] = r.get("forecastMW")
        corrected = round(fc - bias, 1) if fc is not None else None
        periods.append({
            "startTime": r["startTime"],
            "settlementPeriod": r["settlementPeriod"],
            "forecastMW": fc,
            "publishTime": r.get("publishTime"),
            "correctedForecastMW": corrected,
            "lowerMW": round(max(corrected - q_hi, 0.0), 1) if has_history and corrected is not None else None,
            "upperMW": round(corrected - q_lo, 1) if has_history and corrected is not None else None,
            "actualMW": r.get("actualMW"),
        })

    fcs = [p["forecastMW"] for p in periods if p["forecastMW"] is not None]
    pubs = sorted({p["publishTime"] for p in periods if p["publishTime"]})
    day_valid = _valid(day)
    inside = [p for p in periods if p["lowerMW"] is not None and p["actualMW"] is not None]
    day_metrics = compute_metrics_for_records(day_valid)
    corr_abs = [abs(p["correctedForecastMW"] - p["actualMW"]) for p in periods
                if p["correctedForecastMW"] is not None and p["actualMW"] is not None]

    return {
        "deliveryDate": delivery_date.isoformat(),
        "hasHistory": has_history,
        "historyDays": round(params["history_days"], 1) if params else 0.0,
        "lookbackDays": lookback_days,
        "estimatedBiasMW": round(bias, 1),
        "periods": periods,
        "meanForecastMW": round(sum(fcs) / len(fcs), 1) if fcs else 0.0,
        "meanCorrectedMW": round(sum(fcs) / len(fcs) - bias, 1) if fcs else 0.0,
        "earliestPublishTime": pubs[0] if pubs else None,
        "latestPublishTime": pubs[-1] if pubs else None,
        "forecastRunsUsed": len(pubs),
        "rawMaeMW": day_metrics["maeMW"],
        "correctedMaeMW": round(sum(corr_abs) / len(corr_abs), 1) if corr_abs else 0.0,
        "bandCoveragePercent": round(
            sum(1 for p in inside if p["lowerMW"] <= p["actualMW"] <= p["upperMW"]) / len(inside) * 100.0, 1
        ) if inside else None,
    }
