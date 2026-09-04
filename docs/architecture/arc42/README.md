# Gym Tracker — Architecture (v2)

Lean arc42 documentation of the **current** system after the extensible-DSL v2
redesign (plugin version `0.2.0`). The grammar is weight-first
(`100kg x 5 x 3 @ 8`), the parser is a hand-written tokenizer plus a typed
attribute registry, and the model carries an extensible per-set attribute bag.

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

### DSL (v2, weight-first)

```text
set-line := weight-spec "x" reps ["x" sets] ["@" rpe] [attributes] [inline-comment]
weight-spec := weight | "BW" ["+" weight]
reps := NUMBER ["+"] | NUMBER ("," NUMBER)+
attributes := "[" attribute ("," attribute)* "]"
```

| Line | Meaning |
|---|---|
| `100kg x 5 x 3 @ 8` | 100 kg × 5 reps × 3 sets, RPE 8 |
| `100kg x 5` | 100 kg × 5 reps, one set |
| `100kg x 5+ x 3 @ 9` | three sets of 5, last set AMRAP, RPE 9 |
| `100kg x 5,3,1 @ 9.5` | explicit per-set reps 5/3/1 |
| `BW x 8 x 3` | bodyweight × 8 × 3 |
| `BW+10kg x 5 x 3 @ 7` | weighted bodyweight +10 kg |
| `100kg x 5 x 3 @ 8 [tempo 3-1-3, rest 90s]` | + tempo and rest attributes |

`@` denotes RPE (1–10), a trailing `+` on a rep count sets an AMRAP flag,
`BW`/`BW+<weight>` denote bodyweight/weighted-bodyweight, and `[...]` holds
optional key/value attributes. The v1 grammar (`3x5 @ 100kg`) is no longer parsed.

---

## 4. Building Block View

One module per concern. Pure modules (parser, model, stats, util) have no Obsidian import;
glue modules (main, views, settings tab, block processor) use the Obsidian API.

### `src/parser/`

| File | Responsibility |
|---|---|
| `core.ts` | `parseWorkoutBlock(source, opts)` — hand-written line tokenizer for the weight-first grammar. Order: attributes → inline comment → `@` RPE → `weight x reps [x sets]` → weight (`BW`/`BW+`/unit weight) → reps (single / AMRAP `+` / comma list) → sets. Emits per-line `ParseError`. |
| `registry.ts` | `AttrParser` (`parse`/`format`), `registerAttribute`, `parseAttribute`, `formatAttribute` — the typed attribute extension point. Built-ins: `tempo`, `rest`, `rir`. Unknown keys pass through as raw strings. |
| `types.ts` | `ParseError { line, message }`, `ParsedBlock`, `ParseResult { workout, errors }`. |
| `serialize.ts` | `exercisesToDsl(exercises)` — inverse of parsing (used by "new workout from last workout"). Units always explicit; round-trips the v2 model. |

### `src/model/`

| File | Responsibility |
|---|---|
| `types.ts` | Domain types: `Unit`, `AttrValue` (`number \| string \| boolean`), `Weight`, `WorkoutSet`, `Exercise`, `Workout`. `WorkoutSet` carries `reps[]`, `weight?`, `isBodyweight`, `bodyweightAddon?`, `amrap?`, `rpe?`, `attributes?` (extensible `Map<string, AttrValue>`), `comment?`, `line`. |
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
| `blockProcessor.ts` | `registerBlockProcessor` (via `registerMarkdownCodeBlockProcessor("workout", …)`), `formatWeight`, `buildSetRows`, `fuzzyWarning`, `lastSessionLabel` — reading-view table rendering (set/reps/weight + RPE/attributes column) and the "last: …" / "did you mean" labels. |

### `src/stats/`

| File | Responsibility |
|---|---|
| `history.ts` | `computeExerciseHistory`, `lastSessionBefore`, `formatSessionSummary` — per-session history per exercise. |
| `oneRepMax.ts` | `estimateOneRepMax` — Epley formula on kg-normalized weight. |
| `pr.ts` | `computePersonalRecords` — heaviest weight × reps per exercise. |
| `trend.ts` | `computeProgressionTrend`, `formatProgressionTrend` — least-squares slope of est. 1RM over time (kg/month), for the reading-view `trend: …` label. |
| `volume.ts` | `computeWeeklyVolume` — weekly volume per exercise (current ISO week). |

### `src/autocomplete/`

