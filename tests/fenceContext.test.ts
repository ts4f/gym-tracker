import { describe, expect, it } from "vitest";
import { isCursorInsideWorkoutFence } from "../src/autocomplete/fenceContext";

function reader(lines: string[]) {
  return { getLine: (i: number) => lines[i] ?? "" };
}

describe("isCursorInsideWorkoutFence", () => {
  it("returns true when cursor is between opening and closing fence", () => {
    const r = reader(["intro", "```workout", "Bench Press", "```"]);
    expect(isCursorInsideWorkoutFence(r, 2)).toBe(true);
  });

  it("returns false on the fence opening line itself", () => {
    const r = reader(["```workout", "Bench Press", "```"]);
    expect(isCursorInsideWorkoutFence(r, 0)).toBe(false);
  });

  it("returns false on the closing fence line itself", () => {
    const r = reader(["```workout", "Bench", "```"]);
    expect(isCursorInsideWorkoutFence(r, 2)).toBe(false);
  });

  it("returns false in prose outside any fence", () => {
    const r = reader(["regular text", "more prose"]);
    expect(isCursorInsideWorkoutFence(r, 1)).toBe(false);
  });

  it("returns false inside a non-workout fence", () => {
    const r = reader(["```js", "console.log('hi')", "```"]);
    expect(isCursorInsideWorkoutFence(r, 1)).toBe(false);
  });

  it("returns false after a closed workout fence", () => {
    const r = reader(["```workout", "Bench", "```", "outside line"]);
    expect(isCursorInsideWorkoutFence(r, 3)).toBe(false);
  });

  it("returns true on the line immediately after the opening fence", () => {
    const r = reader(["```workout", "cursor here", "```"]);
    expect(isCursorInsideWorkoutFence(r, 1)).toBe(true);
  });

  it("handles multiple workout blocks in one file", () => {
    const r = reader([
      "```workout",
      "A",
      "```",
      "",
      "```workout",
      "B",
      "```",
    ]);
    expect(isCursorInsideWorkoutFence(r, 5)).toBe(true);
    expect(isCursorInsideWorkoutFence(r, 3)).toBe(false);
  });

  it("tolerates trailing whitespace after the workout fence", () => {
    const r = reader(["```workout ", "Bench", "```"]);
    expect(isCursorInsideWorkoutFence(r, 1)).toBe(true);
  });
});
