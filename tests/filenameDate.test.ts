import { describe, expect, it } from "vitest";
import { formatLocalDate, parseFilename } from "../src/util/filenameDate";

describe("parseFilename", () => {
  it("parses YYYY-MM-DD.md without title", () => {
    const r = parseFilename("2026-05-21.md");
    expect(r).not.toBeNull();
    expect(r!.date.toISOString()).toBe("2026-05-21T00:00:00.000Z");
    expect(r!.title).toBeUndefined();
  });

  it("parses YYYY-MM-DD <title>.md", () => {
    const r = parseFilename("2026-05-21 Push Day.md");
    expect(r).not.toBeNull();
    expect(r!.title).toBe("Push Day");
  });

  it("is case-insensitive on the .md extension", () => {
    const r = parseFilename("2026-05-21.MD");
    expect(r).not.toBeNull();
  });

  it("rejects missing extension", () => {
    expect(parseFilename("2026-05-21")).toBeNull();
  });

  it("rejects invalid months", () => {
    expect(parseFilename("2026-13-01.md")).toBeNull();
    expect(parseFilename("2026-00-01.md")).toBeNull();
  });

  it("rejects invalid days", () => {
    expect(parseFilename("2026-02-30.md")).toBeNull();
    expect(parseFilename("2026-04-31.md")).toBeNull();
  });

  it("rejects non-date prefixes", () => {
    expect(parseFilename("workout 2026-05-21.md")).toBeNull();
    expect(parseFilename("notes.md")).toBeNull();
  });

  it("trims whitespace in title", () => {
    const r = parseFilename("2026-05-21    Leg Day   .md");
    expect(r!.title).toBe("Leg Day");
  });
});

describe("formatLocalDate", () => {
  it("formats with zero-padded month and day", () => {
    expect(formatLocalDate(new Date(2026, 5, 1))).toBe("2026-06-01");
  });

  it("uses the local calendar day, not UTC", () => {
    // Local midnight: the UTC date may differ, the local one must win.
    expect(formatLocalDate(new Date(2026, 11, 31, 0, 30))).toBe("2026-12-31");
  });

  it("round-trips through parseFilename", () => {
    const stamp = formatLocalDate(new Date(2026, 0, 5));
    expect(parseFilename(`${stamp}.md`)).not.toBeNull();
  });
});
