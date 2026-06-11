import { Workout } from "../model/types";
import { toKg } from "../model/weight";
import { toIsoWeekKey } from "../util/isoWeek";

export interface ExerciseVolume {
  loadedVolumeKg: number;
  bodyweightReps: number;
}

export type WeeklyVolume = Map<string, Map<string, ExerciseVolume>>;

export function computeWeeklyVolume(workouts: Workout[]): WeeklyVolume {
  const result: WeeklyVolume = new Map();
  for (const w of workouts) {
    const key = toIsoWeekKey(w.date);
    let week = result.get(key);
    if (!week) {
      week = new Map();
      result.set(key, week);
    }
    for (const ex of w.exercises) {
      let v = week.get(ex.name);
      if (!v) {
        v = { loadedVolumeKg: 0, bodyweightReps: 0 };
        week.set(ex.name, v);
      }
      for (const set of ex.sets) {
        const totalReps = set.reps.reduce((a, b) => a + b, 0);
        if (set.isBodyweight) {
          v.bodyweightReps += totalReps;
          if (set.bodyweightAddon) {
            v.loadedVolumeKg += totalReps * toKg(set.bodyweightAddon);
          }
        } else if (set.weight) {
          v.loadedVolumeKg += totalReps * toKg(set.weight);
        }
      }
    }
  }
  return result;
}
