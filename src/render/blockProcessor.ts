import { Plugin } from "obsidian";
import { ExerciseIndex } from "../index/exerciseIndex";
import { WorkoutSet } from "../model/types";
import { parseWorkoutBlock } from "../parser/parser";
import { GymTrackerSettings } from "../settings/settings";
import { formatSessionSummary, lastSessionBefore } from "../stats/history";
import { parseFilename } from "../util/filenameDate";

export interface SetRow {
  setNum: number;
  reps: number;
  weight: string;
  isBodyweight: boolean;
  note: string;
}

export function formatWeight(set: WorkoutSet): string {
  if (set.isBodyweight) {
    if (set.bodyweightAddon) {
      return `BW +${set.bodyweightAddon.value} ${set.bodyweightAddon.unit}`;
    }
    return "BW";
  }
  if (set.weight) {
    return `${set.weight.value} ${set.weight.unit}`;
  }
  return "—";
}

/**
 * Decide whether to show a "Did you mean?" warning for an exercise name.
 * Returns the suggested canonical name, or null when no warning should appear
 * — including when fuzzy matching is disabled in settings.
 */
export function fuzzyWarning(
  index: Pick<ExerciseIndex, "nearestMatch">,
  settings: Pick<GymTrackerSettings, "fuzzyMatchEnabled">,
  name: string,
): string | null {
  if (!settings.fuzzyMatchEnabled) return null;
  return index.nearestMatch(name, 2);
}

/**
 * "last: 100kg × 5 (2026-06-04)" label for the most recent earlier session of
 * an exercise, or null when the note has no parseable date or no prior
 * session exists.
 */
export function lastSessionLabel(
  index: Pick<ExerciseIndex, "allWorkouts">,
  sourcePath: string,
  exerciseName: string,
): string | null {
  const basename = sourcePath.split("/").pop() ?? "";
  const parsed = parseFilename(basename);
  if (!parsed) return null;
  const entry = lastSessionBefore(
    index.allWorkouts(),
    exerciseName,
    parsed.date,
    sourcePath,
  );
  if (!entry) return null;
  return `last: ${formatSessionSummary(entry)}`;
}

export function buildSetRows(sets: WorkoutSet[]): SetRow[] {
  const rows: SetRow[] = [];
  let setNum = 0;
  for (const set of sets) {
    for (const reps of set.reps) {
      setNum++;
      rows.push({
        setNum,
        reps,
        weight: formatWeight(set),
        isBodyweight: set.isBodyweight,
        note: set.comment ?? "",
      });
    }
  }
  return rows;
}

export function registerBlockProcessor(
  plugin: Plugin,
  index: ExerciseIndex,
  getSettings: () => GymTrackerSettings,
): void {
  plugin.registerMarkdownCodeBlockProcessor("workout", (source, el, ctx) => {
    const settings = getSettings();
    const result = parseWorkoutBlock(source, { defaultUnit: settings.defaultUnit });

    const wrapper = el.createDiv({ cls: "gym-tracker-block" });

    for (const exercise of result.workout.exercises) {
      const h4 = wrapper.createEl("h4");
      h4.appendText(exercise.name);

      const match = fuzzyWarning(index, settings, exercise.name);
      if (match !== null) {
        const warning = h4.createSpan({ cls: "gym-tracker-fuzzy-warning" });
        warning.setText(`Did you mean "${match}"?`);
      }

      const last = lastSessionLabel(index, ctx.sourcePath, exercise.name);
      if (last !== null) {
        h4.createSpan({ cls: "gym-tracker-last-session", text: last });
      }

      const table = wrapper.createEl("table");
      const headRow = table.createEl("thead").createEl("tr");
      for (const header of ["Set", "Reps", "Weight", "Note"]) {
        headRow.createEl("th", { text: header });
      }

      const tbody = table.createEl("tbody");

      for (const row of buildSetRows(exercise.sets)) {
        const tr = tbody.createEl("tr");
        tr.createEl("td", { text: String(row.setNum) });
        tr.createEl("td", { text: String(row.reps) });
        const weightTd = tr.createEl("td");
        if (row.isBodyweight) weightTd.addClass("gym-tracker-bw");
        weightTd.setText(row.weight);
        tr.createEl("td", { text: row.note });
      }
    }

    if (result.errors.length > 0) {
      const errorDiv = wrapper.createDiv({ cls: "gym-tracker-errors" });
      for (const error of result.errors) {
        errorDiv.createEl("p", { text: `Line ${error.line}: ${error.message}` });
      }
    }
  });
}
