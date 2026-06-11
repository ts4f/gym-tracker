# Gym Tracker

An [Obsidian](https://obsidian.md) plugin for logging workouts as plain text in your notes.
You write simple workout blocks; the plugin turns them into rendered tables, personal
records, 1RM estimates, weekly volume, and exercise-name autocomplete. Your training log
stays in markdown files you own — no app, no account, no export lock-in.

## Usage

Create one note per workout in your workouts folder (default: `Workouts/`), named by date:

```
Workouts/2026-06-11.md
Workouts/2026-06-13 Push Day.md
```

Inside a note, log the workout in a `workout` code block:

````markdown
```workout
# felt strong today

Bench Press
	3x5 @ 100kg
	1x3 @ 105kg   # new top set

Deadlift # touch and go
	5,3,1 @ 140

Pull-Up
	3x8
	2x5 @ +10kg
```
````

That's the whole syntax:

| Line | Meaning |
|---|---|
| `Bench Press` | Unindented line = exercise name |
| `	3x5 @ 100kg` | Indented line = sets × reps at a weight |
| `	5,3,1 @ 140` | Comma-separated reps (one set each); no unit = your default unit |
| `	3x8` | No weight = bodyweight |
| `	2x5 @ +10kg` | `+` = bodyweight plus added load (e.g. weighted pull-ups) |
| `# ...` | Comment — on its own line or at the end of any line |

Weights accept `kg` or `lb` (e.g. `@ 225lb`); without a suffix, the default unit from
settings is used. Internally everything is converted to kg, so you can mix units freely.

## Features

- **Rendered tables** — in reading view, each workout block becomes a clean table per
  exercise, with a `last: 102.5kg × 5 (2026-06-04)` label showing your previous session
  so you instantly know what to beat.
- **Autocomplete** — start typing an exercise name inside a workout block and get
  suggestions from your history, sorted by how often you train it, pre-filling your
  last weight.
- **Typo guard** — `Bnch Press` gets a "Did you mean *Bench Press*?" warning instead of
  silently splitting your history.
- **Stats sidebar** (dumbbell ribbon icon) —
  - **Personal records**: heaviest weight × reps per exercise; click a row to expand the
    full session-by-session history with estimated 1RM.
  - **This week**: training volume per exercise for the current ISO week.
  - **Est. 1RM leaderboard**: best estimated one-rep max per exercise (Epley formula).
- **Commands** (Ctrl/Cmd-P) —
  - *Open stats* — opens the sidebar.
  - *New workout from last workout* — creates today's note pre-filled with your previous
    workout, ready to edit. The fastest way to log: change the numbers, done.

## Settings

| Setting | Default | Description |
|---|---|---|
| Workouts folder | `Workouts` | Folder scanned for workout notes |
| Default weight unit | `kg` | Unit assumed when a weight has no suffix |
| Fuzzy-match warnings | on | Warn about likely exercise-name typos |

## Installation

Manual install (not yet in the community plugin directory):

1. Copy `main.js`, `manifest.json`, and `styles.css` into
   `<your vault>/.obsidian/plugins/gym-tracker/`.
2. Reload Obsidian and enable **Gym Tracker** under *Settings → Community plugins*.

## Development

```bash
npm install        # install dependencies
npm run dev        # esbuild watch mode → main.js
npm run build      # type-check (tsc -noEmit) + production bundle
npm test           # run the test suite (vitest)
npm run lint       # eslint, including the obsidianmd plugin rules
```

For a live development loop, point the build output into a test vault
(symlink or copy `main.js`, `manifest.json`, `styles.css` into
`<vault>/.obsidian/plugins/gym-tracker/`) and reload Obsidian after changes.

### Architecture

The design is a **pure core with a thin Obsidian shell**: all domain logic
(parsing, stats, indexing) is plain TypeScript with no Obsidian imports and is
unit-tested; only the outer layers touch the Obsidian API.

```
markdown notes  →  parser  →  ExerciseIndex  →  autocomplete / tables / stats
 (source of        (pure)     (in-memory,        (Obsidian shell, re-renders
  truth)                       observable)         on index changes)
```

| Path | Description |
|---|---|
| `src/model/` | Domain types (`Workout`, `Exercise`, `WorkoutSet`, `Weight`), kg⇄lb conversion |
| `src/parser/` | Workout DSL → typed data; errors are collected, never thrown. Also the DSL serializer |
| `src/index/` | `ExerciseIndex` — in-memory source of truth, updated incrementally from vault events |
| `src/stats/` | Pure functions: PRs, weekly volume, per-exercise history, Epley 1RM |
| `src/util/` | Filename date parsing, ISO-week keys, Levenshtein distance |
| `src/autocomplete/` | `EditorSuggest` for exercise names — only triggers inside workout fences |
| `src/render/` | Code-block processor → HTML tables, last-session labels, typo warnings |
| `src/views/` | Right-sidebar stats view; subscribes to index changes |
| `src/settings/` | Settings schema, defensive normalization, settings tab |
| `src/main.ts` | Plugin entry point — wires everything, debounces vault events |
| `tests/` | Vitest unit tests for all pure modules |

Key invariants:

- **Weights are stored as written and converted to kg only for computation/display.**
- **`ExerciseIndex` is the single source of truth**; vault events update it and a
  subscribe/notify pattern re-renders the stats view.
- **Parsing never throws** — malformed lines become `ParseError`s rendered to the user.
- **Vault content is untrusted** — rendering uses Obsidian's escaping DOM helpers
  (`createEl`/`setText`), never `innerHTML`.

### TODOS/IDEAS

- New parsing/stats/index logic goes in pure modules with matching `tests/*.test.ts`.
- Strict TypeScript: no `any`, handle `undefined` explicitly.
- DSL changes must update the parser (`SET_RE`), the block renderer, the autocomplete
  insertion helpers, and their tests together — and the syntax table in this README.
- Run `npm test`, `npm run build`, and `npm run lint` before submitting changes.
