import { describe, expect, it } from "vitest";
import { Workout, WorkoutSet } from "../src/model/types";
import {
  computeProgressionTrend,
  formatProgressionTrend,
} from "../src/stats/trend";
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

describe("computeProgressionTrend", () => {
  it("returns null for fewer than three est-1RM sessions", () => {
    const two = [
      workout("a.md", "2026-06-01", {
        Bench: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
      }),
      workout("b.md", "2026-06-11", {
        Bench: [set({ reps: [1], weight: { value: 110, unit: "kg" } })],
      }),
    ];
    expect(computeProgressionTrend(two, "Bench")).toBeNull();
    expect(computeProgressionTrend([], "Bench")).toBeNull();
  });

  it("honours a custom minimum point count", () => {
    const two = [
      workout("a.md", "2026-06-01", {
        Bench: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
      }),
      workout("b.md", "2026-06-11", {
        Bench: [set({ reps: [1], weight: { value: 110, unit: "kg" } })],
      }),
    ];
    expect(computeProgressionTrend(two, "Bench", 2)).not.toBeNull();
  });

  it("returns null for an unknown exercise", () => {
    const workouts = [
      workout("a.md", "2026-06-01", {
        Squat: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
      }),
      workout("b.md", "2026-06-11", {
        Squat: [set({ reps: [1], weight: { value: 110, unit: "kg" } })],
      }),
      workout("c.md", "2026-06-21", {
        Squat: [set({ reps: [1], weight: { value: 120, unit: "kg" } })],
      }),
    ];
    expect(computeProgressionTrend(workouts, "Bench")).toBeNull();
  });

  it("returns null when all sessions share one date", () => {
    const workouts = [
      workout("a.md", "2026-06-01", {
        Bench: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
      }),
      workout("b.md", "2026-06-01", {
        Bench: [set({ reps: [1], weight: { value: 110, unit: "kg" } })],
      }),
      workout("c.md", "2026-06-01", {
        Bench: [set({ reps: [1], weight: { value: 120, unit: "kg" } })],
      }),
    ];
    expect(computeProgressionTrend(workouts, "Bench")).toBeNull();
  });

  it("computes a positive slope from a collinear increasing history", () => {
    const workouts = [
      workout("a.md", "2026-06-01", {
        Bench: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
      }),
      workout("b.md", "2026-06-11", {
        Bench: [set({ reps: [1], weight: { value: 110, unit: "kg" } })],
      }),
      workout("c.md", "2026-06-21", {
        Bench: [set({ reps: [1], weight: { value: 120, unit: "kg" } })],
      }),
    ];
    const trend = nn(computeProgressionTrend(workouts, "Bench"));
    expect(trend.points).toBe(3);
    expect(trend.slopePerDay).toBeCloseTo(1, 6);
    expect(trend.slopePerMonth).toBeCloseTo(30.44, 3);
  });

  it("computes a negative slope from a declining history", () => {
    const workouts = [
      workout("a.md", "2026-06-01", {
        Bench: [set({ reps: [1], weight: { value: 120, unit: "kg" } })],
      }),
      workout("b.md", "2026-06-11", {
        Bench: [set({ reps: [1], weight: { value: 110, unit: "kg" } })],
      }),
      workout("c.md", "2026-06-21", {
        Bench: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
      }),
    ];
    const trend = nn(computeProgressionTrend(workouts, "Bench"));
    expect(trend.slopePerDay).toBeCloseTo(-1, 6);
    expect(trend.slopePerMonth).toBeCloseTo(-30.44, 3);
  });

  it("returns a ~0 slope for a flat history", () => {
    const workouts = [
      workout("a.md", "2026-06-01", {
        Bench: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
      }),
      workout("b.md", "2026-06-11", {
        Bench: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
      }),
      workout("c.md", "2026-06-21", {
        Bench: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
      }),
    ];
    const trend = nn(computeProgressionTrend(workouts, "Bench"));
    expect(trend.slopePerDay).toBeCloseTo(0, 6);
    expect(trend.slopePerMonth).toBeCloseTo(0, 6);
  });

  it("ignores sessions without an estimated 1RM", () => {
    const workouts = [
      workout("a.md", "2026-06-01", {
        Bench: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
      }),
      workout("b.md", "2026-06-11", {
        Bench: [set({ reps: [10], isBodyweight: true })],
      }),
      workout("c.md", "2026-06-21", {
        Bench: [set({ reps: [1], weight: { value: 110, unit: "kg" } })],
      }),
      workout("d.md", "2026-07-01", {
        Bench: [set({ reps: [1], weight: { value: 120, unit: "kg" } })],
      }),
    ];
    const trend = nn(computeProgressionTrend(workouts, "Bench"));
    expect(trend.points).toBe(3);
  });

  it("is independent of workout input order", () => {
    const a = workout("a.md", "2026-06-01", {
      Bench: [set({ reps: [1], weight: { value: 100, unit: "kg" } })],
    });
    const b = workout("b.md", "2026-06-11", {
      Bench: [set({ reps: [1], weight: { value: 110, unit: "kg" } })],
    });
    const c = workout("c.md", "2026-06-21", {
      Bench: [set({ reps: [1], weight: { value: 120, unit: "kg" } })],
    });
    const t1 = nn(computeProgressionTrend([a, b, c], "Bench"));
    const t2 = nn(computeProgressionTrend([c, a, b], "Bench"));
    expect(t1.slopePerDay).toBeCloseTo(t2.slopePerDay, 6);
    expect(t1.points).toBe(t2.points);
  });
});

describe("formatProgressionTrend", () => {
  const base = {
    slopePerDay: 1,
    points: 3,
    firstDate: new Date("2026-06-01T00:00:00Z"),
    lastDate: new Date("2026-06-21T00:00:00Z"),
  };

  it("formats a positive rate with an up arrow", () => {
    expect(formatProgressionTrend({ ...base, slopePerMonth: 2.5 })).toBe(
      "↑ +2.5kg/mo",
    );
  });

  it("formats a negative rate with a down arrow", () => {
    expect(formatProgressionTrend({ ...base, slopePerMonth: -0.8 })).toBe(
      "↓ -0.8kg/mo",
    );
  });

  it("formats a near-zero rate as flat", () => {
    expect(formatProgressionTrend({ ...base, slopePerMonth: 0.02 })).toBe(
      "→ flat",
    );
  });
});