| File | Responsibility |
|---|---|
| `exerciseSuggest.ts` | `ExerciseSuggest` — editor suggestions from exercise history, pre-filling last weight (weight-first). |
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
               └─► registry (attribute extension point)
          ──► index (workoutLoader → blockExtractor + parser; fileScanner)
          ──► render/blockProcessor ──► parser, stats/history, stats/trend, index
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
      → parseWorkoutBlock(block, {defaultUnit})  (weight-first DSL → Exercise[])
  → index.setAll(workouts)
```

### Incremental sync (vault events)

- `modify` → debounced (300ms) `indexFile`.
- `create` → `indexFile`.
- `delete` → `index.remove(path)`.
- `rename` → `index.rename(old, new)` / `remove` / `indexFile` depending on folder membership.

### Reading view

Each ```workout block is handed to the markdown code block processor, which parses it and
renders one table per exercise, with per-set rows (set number, reps, weight, RPE,
attributes, note), a "last: …" label, an optional "trend: …" progression label (linear
regression over the est. 1RM history), and an optional "did you mean …" fuzzy warning.

### Autocomplete

The editor suggest queries `ExerciseIndex.lookup(prefix)`, sorted by frequency, and
pre-fills the last weight in weight-first form.

### Stats sidebar

`GymTrackerStatsView` reads `ExerciseIndex` and calls the pure `stats/*` functions to
render PRs, weekly volume, and the 1RM leaderboard.

---

## 6. Architecture Decisions

- **ADR-1 — Fenced `workout` code block + Markdown code block processor.** Rendering is a derived view; the source stays plain, portable Markdown. *(constitution I)*
- **ADR-2 — Filename-as-date.** Workout date (and optional title) comes from the note filename, not frontmatter.
- **ADR-3 — Hand-written tokenizer + typed attribute registry.** The v1 single `SET_RE` regex is replaced by a small line tokenizer (`parser/core.ts`) for the fixed `weight × reps × sets @ rpe` core, plus a registry (`parser/registry.ts`) that types `[key value]` attributes. Adding a new attribute is one `registerAttribute` call with no core/model change. *(constitution II, FR-008)*
- **ADR-4 — Weight-first notation (RTS convention).** `100kg x 5 x 3 @ 8` reads naturally mid-workout; `@` means RPE, `+` means AMRAP, `BW`/`BW+10kg` mean bodyweight/weighted. Replaces the overloaded `3x5 @ 100kg` v1 syntax.
- **ADR-5 — Clean breaking change, no migration.** Pre-publication (v0.1.0 → v0.2.0), so v1 syntax is removed wholesale with no migration tool.
- **ADR-6 — Pure-logic core.** Parser, weight conversion, and stats are pure functions with no Obsidian imports. *(constitution II)*
- **ADR-7 — Kilograms internally.** All weight math normalizes to kg via a single conversion constant. *(constitution III)*
- **ADR-8 — Single derived `ExerciseIndex`.** One in-memory index is the sole derived view of the vault, kept in sync with vault events (debounced). *(constitution V)*

---

## 7. Quality Requirements

- Zero runtime dependencies.
- All pure modules have a mirroring Vitest file under `tests/`, developed test-first.
- `npm run build` (typecheck + esbuild), `npm test` (Vitest), `npm run lint` (ESLint) must all pass.
- Pure functions are deterministic (same input → same output).
- No v1-grammar code paths or tests remain (v2-only).

---

## 8. Risks and Technical Debt

| Risk / Debt | Consequence | Mitigation / direction |
|---|---|---|
| **Indentation-sensitive parsing** | A leading tab/space decides whether a line is an exercise or a set; fragile to editor whitespace. | Retained framing; documented explicitly. |
| **Unknown-attribute typos pass silently** | `[tempoo 3-1-3]` is stored as a raw string with no error, because unknown keys are forward-compatible by design. | Accepted trade-off; a "known-key" fuzzy warning is a possible follow-up. |
| **No v1 migration** | Existing `3x5 @ 100kg` notes are not parsed; users recreate them in v2. | Accepted — pre-publication, single user. |
| **RPE vs RIR overlap** | `@n` (core RPE) and `rir` (attribute) both model proximity to failure; users may conflate them. | Document the distinction; keep RPE as the core field. |
| **Supersets out of scope** | No way to group exercises into supersets yet. | Future extension via the attribute registry, not a core change. |
| **In-memory index is derived state** | A missed vault event could desync the index until the next rebuild. | Debounced rebuild + full rebuild on layout-ready. |
