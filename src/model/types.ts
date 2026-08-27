export type Unit = "kg" | "lb";

/** Value domain for extensible per-set attributes (typed by the registry). */
export type AttrValue = number | string | boolean;

export interface Weight {
  value: number;
  unit: Unit;
}

export interface WorkoutSet {
  reps: number[];
  weight?: Weight;
  isBodyweight: boolean;
  bodyweightAddon?: Weight;
  amrap?: boolean;
  rpe?: number;
  attributes?: Map<string, AttrValue>;
  comment?: string;
  line: number;
}

export interface Exercise {
  name: string;
  sets: WorkoutSet[];
  comments: string[];
}

export interface Workout {
  date: Date;
  title?: string;
  file: string;
  exercises: Exercise[];
}
