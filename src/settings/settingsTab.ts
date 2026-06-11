import { App, PluginSettingTab, Setting } from "obsidian";
import GymTrackerPlugin from "../main";

export class GymTrackerSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private plugin: GymTrackerPlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Workouts folder")
      .setDesc(
        "Folder containing your workout notes. Files are expected to be named YYYY-MM-DD <title>.md.",
      )
      .addText((text) =>
        text
          .setPlaceholder("Workouts")
          .setValue(this.plugin.settings.workoutsFolder)
          .onChange(async (value) => {
            this.plugin.settings.workoutsFolder = value.trim();
            await this.plugin.saveSettings();
            await this.plugin.rebuildIndex();
          }),
      );

    new Setting(containerEl)
      .setName("Default weight unit")
      .setDesc(
        "Unit assumed for weights with no suffix in workout blocks. Per-set kg or lb overrides still work.",
      )
      .addDropdown((dd) =>
        dd
          .addOption("kg", "Kilograms (kg)")
          .addOption("lb", "Pounds (lb)")
          .setValue(this.plugin.settings.defaultUnit)
          .onChange(async (value) => {
            if (value !== "kg" && value !== "lb") return;
            this.plugin.settings.defaultUnit = value;
            await this.plugin.saveSettings();
            await this.plugin.rebuildIndex();
          }),
      );

    new Setting(containerEl)
      .setName("Fuzzy-match warnings")
      .setDesc(
        "Surface a warning when an exercise name looks like a typo of a previously-used one.",
      )
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.fuzzyMatchEnabled)
          .onChange(async (value) => {
            this.plugin.settings.fuzzyMatchEnabled = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
