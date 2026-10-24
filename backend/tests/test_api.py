"""
API integration and validation tests using FastAPI TestClient:
1. Health endpoint.
2. Forecasts query with valid and invalid cutoff times.
3. Summary metrics and date filters.
4. Diurnal profile and cutoff sensitivity.
5. Pydantic input validation error format (no stack traces).
"""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_health_check_endpoint():
    """Verify health check returns valid dataset counts."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["fuelhhRecordsCount"] == 1488
    assert data["windforRecordsCount"] > 10000


def test_get_forecasts_valid_params():
    """Verify forecast query returns valid settlement records."""
    response = client.get("/api/forecasts?delivery_date_from=2026-01-02&delivery_date_to=2026-01-02&cutoff_time=09:00")
    assert response.status_code == 200
    records = response.json()
    assert len(records) == 48  # Exactly 48 settlement periods for 1 day
    first = records[0]
    assert first["settlementPeriod"] == 1
    assert first["settlementDate"] == "2026-01-02"
    assert "actualMW" in first
    assert "forecastMW" in first


def test_invalid_cutoff_time_fails_validation():
    """Invalid cutoff time like '25:99' or 'abc' must return 422 with no stack trace."""
    response = client.get("/api/forecasts?cutoff_time=invalid_time")
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert "traceback" not in data


def test_summary_metrics_endpoint():
    """Verify summary metrics endpoint calculates valid numbers."""
    response = client.get("/api/metrics/summary?delivery_date_from=2026-01-02&delivery_date_to=2026-01-03&cutoff_time=09:00")
    assert response.status_code == 200
    data = response.json()
    assert data["totalPeriods"] == 96
    assert data["matchedPeriods"] == 96
    assert data["maeMW"] > 0
    assert data["wapePercent"] > 0
    assert data["totalActualMWh"] > 0


def test_daily_metrics_endpoint():
    """Verify daily metrics endpoint returns 2 days for 2-day query."""
    response = client.get("/api/metrics/daily?delivery_date_from=2026-01-02&delivery_date_to=2026-01-03&cutoff_time=09:00")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["settlementDate"] == "2026-01-02"
    assert data[1]["settlementDate"] == "2026-01-03"


def test_settlement_period_profile_endpoint():
    """Verify 48 diurnal periods returned."""
    response = client.get("/api/settlement-periods/profile?cutoff_time=09:00")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 48
    assert data[0]["settlementPeriod"] == 1
    assert data[47]["settlementPeriod"] == 48


def test_cutoff_sensitivity_endpoint():
    """Verify multiple cutoff times evaluated."""
    response = client.get("/api/metrics/cutoff-sensitivity?delivery_date_from=2026-01-02&delivery_date_to=2026-01-04")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    cutoffs = [item["cutoffTime"] for item in data]
    assert "09:00" in cutoffs
