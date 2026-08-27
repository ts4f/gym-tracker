import { describe, expect, it } from "vitest";
import { parseWorkoutBlock } from "../src/parser/core";
import {
  formatAttribute,
  parseAttribute,
  registerAttribute,
} from "../src/parser/registry";
import { exercisesToDsl } from "../src/parser/serialize";
import { nn } from "./_helpers";

const opts = { defaultUnit: "kg" as const };

function attrsOf(line: string): Map<string, number | string | boolean> {
  const r = parseWorkoutBlock(`Bench\n  ${line}`, opts);
  expect(r.errors).toEqual([]);
  return nn(nn(nn(r.workout.exercises[0]).sets[0]).attributes);
}

describe("attribute registry — built-ins", () => {
  it("types tempo as a validated lowercase string", () => {
    expect(attrsOf("100kg x 5 x 3 [tempo 3-1-3]").get("tempo")).toBe("3-1-3");
  });

  it("accepts a 4-part tempo with X", () => {
    expect(attrsOf("100kg x 5 x 3 [tempo 3-1-X-1]").get("tempo")).toBe("3-1-x-1");
  });

  it("normalizes rest to seconds", () => {
    expect(attrsOf("100kg x 5 [rest 90s]").get("rest")).toBe(90);
    expect(attrsOf("100kg x 5 [rest 2m]").get("rest")).toBe(120);
    expect(attrsOf("100kg x 5 [rest 2:00]").get("rest")).toBe(120);
  });

  it("types rir as a number", () => {
    expect(attrsOf("100kg x 5 [rir 2]").get("rir")).toBe(2);
  });
});

describe("attribute registry — passthrough and errors", () => {
  it("passes unknown keys through as raw strings", () => {
    expect(attrsOf("100kg x 5 [color red]").get("color")).toBe("red");
  });

  it("errors on a malformed known value", () => {
    const r = parseWorkoutBlock("Bench\n  100kg x 5 [tempo foo]", opts);
    expect(r.errors).toEqual([
      { line: 2, message: 'Invalid value "foo" for attribute "tempo"' },
    ]);
  });

  it("round-trips typed attributes through the serializer", () => {
    const r = parseWorkoutBlock("Bench\n  100kg x 5 x 3 [tempo 3-1-3, rest 90s]", opts);
    expect(r.errors).toEqual([]);
    const ex = nn(r.workout.exercises[0]);
    expect(exercisesToDsl([ex])).toBe("Bench\n\t100kg x 5 x 3 [tempo 3-1-3, rest 90s]");
  });
});

describe("attribute registry — extension API", () => {
  it("supports registering a new typed attribute", () => {
    registerAttribute("dots", {
      parse: (raw) => (/^\d+$/.test(raw) ? Number(raw) : null),
      format: (value) => String(value),
    });
    expect(parseAttribute("dots", "3")).toEqual({ value: 3 });
    expect(formatAttribute("dots", 3)).toBe("3");
    expect(parseAttribute("dots", "x").error).toBe(
      'Invalid value "x" for attribute "dots"',
    );
  });
});
