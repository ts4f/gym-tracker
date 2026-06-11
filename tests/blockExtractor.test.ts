import { describe, expect, it } from "vitest";
import { extractWorkoutBlocks } from "../src/index/blockExtractor";

describe("extractWorkoutBlocks", () => {
  it("returns no blocks for empty content", () => {
    expect(extractWorkoutBlocks("")).toEqual([]);
  });

  it("returns no blocks when no workout fences are present", () => {
    expect(extractWorkoutBlocks("just prose\nmore prose")).toEqual([]);
  });

  it("ignores fenced blocks with different languages", () => {
    const md = "```js\nconsole.log('hi')\n```\n";
    expect(extractWorkoutBlocks(md)).toEqual([]);
  });

  it("extracts a single workout block", () => {
    const md = "intro\n```workout\nBench Press\n  3x8 @ 80\n```\noutro";
    expect(extractWorkoutBlocks(md)).toEqual([
      "Bench Press\n  3x8 @ 80\n",
    ]);
  });

  it("extracts multiple workout blocks in one file", () => {
    const md = "```workout\nA\n  3x8 @ 80\n```\n\n```workout\nB\n  3x8 @ 50\n```";
    const blocks = extractWorkoutBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toContain("A");
    expect(blocks[1]).toContain("B");
  });

  it("tolerates trailing info after the workout fence", () => {
    const md = "```workout extra info\nBench\n  3x8 @ 80\n```";
    expect(extractWorkoutBlocks(md)).toHaveLength(1);
  });
});
