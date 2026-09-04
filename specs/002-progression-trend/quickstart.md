# Quickstart: validating progression trend

Runnable validation scenarios for the progression-trend feature. Model and formula
details live in `data-model.md`; decisions and rationale in `research.md`.

## Automated gates

```bash
npm test          # Vitest — trend + blockProcessor label tests green
npm run build     # tsc --noEmit -skipLibCheck && esbuild production bundle
npm run lint      # eslint .
```

Expected: all three pass; zero runtime deps preserved.

## Unit-level validation

```bash
npx vitest run tests/trend.test.ts
npx vitest run tests/blockProcessor.test.ts
```

- `trend.test.ts` proves: null for < 3 est-1RM sessions / unknown exercise /
  same-day sessions; positive, negative, and flat slopes (exact collinear math);
  pure-BW sessions ignored; input-order independence; `formatProgressionTrend`
  up/down/flat strings.
- `blockProcessor.test.ts` proves `trendLabel` returns `trend: ↑ +30.4kg/mo` for a
  known history and null when insufficient/unknown.

## Manual validation (Obsidian)

1. Build (`npm run build`) and copy `main.js`, `manifest.json`, `styles.css` into
   `<vault>/.obsidian/plugins/gym-tracker/`.
2. Create three or more dated workout notes (e.g. `2026-06-01.md`, `2026-06-11.md`,
   `2026-06-21.md`) each containing the same exercise with a rising 1-rep top set:

   ````markdown
   ```workout
   Bench Press
   	100kg x 1
   ```
   ````

   (use 100kg, 110kg, 120kg across the three notes.)
3. **Reading view** of the latest note: the Bench Press header shows
   `last: 110kg × 1 (2026-06-11)  trend: ↑ +30.4kg/mo`.
4. **Flat check**: use identical weights across the three notes → `trend: → flat`.
5. **Insufficient-data check**: a brand-new lift with only one session shows no
   `trend:` label.
6. **Toggle**: Settings → "Progression trend" off → the label disappears from
   reading view.

## Success criteria

- SC-001: `npm test`, `npm run build`, `npm run lint` all pass.
- SC-002: trend is a deterministic pure OLS slope of est. 1RM, correctly signed,
  in `src/stats/trend.ts` with mirroring `tests/trend.test.ts`.
- SC-003: reading view shows `trend: ↑/↓/→ …` next to `last:` only when ≥ 3
  est-1RM sessions span more than one date.
- SC-004: `showTrend` setting (default on) suppresses the label when off.
- SC-005: no new runtime dependency; Markdown source format and data ownership
  unchanged.
