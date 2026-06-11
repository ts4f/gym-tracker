import { ExerciseStats, LastWeight } from "../index/exerciseIndex";

export function buildAuxLine(stats: Pick<ExerciseStats, "frequency" | "lastUsed" | "lastWeight">): string {
  const lastDate = stats.lastUsed.toISOString().slice(0, 10);
  const plural = stats.frequency === 1 ? "" : "s";
  let aux = `${stats.frequency} session${plural} · last ${lastDate}`;
  if (stats.lastWeight === "bodyweight") {
    aux += " · BW";
  } else if (stats.lastWeight !== null) {
    aux += ` · ${stats.lastWeight.value} ${stats.lastWeight.unit}`;
  }
  return aux;
}

export interface InsertionResult {
  text: string;
  cursorCh: number;
}

export function buildInsertion(name: string, lastWeight: LastWeight): InsertionResult {
  if (lastWeight !== null && lastWeight !== "bodyweight") {
    // No space between value and unit — SET_RE only parses "100kg", not "100 kg".
    // Cursor goes after the tab: reps are typed in front of the "@".
    return {
      text: `${name}\n\t@ ${lastWeight.value}${lastWeight.unit}`,
      cursorCh: 1,
    };
  }
  return {
    text: `${name}\n\t`,
    cursorCh: 1,
  };
}
