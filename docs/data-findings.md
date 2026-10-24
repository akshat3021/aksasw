# Data findings (from `scripts/explore.py`)

## Elexon API facts
- `FUELHH/stream` and `WINDFOR/stream` are the optimised streaming endpoints.
- FUELHH: `settlementDateFrom/To` (max 7 days inclusive), `fuelType`, `settlementPeriod`; publish-time params are mutually exclusive with settlement-date params.
- WINDFOR: `publishDateTimeFrom/To`, up to 7 days per query.

## Empirical findings
| Dimension | FUELHH (WIND actuals) | WINDFOR (forecasts) |
|---|---|---|
| Units | MW (30-min average) | MW |
| `startTime` resolution | 30 min | 60 min (:00 only) |
| Forecast horizon (`startTime - publishTime`) | n/a | -25.5 h (re-runs) to 66.5 h; median 21.5 h |
| Forecasts per target hour | 1 actual | 8-24 (mean 14.5) |
| Duplicates / gaps / nulls | none; 48 periods per day | none |
| Timestamps | UTC (GMT in January) | UTC |

## Consequences for the design
1. Alignment: each :30 half-hour uses its hour's forecast (step-hold).
2. Negative horizons exist (re-runs published after the target time). The cutoff rule excludes them automatically, and a test covers it.
3. With 8-24 runs per target, "latest before cutoff" is a real selection, not a formality.
4. Systematic offset: forecast exceeds actual by ~1.4-1.9 GW in every horizon bucket (correlation ~0.96, no useful time shift), which motivated the bias-correction analysis.
