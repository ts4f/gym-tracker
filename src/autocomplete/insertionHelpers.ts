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
    // v2 weight-first: prefill "100kg x " and place the cursor after it so the
    // user types reps and sets (e.g. "5 x 3").
    const stub = `${lastWeight.value}${lastWeight.unit} x `;
    return {
      text: `${name}\n\t${stub}`,
      cursorCh: stub.length + 1,
    };
  }
  return {
    text: `${name}\n\t`,
    cursorCh: 1,
  };
}
