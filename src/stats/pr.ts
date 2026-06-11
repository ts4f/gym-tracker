import { Workout } from "../model/types";
import { toKg } from "../model/weight";
import { estimateOneRepMax } from "./oneRepMax";

export interface MaxWeightRecord {
  weightKg: number;
  reps: number;
  date: Date;
  file: string;
}

export interface MaxEst1RMRecord {
  value: number;
  date: Date;
  file: string;
}

export interface PersonalRecords {
  maxWeight?: MaxWeightRecord;
  maxEst1RM?: MaxEst1RMRecord;
}

export function computePersonalRecords(
  workouts: Workout[],
): Map<string, PersonalRecords> {
  const result = new Map<string, PersonalRecords>();
  // Chronological order makes records deterministic regardless of input
  // order: a record updates only when strictly beaten, so ties keep the
  // earliest session's date.
  const ordered = [...workouts].sort(
    (a, b) => a.date.getTime() - b.date.getTime() || a.file.localeCompare(b.file),
  );
  for (const w of ordered) {
    for (const ex of w.exercises) {
      let pr = result.get(ex.name);
      if (!pr) {
        pr = {};
        result.set(ex.name, pr);
      }
      for (const set of ex.sets) {
        const weightSource = set.weight ?? set.bodyweightAddon;
        if (weightSource && set.reps.length > 0) {
          const wKg = toKg(weightSource);
          const bestReps = Math.max(...set.reps);
          if (
            !pr.maxWeight ||
            wKg > pr.maxWeight.weightKg ||
            (wKg === pr.maxWeight.weightKg && bestReps > pr.maxWeight.reps)
          ) {
            pr.maxWeight = {
              weightKg: wKg,
              reps: bestReps,
              date: w.date,
              file: w.file,
            };
          }
        }
        const est = estimateOneRepMax(set);
        if (est !== null && (!pr.maxEst1RM || est > pr.maxEst1RM.value)) {
          pr.maxEst1RM = { value: est, date: w.date, file: w.file };
        }
      }
    }
  }
  return result;
}
