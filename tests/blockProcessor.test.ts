import { describe, expect, it } from "vitest";
import { buildSetRows, formatWeight, fuzzyWarning, lastSessionLabel } from "../src/render/blockProcessor";
import { WorkoutSet, Workout } from "../src/model/types";
import { ExerciseIndex } from "../src/index/exerciseIndex";

function weightSet(reps: number[], value: number, unit: "kg" | "lb" = "kg", comment?: string): WorkoutSet {
  return { reps, weight: { value, unit }, isBodyweight: false, comment, line: 1 };
}

function bwSet(reps: number[], addon?: { value: number; unit: "kg" | "lb" }): WorkoutSet {
  return { reps, isBodyweight: true, bodyweightAddon: addon, line: 1 };
}

describe("formatWeight", () => {
  it("formats a kg weight", () => {
    expect(formatWeight(weightSet([8], 80))).toBe("80 kg");
  });

  it("formats a lb weight", () => {
    expect(formatWeight(weightSet([8], 45, "lb"))).toBe("45 lb");
  });

  it("formats bodyweight with no addon", () => {
    expect(formatWeight(bwSet([8]))).toBe("BW");
  });

  it("formats bodyweight with addon", () => {
    expect(formatWeight(bwSet([8], { value: 20, unit: "kg" }))).toBe("BW +20 kg");
  });

  it("returns em dash when no weight and not bodyweight", () => {
    const set: WorkoutSet = { reps: [8], isBodyweight: false, line: 1 };
    expect(formatWeight(set)).toBe("—");
  });
});

describe("buildSetRows — NxM expansion", () => {
  it("returns empty array for no sets", () => {
    expect(buildSetRows([])).toEqual([]);
  });

  it("expands 3x8 into three rows with sequential set numbers", () => {
    const rows = buildSetRows([weightSet([8, 8, 8], 80)]);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.setNum)).toEqual([1, 2, 3]);
    expect(rows.map((r) => r.reps)).toEqual([8, 8, 8]);
    expect(rows.map((r) => r.weight)).toEqual(["80 kg", "80 kg", "80 kg"]);
  });

  it("expands varying-reps (8,7,6) into rows preserving each rep count", () => {
    const rows = buildSetRows([weightSet([8, 7, 6], 80)]);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.reps)).toEqual([8, 7, 6]);
  });

  it("continues set numbering across multiple set lines", () => {
    // 3x8 @ 80, then 1x6 @ 85 → 4 rows total
    const rows = buildSetRows([
      weightSet([8, 8, 8], 80),
      weightSet([6], 85),
    ]);
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.setNum)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.weight)).toEqual(["80 kg", "80 kg", "80 kg", "85 kg"]);
  });

  it("expands a single-rep set into one row", () => {
    const rows = buildSetRows([weightSet([6], 85)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ setNum: 1, reps: 6, weight: "85 kg", note: "" });
  });

  it("flags bodyweight rows", () => {
    const rows = buildSetRows([bwSet([8, 8, 8])]);
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.isBodyweight)).toBe(true);
    expect(rows.every((r) => r.weight === "BW")).toBe(true);
  });

  it("carries the set comment onto every row for that set", () => {
    const rows = buildSetRows([weightSet([8, 8], 80, "kg", "PR attempt")]);
    expect(rows.every((r) => r.note === "PR attempt")).toBe(true);
  });

  it("empty note when no comment", () => {
    const rows = buildSetRows([weightSet([8], 80)]);
    expect(rows[0]?.note).toBe("");
  });
});

describe("fuzzyWarning", () => {
  function ex(file: string, dateStr: string, name: string): Workout {
    return {
      file,
      date: new Date(`${dateStr}T00:00:00Z`),
      exercises: [{ name, sets: [], comments: [] }],
    };
  }

  function indexWithTypo(): ExerciseIndex {
    const idx = new ExerciseIndex();
    idx.setAll([
      ex("a.md", "2026-05-01", "Bench Press"),
      ex("b.md", "2026-05-02", "Bench Press"),
      ex("c.md", "2026-05-03", "Bench Press"),
    ]);
    return idx;
  }

  it("suggests the canonical name for a typo when fuzzy matching is on", () => {
    expect(
      fuzzyWarning(indexWithTypo(), { fuzzyMatchEnabled: true }, "Bnch Press"),
    ).toBe("Bench Press");
  });

  it("returns null for a typo when fuzzy matching is off", () => {
    expect(
      fuzzyWarning(indexWithTypo(), { fuzzyMatchEnabled: false }, "Bnch Press"),
    ).toBeNull();
  });

  it("returns null for an exact match regardless of setting", () => {
    expect(
      fuzzyWarning(indexWithTypo(), { fuzzyMatchEnabled: true }, "Bench Press"),
    ).toBeNull();
  });
});

describe("lastSessionLabel", () => {
  function workoutWithSet(file: string, dateStr: string, name: string, weightKg: number): Workout {
    return {
      file,
      date: new Date(`${dateStr}T00:00:00Z`),
      exercises: [
        {
          name,
          sets: [weightSet([5], weightKg)],
          comments: [],
        },
      ],
    };
  }

  function makeIndex(): ExerciseIndex {
    const idx = new ExerciseIndex();
    idx.setAll([
      workoutWithSet("Workouts/2026-06-01.md", "2026-06-01", "Squat", 100),
      workoutWithSet("Workouts/2026-06-04 Legs.md", "2026-06-04", "Squat", 102.5),
      workoutWithSet("Workouts/2026-06-08.md", "2026-06-08", "Squat", 105),
    ]);
    return idx;
  }

  it("labels the most recent earlier session, excluding the current note", () => {
    expect(lastSessionLabel(makeIndex(), "Workouts/2026-06-08.md", "Squat")).toBe(
      "last: 102.5kg × 5 (2026-06-04)",
    );
  });

  it("parses dated filenames with titles", () => {
    expect(
      lastSessionLabel(makeIndex(), "Workouts/2026-06-04 Legs.md", "Squat"),
    ).toBe("last: 100kg × 5 (2026-06-01)");
  });

  it("returns null for the first-ever session of an exercise", () => {
    expect(lastSessionLabel(makeIndex(), "Workouts/2026-06-01.md", "Squat")).toBeNull();
  });

  it("returns null for an exercise with no history", () => {
    expect(lastSessionLabel(makeIndex(), "Workouts/2026-06-08.md", "Deadlift")).toBeNull();
  });

  it("returns null when the note filename has no parseable date", () => {
    expect(lastSessionLabel(makeIndex(), "Workouts/scratch.md", "Squat")).toBeNull();
  });
});
