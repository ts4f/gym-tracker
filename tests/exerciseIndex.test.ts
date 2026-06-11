import { describe, expect, it } from "vitest";
import { ExerciseIndex } from "../src/index/exerciseIndex";
import { Unit, Workout } from "../src/model/types";
import { nn } from "./_helpers";

function workout(file: string, dateStr: string, exerciseNames: string[]): Workout {
  return {
    file,
    date: new Date(`${dateStr}T00:00:00Z`),
    exercises: exerciseNames.map((name) => ({
      name,
      sets: [],
      comments: [],
    })),
  };
}

function workoutWithSets(
  file: string,
  dateStr: string,
  name: string,
  lastSetWeight: { value: number; unit: Unit } | "bodyweight" | null,
): Workout {
  const set =
    lastSetWeight === "bodyweight"
      ? { reps: [8], isBodyweight: true as const, line: 1 }
      : lastSetWeight !== null
        ? { reps: [8], isBodyweight: false as const, weight: lastSetWeight, line: 1 }
        : { reps: [8], isBodyweight: false as const, line: 1 };
  return {
    file,
    date: new Date(`${dateStr}T00:00:00Z`),
    exercises: [{ name, sets: [set], comments: [] }],
  };
}

describe("ExerciseIndex — basic state management", () => {
  it("starts empty", () => {
    const idx = new ExerciseIndex();
    expect(idx.size()).toBe(0);
    expect(idx.knownExercises()).toEqual([]);
  });

  it("setAll replaces all data", () => {
    const idx = new ExerciseIndex();
    idx.setAll([workout("a.md", "2026-05-01", ["Bench Press"])]);
    expect(idx.size()).toBe(1);
    idx.setAll([workout("b.md", "2026-05-02", ["Squat"])]);
    expect(idx.size()).toBe(1);
    expect(idx.knownExercises().map((s) => s.name)).toEqual(["Squat"]);
  });

  it("upsert adds new workouts and replaces existing by path", () => {
    const idx = new ExerciseIndex();
    idx.upsert(workout("a.md", "2026-05-01", ["Bench"]));
    idx.upsert(workout("a.md", "2026-05-01", ["Squat"]));
    expect(idx.size()).toBe(1);
    expect(idx.knownExercises().map((s) => s.name)).toEqual(["Squat"]);
  });

  it("remove drops a workout by path", () => {
    const idx = new ExerciseIndex();
    idx.upsert(workout("a.md", "2026-05-01", ["Bench"]));
    idx.upsert(workout("b.md", "2026-05-02", ["Squat"]));
    idx.remove("a.md");
    expect(idx.size()).toBe(1);
    expect(idx.knownExercises().map((s) => s.name)).toEqual(["Squat"]);
  });

  it("rename updates the file path", () => {
    const idx = new ExerciseIndex();
    idx.upsert(workout("old.md", "2026-05-01", ["Bench"]));
    idx.rename("old.md", "new.md");
    expect(idx.allWorkouts().map((w) => w.file)).toEqual(["new.md"]);
  });
});

describe("ExerciseIndex — frequency and last-used", () => {
  it("counts exercise frequency across workouts", () => {
    const idx = new ExerciseIndex();
    idx.setAll([
      workout("a.md", "2026-05-01", ["Bench", "Squat"]),
      workout("b.md", "2026-05-02", ["Bench"]),
      workout("c.md", "2026-05-03", ["Bench", "Squat"]),
    ]);
    const bench = idx.knownExercises().find((s) => s.name === "Bench");
    const squat = idx.knownExercises().find((s) => s.name === "Squat");
    expect(bench?.frequency).toBe(3);
    expect(squat?.frequency).toBe(2);
  });

  it("tracks the most recent use date", () => {
    const idx = new ExerciseIndex();
    idx.setAll([
      workout("a.md", "2026-05-01", ["Bench"]),
      workout("b.md", "2026-05-15", ["Bench"]),
      workout("c.md", "2026-05-08", ["Bench"]),
    ]);
    const bench = idx.knownExercises().find((s) => s.name === "Bench");
    expect(bench?.lastUsed.toISOString().slice(0, 10)).toBe("2026-05-15");
  });
});

