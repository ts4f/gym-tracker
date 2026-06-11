import { describe, expect, it } from "vitest";
import { format, parseWeightToken, toKg, toLb } from "../src/model/weight";

describe("toKg", () => {
  it("returns value unchanged when unit is kg", () => {
    expect(toKg({ value: 80, unit: "kg" })).toBe(80);
  });

  it("converts lb to kg", () => {
    const result = toKg({ value: 100, unit: "lb" });
    expect(result).toBeCloseTo(45.359, 2);
  });
});

describe("toLb", () => {
  it("returns value unchanged when unit is lb", () => {
    expect(toLb({ value: 100, unit: "lb" })).toBe(100);
  });

  it("converts kg to lb", () => {
    const result = toLb({ value: 100, unit: "kg" });
    expect(result).toBeCloseTo(220.462, 2);
  });
});

describe("format", () => {
  it("renders integer values without decimals", () => {
    expect(format({ value: 80, unit: "kg" })).toBe("80kg");
  });

  it("renders fractional values with one decimal by default", () => {
    expect(format({ value: 22.5, unit: "kg" })).toBe("22.5kg");
  });

  it("rounds to fractionDigits", () => {
    expect(format({ value: 22.567, unit: "kg" }, 2)).toBe("22.57kg");
  });

  it("renders lb correctly", () => {
    expect(format({ value: 45, unit: "lb" })).toBe("45lb");
  });
});

describe("parseWeightToken", () => {
  it("parses bare numbers using the default unit", () => {
    expect(parseWeightToken("80", "kg")).toEqual({ value: 80, unit: "kg" });
    expect(parseWeightToken("80", "lb")).toEqual({ value: 80, unit: "lb" });
  });

  it("respects explicit kg suffix", () => {
    expect(parseWeightToken("80kg", "lb")).toEqual({ value: 80, unit: "kg" });
  });

  it("respects explicit lb suffix", () => {
    expect(parseWeightToken("15lb", "kg")).toEqual({ value: 15, unit: "lb" });
  });

  it("parses decimal values", () => {
    expect(parseWeightToken("22.5", "kg")).toEqual({
      value: 22.5,
      unit: "kg",
    });
  });

  it("accepts a leading plus sign (weighted bodyweight)", () => {
    expect(parseWeightToken("+20", "kg")).toEqual({ value: 20, unit: "kg" });
    expect(parseWeightToken("+20kg", "lb")).toEqual({
      value: 20,
      unit: "kg",
    });
  });

  it("is case-insensitive for units", () => {
    expect(parseWeightToken("80KG", "lb")).toEqual({ value: 80, unit: "kg" });
    expect(parseWeightToken("15Lb", "kg")).toEqual({ value: 15, unit: "lb" });
  });

  it("returns null on garbage input", () => {
    expect(parseWeightToken("abc", "kg")).toBeNull();
    expect(parseWeightToken("", "kg")).toBeNull();
    expect(parseWeightToken("80kg lb", "kg")).toBeNull();
    expect(parseWeightToken("-80", "kg")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(parseWeightToken("  80kg  ", "lb")).toEqual({
      value: 80,
      unit: "kg",
    });
  });
});
