import { TFile, Vault } from "obsidian";
import { Exercise, Unit, Workout } from "../model/types";
import { parseWorkoutBlock } from "../parser/parser";
import { parseFilename } from "../util/filenameDate";
import { extractWorkoutBlocks } from "./blockExtractor";

export async function loadWorkoutFromFile(
  vault: Vault,
  file: TFile,
  defaultUnit: Unit,
): Promise<Workout | null> {
  const parsedName = parseFilename(file.name);
  if (!parsedName) return null;

  const content = await vault.cachedRead(file);
  const blocks = extractWorkoutBlocks(content);
  if (blocks.length === 0) return null;

  const exercises: Exercise[] = [];
  for (const block of blocks) {
    const r = parseWorkoutBlock(block, { defaultUnit });
    exercises.push(...r.workout.exercises);
  }

  return {
    date: parsedName.date,
    title: parsedName.title,
    file: file.path,
    exercises,
  };
}
