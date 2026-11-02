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
- **The API** rejects a taken weekday with a 400 before the write — in `updateWorkoutDay` (moving a day) and in `create` (duplicates within the payload), both in `apps/backend/src/workout-cycles/workout-cycles.service.ts`. The constraint would reject these anyway; the service check turns a driver-level 500 into a message the editor can show. The check reads then writes, so `updateWorkoutDay` also maps a `P2002` on `WorkoutDay_cycleId_weekday_key` back to a 400 — that is the path a concurrent write takes, and the index stays the actual authority. `update` re-anchors every day's `order` when the cycle's start weekday moves, and routes that transaction through the same handler, so a lost race on `WorkoutDay_cycleId_order_key` (or on the weekday index) answers 400 there too rather than a raw 500; it rewrites every day at once, so it reports the generic "someone raced you" message instead of naming a weekday.

Before running the migration against any populated database, run `npm run check:duplicate-weekdays` (in `apps/backend`, `DATABASE_URL` pointed at the target). It is read-only and reports every cycle that would fail the migration.

The day editor offers all seven weekdays; choosing a free one moves the day, choosing a taken one asks to swap and, on confirmation, sends `swapWithWorkoutDayId` back with the update so the two days' weekdays exchange atomically. `updateWorkoutDay` still answers 400 for a taken weekday when `swapWithWorkoutDayId` is absent or names the wrong day — a plain move can't land on an occupied weekday, only a confirmed swap with that specific day can. The swap itself parks the moving day at a sentinel weekday/order first, since both days would otherwise collide on the unique index and on `(cycleId, order)` mid-exchange with each about to take the slot the other holds; names, plans and planned gyms stay with their own day throughout. The creation wizard has no day to swap with yet, so it keeps disabling weekdays already in use instead.

### Today's workout is the one whose weekday is today

**The recommendation is today's cycle day, or nothing. A skipped day is missed, never queued.**

Rotation through `WorkoutDay.order` is gone: it advanced from the last performed workout, so skipping a Saturday and training on Monday performed Saturday's plan on Monday and left the user permanently one step out of phase with their own week.

- **One algorithm, three surfaces**: `WorkoutEngineService` (`apps/backend/src/workouts/workout-engine.service.ts`) answers the workout page (`getSuggestedWorkout`), the cycle modal's highlight (`getCurrentCycleWorkouts`), and the dashboard card (`getNextScheduledWorkout` — today's workout while it is still open, otherwise the next scheduled weekday, wrapping into the following week but never past the cycle's own expiry). The modal still lists every cycle day; only the highlight follows the recommendation.
- **A day is done if _any_ workout carries today's `localDate`** — free, template-started, a different cycle day, or a past-workout entry dated today. Almost every day has exactly one workout, and this keeps the rule stateable in one sentence.
- **"Today" is the user's day, not the server's**: the client sends `X-Timezone` on every request (`apps/frontend/lib/api/client.ts`) and the `@ClientToday()` decorator resolves the weekday and the done-check in that zone, falling back to the pinned `SERVER_TIME_ZONE` (`apps/backend/src/common/utils/today.util.ts`) when the header is absent — direct API calls and server-side rendering. That fallback zone is the same one the `localDate` backfill assumed.

`WorkoutDay.order` still orders the modal's list. It must never decide *which* workout is recommended again.

### An in-use exercise cannot change its `isUnilateral` flag

**Once any `WorkoutSet` references an exercise, its `isUnilateral` flag is frozen. Every other field stays editable.**

`isUnilateral` is a set *shape*, not a loading coefficient (volume sums the per-side columns rather than multiplying by two — `apps/backend/src/common/utils/volume.util.ts`). Flipping it still breaks history: it strands side data on a now-bilateral exercise, or leaves a now-unilateral exercise whose past sets have no sides and so read as half their true volume. An exercise that changed shape is a *different* exercise — make a new one.

