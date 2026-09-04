# Data Model: Progression Trend

## ProgressionTrend

```ts
interface ProgressionTrend {
  slopePerDay: number;   // regression slope, kg/day; positive = improving
  slopePerMonth: number; // slopePerDay * DAYS_PER_MONTH, for display
  points: number;        // sessions with an est. 1RM used in the fit
  firstDate: Date;       // first and last session dates used
  lastDate: Date;
}
```

The trend is a least-squares line fitted through the exercise's estimated-1RM
history (the `est1RM` field of `computeExerciseHistory`). It is a derived,
disposable value — no new store, no new state (constitution I & V).

## Functions (pure, in `src/stats/trend.ts`)

```ts
function computeProgressionTrend(
  workouts: Workout[],
  name: string,
  minPoints?: number, // default MIN_POINTS
): ProgressionTrend | null;

function formatProgressionTrend(trend: ProgressionTrend): string;
```

`computeProgressionTrend` reuses `computeExerciseHistory` (same `Workout[]` input
convention as every other `stats/*` function), filters to entries with
`est1RM !== undefined`, sorts chronologically, then fits `y = est1RM` against
`x = days since first session`.

Returns `null` when:
- fewer than `minPoints` est-1RM sessions exist (default 3), or
- the x-values have no spread (all sessions on one date → zero denominator).

## Constants

| Constant | Value | Meaning |
|---|---|---|
| `MIN_POINTS` | `3` | Fewest est-1RM sessions before a trend is reported. |
| `DAYS_PER_MONTH` | `30.44` | 365.25/12 — rescales a daily slope to kg/month. |
| `FLAT_EPSILON` | `0.05` | Rates within ± this many kg/month format as "flat". |
| `MS_PER_DAY` | `86_400_000` | Millisecond-per-day conversion for x. |

## Regression formula

Ordinary least squares slope:

```
slope = Σ(x_i − x̄)(y_i − ȳ) / Σ(x_i − x̄)²
```

`slopePerMonth = slope * DAYS_PER_MONTH`. All weights are already kg-normalized
by `estimateOneRepMax` (`toKg`), so no unit work happens here (constitution III).

## Formatting

`formatProgressionTrend`:

- `|slopePerMonth| < FLAT_EPSILON` → `"→ flat"`
- positive → `"↑ +2.5kg/mo"` (1 decimal, leading `+`)
- negative → `"↓ -0.8kg/mo"` (1 decimal, leading `-`)

The `"trend: "` prefix is added by the render-layer `trendLabel` helper (mirrors
`lastSessionLabel`), not by this pure module.

## Validation rules

- Input order independence: the chronological sort makes the result identical
  regardless of `workouts[]` ordering (tested).
- No mutation: `computeExerciseHistory` and the regression are read-only over the
  input array; the model remains immutable.
