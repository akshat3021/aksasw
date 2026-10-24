Project: Wind power forecast portal for a UK energy utility's day-ahead buying team.
Stack: Python 3.12 + FastAPI + pandas backend; React + TypeScript (Vite) frontend; Docker; deploy on Vercel.
Data: ONLY Elexon BMRS FUELHH (fuelType=WIND, actuals) and WINDFOR (forecasts), January-2026 purchase decisions. No other data.
Core rule: for each target startTime, the "decision forecast" is the latest forecast with publishTime <= decision cutoff
(default 09:00 UK time on D-1, configurable). Never use forecasts published after the cutoff.
Decision window: decisions made 1-31 Jan 2026 => delivery days 2 Jan - 1 Feb 2026.
Rules: simplest correct implementation, no unneeded libraries, no auth/DB. Type hints everywhere, small functions,
validate API inputs (pydantic), no hardcoded secrets, no stack traces to clients. Write pytest tests for all
forecast-selection and metric logic. One feature at a time; list files changed after each task.