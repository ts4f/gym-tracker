# Gym Tracker

An [Obsidian](https://obsidian.md) plugin for logging workouts as plain text in your notes.
You write simple workout blocks; the plugin turns them into rendered tables, personal
records, 1RM estimates, progression trends, weekly volume, and exercise-name autocomplete.
Your training log stays in markdown files you own — no app, no account, no export lock-in.

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
	100kg x 5 x 3 @ 8
	105kg x 3 @ 9.5   # new top set

Deadlift # touch and go
	140kg x 5,3,1

Pull-Up
	BW x 8 x 3
	BW+10kg x 5 x 3 @ 7
```
````

That's the whole syntax:

| Line | Meaning |
|---|---|
| `Bench Press` | Unindented line = exercise name |
| `	100kg x 5 x 3` | Indented line = weight × reps × sets |
| `	100kg x 5` | One set (sets omitted = 1) |
| `	140kg x 5,3,1` | Comma-separated reps, one set each |
| `	100kg x 5+ x 3 @ 9` | `+` after reps = AMRAP on the last set; `@ 9` = RPE |
| `	100kg x 5 x 3 @ 8` | `@ 8` = RPE (rate of perceived exertion, 1–10) |
| `	BW x 8 x 3` | `BW` = bodyweight |
| `	BW+10kg x 5 x 3` | `BW+10kg` = bodyweight plus added load |
| `	100kg x 5 x 3 [tempo 3-1-3, rest 90s]` | `[...]` = optional attributes |
| `# ...` | Comment — on its own line or at the end of any line |

Weights accept `kg` or `lb` (e.g. `225lb x 5 x 3`); without a suffix, the default unit from
settings is used. Internally everything is converted to kg, so you can mix units freely.

### Attributes

Brackets hold optional per-set attributes, each `key value` separated by commas. Built in:
`tempo` (`3-1-3` or `3-1-X-1`), `rest` (`90s`, `2m`, `2:00`), and `rir` (reps in reserve).
Unknown attributes pass through as text, so the format grows without a plugin update.

## What you get

- **Rendered tables** — in reading view, each workout block becomes a table per exercise
  with columns for set, reps, weight, RPE, and note/attributes, plus a
  `last: 102.5kg × 5 (2026-06-04)` label showing your previous session and a
  `trend: ↑ +2.5kg/mo` progression rate from a linear regression over your
  estimated-1RM history.
- **Autocomplete** — start typing an exercise name inside a workout block and get
  suggestions from your history, pre-filling your last weight in weight-first form.
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
| Progression trend | on | Show a linear-regression trend (e.g. `+2.5kg/mo`) next to each exercise in reading view |

## Installation

Manual install (not yet in the community plugin directory):

1. Copy `main.js`, `manifest.json`, and `styles.css` into
   `<your vault>/.obsidian/plugins/gym-tracker/`.
2. Reload Obsidian and enable **Gym Tracker** under *Settings → Community plugins*.

To build from source: `npm install && npm run build`.

## TODOS/IDEAS

Parser / DSL work
- Supersets — group exercises with A1/A2 prefixes or indentation rules.
- More typed attributes — extend the registry (`registerAttribute`) with e.g. tempo variants.

Stats / algorithms
- Training streaks and frequency — current streak, sessions per week over time.
- Multiple 1RM formulas — current Epley; add Brzycki and a settings dropdown?

UI / Obsidian API
- Hand-rolled SVG chart in the stats sidebar — 1RM over time per exercise, no charting library
- Calendar heatmap of training days (GitHub-contributions style).
