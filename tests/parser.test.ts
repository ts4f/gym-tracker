import { describe, expect, it } from "vitest";
import { parseWorkoutBlock } from "../src/parser/core";
import { nn } from "./_helpers";

const opts = { defaultUnit: "kg" as const };

describe("parseWorkoutBlock — basics", () => {
  it("parses an empty block as no exercises", () => {
    const r = parseWorkoutBlock("", opts);
    expect(r.workout.exercises).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it("treats blank lines as separators", () => {
    const r = parseWorkoutBlock("\n\n\n", opts);
    expect(r.workout.exercises).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it("parses a single uniform-sets exercise", () => {
    const r = parseWorkoutBlock("Bench Press\n  80kg x 8 x 3", opts);
    expect(r.errors).toEqual([]);
    expect(r.workout.exercises).toHaveLength(1);
    const ex = nn(r.workout.exercises[0]);
    expect(ex.name).toBe("Bench Press");
    expect(ex.sets).toHaveLength(1);
    const set0 = nn(ex.sets[0]);
    expect(set0.reps).toEqual([8, 8, 8]);
    expect(set0.weight).toEqual({ value: 80, unit: "kg" });
    expect(set0.isBodyweight).toBe(false);
  });

  it("parses multiple exercises separated by blank lines", () => {
    const src = `Bench Press
  80kg x 8 x 3

Overhead Press
  50kg x 6 x 4`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.errors).toEqual([]);
    expect(r.workout.exercises.map((e) => e.name)).toEqual([
      "Bench Press",
      "Overhead Press",
    ]);
  });

  it("supports tab indentation", () => {
    const r = parseWorkoutBlock("Squat\n\t100kg x 5 x 5", opts);
    expect(r.errors).toEqual([]);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).reps).toEqual([5, 5, 5, 5, 5]);
  });
});

describe("parseWorkoutBlock — set notation", () => {
  it("parses varying-reps csv notation as one set per number", () => {
    const r = parseWorkoutBlock("Bench Press\n  80kg x 8,7,6", opts);
    expect(r.errors).toEqual([]);
    const ex = nn(r.workout.exercises[0]);
    expect(ex.sets).toHaveLength(1);
    expect(nn(ex.sets[0]).reps).toEqual([8, 7, 6]);
  });

  it("parses a single-set notation without a sets suffix", () => {
    const r = parseWorkoutBlock("Bench Press\n  80kg x 6", opts);
    expect(r.errors).toEqual([]);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).reps).toEqual([6]);
  });

  it("accumulates multiple set lines under one exercise", () => {
    const src = `Bench Press
  80kg x 8 x 3
  85kg x 6
  90kg x 4`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.errors).toEqual([]);
    const sets = nn(r.workout.exercises[0]).sets;
    expect(sets).toHaveLength(3);
    expect(sets.map((s) => s.weight?.value)).toEqual([80, 85, 90]);
  });
});

describe("parseWorkoutBlock — rpe and amrap", () => {
  it("parses an RPE suffix", () => {
    const r = parseWorkoutBlock("Bench\n  100kg x 5 x 3 @ 8", opts);
    expect(r.errors).toEqual([]);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).rpe).toBe(8);
  });

  it("parses decimal RPE", () => {
    const r = parseWorkoutBlock("Deadlift\n  100kg x 5,3,1 @ 9.5", opts);
    expect(r.errors).toEqual([]);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).rpe).toBe(9.5);
  });

  it("marks an AMRAP set with a trailing +", () => {
    const r = parseWorkoutBlock("Bench\n  100kg x 5+ x 3 @ 9", opts);
    expect(r.errors).toEqual([]);
    const s = nn(nn(r.workout.exercises[0]).sets[0]);
    expect(s.amrap).toBe(true);
    expect(s.reps).toEqual([5, 5, 5]);
  });
});

describe("parseWorkoutBlock — bodyweight", () => {
  it("treats BW as bodyweight", () => {
    const r = parseWorkoutBlock("Pull-Up\n  BW x 8 x 3", opts);
    expect(r.errors).toEqual([]);
    const s = nn(nn(r.workout.exercises[0]).sets[0]);
    expect(s.isBodyweight).toBe(true);
    expect(s.weight).toBeUndefined();
    expect(s.bodyweightAddon).toBeUndefined();
  });

  it("treats BW+N as weighted bodyweight", () => {
    const r = parseWorkoutBlock("Pull-Up\n  BW+20kg x 6", opts);
    expect(r.errors).toEqual([]);
    const s = nn(nn(r.workout.exercises[0]).sets[0]);
    expect(s.isBodyweight).toBe(true);
    expect(s.bodyweightAddon).toEqual({ value: 20, unit: "kg" });
    expect(s.weight).toBeUndefined();
  });

  it("allows weighted bodyweight with an explicit unit", () => {
    const r = parseWorkoutBlock("Pull-Up\n  BW+45lb x 6", opts);
    expect(r.errors).toEqual([]);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).bodyweightAddon).toEqual({
      value: 45,
      unit: "lb",
    });
  });
});

