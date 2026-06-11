export function levenshtein(a: string, b: string, max = Infinity): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const lower = a.length <= b.length ? a : b;
  const upper = a.length <= b.length ? b : a;
  const n = lower.length;
  const m = upper.length;

  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);

  for (let j = 1; j <= m; j++) {
    curr[0] = j;
    let minInRow = j;
    const upperChar = upper.charCodeAt(j - 1);
    for (let i = 1; i <= n; i++) {
      const cost = lower.charCodeAt(i - 1) === upperChar ? 0 : 1;
      const left = curr[i - 1] ?? Infinity;
      const up = prev[i] ?? Infinity;
      const diag = prev[i - 1] ?? Infinity;
      const value = Math.min(left + 1, up + 1, diag + cost);
      curr[i] = value;
      if (value < minInRow) minInRow = value;
    }
    if (minInRow > max) return max + 1;
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[n] ?? 0;
}
