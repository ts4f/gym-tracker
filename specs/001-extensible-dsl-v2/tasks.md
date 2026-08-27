# Tasks: Extensible Workout DSL v2 (with arc42 documentation)

**Input**: Design documents from `specs/001-extensible-dsl-v2/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/dsl-grammar.md`, `quickstart.md`

**Tests**: Included — the constitution (principle IV) mandates test-first, module-mirrored coverage, and the spec (FR-004, SC-001) requires it.

**Organization**: Tasks grouped by user story, each independently testable. One user story == one Beads issue (epic `gym-tracker-rwl` children `.1`–`.5`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: parallelizable (different files, no dependency on incomplete tasks)
- **[Story]**: `[US1]`–`[US5]`
- Exact file paths in every description.

## Phase 1: Setup

**Purpose**: establish a green baseline before any change.

- [ ] T001 Confirm baseline is green: run `npm test`, `npm run build`, `npm run lint` on the current v1 code (repo root) and record that all pass.

---

## Phase 2: User Story 1 — arc42 as-is documentation (P1) 🎯 MVP

**Goal**: a lean arc42 document capturing the *current* architecture (primary deliverable; the as-is baseline that drives the redesign).

**Independent Test**: `docs/architecture/arc42/` exists and its sections accurately describe the pre-v2 code (v1 grammar, flat `WorkoutSet`).

- [ ] T002 [US1] Create `docs/architecture/arc42/README.md` with: context & constraints (from `.specify/memory/constitution.md`), building-block view (one subsection per module — `src/parser`, `src/model`, `src/index`, `src/render`, `src/stats`, `src/autocomplete`, `src/views` — stating each one's responsibility and dependencies), and the v1 grammar reference (`3x5 @ 100kg`, `5,3,1 @ 140`, `3x8`, `2x5 @ +10kg`, `#` comments).
- [ ] T003 [US1] Extend `docs/architecture/arc42/README.md` with runtime flow (scan → `extractWorkoutBlocks` → `parseWorkoutBlock` → `ExerciseIndex` → render/stats), key design decisions (single `SET_RE` regex, kg normalization, pure core), and risks/tech-debt (regex monolith, rigid `WorkoutSet` model, no extension point).

**Checkpoint**: arc42 as-is doc committed; it documents the system the redesign replaces.

---

## Phase 3: User Story 2 — weight-first core grammar (P1)

**Goal**: the v2 notation (`100kg x 5 x 3 @ 8`) parses into the extended model. This phase is the *foundational* code the later stories build on.

**Independent Test**: `tests/parser.test.ts` parses every core form and emits correct per-line errors.

- [ ] T004 [US2] Extend `src/model/types.ts`: add `amrap?: boolean`, `rpe?: number`, and `attributes: Map<string, AttrValue>` to `WorkoutSet`; add `export type AttrValue = number | string | boolean`.
- [ ] T005 [US2] Write failing `tests/parser.test.ts` covering the v2 grammar: `100kg x 5 x 3 @ 8`, `100kg x 5`, `100kg x 5+ x 3 @ 9`, `100kg x 5,3,1 @ 9.5`, `BW x 8 x 3`, `BW+10kg x 5 x 3 @ 7`, inline `#` comments, and error cases (`100kg x 0`, `100kg x 5 x 0`, `@ 0`, `@ 11`, `BW+ x 5`, set line without exercise).
- [ ] T006 [US2] Implement `src/parser/core.ts` (hand-written tokenizer for `weight x reps [x sets] [@ rpe]`) exposing `parseWorkoutBlock`; delete `src/parser/parser.ts`; update imports in `src/index/workoutLoader.ts` and `src/render/blockProcessor.ts`. Make T005 pass.

**Checkpoint**: v2 core parses; reading view and index load v2 notes via `core.ts`.

---

## Phase 4: User Story 3 — extensible attribute bag + registry (P2)

**Goal**: `[key value, ...]` attributes parse through a typed registry; unknown keys pass through.

**Independent Test**: `tests/registry.test.ts` proves built-ins type correctly, unknown keys pass through raw, and malformed known values error.

- [ ] T007 [US3] Write failing `tests/registry.test.ts` for: `tempo` (`3-1-3`), `rest` (`90s`/`2m`/`2:00` → seconds), `rir` (number 0–10), unknown key `[color red]` passthrough, and malformed `[tempo foo]` error.
- [ ] T008 [US3] Implement `src/parser/registry.ts` (`AttrParser`, `registerAttribute`, built-in `tempo`/`rest`/`rir`) and wire bracket-attribute parsing into `src/parser/core.ts`. Make T007 pass.

**Checkpoint**: new attributes are one `registerAttribute` call away; no core/model change.

---

## Phase 5: User Story 4 — serializer + consumer updates (P2)

**Goal**: serializer round-trips v2; render/stats/index/autocomplete all work against the new model.

**Independent Test**: `serialize.test.ts` round-trip + updated `blockProcessor`/`stats`/`index`/`autocomplete` tests pass.

- [ ] T009 [P] [US4] Rewrite `src/parser/serialize.ts` for v2 round-trip (units always explicit); update `tests/serialize.test.ts`.
- [ ] T010 [P] [US4] Update `src/render/blockProcessor.ts` (`formatWeight`, `buildSetRows`) to render v2 sets and surface RPE/attributes; update `tests/blockProcessor.test.ts`.
- [ ] T011 [P] [US4] Update `src/stats/history.ts`, `src/stats/oneRepMax.ts`, `src/stats/pr.ts`, `src/stats/volume.ts` for the new `WorkoutSet` fields; update `tests/history.test.ts`, `tests/stats.test.ts`.
- [ ] T012 [P] [US4] Update `src/index/exerciseIndex.ts` (`extractLastWeight`) and `src/autocomplete/*` (last-weight pre-fill) for the new model; update `tests/exerciseIndex.test.ts`, `tests/exerciseSuggest.test.ts`.

**Checkpoint**: every consumer reads the v2 model; stats/PR/1RM/volume compute equivalently for v2 input.

---

## Phase 6: User Story 5 — breaking-change rollout (P3)

**Goal**: ship 0.2.0 cleanly — no legacy grammar anywhere.

**Independent Test**: `manifest.json`/`versions.json` read 0.2.0; `README.md` is v2-only.

- [ ] T013 [US5] Bump `manifest.json` and `versions.json` to 0.2.0 and update the description.
- [ ] T014 [US5] Rewrite `README.md` (syntax table + examples + "What you get") to v2 only; remove all `3x5 @ 100kg` references.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T015 Run full `npm test`, `npm run build`, `npm run lint`; fix any failures; confirm no v1 grammar remains (`grep -R "3x5 @" src tests README.md` returns nothing).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)** → baseline.
- **US1 (T002–T003)**: no code dependency — the as-is doc is written against pre-change code; do it first ("as-is baseline first", "documentation is the real driver").
- **US2 (T004–T006)**: the foundational code; blocks US3 and US4.
- **US3 (T007–T008)**: depends on US2 (registry parses on top of the core tokenizer).
- **US4 (T009–T012)**: depends on US2 *and* US3 (consumers read the full model incl. attributes).
- **US5 (T013–T014)**: depends on US2–US4 (rollout last).
- **Polish (T015)**: depends on all.

### User Story Dependencies (mirrors Beads DAG)

```text
US1 (arc42) ──▶ US2 (core) ──▶ US3 (registry) ──▶ US4 (consumers) ──▶ US5 (rollout)
                     └────────────────────────────▶ US4 (also needs core)
```

Beads: `gym-tracker-rwl.2` depends on `.1`; `.3` depends on `.2`; `.4` depends on `.2`+`.3`; `.5` depends on `.4`.

### Within Each Story

- Tests written first and confirmed failing, then implementation.
- US2: T004 (model) → T005 (test) → T006 (impl).
- US3: T007 (test) → T008 (impl).
- US4: T009–T012 are independent files → parallel.

### Parallel Opportunities

- T009, T010, T011, T012 (US4) run in parallel — different files.
- T002 and T003 are sequential (same doc file).
- US1 can proceed in parallel with nothing else (it's read-only documentation); code work waits for it per the Beads DAG.

---

## Parallel Example: User Story 4

```text
Task: "Rewrite src/parser/serialize.ts ..." (T009)
Task: "Update src/render/blockProcessor.ts ..." (T010)
Task: "Update src/stats/*.ts ..." (T011)
Task: "Update src/index/exerciseIndex.ts + src/autocomplete/* ..." (T012)
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. T001 (baseline).
2. T002–T003 (arc42 as-is doc) — the primary deliverable.
3. **STOP and VALIDATE**: review the doc as the redesign's reference.

### Incremental Delivery

1. US1 (arc42) → review.
2. US2 (core grammar) → `npm test` green → demo a v2 block parsing.
3. US3 (registry) → demo `[tempo 3-1-3, rest 90s]`.
4. US4 (consumers) → full plugin works on v2 notes.
5. US5 (rollout) → 0.2.0, v2-only README.
6. T015 (polish) → full gates green.

---

## Notes

- One user story == one Beads issue; keep `tasks.md` and the Beads epic in sync (close `gym-tracker-rwl.N` when its phase's tasks complete).
- Commit after each task or logical group.
- Tests fail before implementation (constitution IV).
- No new runtime dependency (constitution).
