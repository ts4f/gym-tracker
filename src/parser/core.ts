import { AttrValue, Exercise, Unit, Weight, WorkoutSet } from "../model/types";
import { parseWeightToken } from "../model/weight";
import { ParseError, ParseResult } from "./types";

export interface ParseOptions {
  defaultUnit: Unit;
}

const REP_SINGLE = /^(\d+)$/;
const REP_AMRAP = /^(\d+)\+$/;
const REP_COMMA = /^\d+(?:,\d+)+$/;
const BW_ADDON = /^BW\+/i;

/**
 * Parse a workout block written in the v2 weight-first grammar:
 *
 *   weight x reps [x sets] [@ rpe] [attributes] [# comment]
 *
 * Pure function — no Obsidian/I/O dependencies (constitution II).
 */
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

    const parsed = parseSetLine(stripped, opts.defaultUnit);
    if (parsed instanceof Error) {
      errors.push({ line: lineNumber, message: parsed.message });
      continue;
    }
    parsed.line = lineNumber;
    current.sets.push(parsed);
  }

  return {
    workout: { exercises, comments: blockComments },
    errors,
  };
}

function parseSetLine(line: string, defaultUnit: Unit): WorkoutSet | Error {
  let core = line.trim();

  // 1. Attributes "[key value, ...]" first, so a "#" inside brackets isn't a
  //    comment and a bracket can sit anywhere on the line.
  let attributes: Map<string, AttrValue> | undefined;
  const attrMatch = /\[([^\]]*)\]/.exec(core);
  if (attrMatch !== null) {
    attributes = parseAttributes(attrMatch[1] ?? "");
    core = (
      core.slice(0, attrMatch.index) +
      core.slice((attrMatch.index ?? 0) + attrMatch[0].length)
    ).trim();
  }

  // 2. Trailing comment.
  let comment: string | undefined;
  const hashIdx = core.indexOf("#");
  if (hashIdx >= 0) {
    comment = core.slice(hashIdx + 1).trim() || undefined;
    core = core.slice(0, hashIdx).trim();
  }

  // 3. RPE via "@".
  let rpe: number | undefined;
  let main = core;
  const atIdx = core.lastIndexOf("@");
  if (atIdx >= 0) {
    const rpeStr = core.slice(atIdx + 1).trim();
    const rpeVal = Number(rpeStr);
    if (!Number.isFinite(rpeVal) || rpeVal < 1 || rpeVal > 10) {
      return new Error(`Invalid RPE "${rpeStr}"`);
    }
    rpe = rpeVal;
    main = core.slice(0, atIdx).trim();
  }

  // 4. weight x reps [x sets].
  const parts = main
    .split(/\s*x\s*/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (parts.length < 2 || parts.length > 3) {
    return new Error(`Could not parse set line: "${line}"`);
  }

  const weightToken = parts[0] ?? "";
  const repsToken = parts[1] ?? "";
  const setsToken = parts[2];

  // 5. Weight.
  let weight: Weight | undefined;
  let isBodyweight = false;
  let bodyweightAddon: Weight | undefined;
  if (weightToken.toUpperCase() === "BW") {
    isBodyweight = true;
  } else if (BW_ADDON.test(weightToken)) {
    isBodyweight = true;
    const addon = parseWeightToken(weightToken.slice(3), defaultUnit);
    if (!addon) return new Error(`Invalid bodyweight addon "${weightToken}"`);
    bodyweightAddon = addon;
  } else {
    const w = parseWeightToken(weightToken, defaultUnit);
    if (!w) return new Error(`Invalid weight "${weightToken}"`);
    weight = w;
  }

  // 6. Reps.
  let reps: number[];
  let amrap = false;
  const amrapMatch = REP_AMRAP.exec(repsToken);
  if (amrapMatch !== null) {
    amrap = true;
    reps = [Number(amrapMatch[1])];
  } else if (REP_COMMA.test(repsToken)) {
    reps = repsToken.split(",").map(Number);
  } else if (REP_SINGLE.test(repsToken)) {
    reps = [Number(repsToken)];
  } else {
    return new Error(`Invalid reps "${repsToken}"`);
  }

  if (reps.some((r) => !Number.isFinite(r) || r <= 0)) {
    return new Error("Invalid reps value");
  }

  // 7. Sets.
  if (setsToken !== undefined) {
    const sets = Number(setsToken);
    if (!Number.isInteger(sets) || sets <= 0) {
      return new Error("Invalid set count");
    }
    if (reps.length === 1) {
      reps = new Array<number>(sets).fill(reps[0] ?? 0);
    } else if (sets !== reps.length) {
      return new Error("Set count does not match reps list");
    }
  }

  return {
    reps,
    weight,
    isBodyweight,
    bodyweightAddon,
    amrap: amrap || undefined,
    rpe,
    attributes,
    comment,
    line: 0,
  };
}

/**
 * US2 passthrough: split "[key value, key value]" into a raw map. Unknown
 * keys stay strings; a bare key becomes boolean `true`. US3 replaces this with
 * registry-typed parsing for `tempo`/`rest`/`rir`.
 */
function parseAttributes(attrStr: string): Map<string, AttrValue> {
  const map = new Map<string, AttrValue>();
  for (const part of attrStr.split(",")) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    const m = /^(\S+)(?:\s+(.+))?$/.exec(trimmed);
    if (m === null) continue;
    const key = m[1] ?? "";
    const value = m[2]?.trim();
    if (key.length === 0) continue;
    map.set(key, value === undefined ? true : value);
  }
  return map;
}