describe("parseWorkoutBlock — units", () => {
  it("uses the default unit when no suffix is provided", () => {
    const r = parseWorkoutBlock("Bench\n  80 x 8 x 3", { defaultUnit: "lb" });
    expect(nn(nn(r.workout.exercises[0]).sets[0]).weight).toEqual({
      value: 80,
      unit: "lb",
    });
  });

  it("overrides the default with a per-set lb suffix", () => {
    const r = parseWorkoutBlock("DB Curl\n  15lb x 10 x 3", opts);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).weight).toEqual({
      value: 15,
      unit: "lb",
    });
  });

  it("parses decimal weights", () => {
    const r = parseWorkoutBlock("Bench\n  22.5kg x 8 x 3", opts);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).weight).toEqual({
      value: 22.5,
      unit: "kg",
    });
  });
});

describe("parseWorkoutBlock — attributes", () => {
  it("stores typed bracket attributes", () => {
    const r = parseWorkoutBlock(
      "Bench\n  100kg x 5 x 3 @ 8 [tempo 3-1-3, rest 90s]",
      opts,
    );
    expect(r.errors).toEqual([]);
    const attrs = nn(nn(nn(r.workout.exercises[0]).sets[0]).attributes);
    expect(attrs.get("tempo")).toBe("3-1-3");
    expect(attrs.get("rest")).toBe(90);
  });

  it("treats a bare attribute as boolean true", () => {
    const r = parseWorkoutBlock("Bench\n  100kg x 5 x 3 [amrap]", opts);
    expect(r.errors).toEqual([]);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).attributes?.get("amrap")).toBe(true);
  });
});

describe("parseWorkoutBlock — comments", () => {
  it("captures per-set inline comments", () => {
    const r = parseWorkoutBlock("Bench\n  90kg x 4 # PR", opts);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).comment).toBe("PR");
  });

  it("strips inline trailing comment from exercise name", () => {
    const r = parseWorkoutBlock("Bench Press # heavy\n  80kg x 8 x 3", opts);
    const ex = nn(r.workout.exercises[0]);
    expect(ex.name).toBe("Bench Press");
    expect(ex.comments).toEqual(["heavy"]);
  });

  it("attaches indented standalone # comments to current exercise", () => {
    const src = `Bench
  80kg x 8 x 3
  # felt strong
  85kg x 6`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.errors).toEqual([]);
    expect(nn(r.workout.exercises[0]).comments).toEqual(["felt strong"]);
  });

  it("collects unindented standalone # lines as block-level comments", () => {
    const src = `# top of workout
Bench
  80kg x 8 x 3
# bottom note`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.workout.comments).toEqual(["top of workout", "bottom note"]);
    expect(r.workout.exercises).toHaveLength(1);
  });
});

describe("parseWorkoutBlock — error recovery", () => {
  it("reports set lines before any exercise", () => {
    const r = parseWorkoutBlock("  80kg x 8 x 3", opts);
    expect(r.errors).toEqual([{ line: 1, message: "Set without exercise" }]);
    expect(r.workout.exercises).toEqual([]);
  });

  it("reports malformed set lines and continues parsing", () => {
    const src = `Bench
  80kg x 8 x 3
  garbage line
  85kg x 6`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.errors).toHaveLength(1);
    expect(nn(r.errors[0]).line).toBe(3);
    expect(nn(r.workout.exercises[0]).sets).toHaveLength(2);
  });

  it("reports invalid RPE values", () => {
    expect(parseWorkoutBlock("Bench\n  100kg x 5 @ 0", opts).errors).toEqual([
      { line: 2, message: 'Invalid RPE "0"' },
    ]);
    expect(parseWorkoutBlock("Bench\n  100kg x 5 @ 11", opts).errors).toEqual([
      { line: 2, message: 'Invalid RPE "11"' },
    ]);
  });

  it("reports zero reps and zero sets", () => {
    expect(parseWorkoutBlock("Bench\n  100kg x 0", opts).errors).toEqual([
      { line: 2, message: "Invalid reps value" },
    ]);
    expect(parseWorkoutBlock("Bench\n  100kg x 5 x 0", opts).errors).toEqual([
      { line: 2, message: "Invalid set count" },
    ]);
  });

  it("reports BW+ with no addon weight", () => {
    expect(parseWorkoutBlock("Pull-Up\n  BW+ x 5", opts).errors).toEqual([
      { line: 2, message: 'Invalid bodyweight addon "BW+"' },
    ]);
  });

  it("preserves correct line numbers across blank lines", () => {
    const src = `Bench

  garbage`;
    const r = parseWorkoutBlock(src, opts);
    expect(nn(r.errors[0]).line).toBe(3);
  });
});
