import {
  App,
  Editor,
  EditorPosition,
  EditorSuggest,
  EditorSuggestContext,
  EditorSuggestTriggerInfo,
  TFile,
} from "obsidian";
import { ExerciseIndex, ExerciseStats } from "../index/exerciseIndex";
import { GymTrackerSettings } from "../settings/settings";
import { isCursorInsideWorkoutFence } from "./fenceContext";
import { buildAuxLine, buildInsertion } from "./insertionHelpers";

export class ExerciseSuggest extends EditorSuggest<ExerciseStats> {
  constructor(
    app: App,
    private index: ExerciseIndex,
    private getSettings: () => GymTrackerSettings,
  ) {
    super(app);
  }

  onTrigger(
    cursor: EditorPosition,
    editor: Editor,
    _file: TFile | null,
  ): EditorSuggestTriggerInfo | null {
    if (!isCursorInsideWorkoutFence(editor, cursor.line)) return null;

    const lineText = editor.getLine(cursor.line);
    if (/^\s/.test(lineText)) return null;

    const query = lineText.slice(0, cursor.ch);
    if (query.startsWith("```")) return null;
    if (query.length < 2) return null;

    return {
      start: { line: cursor.line, ch: 0 },
      end: cursor,
      query,
    };
  }

  getSuggestions(context: EditorSuggestContext): ExerciseStats[] {
    return this.index.lookup(context.query, 10, {
      excludeTypos: this.getSettings().fuzzyMatchEnabled,
    });
  }

  renderSuggestion(value: ExerciseStats, el: HTMLElement): void {
    el.createDiv({ text: value.name, cls: "gym-tracker-suggest-name" });
    el.createDiv({ cls: "gym-tracker-suggest-aux", text: buildAuxLine(value) });
  }

  selectSuggestion(
    value: ExerciseStats,
    _evt: MouseEvent | KeyboardEvent,
  ): void {
    if (!this.context) return;
    const { editor, start } = this.context;
    const lineLength = editor.getLine(start.line).length;
    const { text, cursorCh } = buildInsertion(value.name, value.lastWeight);
    editor.replaceRange(
      text,
      { line: start.line, ch: 0 },
      { line: start.line, ch: lineLength },
    );
    editor.setCursor({ line: start.line + 1, ch: cursorCh });
  }
}
