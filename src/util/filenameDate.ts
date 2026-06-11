export interface ParsedFilename {
  date: Date;
  title?: string;
}

const RE = /^(\d{4})-(\d{2})-(\d{2})(?:\s+(.+))?\.md$/i;

export function parseFilename(basename: string): ParsedFilename | null {
  const m = RE.exec(basename);
  if (!m) return null;

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  const title = m[4]?.trim();
  return title ? { date, title } : { date };
}

/** Format a date as YYYY-MM-DD using its local calendar day. */
export function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
