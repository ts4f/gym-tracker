# Research: Extensible Workout DSL v2

All decisions resolved during planning (no open NEEDS CLARIFICATION remains). Sources: approved spec, full codebase read, and the upstream powerlifting/RTS notation convention.

## 1. Core notation — weight-first (RTS convention)

- **Decision**: `100kg x 5 x 3 @ 8` = weight × reps × sets @ RPE.
- **Rationale**: Matches the dominant powerlifting/RTS convention where `@` literally means "rate of perceived exertion"; most memorable for lifters and reads naturally mid-workout.
- **Alternatives considered**: keep `3x5 @ 100kg` (rejected — no clean place for RPE/attributes, and `@` is overloaded); fully named key:value token stream (rejected — too verbose to write on the fly).

## 2. Extensibility — typed attribute registry + generic bag

- **Decision**: `[key value, ...]` bracket attributes parsed through a `Map<key, AttrParser>`; unknown keys pass through as raw strings.
- **Rationale**: Adding an attribute = one registry entry, zero changes to the core tokenizer or the model. Pure and unit-testable.
- **Alternatives considered**: hardcode each attribute in the core regex (rejected — the exact non-extensible pattern being removed); YAML/TOML (rejected — needs a runtime dependency, violating zero-deps).

## 3. Parser shape — hand-written tokenizer, no regex monolith

- **Decision**: a small line tokenizer for the fixed core + a registry-backed attribute parser; per-line `{ line, message }` errors (existing shape).
- **Rationale**: zero dependencies, pure, each piece independently testable, and the split is itself the extension seam.
- **Alternatives considered**: single combined regex (rejected — the current pain point).

## 4. Attribute value formats

- **tempo**: `x-y-z` or `x-y-z-w`, each part a number or `X` (concentric) → validated structured string (not computed).
- **rest**: `90s` / `2m` / `2:00` → normalized to integer seconds.
- **rir**: integer or decimal 0–10.
- **rpe** (`@n`): core field, 1–10 (decimal allowed).

## 5. Backward compatibility

- **Decision**: clean break, no migration; bump to 0.2.0.
- **Rationale**: pre-publication (v0.1.0, not in the community directory), single user; the cost of dual-syntax is not justified.
- **Alternatives considered**: superset (old notes keep parsing) — rejected by user decision; converter command — rejected by user decision.

## 6. AMRAP and bodyweight encoding

- **AMRAP**: trailing `+` on a rep count (`5+` → `amrap: true`).
- **Bodyweight**: `BW` / `BW+10kg` reuse existing `isBodyweight` + `bodyweightAddon` model fields.

## 7. arc42 documentation

- **Decision**: lean arc42 subset (context & constraints, building-block view, runtime flow, key decisions, risks/tech-debt, quality goals) under `docs/architecture/arc42/`, describing the **as-is** system first; the to-be update is a follow-on.
- **Rationale**: documentation is the primary driver and the as-is baseline is the reference that justifies the redesign.
- **Alternatives considered**: full 12-section arc42 (rejected — overweight for a small plugin).
