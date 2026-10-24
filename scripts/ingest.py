"""
Elexon BMRS Ingestion Pipeline for UK Wind Power Forecast Portal.
Fetches:
  1. FUELHH (fuelType=WIND only) for 2026-01-01 to 2026-02-02.
  2. WINDFOR (all forecasts published 2025-12-28T00:00:00Z to 2026-02-01T23:59:59Z).

Features:
  - Chunks queries (<= 6 days) to respect Elexon BMRS API limits.
  - Exponential backoff retry logic for rate limits (429) and network timeouts.
  - Normalizes timestamps to UTC datetime64[ns, UTC].
  - Deduplicates records and validates constraints.
  - Saves validated datasets as JSON to backend/data/ (the cache the app reads at runtime).
  - Idempotent and runnable via a single command: python scripts/ingest.py.
  - Logs summary row counts, storage size, and timeline gap analysis.
"""

from datetime import date, datetime, timedelta
import json
import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional
import httpx
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("ingest")

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(WORKSPACE_ROOT, "backend", "data")
ACTUALS_JSON = os.path.join(DATA_DIR, "fuelhh_wind_jan2026.json")
FORECASTS_JSON = os.path.join(DATA_DIR, "windfor_jan2026.json")
# Delivery window for January-2026 decisions (decision on D-1 => D in 2 Jan..1 Feb).
DELIVERY_FROM = "2026-01-02"
DELIVERY_TO = "2026-02-01"


def _iso_z(series: pd.Series) -> pd.Series:
    """UTC datetimes -> 'YYYY-MM-DDTHH:MM:SSZ' strings (format the app compares lexicographically)."""
    return pd.to_datetime(series, utc=True).dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def to_actuals_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """FUELHH WIND rows within the delivery window, in the app's JSON schema."""
    out = df[(df["settlementDate"] >= DELIVERY_FROM) & (df["settlementDate"] <= DELIVERY_TO)].copy()
    out["publishTime"] = _iso_z(out["publishTime"])
    out["startTime"] = _iso_z(out["startTime"])
    out["dataset"] = "FUELHH"
    out["fuelType"] = "WIND"
    out = out.sort_values(["settlementDate", "settlementPeriod"])
    cols = ["dataset", "publishTime", "startTime", "settlementDate", "settlementPeriod", "fuelType", "generation"]
    return out[cols].to_dict(orient="records")


