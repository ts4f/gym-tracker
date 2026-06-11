import { Workout } from "../model/types";
import { toKg } from "../model/weight";
import { estimateOneRepMax } from "./oneRepMax";

export interface TopSet {
  weightKg: number;
  reps: number;
}

export interface HistoryEntry {
  date: Date;
  file: string;
  /** Heaviest loaded set of the session (weight or bodyweight addon). */
  topSet?: TopSet;
  /** Total reps performed in bodyweight sets that session. */
  bodyweightReps: number;
  /** Best estimated 1RM of the session. */
  est1RM?: number;
}

/**
 * Per-session history for one exercise, newest first. Multiple entries of the
 * same exercise within a workout are merged into a single session entry.
 */
export function computeExerciseHistory(
  workouts: Workout[],
  name: string,
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];

  for (const w of workouts) {
    let entry: HistoryEntry | null = null;

    for (const ex of w.exercises) {
      if (ex.name !== name) continue;
      if (!entry) {
        entry = { date: w.date, file: w.file, bodyweightReps: 0 };
        entries.push(entry);
      }

      for (const set of ex.sets) {
        if (set.isBodyweight) {
          entry.bodyweightReps += set.reps.reduce((a, b) => a + b, 0);
        }

        const weightSource = set.weight ?? set.bodyweightAddon;
        if (weightSource) {
          const wKg = toKg(weightSource);
          const bestReps = Math.max(...set.reps);
          if (
            !entry.topSet ||
            wKg > entry.topSet.weightKg ||
            (wKg === entry.topSet.weightKg && bestReps > entry.topSet.reps)
          ) {
            entry.topSet = { weightKg: wKg, reps: bestReps };
          }
        }

        const est = estimateOneRepMax(set);
        if (est !== null && (entry.est1RM === undefined || est > entry.est1RM)) {
          entry.est1RM = est;
        }
      }
    }
  }

  entries.sort(
    (a, b) => b.date.getTime() - a.date.getTime() || a.file.localeCompare(b.file),
  );
  return entries;
}

/**
 * Most recent session of an exercise strictly before `date`, excluding
 * `excludeFile` (typically the note being rendered, which is itself indexed).
 */
export function lastSessionBefore(
  workouts: Workout[],
  name: string,
  date: Date,
  excludeFile?: string,
): HistoryEntry | null {
  for (const entry of computeExerciseHistory(workouts, name)) {
    if (entry.file === excludeFile) continue;
    if (entry.date.getTime() < date.getTime()) return entry;
  }
  return null;
}

/** One-line summary of a session, e.g. `100kg × 5 (2026-06-04)`. */
export function formatSessionSummary(entry: HistoryEntry): string {
  const date = entry.date.toISOString().slice(0, 10);
  if (entry.topSet) {
    const kg = Number(entry.topSet.weightKg.toFixed(1));
    let summary = `${kg}kg × ${entry.topSet.reps}`;
    if (entry.bodyweightReps > 0) summary += " (BW+)";
    return `${summary} (${date})`;
  }
  if (entry.bodyweightReps > 0) {
    return `BW × ${entry.bodyweightReps} reps (${date})`;
  }
  return date;
}
