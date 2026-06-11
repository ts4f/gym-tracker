import { Unit } from "../model/types";

export interface GymTrackerSettings {
  workoutsFolder: string;
  defaultUnit: Unit;
  fuzzyMatchEnabled: boolean;
}

export const DEFAULTS: GymTrackerSettings = {
  workoutsFolder: "Workouts",
  defaultUnit: "kg",
  fuzzyMatchEnabled: true,
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeSettings(raw: unknown): GymTrackerSettings {
  if (!isPlainObject(raw)) return DEFAULTS;
  const folder = raw.workoutsFolder;
  const unit = raw.defaultUnit;
  const fuzzy = raw.fuzzyMatchEnabled;
  return {
    workoutsFolder:
      typeof folder === "string" && folder.length > 0
        ? folder
        : DEFAULTS.workoutsFolder,
    defaultUnit:
      unit === "kg" || unit === "lb" ? unit : DEFAULTS.defaultUnit,
    fuzzyMatchEnabled:
      typeof fuzzy === "boolean" ? fuzzy : DEFAULTS.fuzzyMatchEnabled,
  };
}
