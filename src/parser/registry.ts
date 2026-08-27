import { AttrValue } from "../model/types";

/**
 * A registered attribute: parses raw text to a typed value and formats a
 * typed value back to canonical text. Adding a new attribute is one
 * `registerAttribute` call — no core/model change (constitution II, FR-008).
 */
export interface AttrParser {
  parse(raw: string): AttrValue | null;
  format(value: AttrValue): string;
}

const registry = new Map<string, AttrParser>();

export function registerAttribute(key: string, parser: AttrParser): void {
  registry.set(key, parser);
}

export interface ParseAttributeResult {
  value: AttrValue;
  error?: string;
}

/** Type a raw attribute value; unknown keys pass through as raw strings. */
export function parseAttribute(key: string, raw: string): ParseAttributeResult {
  const parser = registry.get(key);
  if (!parser) return { value: raw };
  const value = parser.parse(raw);
  if (value === null) {
    return {
      value: raw,
      error: `Invalid value "${raw}" for attribute "${key}"`,
    };
  }
  return { value };
}

/** Canonical text for an attribute value; unknown keys stringify directly. */
export function formatAttribute(key: string, value: AttrValue): string {
  const parser = registry.get(key);
  if (parser) return parser.format(value);
  return String(value);
}

// --- built-in attributes ---

const TEMPO_PART = "\\d+|[Xx]";
const TEMPO_RE = new RegExp(`^(?:${TEMPO_PART})(?:-(?:${TEMPO_PART})){2,3}$`);

registerAttribute("tempo", {
  parse: (raw) => (TEMPO_RE.test(raw.trim()) ? raw.trim().toLowerCase() : null),
  format: (value) => String(value),
});

registerAttribute("rest", {
  parse: (raw) => parseDuration(raw),
  format: (value) => `${value}s`,
});

registerAttribute("rir", {
  parse: (raw) => {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n <= 10 ? n : null;
  },
  format: (value) => String(value),
});

/** Parse "90s" / "2m" / "2:00" / bare "90" into integer seconds, else null. */
function parseDuration(raw: string): number | null {
  const s = raw.trim();
  const seconds = /^(\d+)(?:s)?$/i.exec(s);
  if (seconds) return Number(seconds[1]);
  const minutes = /^(\d+)m$/i.exec(s);
  if (minutes) return Number(minutes[1]) * 60;
  const mmss = /^(\d+):([0-5]\d)$/.exec(s);
  if (mmss) return Number(mmss[1]) * 60 + Number(mmss[2]);
  return null;
}
