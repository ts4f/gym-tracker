# Implementation Plan: Extensible Workout DSL v2 (with arc42 documentation)

**Branch**: `001-extensible-dsl-v2` | **Date**: 2026-08-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-extensible-dsl-v2/spec.md`

## Summary

Redesign the workout-block DSL into an extensible weight-first grammar and document the architecture arc42-style (as-is baseline first). The parser splits from a single regex (`parser/parser.ts`) into a small pure core tokenizer (`parser/core.ts`) plus a typed attribute registry (`parser/registry.ts`) — the extension point. The model (`WorkoutSet`) gains `amrap`, `rpe`, and an extensible `attributes` map. This is a clean breaking change: v1 syntax (`3x5 @ 100kg`) is replaced wholesale, no migration, version bumped to 0.2.0.

## Technical Context

**Language/Version**: TypeScript (strict, `noImplicitAny`, `noUncheckedIndexedAccess`); target ES2018, module ESNext.

**Primary Dependencies**: Zero runtime dependencies (constitution). Dev-only: `obsidian` (types), `esbuild` (build), `vitest` (test), `eslint` + `eslint-plugin-obsidianmd` (lint).

**Storage**: User-owned Markdown files in the vault (fenced `workout` blocks). No database. (Beads `bd` tracks project *issues*, not runtime data.)

**Testing**: Vitest, one test file per pure module under `tests/` (module-mirrored). TDD: failing test before implementation.

**Target Platform**: Obsidian desktop + mobile (`isDesktopOnly: false`, `minAppVersion` 1.7.2).

**Project Type**: Obsidian plugin (TypeScript), single in-memory `ExerciseIndex`, thin Obsidian glue.

**Performance Goals**: Pure parse of one workout block in microseconds; debounced index rebuild over hundreds–thousands of notes; no material runtime overhead from the attributes map.

**Constraints**: Zero runtime deps; pure/testable parser core; kg-normalized math; plain-text data ownership; breaking change with no migration; all features reachable via command or sidebar.

**Scale/Scope**: Single-user personal vault; hundreds–thousands of workout notes; ~20 source modules; one feature epic with 5 children.

## Constitution Check

*GATE: must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Plain-text, user-owned data** — PASS. v2 is still fenced `workout` Markdown; no DB, no account, no lock-in. (A syntax swap is not a data-ownership change.)
- **II. Deterministic pure-logic core** — PASS. `parser/core.ts`, `parser/registry.ts`, `parser/serialize.ts`, and `model/weight.ts` are pure functions with no Obsidian/I/O deps.
- **III. Unit-normalized mathematics** — PASS. Weight math unchanged (`toKg`); new attributes (RPE, rest seconds, tempo) carry no weight semantics.
- **IV. Test-first, module-mirrored coverage** — PASS. New/rewritten `tests/parser.test.ts`, `tests/registry.test.ts`, `tests/serialize.test.ts` written before/with implementation; thin glue (`main.ts`, views, block processor) exempt but kept thin.
- **V. Thin Obsidian glue & single derived index** — PASS. Consumers update to the new model but add no competing caches; `ExerciseIndex` remains the sole derived view.

No violations → Complexity Tracking empty.

## Project Structure

### Documentation (this feature)

```text
specs/001-extensible-dsl-v2/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
│   └── dsl-grammar.md   # grammar + parser interface contract
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created here)
```

### Source Code (repository root)

```text
src/
├── parser/
│   ├── core.ts          # NEW: tokenize the fixed weight×reps×sets @rpe core
│   ├── registry.ts      # NEW: attribute key → value-parser registry (extension point)
│   ├── types.ts         # ParseError/ParseResult (shape kept)
│   └── serialize.ts     # REWRITTEN: v2 round-trip
├── model/
│   ├── types.ts         # WorkoutSet += amrap, rpe, attributes
│   └── weight.ts        # unchanged
├── render/blockProcessor.ts            # UPDATED: formatWeight, buildSetRows, RPE/attrs column
├── stats/{history,oneRepMax,pr,volume}.ts  # UPDATED: field access
├── index/{exerciseIndex,workoutLoader,fileScanner,blockExtractor}.ts  # mostly unchanged
├── autocomplete/*.ts    # UPDATED: pre-fill last weight
└── views/statsView.ts   # unchanged

tests/
├── parser.test.ts       # REWRITTEN (v2 grammar)
├── registry.test.ts     # NEW
├── serialize.test.ts    # REWRITTEN (round-trip)
└── ... (existing, updated for new model)
```

**Structure Decision**: Single-project layout already in place. The parser splits from one `parser.ts` into `core.ts` + `registry.ts` (the extensibility seam). No new top-level directories.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

(empty — no constitution violations)
