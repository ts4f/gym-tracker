# Gym Tracker — Architecture (as-is)

Lean arc42 documentation of the **current** (pre-DSL-v2) system. This is a baseline
snapshot that records how the plugin works today; it is the reference against which
the extensible-DSL redesign is judged.

---

## 1. Introduction and Goals

Gym Tracker is an [Obsidian](https://obsidian.md) plugin for logging strength workouts
as plain text. Users write workout blocks in fenced `workout` code blocks inside Markdown
notes; the plugin turns them into rendered tables, computes personal records (PRs),
estimated one-rep max (1RM), weekly volume, and provides exercise-name autocomplete.

The training log stays in user-owned Markdown files. There is no database, no account, no
export lock-in — reading-view rendering, stats, and autocomplete are *derived, disposable
views* over the Markdown source of truth.

Key quality goals (from the project constitution, `.specify/memory/constitution.md`):

- Plain-text, user-owned data (non-negotiable).
- Deterministic, pure-logic core (no Obsidian/I/O dependencies).
- Unit-normalized mathematics (kilograms internally).
- Test-first, module-mirrored unit coverage.
- Thin Obsidian glue + a single derived in-memory index.

---

## 2. Constraints

- **TypeScript, strict** — `strict`, `noImplicitAny`, `noUncheckedIndexedAccess`; target ES2018, module ESNext.
- **Zero runtime dependencies** — Obsidian is a devDependency for types only. The plugin ships `main.js`, `manifest.json`, `styles.css`.
- **Obsidian target** — `minAppVersion` 1.7.2, `isDesktopOnly: false` (desktop + mobile).
- **Plain-text source of truth** — Markdown files are canonical; the plugin MUST NOT mutate or replace them, and MUST NOT introduce a proprietary store.
- **Pure core** — parsing, weight conversion, and statistics are pure functions, independently unit-testable.
- **Every feature reachable** from a Ctrl/Cmd-P command or the stats sidebar.

---

## 3. Context and Scope

The system is a single Obsidian plugin. Its runtime context is the Obsidian vault:

- **Input**: workout notes under the configured workouts folder (default `Workouts/`), named by date.
- **Processing**: scan → extract fenced blocks → parse → normalize → index → derive stats.
- **Output**: reading-view tables, autocomplete suggestions, a stats sidebar, and a "new workout from last workout" command.

There are no external systems, no network calls, no persistence beyond the vault and the plugin's own `data.json` (settings).

---

## 4. Building Block View

One module per concern. Pure modules (parser, model, stats, util) have no Obsidian import;
glue modules (main, views, settings tab, block processor) use the Obsidian API.

### `src/parser/`

| File | Responsibility |
|---|---|
| `parser.ts` | `parseWorkoutBlock(source, opts)` — turns DSL text into the model via a **single regex** (`SET_RE`). Emits per-line `ParseError`. |
| `types.ts` | `ParseError`, `ParsedBlock`, `ParseResult`. |
| `serialize.ts` | `exercisesToDsl(exercises)` — inverse of parsing (used by "new workout from last workout"). Units always explicit. |

### `src/model/`

| File | Responsibility |
|---|---|
| `types.ts` | Domain types: `Unit`, `Weight`, `WorkoutSet`, `Exercise`, `Workout`. |
| `weight.ts` | `toKg`, `toLb`, `format`, `parseWeightToken` — unit conversion and formatting (kg-normalized). |

### `src/index/`

| File | Responsibility |
|---|---|
| `blockExtractor.ts` | `extractWorkoutBlocks(content)` — pulls ```workout fenced blocks out of a note (regex `FENCE_RE`). |
| `fileScanner.ts` | `scanWorkoutFolder`, `isInWorkoutFolder` — enumerate vault notes under the workouts folder. |
| `workoutLoader.ts` | `loadWorkoutFromFile` — parse filename → read content → extract blocks → parse → build `Workout`. |
| `exerciseIndex.ts` | `ExerciseIndex` — the **single derived in-memory index** of all workouts; computes per-exercise stats (`frequency`, `lastUsed`, `lastWeight`) and provides `lookup`/`nearestMatch` (Levenshtein typo detection). |

### `src/render/`

| File | Responsibility |
|---|---|
| `blockProcessor.ts` | `registerBlockProcessor` (via `registerMarkdownCodeBlockProcessor("workout", …)`), `formatWeight`, `buildSetRows`, `fuzzyWarning`, `lastSessionLabel` — reading-view table rendering and the "last: …" / "did you mean" labels. |

### `src/stats/`

| File | Responsibility |
|---|---|
| `history.ts` | `computeExerciseHistory`, `lastSessionBefore`, `formatSessionSummary` — per-session history per exercise. |
| `oneRepMax.ts` | `estimateOneRepMax` — Epley formula on kg-normalized weight. |
| `pr.ts` | Personal-record computation (heaviest weight × reps per exercise). |
| `volume.ts` | Weekly volume per exercise (current ISO week). |

### `src/autocomplete/`

| File | Responsibility |
|---|---|
| `exerciseSuggest.ts` | `ExerciseSuggest` — editor suggestions from exercise history, pre-filling last weight. |
| `fenceContext.ts` | Detects when the cursor is inside a ```workout block. |
| `insertionHelpers.ts` | Insert/edit helpers for the suggestion flow. |

### `src/settings/`, `src/util/`, `src/views/`

| File | Responsibility |
|---|---|
| `settings/settings.ts` | `GymTrackerSettings`, `DEFAULTS`, `normalizeSettings` (workouts folder, default unit, fuzzy-match toggle). |
| `settings/settingsTab.ts` | `GymTrackerSettingTab` — Obsidian settings UI. |
| `util/filenameDate.ts` | `parseFilename`, `formatLocalDate` — date-from-filename convention. |
| `util/isoWeek.ts` | ISO week keys. |
| `util/levenshtein.ts` | Levenshtein distance (typo detection). |
| `views/statsView.ts` | `GymTrackerStatsView` — the sidebar (PRs, weekly volume, 1RM leaderboard). |

### `src/main.ts`

`GymTrackerPlugin` — the Obsidian lifecycle glue: loads settings, registers the view /
suggest / block processor / ribbon / commands, rebuilds the index on layout-ready, and
keeps the index in sync with vault create/modify/delete/rename events (debounced).

### Dependencies (direction: `→` = "depends on")

```text
main.ts ──► parser ──► model ──► weight
         ──► index (workoutLoader → blockExtractor + parser; fileScanner)
         ──► render/blockProcessor ──► parser, stats/history, index
         ──► autocomplete ──► index
         ──► views/statsView ──► index, stats/*
         ──► settings
```

The pure core is `parser` + `model` + `stats` + `util`; everything else is glue over the
`ExerciseIndex`.

---

## 5. Runtime View

### Startup

1. `onload()` — load settings; `registerView` (stats); `addSettingTab`; `registerEditorSuggest`; `registerBlockProcessor`; add ribbon icon + commands (`open-stats`, `new-workout-from-last`).
2. `onLayoutReady` — `rebuildIndex()` then `registerVaultEvents()`.

### Index rebuild

```
scanWorkoutFolder(vault, folder)
  → for each TFile: loadWorkoutFromFile(vault, file, defaultUnit)
      → parseFilename(file.name)            (date + optional title)
      → vault.cachedRead(file)              (note content)
      → extractWorkoutBlocks(content)       (fenced ```workout blocks)
      → parseWorkoutBlock(block, {defaultUnit})  (DSL → Exercise[])
  → index.setAll(workouts)
