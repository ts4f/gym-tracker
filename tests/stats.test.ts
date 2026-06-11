import { describe, expect, it } from "vitest";
import { Workout, WorkoutSet } from "../src/model/types";
import { estimateOneRepMax } from "../src/stats/oneRepMax";
import { computePersonalRecords } from "../src/stats/pr";
import { computeWeeklyVolume } from "../src/stats/volume";

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

describe("estimateOneRepMax", () => {
  it("applies Epley formula for loaded sets", () => {
    const s = set({
      reps: [5],
      weight: { value: 100, unit: "kg" },
    });
    // 100 * (1 + 5/30) = 116.667
    expect(estimateOneRepMax(s)).toBeCloseTo(116.667, 2);
  });

  it("equals weight at 1 rep", () => {
    const s = set({
      reps: [1],
      weight: { value: 100, unit: "kg" },
    });
    expect(estimateOneRepMax(s)).toBeCloseTo(100, 2);
  });

  it("returns the max across reps in a varying-reps set", () => {
    const s = set({
      reps: [8, 6, 4],
      weight: { value: 80, unit: "kg" },
    });
    // 80 * (1 + 8/30) = 101.33 — highest
    expect(estimateOneRepMax(s)).toBeCloseTo(101.333, 2);
  });

  it("returns null for pure bodyweight sets", () => {
    const s = set({ reps: [10], isBodyweight: true });
    expect(estimateOneRepMax(s)).toBeNull();
  });

  it("uses the bodyweight addon for weighted bodyweight sets", () => {
    const s = set({
      reps: [6],
      isBodyweight: true,
      bodyweightAddon: { value: 20, unit: "kg" },
    });
    // 20 * (1 + 6/30) = 24
    expect(estimateOneRepMax(s)).toBeCloseTo(24, 2);
  });

  it("converts lb to kg in the estimate", () => {
    const s = set({ reps: [1], weight: { value: 220.462, unit: "lb" } });
    expect(estimateOneRepMax(s)).toBeCloseTo(100, 1);
  });
});

describe("computePersonalRecords", () => {
  it("returns an empty map for no workouts", () => {
    expect(computePersonalRecords([])).toEqual(new Map());
  });

  it("tracks max weight per exercise", () => {
    const workouts = [
      workout("a.md", "2026-05-01", {
        Bench: [
          set({ reps: [8, 8, 8], weight: { value: 80, unit: "kg" } }),
          set({ reps: [4], weight: { value: 90, unit: "kg" } }),
        ],
      }),
      workout("b.md", "2026-05-08", {
        Bench: [set({ reps: [1], weight: { value: 95, unit: "kg" } })],
      }),
    ];
    const prs = computePersonalRecords(workouts);
    expect(prs.get("Bench")!.maxWeight!.weightKg).toBe(95);
    expect(prs.get("Bench")!.maxWeight!.file).toBe("b.md");
  });

  it("tracks max estimated 1RM per exercise", () => {
    const workouts = [
      workout("a.md", "2026-05-01", {
        Bench: [set({ reps: [8], weight: { value: 80, unit: "kg" } })],
      }),
      workout("b.md", "2026-05-08", {
        Bench: [set({ reps: [1], weight: { value: 95, unit: "kg" } })],
      }),
    ];
    const prs = computePersonalRecords(workouts);
    // 80 * 1.2667 ≈ 101.33 vs 95 — first workout has higher est 1RM
    expect(prs.get("Bench")!.maxEst1RM!.value).toBeCloseTo(101.333, 2);
    expect(prs.get("Bench")!.maxEst1RM!.file).toBe("a.md");
  });

  it("ignores pure bodyweight sets for maxWeight", () => {
    const workouts = [
      workout("a.md", "2026-05-01", {
        "Pull-Up": [set({ reps: [10], isBodyweight: true })],
      }),
    ];
    const prs = computePersonalRecords(workouts);
    expect(prs.get("Pull-Up")?.maxWeight).toBeUndefined();
    expect(prs.get("Pull-Up")?.maxEst1RM).toBeUndefined();
  });

  it("uses bodyweight addon as maxWeight for weighted bodyweight", () => {
    const workouts = [
      workout("a.md", "2026-05-01", {
        "Pull-Up": [
          set({
            reps: [6],
            isBodyweight: true,
            bodyweightAddon: { value: 20, unit: "kg" },
          }),
        ],
      }),
    ];
    const prs = computePersonalRecords(workouts);
    expect(prs.get("Pull-Up")!.maxWeight!.weightKg).toBe(20);
  });

  it("is independent of workout input order", () => {
    const a = workout("a.md", "2026-05-01", {
      Bench: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
    });
    const b = workout("b.md", "2026-05-08", {
      Bench: [set({ reps: [3], weight: { value: 100, unit: "kg" } })],
    });
    expect(computePersonalRecords([a, b])).toEqual(computePersonalRecords([b, a]));
  });

  it("keeps the earliest session for a fully tied max weight", () => {
    const workouts = [
      workout("b.md", "2026-05-08", {
        Bench: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
      }),
      workout("a.md", "2026-05-01", {
        Bench: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
      }),
    ];
    const record = computePersonalRecords(workouts).get("Bench")!.maxWeight!;
    expect(record.file).toBe("a.md");
    expect(record.date.toISOString().slice(0, 10)).toBe("2026-05-01");
  });

  it("prefers higher reps when max weight is tied across sessions", () => {
    const workouts = [
      workout("a.md", "2026-05-01", {
        Bench: [set({ reps: [3], weight: { value: 100, unit: "kg" } })],
      }),
      workout("b.md", "2026-05-08", {
        Bench: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
      }),
    ];
    const record = computePersonalRecords(workouts).get("Bench")!.maxWeight!;
    expect(record.reps).toBe(5);
    expect(record.file).toBe("b.md");
  });

  it("records the highest rep count within a varying-reps set", () => {
    const workouts = [
      workout("a.md", "2026-05-01", {
        Bench: [set({ reps: [3, 5, 2], weight: { value: 100, unit: "kg" } })],
      }),
    ];
    const record = computePersonalRecords(workouts).get("Bench")!.maxWeight!;
    expect(record.reps).toBe(5);
  });

  it("breaks same-date ties by file path for determinism", () => {
    const workouts = [
      workout("z.md", "2026-05-01", {
        Bench: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
      }),
      workout("a.md", "2026-05-01", {
        Bench: [set({ reps: [5], weight: { value: 100, unit: "kg" } })],
      }),
    ];
    const record = computePersonalRecords(workouts).get("Bench")!.maxWeight!;
    expect(record.file).toBe("a.md");
  });
});