describe("ExerciseIndex — lookup", () => {
  it("returns prefix matches before substring matches", () => {
    const idx = new ExerciseIndex();
    idx.setAll([
      workout("a.md", "2026-05-01", ["Bench Press", "Incline Bench", "Squat"]),
    ]);
    const r = idx.lookup("Bench");
    expect(r.map((s) => s.name)).toEqual(["Bench Press", "Incline Bench"]);
  });

  it("ranks ties by frequency desc", () => {
    const idx = new ExerciseIndex();
    idx.setAll([
      workout("a.md", "2026-05-01", ["Bench Press", "Bench Press", "Bent Row"]),
      workout("b.md", "2026-05-02", ["Bench Press"]),
    ]);
    const r = idx.lookup("Ben");
    expect(nn(r[0]).name).toBe("Bench Press");
  });

  it("is case-insensitive", () => {
    const idx = new ExerciseIndex();
    idx.setAll([workout("a.md", "2026-05-01", ["Bench Press"])]);
    expect(idx.lookup("bench").map((s) => s.name)).toEqual(["Bench Press"]);
    expect(idx.lookup("BENCH").map((s) => s.name)).toEqual(["Bench Press"]);
  });

  it("respects the limit", () => {
    const idx = new ExerciseIndex();
    idx.setAll([
      workout("a.md", "2026-05-01", ["Bench Press", "Bench Dip", "Bent Row"]),
    ]);
    expect(idx.lookup("Be", 2)).toHaveLength(2);
  });

  it("returns all known exercises for an empty query", () => {
    const idx = new ExerciseIndex();
    idx.setAll([workout("a.md", "2026-05-01", ["A", "B", "C"])]);
    expect(idx.lookup("").map((s) => s.name).sort()).toEqual(["A", "B", "C"]);
  });
});

describe("ExerciseIndex — lookup with excludeTypos", () => {
  function withTypo(): ExerciseIndex {
    const idx = new ExerciseIndex();
    // "Bench Press" used 3×; "Bench Pres" is a single misspelling.
    idx.setAll([
      workout("a.md", "2026-05-01", ["Bench Press"]),
      workout("b.md", "2026-05-02", ["Bench Press"]),
      workout("c.md", "2026-05-03", ["Bench Press"]),
      workout("d.md", "2026-05-04", ["Bench Pres"]),
    ]);
    return idx;
  }

  it("hides a typo of a more-frequent exercise", () => {
    const r = withTypo().lookup("Bench", 10, { excludeTypos: true });
    expect(r.map((s) => s.name)).toEqual(["Bench Press"]);
  });

  it("still suggests the canonical (more-frequent) name", () => {
    const r = withTypo().lookup("Bench", 10, { excludeTypos: true });
    expect(r.map((s) => s.name)).toContain("Bench Press");
  });

  it("does not filter when excludeTypos is off (default)", () => {
    const r = withTypo().lookup("Bench");
    expect(r.map((s) => s.name).sort()).toEqual(["Bench Pres", "Bench Press"]);
  });

  it("leaves names with no close, more-frequent match untouched", () => {
    const idx = new ExerciseIndex();
    idx.setAll([
      workout("a.md", "2026-05-01", ["Squat", "Deadlift"]),
    ]);
    const r = idx.lookup("", 10, { excludeTypos: true });
    expect(r.map((s) => s.name).sort()).toEqual(["Deadlift", "Squat"]);
  });

  it("keeps both names when frequencies are equal (no clear typo)", () => {
    const idx = new ExerciseIndex();
    idx.setAll([
      workout("a.md", "2026-05-01", ["Bench Press"]),
      workout("b.md", "2026-05-02", ["Bench Pres"]),
    ]);
    const r = idx.lookup("Bench", 10, { excludeTypos: true });
    expect(r.map((s) => s.name).sort()).toEqual(["Bench Pres", "Bench Press"]);
  });
});

