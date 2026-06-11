import { describe, expect, it } from "vitest";
import { toIsoWeekKey } from "../src/util/isoWeek";

describe("toIsoWeekKey", () => {
  it("computes week 1 for early January", () => {
    expect(toIsoWeekKey(new Date(Date.UTC(2026, 0, 5)))).toBe("2026-W02");
    expect(toIsoWeekKey(new Date(Date.UTC(2024, 0, 1)))).toBe("2024-W01");
  });

  it("handles year boundary correctly (Dec 31 may belong to next year week 1)", () => {
    expect(toIsoWeekKey(new Date(Date.UTC(2024, 11, 30)))).toBe("2025-W01");
  });

  it("handles year boundary the other way (Jan 1 may belong to previous year W53)", () => {
    expect(toIsoWeekKey(new Date(Date.UTC(2021, 0, 1)))).toBe("2020-W53");
  });

  it("zero-pads week numbers", () => {
    const result = toIsoWeekKey(new Date(Date.UTC(2026, 0, 5)));
    expect(result).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("matches expected key for 2026-05-21", () => {
    expect(toIsoWeekKey(new Date(Date.UTC(2026, 4, 21)))).toBe("2026-W21");
  });
});
