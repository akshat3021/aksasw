"""
Elexon BMRS Data Fetcher for Wind Power Forecast Portal.
Fetches FUELHH (filtered strictly to fuelType=WIND) and WINDFOR
for January 2026 purchase decisions (delivery window 2026-01-02 to 2026-02-01).
Data source: ONLY Elexon BMRS APIs.
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List
import httpx

BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend", "data")


def fetch_fuelhh_chunk(date_from: str, date_to: str) -> List[Dict[str, Any]]:
    """Fetch FUELHH records for a date range (<= 7 days) and filter to fuelType=WIND."""
    url = f"{BASE_URL}/datasets/fuelhh?settlementDateFrom={date_from}&settlementDateTo={date_to}&format=json"
    print(f"Fetching FUELHH: {date_from} -> {date_to}...")
    with httpx.Client(timeout=45.0) as client:
        resp = client.get(url)
        resp.raise_for_status()
        records = resp.json().get("data", [])
        wind_records = [
            {
                "dataset": "FUELHH",
                "publishTime": r.get("publishTime"),
                "startTime": r.get("startTime"),
                "settlementDate": r.get("settlementDate"),
                "settlementPeriod": r.get("settlementPeriod"),
                "fuelType": "WIND",
                "generation": float(r.get("generation", 0.0)),
            }
            for r in records
            if r.get("fuelType") == "WIND"
        ]
        print(f"  Got {len(wind_records)} WIND records (out of {len(records)} total).")
        return wind_records


def fetch_windfor_chunk(dt_from: str, dt_to: str) -> List[Dict[str, Any]]:
    """Fetch WINDFOR forecast records published between dt_from and dt_to (<= 7 days)."""
    url = f"{BASE_URL}/datasets/WINDFOR?publishDateTimeFrom={dt_from}&publishDateTimeTo={dt_to}&format=json"
    print(f"Fetching WINDFOR: {dt_from} -> {dt_to}...")
    with httpx.Client(timeout=45.0) as client:
        resp = client.get(url)
        resp.raise_for_status()
        records = resp.json().get("data", [])
        formatted_records = [
            {
                "dataset": "WINDFOR",
                "publishTime": r.get("publishTime"),
                "startTime": r.get("startTime"),
                "generation": float(r.get("generation", 0.0)),
            }
            for r in records
            if r.get("startTime") and r.get("publishTime")
        ]
        print(f"  Got {len(formatted_records)} WINDFOR forecast records.")
        return formatted_records


def main() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # 1. Fetch FUELHH for delivery days 2026-01-02 to 2026-02-01 in 6-day chunks
    fuelhh_ranges = [
        ("2026-01-02", "2026-01-07"),
        ("2026-01-08", "2026-01-13"),
        ("2026-01-14", "2026-01-19"),
        ("2026-01-20", "2026-01-25"),
        ("2026-01-26", "2026-01-31"),
        ("2026-02-01", "2026-02-01"),
    ]

    all_fuelhh: List[Dict[str, Any]] = []
    seen_fuelhh_keys = set()

    for d_from, d_to in fuelhh_ranges:
        try:
            chunk = fetch_fuelhh_chunk(d_from, d_to)
            for item in chunk:
                key = (item["settlementDate"], item["settlementPeriod"], item["startTime"])
                if key not in seen_fuelhh_keys:
                    seen_fuelhh_keys.add(key)
                    all_fuelhh.append(item)
            time.sleep(0.5)
        except Exception as e:
            print(f"Error fetching FUELHH {d_from}->{d_to}: {e}", file=sys.stderr)

    # Sort FUELHH chronologically
    all_fuelhh.sort(key=lambda x: x["startTime"])
    fuelhh_path = os.path.join(OUTPUT_DIR, "fuelhh_wind_jan2026.json")
    with open(fuelhh_path, "w", encoding="utf-8") as f:
        json.dump(all_fuelhh, f, indent=2)
    print(f"Successfully saved {len(all_fuelhh)} FUELHH wind records to {fuelhh_path}")

    # 2. Fetch WINDFOR for decisions made 2026-01-01 to 2026-01-31 in 6-day chunks
    windfor_ranges = [
        ("2026-01-01T00:00:00Z", "2026-01-07T00:00:00Z"),
        ("2026-01-07T00:00:00Z", "2026-01-13T00:00:00Z"),
        ("2026-01-13T00:00:00Z", "2026-01-19T00:00:00Z"),
        ("2026-01-19T00:00:00Z", "2026-01-25T00:00:00Z"),
        ("2026-01-25T00:00:00Z", "2026-01-31T23:59:59Z"),
    ]

    all_windfor: List[Dict[str, Any]] = []
    seen_windfor_keys = set()

    for dt_from, dt_to in windfor_ranges:
        try:
            chunk = fetch_windfor_chunk(dt_from, dt_to)
            for item in chunk:
                key = (item["publishTime"], item["startTime"])
                if key not in seen_windfor_keys:
                    seen_windfor_keys.add(key)
                    all_windfor.append(item)
            time.sleep(0.5)
        except Exception as e:
            print(f"Error fetching WINDFOR {dt_from}->{dt_to}: {e}", file=sys.stderr)

    all_windfor.sort(key=lambda x: (x["publishTime"], x["startTime"]))
    windfor_path = os.path.join(OUTPUT_DIR, "windfor_jan2026.json")
    with open(windfor_path, "w", encoding="utf-8") as f:
        json.dump(all_windfor, f, indent=2)
    print(f"Successfully saved {len(all_windfor)} WINDFOR forecast records to {windfor_path}")


if __name__ == "__main__":
    main()
