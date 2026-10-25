# UK Day-Ahead Wind Forecast Portal

A web app for a GB utility's day-ahead buying team. It answers two questions using **only Elexon BMRS wind data**:

1. **Which wind forecast do I actually have when I must decide?** The latest `WINDFOR` run published at or before the D-1 cutoff (default 09:00 UK time).
2. **How wrong is it, in numbers I can plan around?** MAE, RMSE, bias, tail errors (P90/P95), and a bias-corrected view with a P10-P90 band.

## Project Links

- **Live Application:** https://aksasw.vercel.app
- **GitHub Repository:** https://github.com/akshat3021/jksaawr
- **Video 1 — Client Presentation:** https://youtu.be/2PgTsFTv3Es
- **Video 2 — Technical Review:** https://youtu.be/JsNoIMij9kc

## AI Tools Disclosure

AI tools were used during the development of WindDesk:

- **Google Antigravity:** Assisted with code generation and implementation.
- **Claude:** Assisted with planning, code review, debugging, and analysis design.

AI assistance was used as a development aid. I reviewed and tested the generated output, examined the implementation, and validated the analysis choices and results against the project's tests.

I take responsibility for the submitted code, implementation decisions, and documented results.

## Key assumptions (please read)

| Topic | Decision |
|---|---|
| Decision window | Decisions made **1-31 Jan 2026** → delivery days **2 Jan - 1 Feb 2026** (1,488 half-hours). |
| Decision forecast | For each target time, the forecast with the **latest `publishTime` ≤ D-1 at cutoff**. Later runs, including re-runs published after the target time, are never used. |
| Cutoff | Default **09:00 on D-1**, configurable in the UI. January is GMT, so UK time = UTC (no DST handling needed). The real auction gate closure is around 09:20-09:50 depending on the auction, so 09:00 is a conservative default. |
| Resolution | `FUELHH` is 30-minute, `WINDFOR` is hourly (:00 only). Each :30 half-hour uses the forecast for its hour (step-hold). The 30-minute actuals are not averaged. |
| Units | MW. Energy = MW × 0.5 h per settlement period. |
| Data at runtime | The app reads a JSON cache in `backend/data/` and never calls Elexon live (fast, deterministic, works on serverless). `scripts/ingest.py` refreshes it. |

## What the data says (cutoff 09:00, whole window)

- **Mean absolute error 2,042 MW** (WAPE 18.1%), RMSE 2,509 MW.
- **Systematic over-forecast: +1,748 MW on average**, and 85% of half-hours are over-forecast. Correlation with actuals is high (~0.96) and the bias is present at **every horizon**, so it is a level offset, not a timing problem. It may partly reflect a definition difference between the two datasets (see Limitations).
- **Tail risk:** P90 absolute error 4,140 MW, P95 5,310 MW.
- **Bias correction works out-of-sample:** subtracting the mean error of the previous 7 days (only actuals known on D-1, i.e. up to D-2) cuts MAE **18.7%** (2,003 → 1,629 MW) over 29 evaluated days.
- **Band calibration:** the P10-P90 band contains **75%** of actuals (nominal 80%), so it is slightly narrow. A 7-day band window scored 69%, so band widths use all history available at decision time.
- **Cutoff sensitivity** (API only, `/api/metrics/cutoff-sensitivity`): accuracy barely changes between 05:00 and 12:00, because few forecast runs land in that gap. A cutoff after gate closure is not actionable.
- **Bias correction is not a guaranteed win:** it improves the month overall, but can be worse on some weeks (e.g. 2-8 Jan, when little history exists). The UI says so when it happens.

## Architecture

```
Elexon BMRS API ──(scripts/ingest.py, run offline)──► backend/data/*.json   (cached, read-only at runtime)
                                                              │
Browser ◄── React UI (Vite, TypeScript) ◄── /api/* ◄── FastAPI + pandas ◄─┘
                                                      1. pick latest forecast with publishTime ≤ D-1 cutoff
                                                      2. align with 30-min actuals, compute errors
                                                      3. metrics, bias-correction backtest, decision brief
```

- **Docker:** one image; FastAPI serves the API and the built React app on port 8000.
- **Vercel:** two services in one project (`vercel.json`): the Vite frontend at `/` and the FastAPI backend under `/api`.
- **Why a cache, not live calls:** the study window is fixed (January 2026), so results are deterministic, fast and do not depend on Elexon being reachable during review.

## Data quality and missing data

- **At ingestion** (`scripts/ingest.py`): requests are chunked to the API's 7-day limit with retries; timestamps are normalised to UTC; duplicates are dropped; the run fails loudly if a delivery day does not have exactly 48 settlement periods or if any value is null.
- **At runtime:** a half-hour with no eligible forecast is still returned, with `forecastMW = null`, and is excluded from every metric. `matchedPeriods` vs `totalPeriods` in `/api/metrics/summary` (shown under "More metrics" in the UI) makes any exclusion visible.
- **Current data:** 1,488 actual half-hours (31 days × 48, no gaps or duplicates), 18,104 forecast rows (no nulls or duplicates). **All 1,488 half-hours have an eligible forecast.**
- **Metrics are cross-checked:** `backend/tests/test_independent_metrics.py` recomputes MAE, RMSE and bias from the raw JSON using separate code and asserts they equal the API's numbers.

## Verify the data against Elexon yourself

