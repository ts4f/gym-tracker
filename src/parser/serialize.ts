import { Exercise, Weight, WorkoutSet } from "../model/types";

function formatWeightToken(w: Weight): string {
  return `${w.value}${w.unit}`;
}

function setToLine(set: WorkoutSet): string | null {
  const first = set.reps[0];
  if (first === undefined) return null;
  const uniform = set.reps.every((r) => r === first);
  const repsPart = uniform ? `${set.reps.length}x${first}` : set.reps.join(",");
  if (set.isBodyweight) {
    return set.bodyweightAddon
      ? `\t${repsPart} @ +${formatWeightToken(set.bodyweightAddon)}`
      : `\t${repsPart}`;
  }
  if (set.weight) return `\t${repsPart} @ ${formatWeightToken(set.weight)}`;
  return `\t${repsPart}`;
}

/**
 * Serialize exercises back into workout-DSL text (the inverse of
 * parseWorkoutBlock, minus comments). Units are always written explicitly so
 * the output stays correct if the default-unit setting changes.
 */
export function exercisesToDsl(exercises: Exercise[]): string {
  const lines: string[] = [];
  for (const ex of exercises) {
    lines.push(ex.name);
    for (const set of ex.sets) {
      const line = setToLine(set);
      if (line !== null) lines.push(line);
    }
  }
  return lines.join("\n");
}
