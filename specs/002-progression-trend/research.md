# Research: Progression Trend

All decisions resolved during planning (no open NEEDS CLARIFICATION remains).
Sources: approved plan, full codebase read, and the README `TODOS/IDEAS` backlog item.

## 1. Metric — estimated 1RM per session

- **Decision**: regress the session's best *estimated 1RM* (Epley), not top-set
  weight or raw volume.
- **Rationale**: the README backlog item already specifies "linear regression over
  a lift's estimated 1RM history"; est. 1RM is the lift's strength-equivalent
  signal that makes a 5-rep session and a 1-rep session comparable on one scale.
- **Alternatives considered**: top-set weight × reps (rejected — not
  rep-normalized, so a 100×5 day looks "heavier" than a 110×1 day); weekly volume
  (rejected — measures work, not strength progression).

## 2. Fit — ordinary least squares on est. 1RM vs. days

- **Decision**: simple OLS slope of `y = est1RM` against `x = days since first
  session`; rescale the daily slope to kg/month via `DAYS_PER_MONTH = 30.44`.
- **Rationale**: zero dependencies, deterministic, and the README's requested
  "simple linear regression". Days-since-first keeps the intercept meaningful
  without leaking epoch-magnitude into the slope's numeric stability.
- **Alternatives considered**: robust/Theil–Sen regression (rejected — more code
  for no clear gain at this data size); per-week bucketing then regression
  (rejected — loses intra-week detail and complicates x when weeks are skipped).

## 3. Minimum data & flat threshold

- **Decision**: require ≥ 3 est-1RM sessions (`MIN_POINTS = 3`) and a non-zero time
  span; report "flat" when `|slopePerMonth| < 0.05` kg/month.
- **Rationale**: two points always fit a line and overstate the rate; three is the
  smallest sample that still averages noise. A near-zero rate is noise, not signal.
- **Alternatives considered**: ≥ 2 points (rejected — misleading on short histories);
  a minimum span in days instead of point count (rejected — harder to reason about;
  point count + zero-variance guard cover the degenerate case).

## 4. Display — inline label, kg/month

- **Decision**: show `trend: ↑ +2.5kg/mo` (or `↓ -…`, `→ flat`) as a span next to
  the existing `last:` label on the rendered table, in kg to match the existing
  `last:`/leaderboard kg convention.
- **Rationale**: the user's idea is to surface it on the rendered table; a compact
  arrow + signed rate reads at a glance without a chart.
- **Alternatives considered**: stats-sidebar only (rejected — user wants it on the
  table; the pure function is reusable for the sidebar later); convert to the
  default unit (deferred — kg matches every other stat today).

## 5. Placement & scope of the current note

- **Decision**: the trend includes *all* indexed sessions (current note included) —
  "progression as of now" — while the `last:` label keeps its distinct "previous
  session" semantics and continues to exclude the current note.
- **Rationale**: `computeExerciseHistory` merges each file into one session entry,
  so there is no double counting; a pure function that takes only `workouts[]` is
  simpler than one coupled to `sourcePath`.

## 6. Surface & opt-out

- **Decision**: a `showTrend` setting (default `true`) gates the label, matching the
  existing `fuzzyMatchEnabled` toggle pattern.
- **Rationale**: users who find the label noisy can turn it off; the pure logic and
  tests remain regardless.
