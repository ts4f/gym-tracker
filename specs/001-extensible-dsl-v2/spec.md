# Feature Specification: Extensible Workout DSL v2 (with arc42 documentation)

**Feature Branch**: `001-extensible-dsl-v2`

**Created**: 2026-08-25

**Status**: Draft

**Input**: User description: "Parse/DSL refactor — think about the current DSL and start arc42-style documentation; the DSL should be extensible."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - arc42 as-is architecture documentation (Priority: P1)

As a maintainer, I want a lean arc42 document that captures the *current* DSL,
parser, data model, and their consumers, so the redesign has a factual baseline
to react against and future contributors understand the system.

**Why this priority**: Documentation is the stated primary driver; the as-is
baseline is the reference that justifies and scopes the v2 redesign.

**Independent Test**: The document exists at `docs/architecture/arc42/` and its
sections (context/constraints, building-block view, runtime flow, key decisions,
risks/tech-debt, quality goals) accurately describe the pre-v2 code as of this
spec.

**Acceptance Scenarios**:

1. **Given** the current codebase, **When** the doc is written, **Then** it names
   each module (`parser/parser.ts`, `parser/serialize.ts`, `model/types.ts`,
   `index/*`, `render/blockProcessor.ts`, `stats/*`, `autocomplete/*`,
   `views/statsView.ts`) and states each one's responsibility and dependencies.
2. **Given** the doc, **When** a reader opens it, **Then** the current grammar
   (`3x5 @ 100kg`, `5,3,1 @ 140`, `3x8`, `2x5 @ +10kg`, `#` comments) and the
   flat `WorkoutSet` model are described without proposing v2 syntax.

---

### User Story 2 - DSL v2 core grammar: weight-first notation (Priority: P1)

As a lifter logging mid-workout, I write sets in conventional weight-first
notation (`100kg x 5 x 3 @ 8`) so I can record weight, reps, sets, and RPE
naturally without remembering bespoke syntax.

**Why this priority**: The core notation is the foundation every other story
builds on; without it the DSL has no user-facing value.

**Independent Test**: `parseWorkoutBlock` unit tests parse every core form
(`100kg x 5 x 3 @ 8`, `100kg x 5`, `100kg x 5+ x 3`, `100kg x 5,3,1`,
`BW x 8 x 3`, `BW+10kg x 5 x 3 @ 7`) into a correct `WorkoutSet` model.

**Acceptance Scenarios**:

1. **Given** a line `100kg x 5 x 3 @ 8`, **When** parsed, **Then** the set has
   weight 100kg, three sets of 5 reps, and `rpe: 8`.
2. **Given** `100kg x 5`, **When** parsed, **Then** the set is a single set of
   5 reps with weight 100kg and no RPE.
3. **Given** `100kg x 5+ x 3 @ 9`, **When** parsed, **Then** the set is three
   sets of 5 reps with `amrap: true` and `rpe: 9`.
4. **Given** `BW x 8 x 3` and `BW+10kg x 5 x 3 @ 7`, **When** parsed, **Then**
   both are bodyweight sets, the latter carrying a `bodyweightAddon` of 10kg.

---

### User Story 3 - Extensible attribute bag and registry (Priority: P2)

As a maintainer, I add a new set attribute (tempo, rest, RIR, or any future
one) by registering a single parser entry, without editing the core tokenizer or
the data model.

**Why this priority**: This is the "extensible" requirement — it is what makes
v2 a platform rather than another hardcoded regex. It depends on the v2 core
(Story 2) but is independently shippable once parsing exists.

**Independent Test**: `registry.test.ts` proves built-in attributes (`tempo`,
`rest`, `rir`) parse to typed values, and an unknown key passes through as a raw
string without error.

**Acceptance Scenarios**:

1. **Given** `100kg x 5 x 3 @ 8 [tempo 3-1-3, rest 90s]`, **When** parsed,
   **Then** `attributes` holds `tempo` (structured) and `rest` (90 seconds).
