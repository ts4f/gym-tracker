# Data Model: Extensible Workout DSL v2

## Weight

```ts
type Unit = "kg" | "lb";
interface Weight { value: number; unit: Unit; }
```

Unchanged. All math normalizes to kg via `toKg` (constitution III).

## AttrValue

```ts
type AttrValue = number | string | boolean;
```

The value domain for extensible set attributes. Built-in keys map to typed values; unknown keys are stored as raw strings.

## WorkoutSet (extended)

```ts
interface WorkoutSet {
  reps: number[];               // expanded per-set reps
  weight?: Weight;              // loaded weight, or bodyweight addon for BW+10kg
  isBodyweight: boolean;
  amrap?: boolean;              // NEW: trailing "+" on reps
  rpe?: number;                 // NEW: "@n", 1–10 (decimal allowed)
  attributes: Map<string, AttrValue>;   // NEW: extensible bag (tempo/rest/rir + future)
  comment?: string;
  line: number;
}
```

- `weight` + `isBodyweight` + `bodyweightAddon` semantics are unchanged from v1; `BW` sets `isBodyweight`, `BW+10kg` additionally sets `weight` to the addon.
- `attributes` is the extension point. Known keys are typed by the registry; unknown keys are raw strings.

## AttributeRegistry

```ts
type AttrParser = (raw: string) => AttrValue | null;
const registry: Map<string, AttrParser>;
function registerAttribute(key: string, parser: AttrParser): void;
```

- Built-ins: `tempo` → validated pattern string; `rest` → integer seconds; `rir` → number 0–10.
- `registerAttribute` is the public extension API: adding a new attribute is one call, no core/model change.
- Unknown keys are not registered → parser stores the raw value and does not error (forward-compatible).

## Exercise / Workout (unchanged)

```ts
interface Exercise { name: string; sets: WorkoutSet[]; comments: string[]; }
interface Workout { date: Date; title?: string; file: string; exercises: Exercise[]; }
```

## ParseResult / ParseError (shape unchanged)

```ts
interface ParseError { line: number; message: string; }
interface ParsedBlock { exercises: Exercise[]; comments: string[]; }
interface ParseResult { workout: ParsedBlock; errors: ParseError[]; }
```

## State transitions

None. The parser is a pure function; the model is an immutable value. The only derived, mutable state is `ExerciseIndex` (constitution V), rebuilt from parsed `Workout` values.

## Validation rules

- `@rpe` must be 1–10 (decimal allowed); out-of-range → parse error.
- `reps` must be a positive integer list; `sets` (when present) must be a positive integer and, for comma-reps, equal the list length.
- `weight` must parse via `parseWeightToken` (non-negative number, optional `kg|lb`).
- `BW+` with no addon weight → parse error.
- `tempo` must match `x-y-z` / `x-y-z-w` (numeric or `X` parts); malformed → parse error.
- `rest` must parse as seconds (`90s`, `2m`, `2:00`); malformed → parse error.
