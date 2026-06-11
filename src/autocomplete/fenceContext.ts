export interface LineReader {
  getLine(line: number): string;
}

export function isCursorInsideWorkoutFence(
  editor: LineReader,
  line: number,
): boolean {
  if (/^```/.test(editor.getLine(line))) return false;

  for (let i = line - 1; i >= 0; i--) {
    const text = editor.getLine(i);
    if (/^```workout(\s|$)/.test(text)) return true;
    if (/^```\s*$/.test(text)) return false;
  }
  return false;
}