2. **Given** an unknown attribute `[color red]`, **When** parsed, **Then** it is
   stored as a raw string and does not raise a parse error.
3. **Given** a known attribute with a malformed value `[tempo foo]`, **When**
   parsed, **Then** a per-line parse error is emitted.

---

### User Story 4 - Serializer and consumer updates (Priority: P2)

As a user, "New workout from last workout" and the reading-view table, stats,
and autocomplete all keep working correctly with the new grammar and model.

**Why this priority**: A new grammar is useless if the features that consume the
model break. This story makes the whole plugin coherent on v2.

**Independent Test**: `serialize.test.ts` round-trips v2 sets; `blockProcessor`,
`stats`, `exerciseIndex`, and autocomplete tests pass against the new model.

**Acceptance Scenarios**:

1. **Given** a parsed v2 workout, **When** serialized, **Then** it reproduces
   equivalent v2 DSL text (units always explicit).
2. **Given** a v2 block in reading view, **When** rendered, **Then** the table
   shows sets/reps/weight and surfaces RPE and attributes.
3. **Given** the index is rebuilt from v2 notes, **When** stats (PR, 1RM,
   volume) run, **Then** they compute the same values as they did for equivalent
   v1 input.

---

### User Story 5 - Breaking-change rollout (Priority: P3)

As a maintainer, I ship v2 as a clean, deliberate breaking change: version bump,
rewritten README syntax reference, and rewritten tests — no legacy-grammar code
paths and no migration tool.

**Why this priority**: The project is pre-publication (v0.1.0, not in the
community directory), so a clean break is acceptable; this story is the
housekeeping that makes the break coherent.

**Independent Test**: `manifest.json`/`versions.json` read 0.2.0, `README.md`
documents only v2 syntax, and the full test suite passes with no v1-parser code
remaining.

**Acceptance Scenarios**:

1. **Given** the v2 implementation, **When** released, **Then**
   `manifest.json` and `versions.json` are 0.2.0 and the description is updated.
2. **Given** the rewritten `README.md`, **When** read, **Then** the syntax table
   and examples describe only v2 notation.

---

### Edge Cases

- `100kg x 0` / `100kg x 5 x 0` → parse error (zero reps or zero sets).
- `@ 0` / `@ 11` → parse error (RPE outside 1–10).
- `100kg x 5,3,1 x 3` → error if explicit `x sets` contradicts the comma-list
  length; accepted if it matches (comma reps imply set count).
- `BW+ x 5` (missing addon weight) → parse error.
- `BW x 5 x 3` with `@` → valid bodyweight set with RPE.
- Bare weight with no unit (`100 x 5`) → default unit from settings.
- Mixed units (`100kg` then `225lb`) → converted to kg internally, as today.
- Indented `#` line inside an exercise → appended to that exercise's comments
  (unchanged behavior).
- A set line with no preceding exercise → "Set without exercise" error
  (unchanged behavior).
- Unknown attribute key → stored raw, never a hard error (see Story 3).

## Requirements *(mandatory)*