def to_forecast_records(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """WINDFOR rows in the app's JSON schema."""
    out = df.copy()
    out["publishTime"] = _iso_z(out["publishTime"])
    out["startTime"] = _iso_z(out["startTime"])
    out["dataset"] = "WINDFOR"
    out = out.sort_values(["publishTime", "startTime"])
    return out[["dataset", "publishTime", "startTime", "generation"]].to_dict(orient="records")


def save_json(records: List[Dict[str, Any]], path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(records, f, separators=(",", ":"))


def fetch_with_retry(
    url: str,
    params: Dict[str, Any],
    max_retries: int = 5,
    backoff_base: float = 2.0,
    timeout: float = 45.0,
) -> List[Dict[str, Any]]:
    """
    Execute HTTP GET request with exponential backoff on 429 and transient errors.
    """
    for attempt in range(1, max_retries + 1):
        try:
            with httpx.Client(timeout=timeout) as client:
                response = client.get(url, params=params)

                # Rate limiting
                if response.status_code == 429:
                    retry_after = float(response.headers.get("Retry-After", backoff_base ** attempt))
                    logger.warning(
                        "Rate limit (429) hit. Backing off for %.1fs (attempt %d/%d)...",
                        retry_after, attempt, max_retries
                    )
                    time.sleep(retry_after)
                    continue

                response.raise_for_status()
                body = response.json()
                if isinstance(body, list):
                    return body
                return body.get("data", [])

        except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as exc:
            wait_time = backoff_base ** attempt
            if attempt == max_retries:
                logger.error("Request failed after %d attempts for %s with params %s: %s", max_retries, url, params, exc)
                raise
            logger.warning(
                "Request error (%s). Retrying in %.1fs (attempt %d/%d)...",
                exc, wait_time, attempt, max_retries
            )
            time.sleep(wait_time)

    return []


# -------------------------------------------------------------------------
# FUELHH Ingestion (Actuals: fuelType=WIND)
# -------------------------------------------------------------------------

def ingest_fuelhh(start_date: date, end_date: date) -> pd.DataFrame:
    """
    Fetch FUELHH wind actuals in <=6 day chunks between start_date and end_date.
    API limit rule: settlementDateFrom to settlementDateTo inclusive <= 7 days.
    """
    logger.info("=== Starting FUELHH Ingestion (%s to %s) ===", start_date, end_date)
    all_records: List[Dict[str, Any]] = []

    curr_start = start_date
    while curr_start <= end_date:
        curr_end = min(curr_start + timedelta(days=5), end_date)
        params = {
            "settlementDateFrom": curr_start.isoformat(),
            "settlementDateTo": curr_end.isoformat(),
            "fuelType": "WIND",
            "format": "json",
        }
        logger.info("Fetching FUELHH chunk: %s to %s...", curr_start, curr_end)
        chunk = fetch_with_retry(f"{BASE_URL}/datasets/FUELHH", params=params)

        wind_only = [
            r for r in chunk
            if r.get("fuelType") == "WIND" and r.get("startTime") and r.get("generation") is not None
        ]
        logger.info("  Received %d wind records for chunk %s -> %s", len(wind_only), curr_start, curr_end)
        all_records.extend(wind_only)

        curr_start = curr_end + timedelta(days=1)
        time.sleep(0.3)  # Gentle spacing between API calls

    if not all_records:
        raise ValueError("No FUELHH wind records were retrieved from Elexon BMRS API.")

    df = pd.DataFrame(all_records)

    # 1. Deduplication
    initial_len = len(df)
    key_cols = ["settlementDate", "settlementPeriod", "fuelType"]
    df = df.drop_duplicates(subset=[c for c in key_cols if c in df.columns])
    logger.info("Deduplication: %d -> %d records (%d duplicates removed)", initial_len, len(df), initial_len - len(df))

    # 2. Normalize timestamps to UTC
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    if "publishTime" in df.columns:
        df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)

    # 3. Type casting & Validation
    df["generation"] = df["generation"].astype(float)
    df["settlementPeriod"] = df["settlementPeriod"].astype(int)
    df["settlementDate"] = df["settlementDate"].astype(str)

    # Validation constraints
    invalid_gen = df[df["generation"] < 0]
    if not invalid_gen.empty:
        logger.warning("Found %d negative generation records; clamping to 0.0", len(invalid_gen))
        df["generation"] = df["generation"].clip(lower=0.0)

    # Sort chronologically
    df = df.sort_values(["startTime", "settlementPeriod"]).reset_index(drop=True)

    # Select standard clean schema
    cols_to_keep = ["settlementDate", "settlementPeriod", "startTime", "fuelType", "generation"]
    if "publishTime" in df.columns:
        cols_to_keep.append("publishTime")
    df = df[[c for c in cols_to_keep if c in df.columns]]

    # 4. Gap Analysis
    expected_days = (end_date - start_date).days + 1
    actual_days = df["settlementDate"].nunique()
    expected_periods = expected_days * 48
    actual_periods = len(df)
    logger.info("FUELHH Gap Analysis:")
    logger.info("  Expected Delivery Days: %d | Actual Days: %d", expected_days, actual_days)
    logger.info("  Expected Settlement Periods: %d | Actual Periods: %d", expected_periods, actual_periods)

    sp_counts = df.groupby("settlementDate")["settlementPeriod"].count()
    incomplete_days = sp_counts[sp_counts != 48]
    if not incomplete_days.empty:
        logger.warning("Incomplete settlement period days found: %s", incomplete_days.to_dict())
    else:
        logger.info("  [100% Complete] All %d delivery days have exactly 48 half-hour settlement periods.", actual_days)

    return df


# -------------------------------------------------------------------------
# WINDFOR Ingestion (Forecasts)
# -------------------------------------------------------------------------

def ingest_windfor(publish_start: datetime, publish_end: datetime) -> pd.DataFrame:
    """
    Fetch WINDFOR forecast publications in <=6 day chunks.
    publishTime range: 2025-12-28T00:00:00Z to 2026-02-01T23:59:59Z.
    """
    logger.info("=== Starting WINDFOR Ingestion (%s to %s) ===", publish_start.isoformat(), publish_end.isoformat())
    all_records: List[Dict[str, Any]] = []

    curr_start = publish_start
    while curr_start <= publish_end:
        curr_end = min(curr_start + timedelta(days=5), publish_end)
        params = {
            "publishDateTimeFrom": curr_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "publishDateTimeTo": curr_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "format": "json",
        }
        logger.info("Fetching WINDFOR chunk: %s to %s...", params["publishDateTimeFrom"], params["publishDateTimeTo"])
        chunk = fetch_with_retry(f"{BASE_URL}/datasets/WINDFOR", params=params)

        valid_forecasts = [
            r for r in chunk
            if r.get("startTime") and r.get("publishTime") and r.get("generation") is not None
        ]
        logger.info("  Received %d forecast records for chunk", len(valid_forecasts))
        all_records.extend(valid_forecasts)

        curr_start = curr_end + timedelta(seconds=1)
        time.sleep(0.3)

    if not all_records:
        raise ValueError("No WINDFOR forecast records were retrieved from Elexon BMRS API.")

    df = pd.DataFrame(all_records)

    # 1. Deduplication across (publishTime, startTime)
    initial_len = len(df)
    df = df.drop_duplicates(subset=["publishTime", "startTime"])
    logger.info("Deduplication: %d -> %d records (%d duplicates removed)", initial_len, len(df), initial_len - len(df))

    # 2. Normalize timestamps to UTC
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df["publishTime"] = pd.to_datetime(df["publishTime"], utc=True)

    # 3. Type casting & Validation
    df["generation"] = df["generation"].astype(float)
    invalid_gen = df[df["generation"] < 0]
    if not invalid_gen.empty:
        logger.warning("Found %d negative forecast generation values; clamping to 0.0", len(invalid_gen))
        df["generation"] = df["generation"].clip(lower=0.0)

    # Sort chronologically by publishTime and target startTime
    df = df.sort_values(["publishTime", "startTime"]).reset_index(drop=True)

    # 4. Forecast Horizon and Target Coverage Analysis
    df["horizon_hours"] = (df["startTime"] - df["publishTime"]).dt.total_seconds() / 3600.0
    logger.info("WINDFOR Forecast Horizon Metrics:")
    logger.info("  Minimum Horizon: %.1f hours", df["horizon_hours"].min())
    logger.info("  Maximum Horizon: %.1f hours (%.1f days ahead)", df["horizon_hours"].max(), df["horizon_hours"].max() / 24.0)
    logger.info("  Median Horizon:  %.1f hours", df["horizon_hours"].median())

    target_start_min = df["startTime"].min()
    target_start_max = df["startTime"].max()
    unique_targets = df["startTime"].nunique()
    logger.info("Target StartTime Coverage:")
    logger.info("  Earliest target startTime: %s", target_start_min)
    logger.info("  Latest target startTime:   %s", target_start_max)
    logger.info("  Unique target startTimes:  %d", unique_targets)

    # Select standard clean schema
    cols = ["publishTime", "startTime", "generation"]
    df = df[cols]

    return df


def main() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)
    start_wall = time.time()

    # 1. FUELHH Delivery Window: 2026-01-01 to 2026-02-02
    fuelhh_df = ingest_fuelhh(start_date=date(2026, 1, 1), end_date=date(2026, 2, 2))
    actuals = to_actuals_records(fuelhh_df)
    save_json(actuals, ACTUALS_JSON)
    logger.info("Saved actuals: %s (%d rows)", ACTUALS_JSON, len(actuals))

    # 2. WINDFOR Publish Window: 2025-12-28 to 2026-02-01
    publish_start = datetime(2025, 12, 28, 0, 0, 0)
    publish_end = datetime(2026, 2, 1, 23, 59, 59)
    windfor_df = ingest_windfor(publish_start=publish_start, publish_end=publish_end)
    forecasts = to_forecast_records(windfor_df)
    save_json(forecasts, FORECASTS_JSON)
    logger.info("Saved forecasts: %s (%d rows)", FORECASTS_JSON, len(forecasts))

    elapsed = time.time() - start_wall
    logger.info("=== Ingestion Pipeline Complete in %.1fs ===", elapsed)


if __name__ == "__main__":
    main()
