import { describe, expect, it } from "vitest";
import { levenshtein } from "../src/util/levenshtein";

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("Bench Press", "Bench Press")).toBe(0);
  });

  it("handles empty inputs", () => {
    expect(levenshtein("", "")).toBe(0);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });

  it("counts a single substitution", () => {
    expect(levenshtein("cat", "bat")).toBe(1);
  });

  it("counts a single insertion", () => {
    expect(levenshtein("cat", "cats")).toBe(1);
  });

  it("counts a single deletion", () => {
    expect(levenshtein("cats", "cat")).toBe(1);
  });

  it("detects common typos in exercise names", () => {
    expect(levenshtein("Bench Press", "Bnch Press")).toBe(1);
    expect(levenshtein("Bench Press", "Bench Pres")).toBe(1);
    expect(levenshtein("Squat", "Sqaut")).toBe(2);
  });

  it("returns > max early when length difference exceeds max", () => {
    expect(levenshtein("a", "abcdefgh", 2)).toBe(3);
  });

  it("returns > max early when the distance exceeds max", () => {
    expect(levenshtein("abc", "xyz", 2)).toBe(3);
  });

  it("returns the actual distance when within max", () => {
    expect(levenshtein("abc", "abd", 2)).toBe(1);
  });

  it("is symmetric", () => {
    expect(levenshtein("Bench Press", "Bnch Press")).toBe(
      levenshtein("Bnch Press", "Bench Press"),
    );
  });
});
