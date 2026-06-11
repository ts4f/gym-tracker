import { ItemView, WorkspaceLeaf } from "obsidian";
import { ExerciseIndex } from "../index/exerciseIndex";
import { computeExerciseHistory } from "../stats/history";
import { computePersonalRecords } from "../stats/pr";
import { computeWeeklyVolume } from "../stats/volume";
import { Workout } from "../model/types";
import { toIsoWeekKey } from "../util/isoWeek";

export const VIEW_TYPE = "gym-tracker-stats";

export class GymTrackerStatsView extends ItemView {
  private unsubscribe: (() => void) | null = null;
  private selectedExercise: string | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly index: ExerciseIndex,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Gym stats";
  }

  getIcon(): string {
    return "dumbbell";
  }

  async onOpen(): Promise<void> {
    this.unsubscribe = this.index.subscribe(() => this.render());
    this.render();
  }

  async onClose(): Promise<void> {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private isTypo(name: string): boolean {
    return this.index.nearestMatch(name, 2) !== null;
  }

  private render(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("gym-tracker-stats-view");

    const workouts = this.index.allWorkouts();
    const prs = computePersonalRecords(workouts);
    const weekly = computeWeeklyVolume(workouts);
    const weekKey = toIsoWeekKey(new Date());
    const thisWeek = weekly.get(weekKey);

    this.renderSection(contentEl, "Personal Records", (el) => {
      const rows: [string, string][] = [...prs.entries()]
        .filter(([name, pr]) => pr.maxWeight !== undefined && !this.isTypo(name))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, pr]) => [
          name,
          pr.maxWeight
            ? `${pr.maxWeight.weightKg.toFixed(1)} × ${pr.maxWeight.reps} reps`
            : "—",
        ]);
      if (
        this.selectedExercise !== null &&
        !rows.some(([name]) => name === this.selectedExercise)
      ) {
        this.selectedExercise = null;
      }
      this.renderPrTable(el, rows, workouts);
    });

    this.renderSection(contentEl, `This week (${weekKey})`, (el) => {
      if (!thisWeek || thisWeek.size === 0) {
        el.createEl("p", { text: "No workouts this week." });
        return;
      }
      const rows: [string, string][] = [...thisWeek.entries()]
        .filter(([name]) => !this.isTypo(name))
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, vol]) => {
          let value: string;
          if (vol.loadedVolumeKg > 0 && vol.bodyweightReps > 0) {
            value = `${vol.loadedVolumeKg.toFixed(1)} kg + ${vol.bodyweightReps} reps (BW)`;
          } else if (vol.loadedVolumeKg > 0) {
            value = `${vol.loadedVolumeKg.toFixed(1)} kg`;
          } else {
            value = `${vol.bodyweightReps} reps (BW)`;
          }
          return [name, value];
        });
      this.renderTable(el, ["Exercise", "Volume"], rows);
    });

    this.renderSection(contentEl, "Est. 1RM Leaderboard", (el) => {
      const rows: [string, string][] = [...prs.entries()]
        .filter(([name, pr]) => pr.maxEst1RM !== undefined && !this.isTypo(name))
        .sort(
          ([, a], [, b]) =>
            (b.maxEst1RM?.value ?? 0) - (a.maxEst1RM?.value ?? 0),
        )
        .map(([name, pr]) => [name, (pr.maxEst1RM?.value ?? 0).toFixed(1)]);
      this.renderTable(el, ["Exercise", "Est. 1RM (kg)"], rows);
    });
  }

  /**
   * Personal Records table with clickable rows: selecting an exercise expands
   * its per-session history inline below the row.
   */
  private renderPrTable(
    parent: HTMLElement,
    rows: [string, string][],
    workouts: Workout[],
  ): void {
    if (rows.length === 0) {
      parent.createEl("p", { text: "No data yet." });
      return;
    }
    const table = parent.createEl("table");
    const headRow = table.createEl("thead").createEl("tr");
    headRow.createEl("th", { text: "Exercise" });
    headRow.createEl("th", { text: "Max weight (kg)" });
    const tbody = table.createEl("tbody");
    for (const [exercise, value] of rows) {
      const selected = this.selectedExercise === exercise;
      const row = tbody.createEl("tr", { cls: "gym-tracker-pr-row" });
      if (selected) row.addClass("gym-tracker-pr-row-selected");
      row.createEl("td", { text: exercise });
      row.createEl("td", { text: value });
      this.registerDomEvent(row, "click", () => {
        this.selectedExercise = selected ? null : exercise;
        this.render();
      });
      if (selected) {
        const histRow = tbody.createEl("tr", { cls: "gym-tracker-history-row" });
        const cell = histRow.createEl("td", { attr: { colspan: "2" } });
        this.renderHistory(cell, exercise, workouts);
      }
    }
  }

  private renderHistory(
    parent: HTMLElement,
    exercise: string,
    workouts: Workout[],
  ): void {
    const history = computeExerciseHistory(workouts, exercise);
    if (history.length === 0) {
      parent.createEl("p", { text: "No sessions yet." });
      return;
    }
    const table = parent.createEl("table", { cls: "gym-tracker-history" });
    const headRow = table.createEl("thead").createEl("tr");
    for (const header of ["Date", "Top set", "Est. 1RM"]) {
      headRow.createEl("th", { text: header });
    }
    const tbody = table.createEl("tbody");
    for (const entry of history) {
      const tr = tbody.createEl("tr");
      tr.createEl("td", { text: entry.date.toISOString().slice(0, 10) });
      let topSet: string;
      if (entry.topSet) {
        topSet = `${entry.topSet.weightKg.toFixed(1)} × ${entry.topSet.reps}`;
        if (entry.bodyweightReps > 0) topSet += " (BW+)";
      } else if (entry.bodyweightReps > 0) {
        topSet = `BW × ${entry.bodyweightReps} reps`;
      } else {
        topSet = "—";
      }
      tr.createEl("td", { text: topSet });
      tr.createEl("td", {
        text: entry.est1RM !== undefined ? entry.est1RM.toFixed(1) : "—",
      });
    }
  }

  private renderTable(
    parent: HTMLElement,
    headers: [string, string],
    rows: [string, string][],
  ): void {
    if (rows.length === 0) {
      parent.createEl("p", { text: "No data yet." });
      return;
    }
    const table = parent.createEl("table");
    const headRow = table.createEl("thead").createEl("tr");
    headRow.createEl("th", { text: headers[0] });
    headRow.createEl("th", { text: headers[1] });
    const tbody = table.createEl("tbody");
    for (const [exercise, value] of rows) {
      const row = tbody.createEl("tr");
      row.createEl("td", { text: exercise });
      row.createEl("td", { text: value });
    }
  }

  private renderSection(
    parent: HTMLElement,
    title: string,
    body: (el: HTMLElement) => void,
  ): void {
    const details = parent.createEl("details");
    details.setAttribute("open", "");
    details.createEl("summary", { text: title });
    body(details);
  }
}
