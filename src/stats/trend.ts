import { Workout } from "../model/types";
import { computeExerciseHistory } from "./history";

/**
 * Result of fitting a straight line through an exercise's estimated-1RM
 * history. The rate is a simple least-squares slope: how much the est. 1RM is
 * moving per unit of time, on average.
 */
export interface ProgressionTrend {
  /** Regression slope in kg per day; positive means improving. */
  slopePerDay: number;
  /** `slopePerDay` rescaled to a 30.44-day month, for display. */
  slopePerMonth: number;
  /** Number of sessions with an estimated 1RM used in the fit. */
  points: number;
  /** Date of the first and last session used in the fit. */
  firstDate: Date;
  lastDate: Date;
}

/** Fewest est-1RM sessions required before a trend is reported. */
const MIN_POINTS = 3;
/** Average days per month (365.25 / 12), used to rescale a daily slope. */
const DAYS_PER_MONTH = 30.44;
/** Rates within ±this many kg/month render as "flat". */
const FLAT_EPSILON = 0.05;
const MS_PER_DAY = 86_400_000;

/**
 * Linear-regression slope of an exercise's estimated 1RM over time, or null
 * when there is not enough history (fewer than `minPoints` sessions with an
 * estimate, or all sessions on the same date so no time span exists).
 */
export function computeProgressionTrend(
  workouts: Workout[],
  name: string,
  minPoints = MIN_POINTS,
): ProgressionTrend | null {
  const history = computeExerciseHistory(workouts, name)
    .filter((entry) => entry.est1RM !== undefined)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  if (history.length < minPoints) return null;

  const first = history[0];
  if (first === undefined) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (const entry of history) {
    const est = entry.est1RM;
    if (est === undefined) continue;
    xs.push((entry.date.getTime() - first.date.getTime()) / MS_PER_DAY);
    ys.push(est);
  }

  const slopePerDay = linearSlope(xs, ys);
  if (slopePerDay === null) return null;

  const last = history[history.length - 1];
  if (last === undefined) return null;

  return {
    slopePerDay,
    slopePerMonth: slopePerDay * DAYS_PER_MONTH,
    points: history.length,
    firstDate: first.date,
    lastDate: last.date,
  };
}

/**
 * Ordinary-least-squares slope of `ys` against `xs`, or null when `xs` has no
 * spread (all points at the same x, so no line can be fitted).
 */
function linearSlope(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n === 0) return null;

  let sumX = 0;
  let sumY = 0;
  for (let i = 0; i < n; i++) {
    sumX += xs[i] ?? 0;
    sumY += ys[i] ?? 0;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    if (x === undefined || y === undefined) continue;
    const dx = x - meanX;
    numerator += dx * (y - meanY);
    denominator += dx * dx;
  }
  if (denominator === 0) return null;
  return numerator / denominator;
}

/**
 * Human-readable rate, e.g. `↑ +2.5kg/mo`, `↓ -0.8kg/mo`, or `→ flat` when the
 * change is within ±FLAT_EPSILON kg/month.
 */
export function formatProgressionTrend(trend: ProgressionTrend): string {
  const perMonth = trend.slopePerMonth;
  if (Math.abs(perMonth) < FLAT_EPSILON) return "→ flat";
  const magnitude = Math.abs(Number(perMonth.toFixed(1)));
  return `${perMonth > 0 ? "↑" : "↓"} ${perMonth > 0 ? "+" : "-"}${magnitude}kg/mo`;
}
