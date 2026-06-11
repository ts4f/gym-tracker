# Gym Tracker

An [Obsidian](https://obsidian.md) plugin for logging workouts as plain text in your notes.
You write simple workout blocks; the plugin turns them into rendered tables, personal
records, 1RM estimates, weekly volume, and exercise-name autocomplete. Your training log
stays in markdown files you own — no app, no account, no export lock-in.

## How it works

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

## What you get

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

To build from source: `npm install && npm run build`.

## TODOS/IDEAS

Parser / DSL work
- RPE notation — support 3x5 @ 100kg RPE 8 so sets can record perceived effort.
- AMRAP sets — 3x5+ @ 100kg where the last set is "as many reps as possible", logged after the fact as 5,5,8.
- Supersets — group exercises with A1/A2 prefixes or indentation rules.

Stats / algorithms
- Progression trend — simple linear regression over a lift's estimated 1RM history, showing e.g. "+2.5kg/month" in the stats view.
- Training streaks and frequency — current streak, sessions per week over time.
- Multiple 1RM formulas — current Epley; add Brzycki and a settings dropdown?

UI / Obsidian API
- Hand-rolled SVG chart in the stats sidebar — 1RM over time per exercise, no charting library
- Calendar heatmap of training days (GitHub-contributions style).