- **The API** rejects the change in `ExercisesService.update` (`apps/backend/src/exercises/exercises.service.ts`) with a 409 and a German message, but only when the value actually differs from the stored one — a no-op save that restates the current flag still passes. "In use" counts a `WorkoutSet` of **any** `WorkoutKind` (performed, template, blueprint — one table), reached via `workoutExercise.exerciseId`; there is no `completedAt` predicate.
- **The DTO** carries `inUse` (`ExerciseDto`), computed on every read. The editor dialog (`apps/frontend/components/exercises/exercise-editor-dialog.tsx`) uses it to render the Unilateral checkbox disabled with the reason inline, so the rule is visible before save rather than only on the 409.

### One active Zyklus per user

**A user has at most one `WorkoutCycle` with `status = 'ACTIVE'`. A Zyklus scheduled for the future is `ACTIVE` too and counts. Any number of `COMPLETED` ones may exist.**

Before, the server rejected a second active Zyklus only after the user had filled in the whole wizard, and its check read before it wrote, so two simultaneous requests could both pass it.

- **The database** enforces it: partial unique index `WorkoutCycle_userId_active_key` on `WorkoutCycle(userId) WHERE status = 'ACTIVE'`, migration `20261102120000_workout_cycle_unique_active_per_user`. It is raw SQL — Prisma cannot express a partial index, so it is absent from `schema.prisma` (only a comment points to it). Prisma 7's `migrate dev` leaves it alone (verified; its only stray proposal is the known `Workout.updatedAt` `DROP DEFAULT`), but re-check after a Prisma upgrade.
- **The API** keeps its check in `create` (`apps/backend/src/workout-cycles/workout-cycles.service.ts`) and answers `ACTIVE_CYCLE_ALREADY_EXISTS` (400). A request that loses the race hits the index instead and has its `P2002` mapped to the same code, so the answer is a 400, never a 500. With the Prisma 7 `pg` driver adapter the violated index name is at `meta.driverAdapterError.cause.constraint.index` and `meta.target` is absent; `isUniqueIndexConflict` reads both shapes, and the weekday index depends on that too.
- **The wizard route** (`apps/frontend/app/[locale]/cycles/new/page.tsx`, via `NewCycleGuard`) is the single client-side gate: whoever opens it — the Zyklen page, the dashboard card, a past Zyklus, a typed URL — is redirected to the Zyklen page with a toast when an active Zyklus exists. Do not re-add a check at the individual buttons; the "new Zyklus" button stays visible everywhere and relies on the guard. The server still has the last word if the guard's lookup fails or a Zyklus becomes active mid-wizard.

Before running the migration against any populated database, run `npm run check:input-rules` (in `apps/backend`, `DATABASE_URL` pointed at the target). It is read-only and reports every user with more than one active Zyklus as `multiple-active-cycles`; those need a manual decision (complete or delete all but one), since the migration fails on them.

### Warm-up sets carry no RIR

**A `WARMUP` set has no RIR, on any `WorkoutKind`. A `WORKING` set needs one when it is logged or planned, but the server never requires it.**

The server only knows the first half: `deriveSetAggregates` (`apps/backend/src/workout-tree/workout-tree.service.ts`) answers `WORKOUT_SET_WARMUP_RIR` (400) for a warm-up with `rir`, `rirLeft` or `rirRight`. It cannot require RIR on working sets because history holds working sets without one and editing resends the whole tree through `replaceTree`. The data migration of `check:input-rules` nulled the existing warm-up RIR.

The client enforces the rest, through one guard (`apps/frontend/lib/log-set-guards.ts`): `checkSetForLogging` is the single check behind the tick, the swipe and the past-tracking auto-commit; `setNeedsRir` / `findFirstSetNeedingRir` answer "does a working set still lack its RIR" for the plan editors' save, the live workout's "Beenden" and the workout-completeness check. Save payloads never trust the draft to have cleared a warm-up's RIR: `toExercisePayload`, `plannedSideFields` and `planRir` drop it. In Verlauf the rules apply only to sets the user changed.

## Agent skills

### Issue tracker

Issues live in GitHub Issues on `n1k0blc/Workout-Tracker`, driven by the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label string equal to its name (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` and one `docs/adr/` at the repo root, covering both `apps/backend` and `apps/frontend`. See `docs/agents/domain.md`.