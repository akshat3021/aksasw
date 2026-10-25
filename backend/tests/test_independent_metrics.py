"""
Independent cross-check: recompute the headline numbers straight from the raw JSON
with deliberately separate, naive code (no app.* helpers), and require the API to agree.
Also asserts data completeness for the January-2026 delivery window.
"""

import json
import math
import os
from datetime import datetime, timedelta

from fastapi.testclient import TestClient

from app.main import app

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
client = TestClient(app)


def _load(name):
    with open(os.path.join(DATA_DIR, name), encoding="utf-8") as f:
        return json.load(f)


def test_actuals_complete_for_delivery_window():
    actuals = _load("fuelhh_wind_jan2026.json")
    days = sorted({r["settlementDate"] for r in actuals})
    assert days[0] == "2026-01-02" and days[-1] == "2026-02-01" and len(days) == 31
    assert all(r["fuelType"] == "WIND" and r["generation"] is not None for r in actuals)
    for d in days:
        periods = sorted(r["settlementPeriod"] for r in actuals if r["settlementDate"] == d)
        assert periods == list(range(1, 49)), f"{d} does not have exactly 48 settlement periods"


def test_forecasts_have_no_nulls_or_duplicates():
    forecasts = _load("windfor_jan2026.json")
    assert all(r["generation"] is not None for r in forecasts)
    assert len({(r["publishTime"], r["startTime"]) for r in forecasts}) == len(forecasts)


def test_api_metrics_match_independent_recomputation():
    actuals = _load("fuelhh_wind_jan2026.json")
    forecasts = _load("windfor_jan2026.json")

    by_start = {}
    for r in forecasts:
        by_start.setdefault(r["startTime"], []).append((r["publishTime"], r["generation"]))

    errors = []
    for a in actuals:
        decision_day = datetime.strptime(a["settlementDate"], "%Y-%m-%d") - timedelta(days=1)
        cutoff = decision_day.strftime("%Y-%m-%dT09:00:00Z")
        hour = a["startTime"][:14] + "00:00Z"
        eligible = [x for x in by_start.get(hour, []) if x[0] <= cutoff]
        assert eligible, f"no eligible forecast for {a['startTime']}"
        latest = max(eligible)  # tuples sort by publishTime first
        errors.append(latest[1] - a["generation"])

    n = len(errors)
    mae = sum(abs(e) for e in errors) / n
    rmse = math.sqrt(sum(e * e for e in errors) / n)
    bias = sum(errors) / n

    summary = client.get("/api/metrics/summary").json()
    assert summary["matchedPeriods"] == summary["totalPeriods"] == n == 1488
    assert summary["maeMW"] == round(mae, 2)
    assert summary["rmseMW"] == round(rmse, 2)
    assert summary["biasMW"] == round(bias, 2)
