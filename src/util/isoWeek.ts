const MS_PER_DAY = 86400000;

export function toIsoWeekKey(input: Date): string {
  const date = new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
  );
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / MS_PER_DAY + 1) / 7,
  );
  return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}
