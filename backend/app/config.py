"""Application configuration (env-overridable where it matters for deployment)."""

import os
from datetime import date
from typing import List


class Settings:
    PROJECT_NAME: str = "UK Wind Power Forecast Portal"
    # Decision cutoff on D-1, UK local time. January is GMT, so UK time == UTC.
    DEFAULT_CUTOFF: str = "09:00"
    # Decisions made 1-31 Jan 2026 => delivery days 2 Jan - 1 Feb 2026.
    DEFAULT_DATE_FROM: date = date(2026, 1, 2)
    DEFAULT_DATE_TO: date = date(2026, 2, 1)
    CANDIDATE_CUTOFFS: List[str] = [
        "05:00", "06:00", "07:00", "08:00", "09:00",
        "10:00", "11:00", "12:00", "14:00", "17:00",
    ]
    # Days of prior actuals used to estimate forecast bias at decision time.
    BIAS_LOOKBACK_DAYS: int = 7
    # Comma-separated list of allowed browser origins (only needed when the
    # frontend is served from a different origin, e.g. Vite dev server).
    CORS_ORIGINS: List[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
        if o.strip()
    ]


settings = Settings()
