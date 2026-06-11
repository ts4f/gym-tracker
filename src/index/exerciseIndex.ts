import { Exercise, Unit, Workout } from "../model/types";
import { levenshtein } from "../util/levenshtein";

export type LastWeight = { value: number; unit: Unit } | "bodyweight" | null;

export interface ExerciseStats {
  name: string;
  frequency: number;
  lastUsed: Date;
  lastWeight: LastWeight;
}

export interface LookupOptions {
  /** Exclude names that look like a typo of a more-frequent exercise. */
  excludeTypos?: boolean;
  /** Max Levenshtein distance used for typo detection (default 2). */
  typoMaxDist?: number;
}

export class ExerciseIndex {
  private workoutsByPath = new Map<string, Workout>();
  private stats = new Map<string, ExerciseStats>();
  private listeners: Array<() => void> = [];

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      const i = this.listeners.indexOf(listener);
      if (i >= 0) this.listeners.splice(i, 1);
    };
  }

  setAll(workouts: Workout[]): void {
    this.workoutsByPath.clear();
    for (const w of workouts) this.workoutsByPath.set(w.file, w);
    this.rebuildStats();
    this.notify();
  }

  upsert(workout: Workout): void {
    this.workoutsByPath.set(workout.file, workout);
    this.rebuildStats();
    this.notify();
  }

  remove(path: string): void {
    if (this.workoutsByPath.delete(path)) {
      this.rebuildStats();
      this.notify();
    }
  }

  rename(oldPath: string, newPath: string): void {
    const existing = this.workoutsByPath.get(oldPath);
    if (!existing) return;
    this.workoutsByPath.delete(oldPath);
    this.workoutsByPath.set(newPath, { ...existing, file: newPath });
    this.notify();
  }

  size(): number {
    return this.workoutsByPath.size;
  }

  allWorkouts(): Workout[] {
    return Array.from(this.workoutsByPath.values());
  }

  knownExercises(): ExerciseStats[] {
    return Array.from(this.stats.values());
  }

  lookup(prefix: string, limit = 10, opts: LookupOptions = {}): ExerciseStats[] {
    const query = prefix.trim().toLowerCase();
    const exact: ExerciseStats[] = [];
    const sub: ExerciseStats[] = [];
    for (const s of this.stats.values()) {
      const name = s.name.toLowerCase();
      if (query.length === 0) {
        exact.push(s);
        continue;
      }
      if (name.startsWith(query)) exact.push(s);
      else if (name.includes(query)) sub.push(s);
    }
    const sortByFrequencyDesc = (a: ExerciseStats, b: ExerciseStats) =>
      b.frequency - a.frequency || a.name.localeCompare(b.name);
    exact.sort(sortByFrequencyDesc);
    sub.sort(sortByFrequencyDesc);
    let combined = [...exact, ...sub];
    if (opts.excludeTypos) {
      const maxDist = opts.typoMaxDist ?? 2;
      // Hide names that look like a typo of a more-frequent exercise, so the
      // misspelling is never recommended (and thus never propagated further).
      combined = combined.filter((s) => this.nearestMatch(s.name, maxDist) === null);
    }
    return combined.slice(0, limit);
  }

  nearestMatch(name: string, maxDist: number): string | null {
    if (name.length === 0) return null;
    const lower = name.toLowerCase();
    const queryStats = this.stats.get(name);
    const queryFreq = queryStats?.frequency ?? 0;

    let best: { name: string; dist: number; freq: number } | null = null;
    for (const s of this.stats.values()) {
      if (s.name === name) continue;
      const d = levenshtein(lower, s.name.toLowerCase(), maxDist);
      if (d > maxDist) continue;
      if (
        best === null ||
        d < best.dist ||
        (d === best.dist && s.frequency > best.freq)
      ) {
        best = { name: s.name, dist: d, freq: s.frequency };
      }
    }
    if (best === null) return null;
    if (best.freq <= queryFreq) return null;
    return best.name;
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }

  private rebuildStats(): void {
    this.stats.clear();
    for (const w of this.workoutsByPath.values()) {
      for (const ex of w.exercises) {
        const existing = this.stats.get(ex.name);
        if (existing) {
          existing.frequency += 1;
          if (w.date > existing.lastUsed) {
            existing.lastUsed = w.date;
            existing.lastWeight = extractLastWeight(ex);
          }
        } else {
          this.stats.set(ex.name, {
            name: ex.name,
            frequency: 1,
            lastUsed: w.date,
            lastWeight: extractLastWeight(ex),
          });
        }
      }
    }
  }
}

function extractLastWeight(ex: Exercise): LastWeight {
  const lastSet = ex.sets[ex.sets.length - 1];
  if (!lastSet) return null;
  if (lastSet.isBodyweight) return "bodyweight";
  if (lastSet.weight) return { value: lastSet.weight.value, unit: lastSet.weight.unit };
  return null;
}
