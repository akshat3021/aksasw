# Video script (10 min max; two parts)

## Part 1: Customer pitch (about 4.5 min)
1. **Problem (30 s).** "You buy day-ahead on D-1 morning. Wind is weather-driven, so you buy the residual on a forecast. Two questions: which forecast do I have, and how far can I trust it?"
2. **Decision Brief (90 s).** Open 15 Jan. Point at the banner: the latest forecast run available at 09:00 on 14 Jan was published 07:30, and anything later is excluded. Show raw forecast (amber), bias-corrected (teal), P10-P90 band, and actual (dashed). Hover one half-hour.
3. **How wrong is it (90 s).** Range cards: MAE 2,042 MW; **+1,748 MW over-forecast, 85% of half-hours**; P90 error 4,140 MW, P95 5,310 MW.
4. **The so-what (60 s).** "Using only data you'd have on D-1, subtracting the last 7 days' bias cuts error 18.7% (2,003 → 1,629 MW)." Be honest: the band covers 75% vs an 80% target, so it is indicative.
5. **Close (15 s).** Next steps: add demand and other forecasts, daily refresh, alerts when bias drifts.

## Part 2: Tech lead review (about 4.5 min)
1. **Architecture (45 s).** React/Vite UI → FastAPI → JSON cache of Elexon data. One Docker image serves both; Vercel runs the API as a function. No DB/auth by design.
2. **Core rule (90 s).** Open `forecast_service.py`: vectorised join, `publishTime <= D-1 cutoff`, exact-then-hourly match. Show the tests: post-cutoff ignored, negative horizon ignored, real-data assertion.
3. **Analysis choices (75 s).** Step-hold for :30; MAE/RMSE/WAPE (not MAPE: unstable near zero wind); percentiles for tail risk; bias correction uses only actuals ≤ D-2; band calibration check (69% → 75%).
4. **Quality practices (45 s).** 29 tests, input validation, CORS allow-list, no stack traces, typed code, strict TS build.
5. **Limitations and AI use (30 s).** Possible dataset-definition gap behind the offset; 4 weeks of data; Antigravity + Claude used and reviewed.
