"""
Data loader and cache for Elexon BMRS datasets.
Loads FUELHH (fuelType=WIND) and WINDFOR data from JSON storage.
"""

import json
import os
from typing import Any, Dict, List, Optional

_FUELHH_CACHE: Optional[List[Dict[str, Any]]] = None
_WINDFOR_CACHE: Optional[List[Dict[str, Any]]] = None

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
FUELHH_FILE = os.path.join(DATA_DIR, "fuelhh_wind_jan2026.json")
WINDFOR_FILE = os.path.join(DATA_DIR, "windfor_jan2026.json")


def load_fuelhh_wind_data() -> List[Dict[str, Any]]:
    """Load FUELHH wind actuals from local storage with memoization."""
    global _FUELHH_CACHE
    if _FUELHH_CACHE is not None:
        return _FUELHH_CACHE

    if not os.path.exists(FUELHH_FILE):
        return []

    with open(FUELHH_FILE, "r", encoding="utf-8") as f:
        _FUELHH_CACHE = json.load(f)
    return _FUELHH_CACHE or []


def load_windfor_data() -> List[Dict[str, Any]]:
    """Load WINDFOR forecasts from local storage with memoization."""
    global _WINDFOR_CACHE
    if _WINDFOR_CACHE is not None:
        return _WINDFOR_CACHE

    if not os.path.exists(WINDFOR_FILE):
        return []

    with open(WINDFOR_FILE, "r", encoding="utf-8") as f:
        _WINDFOR_CACHE = json.load(f)
    return _WINDFOR_CACHE or []


def clear_cache() -> None:
    """Clear in-memory caches."""
    global _FUELHH_CACHE, _WINDFOR_CACHE
    _FUELHH_CACHE = None
    _WINDFOR_CACHE = None