### DSL Grammar (v2)

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
```

Examples:

| Line | Meaning |
|---|---|
| `100kg x 5 x 3 @ 8` | 100kg × 5 reps × 3 sets, RPE 8 |
| `100kg x 5` | 100kg × 5 reps, 1 set |
| `100kg x 5+ x 3 @ 9` | 3 sets of 5, last set AMRAP, RPE 9 |
| `100kg x 5,3,1 @ 9.5` | explicit reps 5/3/1 |
| `BW x 8 x 3` | bodyweight × 8 × 3 |
| `BW+10kg x 5 x 3 @ 7` | weighted bodyweight +10kg |
| `100kg x 5 x 3 @ 8 [tempo 3-1-3, rest 90s]` | + tempo, rest |

### Functional Requirements

- **FR-001**: The parser MUST parse the v2 grammar above into the model; v1
  syntax (`3x5 @ 100kg`) MUST NOT be parsed.
- **FR-002**: `@` MUST denote RPE (a number 1–10), not weight.
- **FR-003**: A trailing `+` on a rep count MUST set an AMRAP flag on the set.
- **FR-004**: `BW` MUST represent bodyweight; `BW+<weight>` MUST represent a
  weighted-bodyweight set via `bodyweightAddon`.
- **FR-005**: Weights MUST accept `kg`/`lb` suffixes and a bare number (default
  unit), and normalize to kg internally (existing `model/weight.ts`).
- **FR-006**: The bracket attribute bag MUST parse `key value` pairs into an
  extensible attributes map.
- **FR-007**: A registry MUST type known attributes (`tempo` → pattern, `rest` →
  seconds, `rir` → number) and pass unknown keys through as raw strings.
- **FR-008**: Adding a new attribute MUST require only a registry entry — no
  change to the core tokenizer or the `WorkoutSet` model.
- **FR-009**: Parsing, attribute typing, and serialization MUST remain pure,
  dependency-free functions (constitution principle II).
- **FR-010**: Per-line parse errors MUST be reported as `{ line, message }`
  (existing shape) with clear messages for malformed RPE/tempo/rest/weight.
- **FR-011**: The serializer MUST round-trip the model back to v2 DSL text with
  units always explicit.
- **FR-012**: All existing consumers (reading-view renderer, stats, index,
  autocomplete, "New workout from last workout") MUST be updated to the new
  model and grammar and MUST NOT reference v1 grammar.
- **FR-013**: `manifest.json`, `versions.json`, and `README.md` MUST be updated
  for the 0.2.0 breaking release with v2-only documentation.
- **FR-014**: A lean arc42 document MUST be written for the as-is architecture
  under `docs/architecture/arc42/` before the v2 implementation, covering at
  least: context & constraints, building-block view, runtime flow, key design
  decisions, risks/tech-debt, and quality goals.

### Key Entities *(include if feature involves data)*

- **WorkoutSet**: one set (or a uniform group of sets) — `reps` (expanded
  per-set), `weight` (loaded or bodyweight addon), `isBodyweight`, `amrap`,
  `rpe`, `attributes` (extensible key→value map), `comment`, `line`.
- **Attribute**: a named, typed value on a set — built-in keys `tempo`, `rest`,
  `rir`; unknown keys stored as strings. Typed via the registry.
- **Weight**: `{ value, unit }` — normalized to kg for all math.
- **Exercise**: `{ name, sets, comments }` — unchanged shape.
- **Workout**: `{ date, title, file, exercises }` — unchanged shape.
- **AttributeRegistry**: the extension point — maps a key to a value parser.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the new parser/serializer/registry unit tests pass under
  `npm test`, with no v1-grammar tests remaining.
- **SC-002**: Every grammar form in the examples table has a passing parse test.
- **SC-003**: A new attribute can be added with a single registry entry and no
  changes to `parser/core.ts` or `model/types.ts`.
- **SC-004**: The arc42 document is complete (all lean sections) and committed
  before v2 code changes begin.
- **SC-005**: `npm run build`, `npm test`, and `npm run lint` all pass at
  completion, with zero runtime dependencies preserved.
- **SC-006**: `README.md` contains no references to the old `3x5 @ 100kg`
  notation.

## Assumptions

- The plugin is pre-publication (v0.1.0, not in the community directory), so a
  clean breaking change with no migration tool is acceptable.
- Existing workout notes are not migrated; users recreate them in v2 syntax.
- Tempo uses a `x-y-z` (or `x-y-z-w` with `X` allowed) pattern; rest accepts
  `90s`, `2m`, and `2:00` forms normalized to seconds.
- RPE and RIR are both supported (RPE as core `@n`, RIR as an attribute) and
  represent proximity to failure; the 1RM formula remains Epley (kg-normalized)
  for this feature.
- Supersets are explicitly out of scope for this feature (future extension via
  the registry/attributes, not part of v2 core).
- The arc42 document describes the as-is system first; a to-be update is a
  follow-on, not part of this feature's definition of done.
