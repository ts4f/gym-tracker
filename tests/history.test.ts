import { describe, expect, it } from "vitest";
import { Workout, WorkoutSet } from "../src/model/types";
import {
  computeExerciseHistory,
  formatSessionSummary,
  lastSessionBefore,
} from "../src/stats/history";
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

function workout(
  file: string,
  dateStr: string,
  exerciseNames: Record<string, WorkoutSet[]>,
): Workout {
  return {
    file,
    date: new Date(`${dateStr}T00:00:00Z`),
    exercises: Object.entries(exerciseNames).map(([name, sets]) => ({
      name,
      sets,
      comments: [],
    })),
  };
}

describe("computeExerciseHistory", () => {
  it("returns empty array for unknown exercise", () => {
    const workouts = [
      workout("w/2026-06-01.md", "2026-06-01", {
        Squat: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
      }),
    ];
    expect(computeExerciseHistory(workouts, "Bench Press")).toEqual([]);
  });

  it("returns one entry per session containing the exercise, newest first", () => {
    const workouts = [
      workout("w/2026-06-01.md", "2026-06-01", {
        Squat: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
      }),
      workout("w/2026-06-08.md", "2026-06-08", {
        Squat: [set({ reps: [5], weight: { value: 102.5, unit: "kg" } })],
        "Bench Press": [set({ reps: [5], weight: { value: 80, unit: "kg" } })],
      }),
      workout("w/2026-06-04.md", "2026-06-04", {
        "Bench Press": [set({ reps: [5], weight: { value: 77.5, unit: "kg" } })],
      }),
    ];
    const history = computeExerciseHistory(workouts, "Squat");
    expect(history.map((h) => h.file)).toEqual([
      "w/2026-06-08.md",
      "w/2026-06-01.md",
    ]);
  });

  it("is independent of workout input order", () => {
    const a = workout("w/2026-06-01.md", "2026-06-01", {
      Squat: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
    });
    const b = workout("w/2026-06-08.md", "2026-06-08", {
      Squat: [set({ reps: [3], weight: { value: 110, unit: "kg" } })],
    });
    expect(computeExerciseHistory([a, b], "Squat")).toEqual(
      computeExerciseHistory([b, a], "Squat"),
    );
  });

  it("picks the heaviest set as top set, in kg", () => {
    const workouts = [
      workout("w/2026-06-01.md", "2026-06-01", {
        Squat: [
          set({ reps: [5, 5, 5], weight: { value: 100, unit: "kg" } }),
          set({ reps: [2], weight: { value: 120, unit: "kg" } }),
        ],
      }),
    ];
    const entry = nn(computeExerciseHistory(workouts, "Squat")[0]);
    expect(entry.topSet).toEqual({ weightKg: 120, reps: 2 });
  });

  it("prefers higher reps when top-set weight is tied", () => {
    const workouts = [
      workout("w/2026-06-01.md", "2026-06-01", {
        Squat: [
          set({ reps: [3], weight: { value: 100, unit: "kg" } }),
          set({ reps: [5], weight: { value: 100, unit: "kg" } }),
        ],
      }),
    ];
    const entry = nn(computeExerciseHistory(workouts, "Squat")[0]);
    expect(entry.topSet).toEqual({ weightKg: 100, reps: 5 });
  });

  it("uses the bodyweight addon as the top-set load for weighted BW sets", () => {
    const workouts = [
      workout("w/2026-06-01.md", "2026-06-01", {
        "Pull-Up": [
          set({
            reps: [5],
            isBodyweight: true,
            bodyweightAddon: { value: 10, unit: "kg" },
          }),
        ],
      }),
    ];
    const entry = nn(computeExerciseHistory(workouts, "Pull-Up")[0]);
    expect(entry.topSet).toEqual({ weightKg: 10, reps: 5 });
    expect(entry.bodyweightReps).toBe(5);
  });

  it("totals bodyweight reps and leaves topSet undefined for pure BW sessions", () => {
    const workouts = [
      workout("w/2026-06-01.md", "2026-06-01", {
        "Push-Up": [
          set({ reps: [12, 10], isBodyweight: true }),
          set({ reps: [8], isBodyweight: true }),
        ],
      }),
    ];
    const entry = nn(computeExerciseHistory(workouts, "Push-Up")[0]);
    expect(entry.topSet).toBeUndefined();
    expect(entry.est1RM).toBeUndefined();
    expect(entry.bodyweightReps).toBe(30);
  });

  it("reports the session's best estimated 1RM", () => {
    const workouts = [
      workout("w/2026-06-01.md", "2026-06-01", {
        Squat: [
          set({ reps: [8], weight: { value: 90, unit: "kg" } }),
          set({ reps: [1], weight: { value: 110, unit: "kg" } }),
        ],
      }),
    ];
    const entry = nn(computeExerciseHistory(workouts, "Squat")[0]);
    // 90 * (1 + 8/30) = 114 < 110? No: 114 > 110 — the 8-rep back-off wins.
    expect(entry.est1RM).toBeCloseTo(114, 3);
  });

  it("merges duplicate exercise entries within one workout into one session", () => {
    const w: Workout = {
      file: "w/2026-06-01.md",
      date: new Date("2026-06-01T00:00:00Z"),
      exercises: [
        {
          name: "Squat",
          sets: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
          comments: [],
        },
        {
          name: "Squat",
          sets: [set({ reps: [3], weight: { value: 105, unit: "kg" } })],
          comments: [],
        },
      ],
    };
    const history = computeExerciseHistory([w], "Squat");
    expect(history).toHaveLength(1);
    expect(nn(history[0]).topSet).toEqual({ weightKg: 105, reps: 3 });
  });

  it("converts lb top sets to kg", () => {
    const workouts = [
      workout("w/2026-06-01.md", "2026-06-01", {
        "Bench Press": [set({ reps: [5], weight: { value: 225, unit: "lb" } })],
      }),
    ];
    const entry = nn(computeExerciseHistory(workouts, "Bench Press")[0]);
    expect(nn(entry.topSet).weightKg).toBeCloseTo(102.06, 2);
  });
});