```

### Incremental sync (vault events)

- `modify` → debounced (300ms) `indexFile`.
- `create` → `indexFile`.
- `delete` → `index.remove(path)`.
- `rename` → `index.rename(old, new)` / `remove` / `indexFile` depending on folder membership.

### Reading view

Each ```workout block is handed to the markdown code block processor, which parses it and
renders one table per exercise, with per-set rows (set number, reps, weight, note), a
"last: …" label, and an optional "did you mean …" fuzzy warning.

### Autocomplete

The editor suggest queries `ExerciseIndex.lookup(prefix)`, sorted by frequency, and
pre-fills the last weight.

### Stats sidebar

`GymTrackerStatsView` reads `ExerciseIndex` and calls the pure `stats/*` functions to
render PRs, weekly volume, and the 1RM leaderboard.

---

## 6. Architecture Decisions

- **ADR-1 — Fenced `workout` code block + Markdown code block processor.** Rendering is a derived view; the source stays plain, portable Markdown. *(constitution I)*
- **ADR-2 — Filename-as-date.** Workout date (and optional title) comes from the note filename, not frontmatter.
- **ADR-3 — Single `SET_RE` regex.** The whole set grammar is one regular expression in `parser.ts`. Simple and fast, but not extensible (see Risks).
- **ADR-4 — Pure-logic core.** Parser, weight conversion, and stats are pure functions with no Obsidian imports. *(constitution II)*
- **ADR-5 — Kilograms internally.** All weight math normalizes to kg via a single conversion constant. *(constitution III)*
- **ADR-6 — Single derived `ExerciseIndex`.** One in-memory index is the sole derived view of the vault, kept in sync with vault events (debounced). *(constitution V)*

---

## 7. Quality Requirements

- Zero runtime dependencies.
- All pure modules have a mirroring Vitest file under `tests/`, developed test-first.
- `npm run build` (typecheck + esbuild), `npm test` (Vitest), `npm run lint` (ESLint) must all pass.
- Pure functions are deterministic (same input → same output).

---

## 8. Risks and Technical Debt

| Risk / Debt | Consequence | Mitigation (v2 direction) |
|---|---|---|
| **Monolithic `SET_RE` regex** | Adding RPE / AMRAP / tempo / rest means editing the regex and threading fields through model + consumers. No extension point. | Split parser into a small core tokenizer + a typed attribute registry. |
| **Rigid, flat `WorkoutSet` model** | No generic place for new per-set attributes. | Add an extensible `attributes` map. |
| **`+` overloaded** | `+` means "bodyweight addon" (`@ +10kg`); a future AMRAP marker would collide. | Redesign the core notation. |
| **Two rep notations** | `3x5` (uniform) vs `5,3,1` (per-set) — two ways to express the same thing. | Unify in the redesign. |
| **Indentation-sensitive parsing** | A leading tab/space changes line meaning; fragile to editor whitespace. | Retain but make explicit; document clearly. |
| **No RPE / tempo / rest / RIR / AMRAP / supersets** | Common training data cannot be recorded. | The extensible-DSL redesign's core motivation. |
