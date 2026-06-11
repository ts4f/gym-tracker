import { Notice, Plugin, TAbstractFile, TFile, WorkspaceLeaf, normalizePath } from "obsidian";
import { ExerciseSuggest } from "./autocomplete/exerciseSuggest";
import { ExerciseIndex } from "./index/exerciseIndex";
import { isInWorkoutFolder, scanWorkoutFolder } from "./index/fileScanner";
import { loadWorkoutFromFile } from "./index/workoutLoader";
import { Workout } from "./model/types";
import { exercisesToDsl } from "./parser/serialize";
import { registerBlockProcessor } from "./render/blockProcessor";
import { formatLocalDate } from "./util/filenameDate";
import { GymTrackerStatsView, VIEW_TYPE as STATS_VIEW_TYPE } from "./views/statsView";
import {
  DEFAULTS,
  GymTrackerSettings,
  normalizeSettings,
} from "./settings/settings";
import { GymTrackerSettingTab } from "./settings/settingsTab";

export default class GymTrackerPlugin extends Plugin {
  settings: GymTrackerSettings = DEFAULTS;
  index = new ExerciseIndex();
  private modifyTimers = new Map<string, number>();

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(STATS_VIEW_TYPE, (leaf: WorkspaceLeaf) => new GymTrackerStatsView(leaf, this.index));
    this.addSettingTab(new GymTrackerSettingTab(this.app, this));
    this.registerEditorSuggest(new ExerciseSuggest(this.app, this.index, () => this.settings));
    registerBlockProcessor(this, this.index, () => this.settings);
    this.addRibbonIcon("dumbbell", "Open gym stats", () => { void this.openStatsView(); });
    this.addCommand({ id: "open-stats", name: "Open stats", callback: () => { void this.openStatsView(); } });
    this.addCommand({
      id: "new-workout-from-last",
      name: "New workout from last workout",
      callback: () => { void this.createWorkoutFromLast(); },
    });

    this.app.workspace.onLayoutReady(() => {
      void this.rebuildIndex();
      this.registerVaultEvents();
    });
  }

  onunload(): void {
    for (const timer of this.modifyTimers.values()) window.clearTimeout(timer);
    this.modifyTimers.clear();
  }

  async loadSettings(): Promise<void> {
    const raw: unknown = await this.loadData();
    this.settings = normalizeSettings(raw);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async rebuildIndex(): Promise<void> {
    const files = scanWorkoutFolder(
      this.app.vault,
      this.settings.workoutsFolder,
    );
    const workouts: Workout[] = [];
    for (const file of files) {
      if (!(file instanceof TFile)) continue;
      const w = await loadWorkoutFromFile(
        this.app.vault,
        file,
        this.settings.defaultUnit,
      );
      if (w) workouts.push(w);
    }
    this.index.setAll(workouts);
  }

  private async openStatsView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(STATS_VIEW_TYPE);
    const existingLeaf = existing[0];
    if (existingLeaf) {
      await workspace.revealLeaf(existingLeaf);
      return;
    }
    const leaf = workspace.getRightLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({ type: STATS_VIEW_TYPE, active: true });
    await workspace.revealLeaf(leaf);
  }

  private latestWorkout(): Workout | null {
    let latest: Workout | null = null;
    for (const w of this.index.allWorkouts()) {
      if (
        latest === null ||
        w.date.getTime() > latest.date.getTime() ||
        (w.date.getTime() === latest.date.getTime() && w.file > latest.file)
      ) {
        latest = w;
      }
    }
    return latest;
  }

  private async createWorkoutFromLast(): Promise<void> {
    const stamp = formatLocalDate(new Date());
    const folder = this.settings.workoutsFolder.replace(/\/+$/, "");
    const path = normalizePath(
      folder.length > 0 ? `${folder}/${stamp}.md` : `${stamp}.md`,
    );

    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      new Notice("Today's workout note already exists.");
      await this.app.workspace.getLeaf(false).openFile(existing);
      return;
    }

    if (folder.length > 0 && this.app.vault.getFolderByPath(folder) === null) {
      await this.app.vault.createFolder(folder);
    }

    const latest = this.latestWorkout();
    const body =
      latest && latest.exercises.length > 0
        ? exercisesToDsl(latest.exercises)
        : "";
    const content =
      body.length > 0 ? `\`\`\`workout\n${body}\n\`\`\`\n` : "```workout\n```\n";
    const file = await this.app.vault.create(path, content);
    await this.app.workspace.getLeaf(false).openFile(file);
    if (!latest) new Notice("No previous workout found — created an empty note.");
  }

  private registerVaultEvents(): void {
    this.registerEvent(
      this.app.vault.on("modify", (file: TAbstractFile) => {
        if (!(file instanceof TFile)) return;
        if (!isInWorkoutFolder(file.path, this.settings.workoutsFolder)) return;
        const existing = this.modifyTimers.get(file.path);
        if (existing !== undefined) window.clearTimeout(existing);
        const timer = window.setTimeout(() => {
          this.modifyTimers.delete(file.path);
          void this.indexFile(file);
        }, 300);
        this.modifyTimers.set(file.path, timer);
      }),
    );

    this.registerEvent(
      this.app.vault.on("create", (file: TAbstractFile) => {
        if (!(file instanceof TFile)) return;
        if (!isInWorkoutFolder(file.path, this.settings.workoutsFolder)) return;
        void this.indexFile(file);
      }),
    );

    this.registerEvent(
      this.app.vault.on("delete", (file: TAbstractFile) => {
        if (!(file instanceof TFile)) return;
        if (!isInWorkoutFolder(file.path, this.settings.workoutsFolder)) return;
        this.index.remove(file.path);
      }),
    );

    this.registerEvent(
      this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
        if (!(file instanceof TFile)) return;
        const wasIn = isInWorkoutFolder(oldPath, this.settings.workoutsFolder);
        const isIn = isInWorkoutFolder(file.path, this.settings.workoutsFolder);
        if (wasIn && isIn) {
          this.index.rename(oldPath, file.path);
        } else if (wasIn) {
          this.index.remove(oldPath);
        } else if (isIn) {
          void this.indexFile(file);
        }
      }),
    );
  }

  private async indexFile(file: TFile): Promise<void> {
    const w = await loadWorkoutFromFile(
      this.app.vault,
      file,
      this.settings.defaultUnit,
    );
    if (w) {
      this.index.upsert(w);
    } else {
      this.index.remove(file.path);
    }
  }
}
