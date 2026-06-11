const FENCE_RE = /^```workout[^\n]*\n([\s\S]*?)^```/gm;

export function extractWorkoutBlocks(content: string): string[] {
  FENCE_RE.lastIndex = 0;
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(content)) !== null) {
    const inner = m[1];
    if (inner !== undefined) blocks.push(inner);
  }
  return blocks;
}
