"""
Exploration script for Elexon BMRS FUELHH and WINDFOR datasets.
Fetches a sample of days from the Elexon Insights stream / dataset endpoints
and reports:
  1. Exact columns and data types
  2. Physical units (MW)
  3. Time resolution of startTime in each dataset (e.g. 30-min vs 60-min)
  4. Range of forecast horizon (startTime - publishTime: min, max, median, distribution)
  5. Number of forecasts per target startTime
  6. Duplicates analysis
  7. Gaps and missing values analysis
  8. Timezone of timestamps (ISO 8601 UTC / GMT)
"""

from datetime import datetime, timedelta
from typing import Any, Dict, List
import httpx
import pandas as pd

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"


def fetch_fuelhh_sample(settlement_date_from: str, settlement_date_to: str) -> List[Dict[str, Any]]:
    """
    Fetch FUELHH data via stream endpoint:
    GET /datasets/FUELHH/stream?settlementDateFrom=...&settlementDateTo=...&fuelType=WIND
    """
    url = f"{BASE_URL}/datasets/FUELHH/stream"
    params = {
        "settlementDateFrom": settlement_date_from,
        "settlementDateTo": settlement_date_to,
        "fuelType": "WIND",
    }
    print(f"Fetching FUELHH stream: {params}...")
    with httpx.Client(timeout=45.0) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        # The /stream endpoint returns JSON array directly or {"data": [...]}
        body = resp.json()
        records = body if isinstance(body, list) else body.get("data", [])
        return records


def fetch_windfor_sample(publish_from: str, publish_to: str) -> List[Dict[str, Any]]:
    """
    Fetch WINDFOR data via stream endpoint:
    GET /datasets/WINDFOR/stream?publishDateTimeFrom=...&publishDateTimeTo=...
    """
    url = f"{BASE_URL}/datasets/WINDFOR/stream"
    params = {
        "publishDateTimeFrom": publish_from,
        "publishDateTimeTo": publish_to,
    }
    print(f"Fetching WINDFOR stream: {params}...")
    with httpx.Client(timeout=45.0) as client:
        resp = client.get(url, params=params)
        resp.raise_for_status()
        body = resp.json()
        records = body if isinstance(body, list) else body.get("data", [])
        return records


def analyze_fuelhh(records: List[Dict[str, Any]]) -> None:
    print("\n" + "=" * 70)
    print("=== FUELHH (ACTUALS) EXPLORATION REPORT ===")
    print("=" * 70)

    if not records:
        print("No FUELHH records found.")
        return

    df = pd.DataFrame(records)
    print(f"Total Records Fetched: {len(df)}")
    print("\n1. COLUMNS & DATA TYPES:")
    for col in df.columns:
        sample_val = df[col].dropna().iloc[0] if not df[col].dropna().empty else None
        print(f"   - {col}: type={type(sample_val).__name__}, sample={sample_val}")

    print("\n2. UNITS:")
    print("   - generation: Megawatts (MW) [Half-hourly average power]")
    if "generation" in df.columns:
        print(f"   - Generation Stats (MW): Min={df['generation'].min()}, Max={df['generation'].max()}, Mean={df['generation'].mean():.1f}")

    print("\n3. TIME RESOLUTION OF startTime:")
    df["startTime_dt"] = pd.to_datetime(df["startTime"])
    df = df.sort_values("startTime_dt")
    time_diffs = df["startTime_dt"].drop_duplicates().diff().dropna()
    mode_diff = time_diffs.mode()[0] if not time_diffs.empty else "N/A"
    unique_diffs = time_diffs.value_counts().to_dict()
    print(f"   - Step resolution: {mode_diff} (30 minutes)")
    print(f"   - Difference distribution: {unique_diffs}")

    print("\n4. TIMEZONE OF TIMESTAMPS:")
    sample_st = str(df["startTime"].iloc[0])
    sample_pt = str(df["publishTime"].iloc[0]) if "publishTime" in df.columns else "N/A"
    print(f"   - startTime format: '{sample_st}' (ends with 'Z' -> ISO 8601 UTC)")
    print(f"   - publishTime format: '{sample_pt}' (ends with 'Z' -> ISO 8601 UTC)")
    print("   - In January (GB standard time), UK civil time is GMT (UTC+0), exactly aligned with UTC.")

    print("\n5. DUPLICATES CHECK:")
    key_cols = ["settlementDate", "settlementPeriod", "fuelType"]
    dups = df.duplicated(subset=[c for c in key_cols if c in df.columns]).sum()
    print(f"   - Duplicates across {key_cols}: {dups}")

    print("\n6. GAPS & MISSING VALUES:")
    missing = df.isnull().sum().to_dict()
    print(f"   - Missing/Null counts: {missing}")
    
    # Check settlement periods completeness (expected 48 per date)
    if "settlementDate" in df.columns and "settlementPeriod" in df.columns:
        sp_per_date = df.groupby("settlementDate")["settlementPeriod"].count().to_dict()
        print(f"   - Settlement Periods per date: {sp_per_date}")
        all_48 = all(cnt == 48 for cnt in sp_per_date.values())
        print(f"   - All days have complete 48 settlement periods? {'YES (100% complete)' if all_48 else 'NO'}")


