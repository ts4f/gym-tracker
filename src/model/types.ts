export type Unit = "kg" | "lb";

export interface Weight {
  value: number;
  unit: Unit;
}

export interface WorkoutSet {
  reps: number[];
  weight?: Weight;
  isBodyweight: boolean;
  bodyweightAddon?: Weight;
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
