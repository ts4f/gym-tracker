import { describe, expect, it } from "vitest";
import { Exercise, WorkoutSet } from "../src/model/types";
import { parseWorkoutBlock } from "../src/parser/parser";
import { exercisesToDsl } from "../src/parser/serialize";
import { nn } from "./_helpers";

function set(partial: Partial<WorkoutSet>): WorkoutSet {
  return {
    reps: partial.reps ?? [1],
    weight: partial.weight,
    isBodyweight: partial.isBodyweight ?? false,
    bodyweightAddon: partial.bodyweightAddon,
    comment: partial.comment,
    line: partial.line ?? 1,
  };
}

function exercise(name: string, sets: WorkoutSet[]): Exercise {
  return { name, sets, comments: [] };
}

describe("exercisesToDsl — output format", () => {
  it("writes uniform reps as NxM with explicit unit", () => {
    const dsl = exercisesToDsl([
      exercise("Bench Press", [set({ reps: [5, 5, 5], weight: { value: 100, unit: "kg" } })]),
    ]);
    expect(dsl).toBe("Bench Press\n\t3x5 @ 100kg");
  });

  it("writes varying reps as CSV", () => {
    const dsl = exercisesToDsl([
      exercise("Deadlift", [set({ reps: [5, 3, 1], weight: { value: 90, unit: "kg" } })]),
    ]);
    expect(dsl).toBe("Deadlift\n\t5,3,1 @ 90kg");
  });

  it("writes bodyweight sets without a weight token", () => {
    const dsl = exercisesToDsl([
      exercise("Push-Up", [set({ reps: [12, 12], isBodyweight: true })]),
    ]);
    expect(dsl).toBe("Push-Up\n\t2x12");
  });

  it("writes bodyweight addons with a plus sign", () => {
    const dsl = exercisesToDsl([
      exercise("Pull-Up", [
        set({ reps: [5], isBodyweight: true, bodyweightAddon: { value: 10, unit: "kg" } }),
      ]),
    ]);
    expect(dsl).toBe("Pull-Up\n\t1x5 @ +10kg");
  });

  it("skips sets with no reps", () => {
    const dsl = exercisesToDsl([exercise("Squat", [set({ reps: [] })])]);
    expect(dsl).toBe("Squat");
  });
});

describe("exercisesToDsl — parser round-trip", () => {
  const cases: { name: string; exercises: Exercise[] }[] = [
    {
      name: "uniform weighted sets",
      exercises: [
        exercise("Bench Press", [set({ reps: [5, 5, 5], weight: { value: 100, unit: "kg" } })]),
      ],
    },
    {
      name: "CSV reps with decimal weight",
      exercises: [
        exercise("Squat", [set({ reps: [5, 3, 1], weight: { value: 102.5, unit: "kg" } })]),
      ],
    },
    {
      name: "lb unit preserved regardless of default unit",
      exercises: [
        exercise("DB Curl", [set({ reps: [10, 10], weight: { value: 25, unit: "lb" } })]),
      ],
    },
    {
      name: "pure bodyweight",
      exercises: [exercise("Push-Up", [set({ reps: [12, 10, 8], isBodyweight: true })])],
    },
    {
      name: "weighted bodyweight",
      exercises: [
        exercise("Pull-Up", [
          set({ reps: [5, 5], isBodyweight: true, bodyweightAddon: { value: 10, unit: "kg" } }),
        ]),
      ],
    },
    {
      name: "multiple exercises with mixed set types",
      exercises: [
        exercise("Squat", [
          set({ reps: [5, 5, 5], weight: { value: 140, unit: "kg" } }),
          set({ reps: [8], weight: { value: 120, unit: "kg" } }),
        ]),
        exercise("Dip", [set({ reps: [10, 8], isBodyweight: true })]),
      ],
    },
  ];

  for (const { name, exercises } of cases) {
    it(`round-trips ${name}`, () => {
      // Parse with the opposite default unit to prove serialized units are explicit.
      const result = parseWorkoutBlock(exercisesToDsl(exercises), { defaultUnit: "lb" });
      expect(result.errors).toEqual([]);
      expect(result.workout.exercises).toHaveLength(exercises.length);
      for (const [i, expected] of exercises.entries()) {
        const actual = nn(result.workout.exercises[i]);
        expect(actual.name).toBe(expected.name);
        expect(actual.sets).toHaveLength(expected.sets.length);
        for (const [j, expectedSet] of expected.sets.entries()) {
          const actualSet = nn(actual.sets[j]);
          expect(actualSet.reps).toEqual(expectedSet.reps);
          expect(actualSet.weight).toEqual(expectedSet.weight);
          expect(actualSet.isBodyweight).toBe(expectedSet.isBodyweight);
          expect(actualSet.bodyweightAddon).toEqual(expectedSet.bodyweightAddon);
        }
      }
    });
  }
});
