import { Exercise, Unit, Weight } from "../model/types";
import { parseWeightToken } from "../model/weight";
import { ParseError, ParseResult } from "./types";

export interface ParseOptions {
  defaultUnit: Unit;
}

const SET_RE =
  /^(?:(\d+)x(\d+)|((?:\d+,)*\d+))(?:\s*@\s*(\+?)(\d+(?:\.\d+)?)(kg|lb)?)?\s*(?:#\s*(.*))?$/i;

export function parseWorkoutBlock(
  source: string,
  opts: ParseOptions,
): ParseResult {
  const lines = source.split("\n");
  const exercises: Exercise[] = [];
  const blockComments: string[] = [];
  const errors: ParseError[] = [];
  let current: Exercise | null = null;

  for (const [i, line] of lines.entries()) {
    const lineNumber = i + 1;
    const raw = line.replace(/\s+$/, "");
    if (raw.length === 0) continue;

    const indented = /^\s/.test(raw);
    const stripped = raw.trim();

    if (!indented && stripped.startsWith("#")) {
      blockComments.push(stripped.slice(1).trim());
      continue;
    }

    if (!indented) {
      const hashIdx = stripped.indexOf("#");
      const name = hashIdx >= 0 ? stripped.slice(0, hashIdx).trim() : stripped;
      const inlineComment =
        hashIdx >= 0 ? stripped.slice(hashIdx + 1).trim() : undefined;

      if (name.length === 0) {
        errors.push({ line: lineNumber, message: "Empty exercise name" });
        continue;
      }

      current = {
        name,
        sets: [],
        comments: inlineComment ? [inlineComment] : [],
      };
      exercises.push(current);
      continue;
    }

    if (current === null) {
      errors.push({ line: lineNumber, message: "Set without exercise" });
      continue;
    }

    if (stripped.startsWith("#")) {
      current.comments.push(stripped.slice(1).trim());
      continue;
    }

    const m = SET_RE.exec(stripped);
    if (!m) {
      errors.push({
        line: lineNumber,
        message: `Could not parse set line: "${stripped}"`,
      });
      continue;
    }

    const [, setsStr, repsStr, csvStr, plus, weightVal, unit, comment] = m;

    let reps: number[];
    if (setsStr !== undefined) {
      const sets = Number(setsStr);
      const rep = Number(repsStr);
      if (sets <= 0 || rep <= 0) {
        errors.push({ line: lineNumber, message: "Invalid set or rep count" });
        continue;
      }
      reps = new Array<number>(sets).fill(rep);
    } else if (csvStr !== undefined) {
      reps = csvStr.split(",").map((s) => Number(s));
      if (reps.some((r) => !Number.isFinite(r) || r <= 0)) {
        errors.push({ line: lineNumber, message: "Invalid reps value" });
        continue;
      }
    } else {
      errors.push({ line: lineNumber, message: "Invalid reps value" });
      continue;
    }

    let weight: Weight | undefined;
    let isBodyweight = false;
    let bodyweightAddon: Weight | undefined;

    if (weightVal === undefined) {
      isBodyweight = true;
    } else {
      const parsed = parseWeightToken(
        `${weightVal}${unit ?? ""}`,
        opts.defaultUnit,
      );
      if (!parsed) {
        errors.push({ line: lineNumber, message: "Invalid weight value" });
        continue;
      }
      if (plus) {
        isBodyweight = true;
        bodyweightAddon = parsed;
      } else {
        weight = parsed;
      }
    }

    current.sets.push({
      reps,
      weight,
      isBodyweight,
      bodyweightAddon,
      comment: comment?.trim() || undefined,
      line: lineNumber,
    });
  }

  return {
    workout: { exercises, comments: blockComments },
    errors,
  };
}
