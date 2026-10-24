# UK Day-Ahead Wind Forecast Portal

A web app for a GB utility's day-ahead buying team. It answers two questions using **only Elexon BMRS wind data**:

1. **Which wind forecast do I actually have when I must decide?** The latest `WINDFOR` run published at or before the D-1 cutoff (default 09:00 UK time).
2. **How wrong is it, in numbers I can plan around?** MAE, RMSE, bias, tail errors (P90/P95), and a bias-corrected view with a P10-P90 band.

- **Live app:** `<ADD VERCEL URL HERE>`
- **Demo video:** `<ADD UNLISTED YOUTUBE URL HERE>`

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
- **Cutoff sensitivity:** accuracy barely changes between 05:00 and 12:00, because few forecast runs land in that gap. This view is informational; a cutoff after gate closure is not actionable.

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
cd backend && python -m pytest -q          # 29 tests
cd frontend && npm run build               # type-check + production build
```

### Refresh the data (optional; needs internet)
```bash
python scripts/ingest.py     # overwrites backend/data/*.json from the Elexon API
python scripts/explore.py    # data profiling report (resolution, horizons, gaps)
```

### Deploy to Vercel
Import the repo in Vercel (no env vars needed). `vercel.json` builds the React app and runs FastAPI from `api/index.py`.

## Repository layout

```
api/index.py              Vercel serverless entry (exposes the FastAPI app)
backend/app/
  main.py                 FastAPI routes, input validation, CORS, static serving
  forecast_service.py     Core rule: latest forecast <= D-1 cutoff; merge with actuals; cached
  metrics_service.py      MAE/RMSE/WAPE/bias, percentiles, bias-correction backtest, decision brief
  data_loader.py          Loads the JSON cache
  models.py, config.py    Pydantic response models; settings
backend/data/             Cached Elexon data (FUELHH wind actuals, WINDFOR forecasts)
backend/tests/            Pytest suite (selection rule, metrics, no-look-ahead, API)
frontend/src/             React + TypeScript (Vite, Tailwind)
  components/DecisionBrief.tsx   Per-day view: forecast available at cutoff, corrected view, band
  components/RiskCards.tsx       Tail-error and backtest cards
scripts/ingest.py         Elexon → JSON cache (chunked ≤7 days, retries, validation)
scripts/explore.py        Data exploration
docs/                     Data findings; video script
Dockerfile, docker-compose.yml, vercel.json, requirements*.txt
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
