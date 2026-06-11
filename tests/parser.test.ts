import { describe, expect, it } from "vitest";
import { parseWorkoutBlock } from "../src/parser/parser";
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
    const r = parseWorkoutBlock("Bench Press\n  3x8 @ 80", opts);
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
  3x8 @ 80

Overhead Press
  4x6 @ 50`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.errors).toEqual([]);
    expect(r.workout.exercises.map((e) => e.name)).toEqual([
      "Bench Press",
      "Overhead Press",
    ]);
  });

  it("supports tab indentation", () => {
    const r = parseWorkoutBlock("Squat\n\t5x5 @ 100", opts);
    expect(r.errors).toEqual([]);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).reps).toEqual([5, 5, 5, 5, 5]);
  });
});

describe("parseWorkoutBlock — set notation", () => {
  it("parses varying-reps csv notation as one set per number", () => {
    const r = parseWorkoutBlock("Bench Press\n  8,7,6 @ 80", opts);
    expect(r.errors).toEqual([]);
    const ex = nn(r.workout.exercises[0]);
    expect(ex.sets).toHaveLength(1);
    expect(nn(ex.sets[0]).reps).toEqual([8, 7, 6]);
  });

  it("parses a single-set notation without sets prefix", () => {
    const r = parseWorkoutBlock("Bench Press\n  6 @ 80", opts);
    expect(r.errors).toEqual([]);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).reps).toEqual([6]);
  });

  it("accumulates multiple set lines under one exercise", () => {
    const src = `Bench Press
  3x8 @ 80
  1x6 @ 85
  1x4 @ 90`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.errors).toEqual([]);
    const sets = nn(r.workout.exercises[0]).sets;
    expect(sets).toHaveLength(3);
    expect(sets.map((s) => s.weight?.value)).toEqual([80, 85, 90]);
  });
});

describe("parseWorkoutBlock — bodyweight", () => {
  it("treats absent weight as bodyweight", () => {
    const r = parseWorkoutBlock("Pull-Up\n  3x8", opts);
    expect(r.errors).toEqual([]);
    const s = nn(nn(r.workout.exercises[0]).sets[0]);
    expect(s.isBodyweight).toBe(true);
    expect(s.weight).toBeUndefined();
    expect(s.bodyweightAddon).toBeUndefined();
  });

  it("treats @ +N as weighted bodyweight", () => {
    const r = parseWorkoutBlock("Pull-Up\n  1x6 @ +20", opts);
    expect(r.errors).toEqual([]);
    const s = nn(nn(r.workout.exercises[0]).sets[0]);
    expect(s.isBodyweight).toBe(true);
    expect(s.bodyweightAddon).toEqual({ value: 20, unit: "kg" });
    expect(s.weight).toBeUndefined();
  });

  it("allows weighted bodyweight with explicit unit suffix", () => {
    const r = parseWorkoutBlock("Pull-Up\n  1x6 @ +45lb", opts);
    expect(r.errors).toEqual([]);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).bodyweightAddon).toEqual({
      value: 45,
      unit: "lb",
    });
  });
});

describe("parseWorkoutBlock — units", () => {
  it("uses the default unit when no suffix is provided", () => {
    const r = parseWorkoutBlock("Bench\n  3x8 @ 80", { defaultUnit: "lb" });
    expect(nn(nn(r.workout.exercises[0]).sets[0]).weight).toEqual({
      value: 80,
      unit: "lb",
    });
  });

  it("overrides the default with a per-set lb suffix", () => {
    const r = parseWorkoutBlock("DB Curl\n  3x10 @ 15lb", opts);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).weight).toEqual({
      value: 15,
      unit: "lb",
    });
  });

  it("parses decimal weights", () => {
    const r = parseWorkoutBlock("Bench\n  3x8 @ 22.5", opts);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).weight).toEqual({
      value: 22.5,
      unit: "kg",
    });
  });
});

describe("parseWorkoutBlock — comments", () => {
  it("captures per-set inline comments", () => {
    const r = parseWorkoutBlock("Bench\n  1x4 @ 90 # PR", opts);
    expect(nn(nn(r.workout.exercises[0]).sets[0]).comment).toBe("PR");
  });

  it("strips inline trailing comment from exercise name", () => {
    const r = parseWorkoutBlock("Bench Press # heavy\n  3x8 @ 80", opts);
    const ex = nn(r.workout.exercises[0]);
    expect(ex.name).toBe("Bench Press");
    expect(ex.comments).toEqual(["heavy"]);
  });

  it("attaches indented standalone # comments to current exercise", () => {
    const src = `Bench
  3x8 @ 80
  # felt strong
  1x6 @ 85`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.errors).toEqual([]);
    expect(nn(r.workout.exercises[0]).comments).toEqual(["felt strong"]);
  });

  it("collects unindented standalone # lines as block-level comments", () => {
    const src = `# top of workout
Bench
  3x8 @ 80
# bottom note`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.workout.comments).toEqual(["top of workout", "bottom note"]);
    expect(r.workout.exercises).toHaveLength(1);
  });
});

describe("parseWorkoutBlock — error recovery", () => {
  it("reports set lines before any exercise", () => {
    const r = parseWorkoutBlock("  3x8 @ 80", opts);
    expect(r.errors).toEqual([
      { line: 1, message: "Set without exercise" },
    ]);
    expect(r.workout.exercises).toEqual([]);
  });

  it("reports malformed set lines and continues parsing", () => {
    const src = `Bench
  3x8 @ 80
  garbage line
  1x6 @ 85`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.errors).toHaveLength(1);
    expect(nn(r.errors[0]).line).toBe(3);
    expect(nn(r.workout.exercises[0]).sets).toHaveLength(2);
  });

  it("reports empty exercise names", () => {
    const r = parseWorkoutBlock("# \n  3x8 @ 80", opts);
    expect(r.errors).toEqual([
      { line: 2, message: "Set without exercise" },
    ]);
  });

  it("preserves correct line numbers across blank lines", () => {
    const src = `Bench

  garbage`;
    const r = parseWorkoutBlock(src, opts);
    expect(nn(r.errors[0]).line).toBe(3);
  });
});

describe("parseWorkoutBlock — golden sample", () => {
  it("matches expected AST for the canonical example", () => {
    const src = `Bench Press
  3x8 @ 80
  1x6 @ 85
  1x4 @ 90  # PR

Pull-Up
  3x8
  1x6 @ +20

Dumbbell Curl
  3x10 @ 15lb`;
    const r = parseWorkoutBlock(src, opts);
    expect(r.errors).toEqual([]);
    expect(r.workout.exercises).toHaveLength(3);

    const bench = nn(r.workout.exercises[0]);
    expect(bench.name).toBe("Bench Press");
    expect(bench.sets.map((s) => s.weight?.value)).toEqual([80, 85, 90]);
    expect(nn(bench.sets[2]).comment).toBe("PR");

    const pullup = nn(r.workout.exercises[1]);
    expect(pullup.name).toBe("Pull-Up");
    expect(nn(pullup.sets[0]).isBodyweight).toBe(true);
    expect(nn(pullup.sets[0]).bodyweightAddon).toBeUndefined();
    expect(nn(pullup.sets[1]).bodyweightAddon).toEqual({
      value: 20,
      unit: "kg",
    });

    const curl = nn(r.workout.exercises[2]);
    expect(nn(curl.sets[0]).weight).toEqual({ value: 15, unit: "lb" });
  });
});
