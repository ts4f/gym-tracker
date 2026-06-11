import { WorkoutSet } from "../model/types";
import { toKg } from "../model/weight";

export function estimateOneRepMax(set: WorkoutSet): number | null {
  const weightSource = set.weight ?? set.bodyweightAddon;
  if (!weightSource) return null;
  const wKg = toKg(weightSource);
  if (wKg <= 0) return null;

  let max = 0;
  for (const r of set.reps) {
    if (r <= 0) continue;
    const est = r === 1 ? wKg : wKg * (1 + r / 30);
    if (est > max) max = est;
  }
  return max > 0 ? max : null;
}
