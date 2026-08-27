# Quickstart: validating DSL v2

Runnable validation scenarios that prove the feature works end-to-end. Grammar and model details live in `contracts/dsl-grammar.md` and `data-model.md`.

## Prerequisites

- Node.js `^22.19.0 || >=24`
- `npm install` (installs dev-only toolchain; the plugin itself has zero runtime deps)

## Automated gates

```bash
npm test          # Vitest — parser/registry/serialize + existing suites all green
npm run build     # tsc --noEmit -skipLibCheck && esbuild production bundle
npm run lint      # eslint .
```

Expected: all three pass; no v1-grammar tests remain.

## Unit-level validation

```bash
npx vitest run tests/parser.test.ts
npx vitest run tests/registry.test.ts
npx vitest run tests/serialize.test.ts
```

Each grammar form in the contract's examples table has a passing parse test; `registry.test.ts` proves `tempo`/`rest`/`rir` type correctly and an unknown key passes through raw; `serialize.test.ts` proves round-trip.

## Manual validation (Obsidian)

1. Build (`npm run build`) and copy `main.js`, `manifest.json`, `styles.css` into `<vault>/.obsidian/plugins/gym-tracker/`.
2. Create a workout note with a v2 block:

   ````markdown
   ```workout
   Bench Press
     100kg x 5 x 3 @ 8 [tempo 3-1-3, rest 90s]
     100kg x 5+ x 3 @ 9
   Pull-Up
     BW+10kg x 5 x 3 @ 7
     BW x 8 x 3
   ```
   ````

3. **Reading view**: each exercise renders a table (set/reps/weight) with RPE and attributes surfaced.
4. **Stats sidebar** (dumbbell ribbon): PR, est. 1RM, weekly volume compute from the v2 notes.
5. **Command** "New workout from last workout": emits a fresh v2 block.
6. **Negative check**: type an old-style line (`3x5 @ 100kg`) and confirm the reading view shows a per-line parse error.

## Success criteria (from spec)

- SC-001: all parser/serializer/registry tests pass; no v1-grammar tests remain.
- SC-002: every grammar form has a passing parse test.
- SC-003: a new attribute can be added with one `registerAttribute` call, no `core.ts`/`types.ts` change.
- SC-004: arc42 doc complete and committed before v2 code changes.
- SC-005: build/test/lint all pass; zero runtime deps preserved.
- SC-006: `README.md` has no `3x5 @ 100kg` references.