describe("ExerciseIndex — lastWeight tracking", () => {
  it("captures weight from the last set of the most recent workout", () => {
    const idx = new ExerciseIndex();
    idx.upsert(workoutWithSets("a.md", "2026-05-01", "Bench Press", { value: 80, unit: "kg" }));
    const s = idx.knownExercises().find((x) => x.name === "Bench Press");
    expect(s?.lastWeight).toEqual({ value: 80, unit: "kg" });
  });

  it("uses 'bodyweight' when last set has no external load", () => {
    const idx = new ExerciseIndex();
    idx.upsert(workoutWithSets("a.md", "2026-05-01", "Pull-Up", "bodyweight"));
    const s = idx.knownExercises().find((x) => x.name === "Pull-Up");
    expect(s?.lastWeight).toBe("bodyweight");
  });

  it("is null when the exercise has no sets", () => {
    const idx = new ExerciseIndex();
    idx.upsert(workout("a.md", "2026-05-01", ["Bench Press"]));
    const s = idx.knownExercises().find((x) => x.name === "Bench Press");
    expect(s?.lastWeight).toBeNull();
  });

  it("updates lastWeight when a newer workout is processed", () => {
    const idx = new ExerciseIndex();
    idx.setAll([
      workoutWithSets("a.md", "2026-05-01", "Bench", { value: 80, unit: "kg" }),
      workoutWithSets("b.md", "2026-05-15", "Bench", { value: 90, unit: "kg" }),
      workoutWithSets("c.md", "2026-05-08", "Bench", { value: 85, unit: "kg" }),
    ]);
    const s = idx.knownExercises().find((x) => x.name === "Bench");
    expect(s?.lastWeight).toEqual({ value: 90, unit: "kg" });
  });

  it("switches to bodyweight when the most recent session was BW", () => {
    const idx = new ExerciseIndex();
    idx.setAll([
      workoutWithSets("a.md", "2026-05-01", "Pull-Up", { value: 10, unit: "kg" }),
      workoutWithSets("b.md", "2026-05-20", "Pull-Up", "bodyweight"),
    ]);
    const s = idx.knownExercises().find((x) => x.name === "Pull-Up");
    expect(s?.lastWeight).toBe("bodyweight");
  });

  it("does not update lastWeight when an older workout is processed later", () => {
    const idx = new ExerciseIndex();
    idx.setAll([
      workoutWithSets("b.md", "2026-05-15", "Bench", { value: 90, unit: "kg" }),
      workoutWithSets("a.md", "2026-05-01", "Bench", { value: 80, unit: "kg" }),
    ]);
    const s = idx.knownExercises().find((x) => x.name === "Bench");
    expect(s?.lastWeight).toEqual({ value: 90, unit: "kg" });
  });
});

describe("ExerciseIndex — nearestMatch", () => {
  const idx = new ExerciseIndex();
  idx.setAll([
    workout("a.md", "2026-05-01", ["Bench Press"]),
    workout("b.md", "2026-05-02", ["Bench Press"]),
    workout("c.md", "2026-05-03", ["Bench Press"]),
    workout("d.md", "2026-05-04", ["Squat"]),
  ]);

  it("returns null for an exact match (no warning)", () => {
    expect(idx.nearestMatch("Bench Press", 2)).toBeNull();
  });

  it("returns the more-frequent near-match for a likely typo", () => {
    expect(idx.nearestMatch("Bnch Press", 2)).toBe("Bench Press");
  });

  it("returns null when the closest neighbor is beyond maxDist", () => {
    expect(idx.nearestMatch("Deadlift", 2)).toBeNull();
  });

  it("does not warn when the input and neighbor have equal frequency", () => {
    const equal = new ExerciseIndex();
    equal.setAll([
      workout("a.md", "2026-05-01", ["Bench Press"]),
      workout("b.md", "2026-05-02", ["Bnch Press"]),
    ]);
    // Both have freq 1 — no warning either way
    expect(equal.nearestMatch("Bnch Press", 2)).toBeNull();
    expect(equal.nearestMatch("Bench Press", 2)).toBeNull();
  });

  it("returns null on an empty name", () => {
    expect(idx.nearestMatch("", 2)).toBeNull();
  });
});
