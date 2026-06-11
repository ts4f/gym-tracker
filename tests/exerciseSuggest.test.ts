import { describe, expect, it } from "vitest";
import { buildAuxLine, buildInsertion } from "../src/autocomplete/insertionHelpers";
import { LastWeight } from "../src/index/exerciseIndex";
import { parseWorkoutBlock } from "../src/parser/parser";

const baseDate = new Date("2026-05-20T00:00:00Z");

describe("buildAuxLine", () => {
  it("shows frequency, date, and kg weight", () => {
    expect(
      buildAuxLine({ frequency: 5, lastUsed: baseDate, lastWeight: { value: 80, unit: "kg" } }),
    ).toBe("5 sessions · last 2026-05-20 · 80 kg");
  });

  it("shows lb weight with correct unit", () => {
    expect(
      buildAuxLine({ frequency: 3, lastUsed: baseDate, lastWeight: { value: 45, unit: "lb" } }),
    ).toBe("3 sessions · last 2026-05-20 · 45 lb");
  });

  it("shows BW suffix for bodyweight exercises", () => {
    expect(
      buildAuxLine({ frequency: 2, lastUsed: baseDate, lastWeight: "bodyweight" }),
    ).toBe("2 sessions · last 2026-05-20 · BW");
  });

  it("omits weight suffix when lastWeight is null", () => {
    expect(
      buildAuxLine({ frequency: 1, lastUsed: baseDate, lastWeight: null }),
    ).toBe("1 session · last 2026-05-20");
  });

  it("uses singular 'session' when frequency is 1", () => {
    const line = buildAuxLine({ frequency: 1, lastUsed: baseDate, lastWeight: null });
    expect(line).toContain("1 session ·");
    expect(line).not.toContain("sessions");
  });

  it("uses plural 'sessions' when frequency > 1", () => {
    const line = buildAuxLine({ frequency: 2, lastUsed: baseDate, lastWeight: null });
    expect(line).toContain("2 sessions ·");
  });
});

describe("buildInsertion — weighted exercise", () => {
  it("inserts name + indented weight stub for a kg weight", () => {
    const result = buildInsertion("Tricep Dips", { value: 30, unit: "kg" });
    expect(result.text).toBe("Tricep Dips\n\t@ 30kg");
  });

  it("inserts name + indented weight stub for a lb weight", () => {
    const result = buildInsertion("DB Curl", { value: 25, unit: "lb" });
    expect(result.text).toBe("DB Curl\n\t@ 25lb");
  });

  it("positions cursor after the tab, before the weight stub", () => {
    const result = buildInsertion("Bench Press", { value: 30, unit: "kg" });
    expect(result.cursorCh).toBe(1);
  });

  it("round-trips through the parser once reps are typed at the cursor", () => {
    const cases: LastWeight[] = [
      { value: 100, unit: "kg" },
      { value: 100.5, unit: "kg" },
      { value: 45, unit: "lb" },
    ];
    for (const lastWeight of cases) {
      const { text, cursorCh } = buildInsertion("Squat", lastWeight);
      const lines = text.split("\n");
      const setLine = lines[1] ?? "";
      const typed = setLine.slice(0, cursorCh) + "3x5 " + setLine.slice(cursorCh);
      const result = parseWorkoutBlock([lines[0], typed].join("\n"), {
        defaultUnit: "kg",
      });
      expect(result.errors).toEqual([]);
      expect(result.workout.exercises[0]?.sets[0]?.reps).toEqual([5, 5, 5]);
      expect(result.workout.exercises[0]?.sets[0]?.weight).toEqual(lastWeight);
    }
  });
});

describe("buildInsertion — bodyweight exercise", () => {
  it("inserts name + bare indented line, no weight stub", () => {
    const result = buildInsertion("Pull-Up", "bodyweight");
    expect(result.text).toBe("Pull-Up\n\t");
  });

  it("positions cursor after the tab character", () => {
    const result = buildInsertion("Pull-Up", "bodyweight");
    expect(result.cursorCh).toBe(1);
  });
});

describe("buildInsertion — null lastWeight (no prior data)", () => {
  const nullWeight: LastWeight = null;

  it("inserts name + bare indented line", () => {
    const result = buildInsertion("New Exercise", nullWeight);
    expect(result.text).toBe("New Exercise\n\t");
  });

  it("positions cursor after the tab character", () => {
    const result = buildInsertion("New Exercise", nullWeight);
    expect(result.cursorCh).toBe(1);
  });
});
