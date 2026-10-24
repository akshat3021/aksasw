"""
FastAPI application for the UK Wind Power Forecast Portal.

Serves day-ahead decision forecasts, accuracy metrics, cutoff sensitivity and a
per-day Decision Brief. In production (Docker) it also serves the built React app.
"""

import logging
import os
from datetime import date
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .data_loader import load_fuelhh_wind_data, load_windfor_data
from .forecast_service import compute_cutoff_timestamp, get_merged_records
from .metrics_service import (
    compute_daily_breakdown,
    compute_decision_brief,
    compute_metrics_for_records,
    compute_rolling_bias_correction,
    compute_settlement_period_profile,
)
from .models import (
    BiasCorrectionBacktest,
    CutoffSensitivityItem,
    DailyMetricRecord,
    DecisionBrief,
    PeriodRecord,
    SettlementPeriodProfileRecord,
    SummaryMetrics,
)

logger = logging.getLogger("uvicorn.error")

CUTOFF_PATTERN = r"^(?:[01]\d|2[0-3]):[0-5]\d$"

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="UK day-ahead wind buying portal (Elexon BMRS FUELHH & WINDFOR, January 2026)",
    version="1.1.0",
)

# Only needed when the UI is served from another origin (Vite dev server).
# In production the UI and API share an origin, so no cross-origin access is granted.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["GET"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Log internally; never leak stack traces to the client."""
    logger.error("Internal application error: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal error occurred while processing your request."},
    )


def _validated_window(date_from: date, date_to: date) -> None:
    """Reject ranges outside the dataset's delivery window or in the wrong order."""
    lo, hi = settings.DEFAULT_DATE_FROM, settings.DEFAULT_DATE_TO
    if date_from > date_to:
        raise HTTPException(status_code=422, detail="delivery_date_from must be on or before delivery_date_to.")
    if date_from < lo or date_to > hi:
        raise HTTPException(
            status_code=422,
            detail=f"Delivery dates must be within {lo.isoformat()} and {hi.isoformat()}.",
        )


