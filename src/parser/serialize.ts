import { AttrValue, Exercise, Weight, WorkoutSet } from "../model/types";
import { formatAttribute } from "./registry";

function formatWeightToken(w: Weight): string {
  return `${w.value}${w.unit}`;
}

function attributesPart(attrs?: Map<string, AttrValue>): string {
  if (!attrs || attrs.size === 0) return "";
  const parts: string[] = [];
  for (const [key, value] of attrs) {
    if (value === true) parts.push(key);
    else if (value !== false && value !== null && value !== undefined) {
      parts.push(`${key} ${formatAttribute(key, value)}`);
    }
  }
  return parts.length > 0 ? ` [${parts.join(", ")}]` : "";
}

function setToLine(set: WorkoutSet): string | null {
  const first = set.reps[0];
  if (first === undefined) return null;
  const uniform = set.reps.every((r) => r === first);

  let weightPart: string;
  if (set.isBodyweight) {
    weightPart = set.bodyweightAddon
      ? `BW+${formatWeightToken(set.bodyweightAddon)}`
      : "BW";
  } else {
    weightPart = set.weight ? formatWeightToken(set.weight) : "BW";
  }

  let repsPart: string;
  if (uniform) {
    repsPart = `${first}${set.amrap ? "+" : ""}`;
    if (set.reps.length > 1) repsPart += ` x ${set.reps.length}`;
  } else {
    repsPart = set.reps.join(",") + (set.amrap ? "+" : "");
  }

  const rpePart = set.rpe !== undefined ? ` @ ${set.rpe}` : "";
  const attrPart = attributesPart(set.attributes);
  const commentPart = set.comment ? ` # ${set.comment}` : "";
  return `\t${weightPart} x ${repsPart}${rpePart}${attrPart}${commentPart}`;
}

/**
 * Serialize exercises back into workout-DSL v2 text (the inverse of
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