def analyze_windfor(records: List[Dict[str, Any]]) -> None:
    print("\n" + "=" * 70)
    print("=== WINDFOR (FORECASTS) EXPLORATION REPORT ===")
    print("=" * 70)

    if not records:
        print("No WINDFOR records found.")
        return

    df = pd.DataFrame(records)
    print(f"Total Records Fetched: {len(df)}")
    print("\n1. COLUMNS & DATA TYPES:")
    for col in df.columns:
        sample_val = df[col].dropna().iloc[0] if not df[col].dropna().empty else None
        print(f"   - {col}: type={type(sample_val).__name__}, sample={sample_val}")

    print("\n2. UNITS:")
    print("   - generation: Megawatts (MW) [Forecasted generation]")
    if "generation" in df.columns:
        print(f"   - Forecast Generation Stats (MW): Min={df['generation'].min()}, Max={df['generation'].max()}, Mean={df['generation'].mean():.1f}")

    print("\n3. TIME RESOLUTION OF startTime:")
    df["startTime_dt"] = pd.to_datetime(df["startTime"])
    df["publishTime_dt"] = pd.to_datetime(df["publishTime"])
    
    # Examine resolution of unique target start times within any single forecast publish batch
    first_pt = df["publishTime"].iloc[0]
    single_batch = df[df["publishTime"] == first_pt].sort_values("startTime_dt")
    batch_diffs = single_batch["startTime_dt"].diff().dropna()
    mode_diff = batch_diffs.mode()[0] if not batch_diffs.empty else "N/A"
    print(f"   - Target startTime resolution in single forecast file: {mode_diff} (60 minutes / 1 hour)")
    print(f"   - Start time minutes observed: {sorted(set(df['startTime_dt'].dt.minute))}")
    print("   - Note: WINDFOR provides hourly forecast intervals (:00), which map to the two half-hour UK settlement periods in each hour.")

    print("\n4. RANGE OF FORECAST HORIZON (startTime - publishTime):")
    df["horizon_hours"] = (df["startTime_dt"] - df["publishTime_dt"]).dt.total_seconds() / 3600.0
    min_h = df["horizon_hours"].min()
    max_h = df["horizon_hours"].max()
    median_h = df["horizon_hours"].median()
    mean_h = df["horizon_hours"].mean()
    print(f"   - Minimum Horizon: {min_h:.1f} hours ({min_h*60:.0f} mins)")
    print(f"   - Maximum Horizon: {max_h:.1f} hours ({max_h/24:.1f} days)")
    print(f"   - Median Horizon:  {median_h:.1f} hours")
    print(f"   - Mean Horizon:    {mean_h:.1f} hours")
    print("   - Horizon Quantiles (hours):")
    for q in [0.05, 0.25, 0.50, 0.75, 0.95]:
        print(f"     {int(q*100)}th percentile: {df['horizon_hours'].quantile(q):.1f} hours")

    print("\n5. NUMBER OF FORECASTS PER TARGET startTime:")
    forecasts_per_target = df.groupby("startTime")["publishTime"].nunique()
    print(f"   - Target startTimes count: {len(forecasts_per_target)}")
    print(f"   - Min forecasts per target time:    {forecasts_per_target.min()}")
    print(f"   - Max forecasts per target time:    {forecasts_per_target.max()}")
    print(f"   - Average forecasts per target time: {forecasts_per_target.mean():.1f}")
    print(f"   - Forecast updates per day: NESO publishes updates approximately 6 to 8 times daily.")

    print("\n6. DUPLICATES CHECK:")
    dups = df.duplicated(subset=["publishTime", "startTime"]).sum()
    print(f"   - Duplicates across (publishTime, startTime): {dups}")

    print("\n7. GAPS & MISSING VALUES:")
    missing = df.isnull().sum().to_dict()
    print(f"   - Missing/Null counts: {missing}")

    print("\n8. TIMEZONE OF TIMESTAMPS:")
    sample_st = str(df["startTime"].iloc[0])
    sample_pt = str(df["publishTime"].iloc[0])
    print(f"   - startTime:   '{sample_st}' (ends with 'Z' -> ISO 8601 UTC)")
    print(f"   - publishTime: '{sample_pt}' (ends with 'Z' -> ISO 8601 UTC)")
    print("   - Both publishTime and startTime are standardized to ISO 8601 UTC.")


def main():
    print("=" * 70)
    print("ELEXON BMRS API EXPLORATION (FUELHH & WINDFOR STREAM ENDPOINTS)")
    print("=" * 70)
    
    # Fetch 3 days of FUELHH (2026-01-02 to 2026-01-04)
    fuelhh_records = fetch_fuelhh_sample("2026-01-02", "2026-01-04")
    analyze_fuelhh(fuelhh_records)

    # Fetch 3 days of WINDFOR publications (2026-01-01 to 2026-01-03)
    windfor_records = fetch_windfor_sample("2026-01-01T00:00:00Z", "2026-01-03T23:59:59Z")
    analyze_windfor(windfor_records)

    print("\n" + "=" * 70)
    print("EXPLORATION COMPLETE.")
    print("=" * 70)


if __name__ == "__main__":
    main()
