# Video script (10 min max; two parts)

## Part 1: Customer pitch (about 4.5 min)
1. **Problem (30 s).** "You buy day-ahead on the morning before delivery. Wind is weather-driven, so you buy the rest on a forecast. Two questions: which forecast do I actually have, and how far can I trust it?"
2. **Tab 1, Tomorrow's decision (100 s).** Open 15 Jan. Read the blue banner: the forecast you would have had was published 14 Jan 07:30, and anything later is not used. Show the three cards: published forecast 11,610 MW, adjusted 9,773 MW, likely range 7,042 - 12,579 MW. Tick "Show what actually happened" (actual average 10,568 MW) hover one half-hour, then open the half-hourly data table to show each forecast's publish time next to the actual.
3. **Tab 2, How accurate is it? (100 s).** Read the headline sentence: off by 2,042 MW on average, too high in 85% of half-hours by 1,748 MW. Point at the bad-case miss (4,140 MW) and the daily bar chart: the error is a level offset, mostly blue bars (too high).
4. **The so-what (40 s).** "Plan on about 1,750 MW less wind than the forecast says, and keep margin for around 4,100 MW. Adjusting for recent bias cut error by 18.7% using only data known the day before." Be honest: it does not help every week, and the likely range holds 75% of the time against an 80% aim.
5. **Close (15 s).** Next steps: add demand and other forecasts, daily refresh, alerts when the bias drifts.

## Part 2: Tech lead review (about 4.5 min)
1. **Architecture (45 s).** React/Vite UI, FastAPI backend, JSON cache of Elexon data. Docker image serves both; on Vercel they are two services (`/` and `/api`). No database or auth by design.
2. **Core rule (90 s).** Open `forecast_service.py`: vectorised join, `publishTime <= D-1 cutoff`, exact-then-hourly match. Show the tests: post-cutoff ignored, negative horizon ignored, real-data assertion.
3. **Analysis choices (75 s).** Step-hold for :30 half-hours; MAE/RMSE/WAPE rather than MAPE (unstable near zero wind); percentiles for tail risk; bias correction uses only results up to two days before delivery (tested for no look-ahead); band calibration check (69% to 75%).
4. **Quality practices (45 s).** 32 tests plus a CI pipeline that also builds and smoke-tests the Docker image, input validation, CORS allow-list, no stack traces, strict TypeScript build, accessible controls.
5. **Limitations and AI use (30 s).** Possible dataset-definition gap behind the offset; only 4 weeks of data; Antigravity and Claude used and reviewed.