Open these in a browser and compare with the app's "Half-hourly data" table for **15 Jan 2026** (decision made 14 Jan 09:00):

- Actual, 00:00: `https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream?settlementDateFrom=2026-01-15&settlementDateTo=2026-01-15&fuelType=WIND` → expect `generation` **14602** for `startTime` 2026-01-15T00:00:00Z.
- Forecast, same hour: `https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream?publishDateTimeFrom=2026-01-14T07:00:00Z&publishDateTimeTo=2026-01-14T08:00:00Z` → expect `generation` **15834** for `startTime` 2026-01-15T00:00:00Z, `publishTime` 2026-01-14T07:30:00Z.

## Run it

### Docker (recommended)
```bash
docker compose up --build
# open http://localhost:8000   (API docs: http://localhost:8000/docs)
```

### Local development
```bash
# backend (Python 3.12)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cd backend && uvicorn app.main:app --reload --port 8000

# frontend (new terminal)
cd frontend && npm ci && npm run dev      # http://localhost:5173 (proxies /api to :8000)
```

### Tests
```bash
cd backend && python -m pytest -q          # 32 tests
cd frontend && npm run build               # type-check + production build
```

**CI** (`.github/workflows/ci.yml`) runs on every push: backend tests, the frontend build, and a Docker job that builds the image, starts the container, and checks `/api/health`, the UI, the headline metric, a decision brief and input validation. See the *Actions* tab for the latest run.

### Refresh the data (optional; needs internet)
```bash
python scripts/ingest.py     # overwrites backend/data/*.json from the Elexon API
python scripts/explore.py    # data profiling report (resolution, horizons, gaps)
```

### Deploy to Vercel
Import the repo in Vercel (no env vars needed). `vercel.json` defines two services: the Vite frontend served at `/`, and the FastAPI backend (`backend/main.py`) served under `/api`.

## Repository layout

```
backend/main.py             Vercel service entrypoint (re-exports the FastAPI app)
backend/requirements.txt    Runtime Python dependencies (used by Docker and Vercel)
backend/app/
  main.py                 FastAPI routes, input validation, CORS, static serving
  forecast_service.py     Core rule: latest forecast <= D-1 cutoff; merge with actuals; cached
  metrics_service.py      MAE/RMSE/WAPE/bias, percentiles, bias-correction backtest, decision brief
  data_loader.py          Loads the JSON cache
  models.py, config.py    Pydantic response models; settings
backend/data/             Cached Elexon data (FUELHH wind actuals, WINDFOR forecasts)
backend/tests/            Pytest suite (selection rule, metrics, no-look-ahead, independent metric check, API)
frontend/src/             React + TypeScript (Vite, Tailwind)
  components/DecisionBrief.tsx   "Tomorrow's decision": forecast available at the cutoff, adjusted forecast, likely range
  components/AccuracyView.tsx    "How accurate is it?": plain-English error summary, daily error chart
scripts/ingest.py         Elexon → JSON cache (chunked ≤7 days, retries, validation)
scripts/explore.py        Data exploration
docs/                     Data findings; video script
Dockerfile, docker-compose.yml, vercel.json (frontend + backend services), requirements-dev.txt
.agents/rules/main.md     Project rules given to the AI coding assistant
```

## API

| Endpoint | Purpose |
|---|---|
| `GET /api/decision-brief?delivery_date=&cutoff_time=` | One delivery day: forecast at cutoff, run used, corrected forecast, P10-P90 band |
| `GET /api/forecasts` | Half-hourly actual vs decision forecast (with the `publishTime` used) |
| `GET /api/metrics/summary` | MAE, RMSE, WAPE, bias, P50/P90/P95 error |
| `GET /api/metrics/bias-correction` | Out-of-sample backtest of the bias correction and band coverage |
| `GET /api/metrics/daily`, `/api/settlement-periods/profile`, `/api/metrics/cutoff-sensitivity` | Trend, intraday profile, cutoff trade-off |
| `GET /api/health` | Dataset status |

Inputs are validated (cutoff `HH:MM`, delivery dates inside the window, `from ≤ to`); errors never include stack traces; CORS is restricted to configured origins.

## Design notes

- **No look-ahead, tested.** Tests prove forecasts after the cutoff are ignored and that bias correction for day D uses only actuals up to D-2. A real-data test asserts every selected forecast was published before its cutoff.
- **Vectorised selection + caching.** The selection join is about 11× faster than the first version (1.9 s → 0.17 s per cutoff), and results are memoised per cutoff.
- **Simple on purpose.** No database or auth: the data is public, small and fixed for the study window.

## Limitations

- **Dataset definitions.** FUELHH wind and WINDFOR may not cover exactly the same fleet; part of the persistent +1.7 GW offset could be definitional rather than forecast skill. I did not confirm this.
- Bias correction and bands are simple statistical estimates from 4 weeks of data; the band slightly under-covers.
- Wind only (per the brief). Demand and price are out of scope, so the app does not compute a procurement volume.
- `scripts/ingest.py` was adapted to write the JSON cache; its output format was verified against the bundled data, but the live fetch was not re-run for this submission.

## AI tools disclosure

This project was built with AI assistance: **Google Antigravity** (code generation) and **Claude** (planning, review, debugging and the analysis design). I reviewed and tested the output, including the analysis choices above.