describe("lastSessionBefore", () => {
  const workouts = [
    workout("w/2026-06-01.md", "2026-06-01", {
      Squat: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
    }),
    workout("w/2026-06-04.md", "2026-06-04", {
      Squat: [set({ reps: [5], weight: { value: 102.5, unit: "kg" } })],
    }),
    workout("w/2026-06-08.md", "2026-06-08", {
      Squat: [set({ reps: [5], weight: { value: 105, unit: "kg" } })],
    }),
  ];

  it("returns the most recent session strictly before the given date", () => {
    const entry = lastSessionBefore(workouts, "Squat", new Date("2026-06-08T00:00:00Z"));
    expect(nn(entry).file).toBe("w/2026-06-04.md");
  });

  it("excludes the given file even when its date is earlier", () => {
    const entry = lastSessionBefore(
      workouts,
      "Squat",
      new Date("2026-06-08T00:00:00Z"),
      "w/2026-06-04.md",
    );
    expect(nn(entry).file).toBe("w/2026-06-01.md");
  });

  it("returns null when no earlier session exists", () => {
    expect(
      lastSessionBefore(workouts, "Squat", new Date("2026-06-01T00:00:00Z")),
    ).toBeNull();
  });

  it("returns null for an unknown exercise", () => {
    expect(
      lastSessionBefore(workouts, "Deadlift", new Date("2026-06-08T00:00:00Z")),
    ).toBeNull();
  });

  it("does not count a same-date session as previous", () => {
    const entry = lastSessionBefore(
      workouts,
      "Squat",
      new Date("2026-06-04T00:00:00Z"),
      "w/2026-06-04.md",
    );
    expect(nn(entry).file).toBe("w/2026-06-01.md");
  });
});

describe("formatSessionSummary", () => {
  const date = new Date("2026-06-04T00:00:00Z");

  it("formats a loaded top set", () => {
    expect(
      formatSessionSummary({ date, file: "f", topSet: { weightKg: 100, reps: 5 }, bodyweightReps: 0 }),
    ).toBe("100kg × 5 (2026-06-04)");
  });

  it("trims trailing zeros but keeps real decimals", () => {
    expect(
      formatSessionSummary({ date, file: "f", topSet: { weightKg: 102.5, reps: 3 }, bodyweightReps: 0 }),
    ).toBe("102.5kg × 3 (2026-06-04)");
  });

  it("marks sessions that mix loaded and bodyweight work", () => {
    expect(
      formatSessionSummary({ date, file: "f", topSet: { weightKg: 10, reps: 5 }, bodyweightReps: 5 }),
    ).toBe("10kg × 5 (BW+) (2026-06-04)");
  });

  it("formats pure bodyweight sessions by reps", () => {
    expect(
      formatSessionSummary({ date, file: "f", bodyweightReps: 30 }),
    ).toBe("BW × 30 reps (2026-06-04)");
  });
});
