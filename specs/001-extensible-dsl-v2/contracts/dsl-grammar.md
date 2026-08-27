# Contract: DSL v2 grammar & parser interface

This is the interface contract for the parser. The grammar is the user-facing contract; the parser/serializer signatures are the code-facing contract. Both are stable — extensions go through the attribute registry, not through changes to the core grammar.

## Grammar (EBNF)

```text
workout-block := (exercise | comment | blank)*
exercise      := EXERCISE_NAME [inline-comment]
set-line      := weight-spec "x" reps ["x" sets] ["@" rpe] [attributes] [inline-comment]
weight-spec   := weight | "BW" ["+" weight]
weight        := NUMBER [UNIT]                 ; bare number = default unit
reps          := NUMBER ["+"]                  ; "+" = AMRAP flag
               | NUMBER ("," NUMBER)+          ; explicit per-set reps
sets          := NUMBER                        ; omitted = 1 (uniform) or list length (comma)
rpe           := NUMBER ["." NUMBER]           ; range 1..10
attributes    := "[" attribute ("," attribute)* "]"
attribute     := KEY VALUE
inline-comment := "#" TEXT
comment       := "#" TEXT
blank         := <empty or whitespace-only line>
```

## Examples

| Line | Meaning |
|---|---|
| `100kg x 5 x 3 @ 8` | 100kg × 5 reps × 3 sets, RPE 8 |
| `100kg x 5` | 100kg × 5 reps, 1 set |
| `100kg x 5+ x 3 @ 9` | 3 sets of 5, last set AMRAP, RPE 9 |
| `100kg x 5,3,1 @ 9.5` | explicit reps 5/3/1 |
| `BW x 8 x 3` | bodyweight × 8 × 3 |
| `BW+10kg x 5 x 3 @ 7` | weighted bodyweight +10kg |
| `100kg x 5 x 3 @ 8 [tempo 3-1-3, rest 90s]` | + tempo, rest |

## Parser API

```ts
interface ParseOptions { defaultUnit: Unit; }
interface ParseResult { workout: ParsedBlock; errors: ParseError[]; }
function parseWorkoutBlock(source: string, opts: ParseOptions): ParseResult;
```

- Pure, no Obsidian/I/O deps.
- Indented line = set; unindented line = exercise name (unchanged framing).
- Errors are per-line `{ line, message }`.

## Attribute registry (extension API)

```ts
type AttrParser = (raw: string) => AttrValue | null;
function registerAttribute(key: string, parser: AttrParser): void;
```

- Built-ins: `tempo`, `rest`, `rir`.
- Unknown keys pass through as raw strings (no error) — a new attribute needs only `registerAttribute`, never a grammar change.

## Serializer

```ts
function exercisesToDsl(exercises: Exercise[]): string;
```

- Inverse of `parseWorkoutBlock` (comments excluded).
- Units always written explicitly so output is independent of the default-unit setting.

## Round-trip invariant

For a `WorkoutSet` with explicit weight, `parse(serialize(model))` reproduces an equivalent model (same reps/sets/weight/amrap/rpe/attributes). Bodyweight/weighted-bodyweight and unit-normalized values round-trip without drift.

## Error contract

- Malformed core line → `ParseError` with a specific message (bad reps, bad weight, bad RPE, bad sets).
- Malformed known attribute (`[tempo foo]`) → `ParseError`.
- Unknown attribute (`[color red]`) → stored raw, no error.
