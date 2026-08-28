<!--
Sync Impact Report
===================
Version change: 1.0.0 → 1.1.0 (workflow: Spec-Kit file storage → beads-native)
Modified principles: none
Added sections: none
Removed sections: none
Deferred TODOs: none
-->

# Gym Tracker Constitution

## Core Principles

### I. Plain-Text, User-Owned Data (NON-NEGOTIABLE)

Training data lives exclusively in user-owned Markdown files under the vault's
workouts folder, encoded in fenced `workout` code blocks. The Markdown files are
the canonical store; the plugin MUST NOT introduce a proprietary database,
external account, or any export lock-in. Reading-view rendering, stats, and
autocomplete are derived, disposable views over that source of truth and MUST
never mutate or replace it.

Rationale: no lock-in is the product's core promise (see `README.md`).

### II. Deterministic Pure-Logic Core

Parsing, weight conversion, and all statistics (personal records, 1RM
estimates, weekly volume) MUST be implemented as pure functions with no Obsidian
API or I/O dependencies and no hidden mutable state. A pure function MUST return
the same result for the same input on every call.

Rationale: purity makes the core independently unit-testable and keeps behavior
verifiable outside a live Obsidian vault.

### III. Unit-Normalized Mathematics

All weight arithmetic MUST be normalized to kilograms internally. Weights MAY be
expressed with a `kg` or `lb` suffix; a bare weight uses the configured default
unit. Unit conversion MUST use a single fixed conversion constant, and all stats
formulas (e.g. the Epley 1RM estimate) MUST operate on normalized kilogram
values so mixed-unit logs yield consistent results.

### IV. Test-First, Module-Mirrored Unit Coverage

Every pure module MUST have a matching Vitest test file whose path mirrors the
source module (one test file per pure module under `tests/`). New pure logic
MUST be developed test-first: write the failing test, then implement.
Obsidian-lifecycle glue (`main.ts`, views, settings tab, block processor) MAY be
exempt from unit tests but MUST remain as thin as possible so untested surface
area stays small.

### V. Thin Obsidian Glue & Single Derived Index

Obsidian lifecycle and UI MUST live in a thin layer and use the Plugin API
correctly (`registerView`, `registerEditorSuggest`, `addCommand`,
`registerEvent`), releasing resources in `onunload`. A single in-memory
`ExerciseIndex` is the sole derived view of the vault and MUST be rebuilt from
and kept in sync with vault create/modify/delete/rename events (debounced). No
other component MAY maintain a competing cache of workout data.

## Technology & Constraints

- TypeScript in strict mode (`strict`, `noImplicitAny`,
  `noUncheckedIndexedAccess`); runtime target ES2018, module ESNext.
- Build with esbuild; typecheck with `tsc -noEmit -skipLibCheck`.
- Lint with ESLint using `eslint-plugin-obsidianmd`.
- Zero runtime dependencies — Obsidian is a devDependency for types only. The
  plugin ships `main.js`, `manifest.json`, and `styles.css`.
- All features MUST be reachable from Ctrl/Cmd-P commands or the stats sidebar.

## Development Workflow & Quality Gates

- `npm run build` (typecheck + esbuild production bundle), `npm test` (Vitest),
  and `npm run lint` (ESLint) MUST all pass before a change is complete.
- Feature work is tracked in beads (`bd`): one `epic` per feature carrying
  `## Success Criteria` and a `--spec-id` link; one child (type `feature`) per
  user story carrying `## Acceptance Criteria` and its task checklist in
  `notes`; execution order via `bd dep`. Reference design documents
  (`data-model.md`, `contracts/`, `quickstart.md`, `research.md`) live under
  `specs/<feature>/`.
- Obsidian release conventions MUST be honored: keep `manifest.json` (version,
  minAppVersion, description) and `versions.json` consistent.

## Governance

This constitution supersedes all other project practices. Amendments MUST
document the rationale and bump the constitution version per semantic
versioning (MAJOR: principle removal/redefinition; MINOR: new principle or
material expansion; PATCH: wording or clarification).

Compliance review: every change MUST verify that (a) pure logic is unit-tested,
(b) no new runtime dependency is introduced without justification, and (c) no
feature regresses plain-text data ownership. For runtime development guidance
and current feature context, consult `README.md`, the architecture
documentation under `docs/`, and the beads backlog (`bd prime`, `bd show`).

**Version**: 1.1.0 | **Ratified**: 2026-08-23 | **Last Amended**: 2026-08-28
