"""
Tests for decision-risk analytics:
1. Error percentiles.
2. No look-ahead: corrections for delivery day D only use actuals up to D-2.
3. Out-of-sample bias-correction backtest.
4. Decision brief + API validation of the delivery window.
"""

from datetime import date, timedelta
from typing import Dict, List, Optional

from fastapi.testclient import TestClient

from app.main import app
from app.metrics_service import (
    compute_decision_brief,
    compute_metrics_for_records,
    compute_rolling_bias_correction,
)

client = TestClient(app)


def _days(error_by_day: Dict[str, float], actual: float = 1000.0) -> List[Dict]:
    """48 periods per day; forecast = actual + the day's constant error."""
    records = []
    for day_str, err in error_by_day.items():
        for sp in range(1, 49):
            records.append({
                "startTime": f"{day_str}T{(sp - 1) // 2:02d}:{'30' if sp % 2 == 0 else '00'}:00Z",
                "settlementDate": day_str,
                "settlementPeriod": sp,
                "actualMW": actual,
                "forecastMW": actual + err,
                "publishTime": f"{day_str}T00:00:00Z",
            })
    return records


def _series(start: date, n: int, err: float = 100.0, overrides: Optional[Dict[str, float]] = None):
    out = {(start + timedelta(days=i)).isoformat(): err for i in range(n)}
    out.update(overrides or {})
    return _days(out)


def test_error_percentiles():
    recs = [{"actualMW": 100.0, "forecastMW": 100.0 + e, "settlementPeriod": 1, "settlementDate": "2026-01-02"}
            for e in range(0, 101)]  # errors 0..100
    m = compute_metrics_for_records(recs)
    assert m["p50AbsErrorMW"] == 50.0
    assert m["p90AbsErrorMW"] == 90.0
    assert m["p95AbsErrorMW"] == 95.0
    assert m["p10ErrorMW"] == 10.0


def test_brief_never_uses_actuals_from_d_minus_1_or_later():
    # Constant +100 error, except D-1 (Jan 9) and D (Jan 10) which carry a huge error.
    recs = _series(date(2026, 1, 2), 9, overrides={"2026-01-09": 9999.0, "2026-01-10": 9999.0})
    brief = compute_decision_brief(recs, date(2026, 1, 10), lookback_days=7)
    assert brief["hasHistory"] is True
    assert brief["estimatedBiasMW"] == 100.0  # Jan 9 / Jan 10 errors must not leak in


def test_brief_without_history_has_no_band():
    recs = _series(date(2026, 1, 2), 3)
    brief = compute_decision_brief(recs, date(2026, 1, 3))  # history would need Jan 1 or earlier
    assert brief["hasHistory"] is False
    assert all(p["lowerMW"] is None and p["upperMW"] is None for p in brief["periods"])
    assert all(p["correctedForecastMW"] == p["forecastMW"] for p in brief["periods"])


def test_brief_band_is_ordered_and_non_negative():
    errs = {(date(2026, 1, 2) + timedelta(days=i)).isoformat(): 50.0 + 40.0 * (i % 3) for i in range(12)}
    brief = compute_decision_brief(_days(errs), date(2026, 1, 12))
    assert brief["hasHistory"]
    for p in brief["periods"]:
        assert 0.0 <= p["lowerMW"] <= p["upperMW"]


def test_bias_backtest_removes_constant_bias():
    recs = _series(date(2026, 1, 2), 12, err=100.0)
    res = compute_rolling_bias_correction(recs, date(2026, 1, 2), date(2026, 1, 13))
    # Data spans Jan 2-13. Jan 2 and Jan 3 have no actuals up to D-2; Jan 4 is the first (uses Jan 2).
    assert res["daysEvaluated"] == 10
    assert res["rawMaeMW"] == 100.0
    assert res["correctedMaeMW"] == 0.0
    assert res["maeImprovementPercent"] == 100.0


def test_bias_backtest_empty_when_no_history():
    recs = _series(date(2026, 1, 2), 2)
    res = compute_rolling_bias_correction(recs, date(2026, 1, 2), date(2026, 1, 3))
    assert res["daysEvaluated"] == 0 and res["correctedMaeMW"] == 0.0


# --- API -------------------------------------------------------------------

def test_decision_brief_endpoint_real_data():
    r = client.get("/api/decision-brief", params={"delivery_date": "2026-01-15", "cutoff_time": "09:00"})
    assert r.status_code == 200
    body = r.json()
    assert body["decisionTimestamp"] == "2026-01-14T09:00:00Z"
    assert len(body["periods"]) == 48
    # Core rule: the forecast run used must be published at or before the cutoff.
    assert body["latestPublishTime"] <= body["decisionTimestamp"]


def test_every_decision_forecast_is_published_before_cutoff_on_real_data():
    r = client.get("/api/forecasts")
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) == 1488 and all(x["forecastMW"] is not None for x in rows)
    for x in rows:
        d = date.fromisoformat(x["settlementDate"]) - timedelta(days=1)
        assert x["publishTime"] <= f"{d.isoformat()}T09:00:00Z"


def test_bias_correction_endpoint():
    r = client.get("/api/metrics/bias-correction")
    assert r.status_code == 200
    body = r.json()
    assert body["daysEvaluated"] > 20
    assert body["correctedMaeMW"] < body["rawMaeMW"]


def test_date_window_validation():
    assert client.get("/api/decision-brief", params={"delivery_date": "2026-03-01"}).status_code == 422
    assert client.get("/api/decision-brief", params={"delivery_date": "2026-01-01"}).status_code == 422
    bad_order = client.get("/api/forecasts", params={"delivery_date_from": "2026-01-10", "delivery_date_to": "2026-01-05"})
    assert bad_order.status_code == 422
    assert "Traceback" not in bad_order.text


def test_cors_is_not_wildcard():
    r = client.options(
        "/api/health",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert r.headers.get("access-control-allow-origin") != "*"
    assert "access-control-allow-origin" not in r.headers