describe("computeWeeklyVolume", () => {
  it("returns an empty map for no workouts", () => {
    expect(computeWeeklyVolume([])).toEqual(new Map());
  });

  it("sums loaded volume per exercise per week", () => {
    const workouts = [
      workout("a.md", "2026-05-19", {
        Bench: [
          set({ reps: [8, 8, 8], weight: { value: 80, unit: "kg" } }),
        ],
      }),
    ];
    const v = computeWeeklyVolume(workouts);
    expect(v.get("2026-W21")!.get("Bench")!.loadedVolumeKg).toBe(24 * 80);
    expect(v.get("2026-W21")!.get("Bench")!.bodyweightReps).toBe(0);
  });

  it("aggregates multiple workouts in the same week", () => {
    const workouts = [
      workout("a.md", "2026-05-19", {
        Squat: [set({ reps: [5, 5, 5], weight: { value: 100, unit: "kg" } })],
      }),
      workout("b.md", "2026-05-22", {
        Squat: [set({ reps: [3, 3], weight: { value: 110, unit: "kg" } })],
      }),
    ];
    const v = computeWeeklyVolume(workouts);
    expect(v.size).toBe(1);
    expect(v.get("2026-W21")!.get("Squat")!.loadedVolumeKg).toBe(
      15 * 100 + 6 * 110,
    );
  });

  it("tracks bodyweight reps separately", () => {
    const workouts = [
      workout("a.md", "2026-05-19", {
        "Push-Up": [set({ reps: [15, 12, 10], isBodyweight: true })],
      }),
    ];
    const v = computeWeeklyVolume(workouts);
    expect(v.get("2026-W21")!.get("Push-Up")!.bodyweightReps).toBe(37);
    expect(v.get("2026-W21")!.get("Push-Up")!.loadedVolumeKg).toBe(0);
  });

  it("counts weighted bodyweight as both bodyweightReps and loadedVolumeKg", () => {
    const workouts = [
      workout("a.md", "2026-05-19", {
        "Pull-Up": [
          set({
            reps: [6, 5, 4],
            isBodyweight: true,
            bodyweightAddon: { value: 20, unit: "kg" },
          }),
        ],
      }),
    ];
    const v = computeWeeklyVolume(workouts);
    expect(v.get("2026-W21")!.get("Pull-Up")!.bodyweightReps).toBe(15);
    expect(v.get("2026-W21")!.get("Pull-Up")!.loadedVolumeKg).toBe(15 * 20);
  });

  it("converts lb to kg in loaded volume", () => {
    const workouts = [
      workout("a.md", "2026-05-19", {
        "DB Curl": [
          set({ reps: [10, 10, 10], weight: { value: 22.0462, unit: "lb" } }),
        ],
      }),
    ];
    const v = computeWeeklyVolume(workouts);
    // 22.0462 lb ≈ 10 kg; total reps = 30; volume ≈ 300 kg
    expect(
      v.get("2026-W21")!.get("DB Curl")!.loadedVolumeKg,
    ).toBeCloseTo(300, 0);
  });
});