@app.get("/api/health")
def health_check() -> Dict[str, Any]:
    """Health check with dataset status."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "fuelhhRecordsCount": len(load_fuelhh_wind_data()),
        "windforRecordsCount": len(load_windfor_data()),
        "defaultCutoff": settings.DEFAULT_CUTOFF,
        "deliveryWindow": {
            "from": settings.DEFAULT_DATE_FROM.isoformat(),
            "to": settings.DEFAULT_DATE_TO.isoformat(),
        },
    }


@app.get("/api/forecasts", response_model=List[PeriodRecord])
def get_forecasts(
    delivery_date_from: date = Query(default=settings.DEFAULT_DATE_FROM),
    delivery_date_to: date = Query(default=settings.DEFAULT_DATE_TO),
    cutoff_time: str = Query(default=settings.DEFAULT_CUTOFF, pattern=CUTOFF_PATTERN),
    settlement_period: Optional[int] = Query(default=None, ge=1, le=48),
) -> List[PeriodRecord]:
    """Actuals and decision forecasts (latest published <= cutoff on D-1) per settlement period."""
    _validated_window(delivery_date_from, delivery_date_to)
    records = get_merged_records(cutoff_time, delivery_date_from, delivery_date_to, settlement_period)
    return [PeriodRecord(**r) for r in records]


@app.get("/api/metrics/summary", response_model=SummaryMetrics)
def get_summary_metrics(
    delivery_date_from: date = Query(default=settings.DEFAULT_DATE_FROM),
    delivery_date_to: date = Query(default=settings.DEFAULT_DATE_TO),
    cutoff_time: str = Query(default=settings.DEFAULT_CUTOFF, pattern=CUTOFF_PATTERN),
) -> SummaryMetrics:
    """Accuracy summary (MAE, RMSE, WAPE, bias, error percentiles) for the delivery range."""
    _validated_window(delivery_date_from, delivery_date_to)
    records = get_merged_records(cutoff_time, delivery_date_from, delivery_date_to)
    return SummaryMetrics(
        deliveryDateFrom=delivery_date_from.isoformat(),
        deliveryDateTo=delivery_date_to.isoformat(),
        cutoffTimeUsed=cutoff_time,
        **compute_metrics_for_records(records),
    )


@app.get("/api/metrics/bias-correction", response_model=BiasCorrectionBacktest)
def get_bias_correction(
    delivery_date_from: date = Query(default=settings.DEFAULT_DATE_FROM),
    delivery_date_to: date = Query(default=settings.DEFAULT_DATE_TO),
    cutoff_time: str = Query(default=settings.DEFAULT_CUTOFF, pattern=CUTOFF_PATTERN),
) -> BiasCorrectionBacktest:
    """Out-of-sample backtest: does subtracting the trailing known bias reduce error?"""
    _validated_window(delivery_date_from, delivery_date_to)
    all_records = get_merged_records(cutoff_time)
    return BiasCorrectionBacktest(
        **compute_rolling_bias_correction(
            all_records, delivery_date_from, delivery_date_to, settings.BIAS_LOOKBACK_DAYS
        )
    )


@app.get("/api/metrics/daily", response_model=List[DailyMetricRecord])
def get_daily_metrics(
    delivery_date_from: date = Query(default=settings.DEFAULT_DATE_FROM),
    delivery_date_to: date = Query(default=settings.DEFAULT_DATE_TO),
    cutoff_time: str = Query(default=settings.DEFAULT_CUTOFF, pattern=CUTOFF_PATTERN),
) -> List[DailyMetricRecord]:
    """Daily accuracy metrics for trend analysis."""
    _validated_window(delivery_date_from, delivery_date_to)
    records = get_merged_records(cutoff_time, delivery_date_from, delivery_date_to)
    return [DailyMetricRecord(**d) for d in compute_daily_breakdown(records)]


@app.get("/api/settlement-periods/profile", response_model=List[SettlementPeriodProfileRecord])
def get_settlement_period_profile(
    delivery_date_from: date = Query(default=settings.DEFAULT_DATE_FROM),
    delivery_date_to: date = Query(default=settings.DEFAULT_DATE_TO),
    cutoff_time: str = Query(default=settings.DEFAULT_CUTOFF, pattern=CUTOFF_PATTERN),
) -> List[SettlementPeriodProfileRecord]:
    """Error profile across the 48 settlement periods of the day."""
    _validated_window(delivery_date_from, delivery_date_to)
    records = get_merged_records(cutoff_time, delivery_date_from, delivery_date_to)
    return [SettlementPeriodProfileRecord(**p) for p in compute_settlement_period_profile(records)]


@app.get("/api/metrics/cutoff-sensitivity", response_model=List[CutoffSensitivityItem])
def get_cutoff_sensitivity(
    delivery_date_from: date = Query(default=settings.DEFAULT_DATE_FROM),
    delivery_date_to: date = Query(default=settings.DEFAULT_DATE_TO),
) -> List[CutoffSensitivityItem]:
    """Accuracy at several candidate D-1 cutoffs: how much does waiting for later runs help?"""
    _validated_window(delivery_date_from, delivery_date_to)
    items: List[CutoffSensitivityItem] = []
    for cutoff in settings.CANDIDATE_CUTOFFS:
        m = compute_metrics_for_records(get_merged_records(cutoff, delivery_date_from, delivery_date_to))
        items.append(CutoffSensitivityItem(
            cutoffTime=cutoff,
            maeMW=m["maeMW"], rmseMW=m["rmseMW"], wapePercent=m["wapePercent"],
            biasMW=m["biasMW"], matchedPeriods=m["matchedPeriods"],
        ))
    return items


@app.get("/api/decision-brief", response_model=DecisionBrief)
def get_decision_brief(
    delivery_date: date = Query(description="Delivery day D; the decision is taken on D-1"),
    cutoff_time: str = Query(default=settings.DEFAULT_CUTOFF, pattern=CUTOFF_PATTERN),
) -> DecisionBrief:
    """Forecast available at the cutoff for one delivery day, with bias-corrected view and risk band."""
    _validated_window(delivery_date, delivery_date)
    brief = compute_decision_brief(
        get_merged_records(cutoff_time), delivery_date, settings.BIAS_LOOKBACK_DAYS
    )
    return DecisionBrief(
        cutoffTime=cutoff_time,
        decisionTimestamp=compute_cutoff_timestamp(delivery_date, cutoff_time),
        **brief,
    )


# Serve the built React app when present (Docker image). On Vercel the static
# build is served by the platform and only /api/* reaches this function.
_FRONTEND_DIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist"
)
if os.path.isdir(_FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=_FRONTEND_DIST, html=True), name="frontend")
