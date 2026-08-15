# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## Domain invariants

### Exercise and set ordering

**Array position is authoritative. `order` is 1-based and contiguous within its parent, and must restate the position it was sent in.**

This holds for all three `WorkoutKind`s (`BLUEPRINT`, `TEMPLATE`, `WORKOUT`) and both levels of the tree — `WorkoutExercise.order` within a workout, `WorkoutSet.order` within an exercise.

- **Clients** build save payloads with `withArrayPositionOrder` (`apps/frontend/lib/workout-order.ts`), which stamps `order` from array position. Never send a stored `order` back, and never add or subtract an offset to "convert" between bases.
- **The API** rejects a payload whose `order` disagrees with its array position with a 400 (`toExerciseInputs`), and writes `order` from array position regardless (`replaceTree`). Both live in `apps/backend/src/workout-tree/workout-tree.service.ts`.

Rejection is deliberate rather than quietly normalizing: an array of A, B, C numbered 3, 1, 2 states two different sequences, and picking one would silently discard a reorder.

The invariant is enforced, not merely assumed — but it was not always. `order` used to be persisted verbatim from whatever each client sent, which left 0-based rows, 1-based rows, gaps and bases above 1 coexisting in the same tables; migration `20260814080000_normalize_order_to_one_based` cleaned that up. Symptoms of a regression here are subtle: the collapsed exercise card de-duplicates set numbers when drawing its bars, so duplicates silently drop a bar and mislabel a set's warm-up/working type rather than failing.

### One workout day per weekday within a cycle

**`WorkoutDay.weekday` is unique within its cycle. Days in different cycles reuse weekdays freely.**

The weekday decides which workout is recommended, so two days in one cycle both claiming Monday leave "what am I doing on Monday?" with no correct answer.

- **The database** enforces it: unique index on `WorkoutDay(cycleId, weekday)`, migration `20260815120000_workout_day_unique_weekday_per_cycle`.
- **The API** rejects a taken weekday with a 400 before the write — in `updateWorkoutDay` (moving a day) and in `create` (duplicates within the payload), both in `apps/backend/src/workout-cycles/workout-cycles.service.ts`. The constraint would reject these anyway; the service check turns a driver-level 500 into a message the editor can show. The check reads then writes, so `updateWorkoutDay` also maps a `P2002` on `WorkoutDay_cycleId_weekday_key` back to a 400 — that is the path a concurrent write takes, and the index stays the actual authority.

Before running the migration against any populated database, run `npm run check:duplicate-weekdays` (in `apps/backend`, `DATABASE_URL` pointed at the target). It is read-only and reports every cycle that would fail the migration.

The day editor currently offers all seven weekdays and lets the user hit the 400 — making it pleasant under the constraint (moving a day to a free weekday, swapping two days) is separate work.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `n1k0blc/Workout-Tracker`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` and one `docs/adr/` at the repo root, covering both `apps/backend` and `apps/frontend`. See `docs/agents/domain.md`.