# Backend Refactoring Plan

> Derived from a full grilling session against the current codebase (`apps/backend`) and the existing frontend (`apps/frontend`).
> Scope: **backend refactoring**, but because the data-model unification changes the API contract, this is in reality a **full-stack, clean-break** effort with a coordinated deploy. The frontend is "done" only against the *old* contract.
>
> **Threat model (drives priorities):** multi-user, **internet-exposed** (public `workout.nikobjelic.com` via Cloudflare Tunnel; TLS terminates at Cloudflare, backend speaks plain HTTP behind it). IDOR/BOLA is an *active, exploitable* vulnerability, and brute-force protection is non-optional.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Current state per area](#2-current-state-per-area)
3. [Locked decisions & target state](#3-locked-decisions--target-state)
4. [Concrete improvements with reasoning](#4-concrete-improvements-with-reasoning)
5. [Step-by-step plan & PR breakdown](#5-step-by-step-plan--pr-breakdown)
6. [Testing strategy](#6-testing-strategy)
7. [Pi deployment & rollback strategy](#7-pi-deployment--rollback-strategy)
8. [Open flags / deferred](#8-open-flags--deferred)
9. [Progress log](#9-progress-log)

---

## 1. Executive summary

The backend is functional and the dependency stack is current (NestJS 11.1, Prisma 6.19), but it carries three structural problems and one active security gap:

- **Three parallel data hierarchies** model essentially the same thing (an ordered tree of exercises → sets → values): `WorkoutBlueprint/BlueprintExercise/BlueprintSet`, `Workout/ExerciseLog/SetLog`, and `WorkoutTemplate/WorkoutTemplateExercise/WorkoutTemplateSet`. Field names drift across them, and every "copy from one to another" path is hand-written and inconsistent.
- **Analytics sprawl**: 18 endpoints (each metric plus a near-identical `-by-cycle` twin), a 2270-line service, ~5 divergent volume calculators, and inconsistent muscle filtering across charts.
- **Active BOLA/IDOR holes**: several endpoints mutate rows by primary key without scoping to the authenticated user.
- **No real security baseline**: bcrypt cost 10, 7-day JWT in `localStorage`, no throttler, no helmet, no env validation, permissive CORS.

The plan unifies the data model behind one `Workout` entity discriminated by `kind`, collapses the per-set live-logging machinery into a single transactional "save the finished workout" call (logging becomes client-side), consolidates analytics, hardens auth, and closes BOLA — shipped as a coordinated full-stack sequence with a carefully rehearsed, backup-first Pi deployment.

---

## 2. Current state per area

### 2.1 Auth & security

| Aspect | Current state |
|---|---|
| Password hashing | `bcrypt`, `saltRounds = 10` (`auth.service.ts`) |
| Tokens | JWT, `expiresIn` default **7d**, signed with `JWT_SECRET`; **no refresh token** |
| Token storage (FE) | `localStorage` (`access_token`); Bearer header. (Inconsistency: `workout-context.tsx:262` reads key `'token'` while auth uses `'access_token'`.) |
| Guard | `JwtAuthGuard` (passport-jwt); `validateUser` hits DB per request |
| Brute-force | **None** (`@nestjs/throttler` not installed) |
| Security headers | **None** (`helmet` not installed) |
| Env validation | **None** (`JWT_SECRET`/`DATABASE_URL` read unchecked; no `ConfigModule` schema) |
| CORS | Reflects entire RFC1918 space + localhost (dev-convenience); `credentials: true` |
| Response leakage | Guarded by explicit Prisma `select` (no `ClassSerializerInterceptor`/`@Exclude`); Prisma entities not returned raw |
| Raw SQL | **None** — no `$queryRawUnsafe`/`$executeRawUnsafe` (no SQL-injection surface) |

**Object-level authorization (BOLA/IDOR):** `WorkoutsService.findById` scopes correctly (`userId` check → 404) and most mutations route through it. But these mutate by raw `id` **without** scoping to the owned workout:
- `removeExercise` → `exerciseLog.delete({ where: { id } })`
- `deleteSet` → `setLog.delete({ where: { id } })`
- `updateCompletedWorkout` → updates/deletes `SetLog` by `setUpdate.id` and prunes by `exerciseLogId`

A logged-in user can mutate **another user's** rows. (Most of these endpoints are deleted by the client-side-logging change; the rest are covered by the BOLA pass.) Error semantics elsewhere leak existence (e.g. `exercises`/`users` throw `Conflict`/`Forbidden` for others' objects rather than `404`).

### 2.2 Data model (schema.prisma)

Three parallel hierarchies for the same shape:

```
Plan (prescriptive):
  WorkoutBlueprint (1:1 WorkoutDay) → BlueprintExercise(order) → BlueprintSet(order,setType,reps,weight,rir,restAfterSet)
  WorkoutTemplate(name)            → WorkoutTemplateExercise(order) → WorkoutTemplateSet(order,isWarmup,targetReps,targetWeight,targetRir)   ← NO rest column
Log (actual):
  Workout                          → ExerciseLog(order,customPlannedSets Json) → SetLog(setNumber,setType,targetReps/Weight/Rir,reps,weight,rir,actualRestDuration,completedAt)
```

- **Field-vocabulary drift**: `setType` enum vs `isWarmup` bool; `order` vs `setNumber`; `reps/weight/rir` vs `target*`.
- **Templates cannot store rest at all** (no column) → create-from-workout drops rest; `startFromTemplate` hard-codes `restAfterSet: 90`.
- **Target vs actual on `SetLog`**: `target*` are written at log-time and only echoed back to the UI as `plannedSets`; **no analytics reads them** (verified). Only `actualRestDuration` is consumed (rest-time analytics).

### 2.3 Workout lifecycle & persistence

- Sets are **persisted incrementally** (`logSet` writes each `SetLog` immediately) — it is *not* a single final save.
- `complete()` flips status, then runs `setORMBenchmarks` and optionally `updateBlueprintFromWorkout` — **no `$transaction` anywhere** in the codebase.
- `updateBlueprintFromWorkout` does a destructive `deleteMany` → loop-`create` (data-loss risk on partial failure).
- FE logs per set (`exercise-card.tsx:226` → `logSet`), and persists live timers in `localStorage`. No crash-resume today.

### 2.4 Cycles & blueprint propagation

- `WorkoutCycle` (name, `duration` weeks, `startDate`, status) → **one ACTIVE cycle at a time**. Recurs weekly (no per-week storage).
- `WorkoutDay` bound to a **weekday** (0–6) → one `WorkoutBlueprint` (1:1).
- Cycle creation posts the whole tree in one call (already the desired shape).
- `autoCompleteExpiredCycles` runs as a **write-on-read** side-effect on every cycle GET.
- **Propagation (today = dual-source):** the "suggested workout" takes **structure** from the blueprint but **numbers** (reps/weight/rir) from the *last completed session* — so blueprint numbers are effectively dead after session 1. **Rest** uniquely comes from the blueprint.
- Two divergent "next workout" algorithms: `workout-engine` is **weekday-based**; `dashboard.getNextPlannedWorkout` is **sequence/rotation-based**. Cycle-week is computed three different ways (`floor` vs `ceil`).

### 2.5 Workout templates & "influence" flows

Four hand-written copy paths, each translating between the three field vocabularies:
- `createFromWorkout` (workout → new template), `createFromBlueprint` (blueprint → new template), `updateBlueprintFromWorkout` (workout → overwrite blueprint, home-gym-gated, non-atomic). No "overwrite template" exists yet.

### 2.6 Exercises

- **System** (`isCustom=false, userId=null`, seeded via `csvId`) vs **custom** (`isCustom=true, userId`). Soft-delete via `deletedAt` (custom only).
- **Two overlapping muscle representations:** a single `muscleGroup` enum with **15 values at two granularities** (coarse `BACK/LEGS/ABS` + fine `LATISSIMUS/QUADRICEPS/…`), *and* a **12-column percent distribution**. They can drift.
- **Cross-chart filtering inconsistency:** volume/muscle-distribution filter via the 12-percent distribution; rir/reps/duration/rest/prs filter via the single `muscleGroup` field → the same "Chest" filter yields different exercise sets on different charts.
- `validateAndNormalizeMusclePercentages` enforces sum==100 (auto-100 on primary when all zero).

### 2.7 Users & home-gyms

- `HomeGym` (id, name, userId) = a named gym/location. Referenced by `Workout.homeGymId` and `WorkoutDay.plannedHomeGymId`. `homeGymId=null` = "other/away" gym.
- BOLA here is **correct** (everything keys off token `userId`).
- **Gaps:** `deleteHomeGym` hard-blocks if referenced by a workout but ignores `plannedHomeGymId`; used gyms are permanently undeletable (immutable history); no change-password flow; `updateUser` does no email-uniqueness re-check.
- Registration **requires** ≥1 gym.

### 2.8 Analytics

- **18 endpoints** = each metric + a near-clone `-by-cycle` twin. Shared skeleton: load `COMPLETED` workouts in range → gym filter (`alle`/`andere`/specific) → per-exercise filter → per-set reduce → optional week-agg.
- **~5 volume calculators** (see §4.5), one of which (`dashboard`) is buggy.
- Metrics: volume (distributed), muscle-distribution, time-tracking, duration, rest-time, rir (0/1/2 buckets), reps, sets, prs (weight-only, **home-gym-only**), 1rm-trend, orm (benchmark %ORM), cycles list.
- `getORMByCycle` has a multi-select filter bug (`exercise.muscleGroup !== muscleGroup` when it's an array) and `getBenchmark` N+1.

### 2.9 ORM / intensity

- Two features: absolute e1RM trend (`/1rm/:exerciseId`) and the cycle **%ORM** benchmark system (`ExerciseBenchmark` set once per `(cycle,day,exercise)`).
- `%ORM = weight / benchmark`, while the benchmark is a *full Epley e1RM* → the baseline session reads ~75%, not 100%, and the metric ignores reps/rir in the numerator (an asymmetry). Home-gym-only, cycle-only.

### 2.10 Dashboard

Thin aggregator that **reimplements and diverges from** analytics/cycle/engine logic: a buggy volume calc (missing multipliers, includes warmups, reads a non-existent field), a third cycle-week formula, and a second "next workout" algorithm.

### 2.11 Tooling / ops

- Stack current: NestJS 11.1.x (patch-behind only), Prisma 6.19 (7.x is the only major), TS 5.9 (6.x major). `npm audit`: 40 vulns, almost all transitive/dev (picomatch, qs) → fixable via non-breaking `npm audit fix`.
- **No working test harness** (no jest config; the two spec files can't run as-is; `test:e2e` points at a missing dir). No frontend test tooling. No CI.
- Prisma: 11 clean `migrate` migrations; no `binaryTargets` (Docker `node:20-alpine`/musl builds native on ARM — fine as long as built on ARM). `PrismaService` basic connect/disconnect; no `connection_limit` set (Prisma default ~9 on the Pi's cores vs Postgres max 100 — fine).
- Deploy: Pi 5 / Docker / Cloudflare Tunnel; DB port not exposed; Prisma `migrate deploy` auto-runs in-container; data-migration TS scripts run from the Mac over an SSH tunnel; `backup.sh`/`restore.sh` + daily cron exist.
- **Timezone mix** in `date.util`/analytics: `getCurrentDate()`/week logic use server-**local** time, but data-point dates use `toISOString().split('T')[0]` (**UTC**) → off-by-one bucketing near midnight / off-UTC.

---

## 3. Locked decisions & target state

### 3.1 Security / auth
- **Passwords → argon2id** (OWASP floor `m=19MiB, t=2, p=1`, benchmarked on the Pi), with **rehash-on-login** so existing `bcrypt` (`$2…`) hashes upgrade transparently.
- **Tokens → short-lived access (~15m) + DB-backed rotating refresh token** (new `RefreshToken` model, enabling logout + reuse/theft detection) in an **httpOnly, Secure, SameSite** cookie; **CSRF** protection; `/logout`; `trust proxy` so `Secure` works behind Cloudflare; strict prod CORS allowlist (wildcard + credentials don't mix). This is the one place the "frozen" frontend is reopened for auth.
- Add **`@nestjs/throttler`** (global + strict on `/auth/login`, `/auth/register`), **`helmet`**, **env-validation schema** (fail-fast on missing/weak `JWT_SECRET`, `DATABASE_URL`), **change-password** + **email-uniqueness** on change.
- **BOLA**: every read/mutation scoped to the authenticated user; own-object guards return **404** (no existence leak). A full endpoint-by-endpoint BOLA audit is part of PR 2. IDOR fixes ship **with** the refactor (no separate hotfix — user's call), so BOLA lands as early as possible within it.

### 3.2 Unified data model
- **One `Workout` entity discriminated by `kind = TEMPLATE | BLUEPRINT | WORKOUT`**, sharing one tree: `Workout → Exercises(order; reorderable/deletable) → Sets(order; deletable) → values {setType, weight, reps, rir, rest}`.
- **Drop the target/actual duplication** — a single value set means "prescribed" for plans and "performed" for logs. Rest-time analytics reads the single `rest` field.
- Kind-specific fields become nullable: `cycleId`+`workoutDayId` (blueprint), `name` (template), `date`+`totalDuration` (performed). `WorkoutStatus` collapses (no server-side `IN_PROGRESS`/`DISCARDED`).
- **Blueprint** = `Workout(kind=BLUEPRINT)` 1:1 with `WorkoutDay` (unique). Performed = `Workout(kind=WORKOUT, cycleId, workoutDayId)`. Templates = `Workout(kind=TEMPLATE, name)`.
- **Immutable history preserved**: performed rows are independent; plan changes never rewrite them.

### 3.3 Logging & persistence
- **Logging moves fully client-side; the whole finished workout is saved once, atomically.** Consistent with the invariant "a workout is saved only once every set is logged or deleted." No server-side draft (a draft = unperformed sets, which would violate the invariant). No crash-resume regression (there is none today).
- Removes `start / logSet / updateSet / deleteSet / addExercise / removeExercise / reorder / replaceExercise / complete`. Backend exposes `create / update / get / list / delete` on the unified resource.

### 3.4 Save + side-effects (one transactional endpoint)
- Single `POST` carries the finished workout tree + optional flags: `saveAsTemplate: none | new(name) | overwrite(templateId)` and `overwriteBlueprint: bool`.
- Backend copies the tree into target record(s) via **one shared primitive** ("materialize this tree as/into a record of kind K"), inside **one `$transaction`**. **Snapshot** semantics (performed values become the new plan).
- **Availability matrix** (by origin, which the client knows):

  | Origin | overwrite blueprint | overwrite template | save as new template |
  |---|---|---|---|
  | Free / Past | — | — | ✅ |
  | Cycle day **at a home gym** | ✅ | — | ✅ |
  | Cycle day at another gym | — | — | ✅ |
  | Custom template | — | ✅ | ✅ |
  | System template | — | ❌ (locked) | ✅ |

- **Overwrite-template UX**: auto-detect the origin template (show its name, destructive confirm, **no selector**). Server validates the `overwrite(templateId)` equals the workout's recorded origin **and** is custom + owned.
- **Overwrite-blueprint** stays **home-gym-gated** (`homeGymId != null`) and **defaults ON** for cycle workouts (easy opt-out).

### 3.5 Rest pauses
- One `rest` field; semantics = **"seconds rested after completing this set."**
- Live tracking: client measures rest between consecutive set completions and attributes it to the set just completed → every set gets a real value (fixes the current off-by-one + first-set placeholder). **Only the single final set of the whole workout** falls back to planned/90.
- Past-tracking & history edits (no live timer): fall back to planned/90.
- Create/overwrite template & overwrite blueprint copy per-set `rest` verbatim (templates now have a rest column). Manual template/blueprint creation: no rest input → default 90.

### 3.6 Cycles & blueprint propagation
- **Blueprint is the single source of truth** for the weekly suggestion — structure **and** values **and** rest, verbatim. `getSuggestedWorkout` collapses to "return the blueprint" (no history merge; fewer Pi queries). *(Supersedes the earlier dual-source idea.)*
- **Progression is explicit**, via "overwrite blueprint" (replaces the whole blueprint tree, transactionally, home-gym-gated), **defaulting ON** for cycle workouts.
- **"Next workout" = rotation/sequence-based** (canonical); weekday becomes a *date hint*, not a gate. Add an explicit **`order` field on `WorkoutDay`** to define the rotation. Engine + dashboard unify on one "next workout" service.
- One active cycle at a time; wizard posts the whole tree; `autoCompleteExpiredCycles` moved off write-on-read to an explicit/idempotent trigger.

### 3.7 Exercises
- **12 fine muscles are the canonical set.** `MuscleGroup` enum reduces to exactly those 12; coarse `BACK/LEGS/ABS` retired.
- **Distribution (12 typed percent columns, sum-to-100, auto-100-on-primary) is the single source of truth.** Drop the standalone `muscleGroup` column; derive "primary" = max-percent muscle.
- **All analytics filter through the distribution**; **filters expose all 12 fine muscles** (1:1 with the distribution chart) → no coarse mapping to maintain.
- Backfill zero-distribution rows via the existing coarse→fine default map (`BACK→latissimus`, `LEGS→quadriceps`, `ABS→abdomen`, …).
- System/custom + soft-delete kept; fold-in fixes: `findById`/name-check respect `deletedAt`; own-object errors → 404; `sum-to-100` may move to a class-validator decorator.

### 3.8 Users & home-gyms
- **Soft-delete gyms** (`HomeGym.deletedAt`, mirrors Exercise): hidden from new selection, preserved for history. Block soft-delete if the gym is the planned gym of an **active** cycle day; else allow and historical references keep resolving.
- ≥1 gym still required at signup. `HomeGym→Gym` rename optional/low-priority. `deleteHomeGym` also checks `plannedHomeGymId`. Change-password + email-uniqueness folded into the auth overhaul.

### 3.9 Analytics
- **One endpoint per metric** (9 `-by-cycle` twins removed), driven by a shared `AnalyticsFilterDto` + `loadWorkoutsForAnalytics(filter)` loader, with `scope = all | cycle | non-cycle` **and** optional `cycleId` (cycle-detail page → cycle-anchored weeks + `trainingDay`).
- **One volume primitive** (§4.5) everywhere; **muscle filtering unified** on the 12-muscle distribution across every metric.
- **Merge `duration` + `time-tracking`** into one duration metric.
- **PRs**: weight-only, **home-gym-only** (intentional — equipment varies across gyms; a weight-based record must be equipment-consistent). Unchanged.
- **RIR**: keep 0/1/2 buckets (intentional near-failure tracking); documented.
- Warmup handling standardized per metric (working-only for volume/reps/sets/rir/prs/intensity; duration is workout-level; rest-time = sets with recorded rest).

### 3.10 ORM → Intensity (kept, generalized — NOT dropped)
- The ORM% metric **survives**, reborn as a cross-exercise **Intensity %** = `3000 / (30 + reps + RIR)` per working set (averaged). Weight algebraically cancels — **by design**: it makes intensity comparable across exercises (Bench 100×8@0 and Fly 50×8@0 both read ~78.9%). Load/strength magnitude is covered by **volume**.
- **Available for all workouts and all gyms** (weight-independent → equipment variance is irrelevant, which is *why* it can be all-gyms, unlike PRs).
- **Removed** (only these): the `ExerciseBenchmark` table + benchmark-setting machinery (intensity needs no benchmark), and the separate `/analytics/1rm/:exerciseId` absolute-e1RM **trend** endpoint. The latent `getORMByCycle` filter bug + `getBenchmark` N+1 dissolve with the deleted code.

### 3.11 Dashboard
- Keeps its endpoint grouping but **delegates to shared primitives** — the canonical volume primitive (fixes the bug), one cycle-week/progress function (canonical `floor(diffDays/7)+1`, capped at duration), the one rotation-based "next workout" service. The 7-day-vs-previous-7 stat rebuilt on the shared loader.

### 3.12 Scope & tooling
- **Full-stack, clean break, coordinated deploy.** No API versioning / compatibility shim (single app, both sides controlled). PRs ship backend+frontend pairs.
- **pnpm migration: out of scope** (parked with major bumps as future work).
- Major bumps (Prisma 6→7, TS 5→6) deferred to separate post-refactor PRs. Non-breaking `npm audit fix` + patch bumps land in PR 0.

---

## 4. Concrete improvements with reasoning

### 4.1 Unify the three hierarchies → one `Workout(kind)` + one set-value model
**Why:** the three trees are the same shape with drifting field names; every copy path (save-as-template, create-from-blueprint, overwrite-blueprint) is bespoke and inconsistent, and templates can't even store rest. One model + one shared copy primitive kills the duplication, gives templates rest for free, and makes create/overwrite of template/blueprint/workout a single operation. Respects immutable history because kinds are separate rows.

### 4.2 Drop target/actual duplication
**Why:** verified that no analytics reads `target*`; only `actualRestDuration` is consumed, and it maps cleanly onto the single `rest` field. Removing the dual columns is a pure simplification with no analytical loss.

### 4.3 Client-side logging + one transactional save
**Why:** matches the "save only when complete" invariant, removes ~8 chatty endpoints and the entire `start→complete` lifecycle, makes the final save atomic, and lets side-effects (overwrite blueprint/template) run in the same transaction. No durability regression (no crash-resume exists today).

### 4.4 Analytics consolidation
**Why:** the `-by-cycle` twins are accidental clones (the only differences are `where:{cycleId}`, cycle-anchored weeks, and a `trainingDay` index — all parameterizable, as `volume` already proves). Halving the endpoints + a shared loader/filter removes the largest single source of duplication and fixes the cross-chart muscle-filter inconsistency.

### 4.5 One volume primitive (there are ~5 today)
| Site | Issue |
|---|---|
| `analytics.getVolumeAnalytics:332` | canonical (distributed) |
| `analytics.getMuscleDistribution:671` | duplicate of the above |
| `workout-cycles.getCycleDetails:470` | same math, different code |
| `workouts.findAll:84` | same math, different code |
| `dashboard.calculateTotalVolume:142` | **BUG**: reads non-existent `set.isUnilateral` (→ always ×1), ignores `isDoubleWeight`, includes warmups |

**Target primitive:**
```ts
setWorkingVolume(set, ex) = set.setType === 'WORKING'
  ? set.reps * set.weight * (ex.isUnilateral ? 2 : 1) * (ex.isDoubleWeight ? 2 : 1)
  : 0
distributeAcrossMuscles(volume, ex)   // splits by the 12 %-columns
```
Every site calls `setWorkingVolume`; analytics additionally distributes. Fixes the dashboard bug for free.

### 4.6 Intensity metric (weight-independent)
**Why:** `3000/(30+reps+rir)` is comparable across exercises with different load ranges — the original point of "%ORM". It needs no benchmark, so it works for all workouts/gyms and lets us delete the whole `ExerciseBenchmark` mechanism.

### 4.7 Blueprint = single source of truth
**Why:** the dual-source model (structure from blueprint, numbers from history) was internally inconsistent and made blueprint numbers dead weight. Single-source is predictable, simplifies the engine, and makes "overwrite blueprint" (default ON) the clear progression control.

### 4.8 Muscle model: distribution as SoT
**Why:** two representations that can drift and are filtered inconsistently across charts. Collapsing to the 12-muscle distribution (primary = max-percent) removes drift and makes every chart consistent.

### 4.9 Security hardening
**Why:** multi-user + internet-exposed makes bcrypt-10/7d-localStorage-token/no-throttler/no-helmet genuinely risky, and the BOLA holes are exploitable today. argon2id + refresh-cookie + throttler + helmet + env-validation + BOLA scoping bring it to a defensible baseline.

---

## 5. Step-by-step plan & PR breakdown

> Ordering principle: security first where cheap; the destructive model change as one coherent (sub-sliced) unit with BOLA folded in; analytics last (it depends on the settled schema). No major version bumps mixed into the structural work. Extract pure logic into DB-free functions as you go, so it's unit-testable.

### PR 0 — Foundations & low-risk hardening (backend)
- Establish **jest + ts-jest** harness (fix config; make the existing specs run); set up the unit-test layout.
- `@nestjs/config` **env-validation schema** (fail-fast on `JWT_SECRET` strength, `DATABASE_URL`).
- **`helmet`**, **`@nestjs/throttler`** (global + strict on auth routes), **prod CORS allowlist**, `trust proxy`.
- `npm audit fix` (non-breaking) + patch bumps (Nest 11.1.x, Prisma 6.19.3).
- Add DB-ping readiness to `/health`; set `connection_limit` on the pooled `DATABASE_URL`.
- **Risk:** low. **Deploy:** backend-only.

### PR 1 — Auth overhaul (backend + frontend)
- **argon2id** + **rehash-on-login** (detect `$2…` bcrypt → verify → rehash to argon2id).
- Short access token (~15m) + **DB-backed rotating refresh token** (`RefreshToken` model, reuse detection) in **httpOnly/Secure/SameSite** cookie; **CSRF**; `/logout`; multi-device revocation.
- **change-password** + email-uniqueness on change.
- Frontend: switch from `localStorage` Bearer to the cookie flow; fix the `'token'` vs `'access_token'` key mismatch.
- Unit-test hashing/token/rehash logic.
- **Risk:** medium (full-stack auth). **Deploy note:** invalidates existing tokens → all users re-login.

### PR 2 — Unified data-model core + BOLA (backend + frontend; sub-sliced)
- **2a — Schema & migrations (SQL backfills embedded):** unified `Workout(kind)` + single set-value model + `WorkoutDay.order`; `RefreshToken` already added in PR1; drop `target*`/`customPlannedSets`; add `rest` to the unified set (templates gain rest); **distribution as SoT** (drop `muscleGroup` column, backfill primary from the coarse→fine map, reduce enum to 12); **drop `ExerciseBenchmark`**; `HomeGym.deletedAt`. Data migration: move blueprint/template/workout rows into the unified table with FK remapping (INSERT…SELECT).
- **2b — Services/DTOs:** the **shared copy primitive**; the **transactional save-workout + side-effect flags**; remove the per-set lifecycle endpoints; blueprint **single-source** propagation; **rotation** next-workout service (shared by engine + dashboard); soft-delete gyms; `autoCompleteExpiredCycles` off write-on-read; move `sum-to-100` to a validator.
- **2c — BOLA pass:** full endpoint audit; scope every read/mutation to `userId`; own-object guards → **404**; the auto-detect overwrite-target server guard. **Closes the IDOR exposure.**
- **2d — Frontend cutover:** client-side workout state machine (build locally, rest attribution incl. "rest-after / last-set→90", save-once + side-effect flags); unified types; overwrite-template UX (auto-detect + confirm); remove per-set calls.
- Unit tests: rest attribution, propagation selection, copy-primitive shape, primary-muscle derivation.
- **Risk:** high (destructive migration + client rewrite). **Deploy:** the big one.

### PR 3 — Analytics + dashboard consolidation (backend + frontend)
- Shared `AnalyticsFilterDto` + `loadWorkoutsForAnalytics`; one endpoint per metric + `scope` + optional `cycleId`; **one volume primitive** everywhere; muscle-filter on distribution; **merge duration + time-tracking**; **ORM% → Intensity** (all gyms/workouts); PRs weight-only/home-gym; RIR 0/1/2; retire `/1rm` trend; dashboard delegates to shared primitives + rotation next-workout; fix the timezone mix (choose one basis — recommend a single configured app timezone for bucketing).
- Unit tests: intensity, volume, `aggregateByWeek`/cycle-week, 1RM/PR.
- **Risk:** medium (read-path, but broad).

### Later / separate (not part of this refactor)
- **Prisma 6 → 7** (own PR), **TS 5 → 6** (own PR), **npm→pnpm migration** (own PR). Each in isolation so regressions are attributable.

### Out of scope (future session)
- Pi resilience: SD vs SSD, backup/restore hardening, SPOF.

---

## 6. Testing strategy

**Scope (user decision): unit tests only; everything else is manual.**

- Establish a working **jest + ts-jest** harness (PR 0).
- **Unit-test the extracted pure logic** (design the refactor to make these DB-free functions): `setWorkingVolume` + `distributeAcrossMuscles`, intensity `3000/(30+reps+rir)`, 1RM/PR calc, `aggregateByWeek` + cycle-week, rotation/next-workout selection, rest-attribution, primary-muscle derivation, argon2id hash/verify/rehash.
- **No** integration/E2E/frontend test tooling/CI gating — verified manually by the developer.
- **Manual-testing priority (highest risk):** the **client-side workout state machine** (build-locally, rest attribution, save-once + side-effect flags) — it's newly load-bearing and untested. Also: auth cookie/refresh/CSRF flow, the transactional save + overwrite paths, and analytics parity after the schema change.

---

## 7. Pi deployment & rollback strategy

**Context:** Pi 5 / Docker / Cloudflare Tunnel (DB not exposed). Prisma `migrate deploy` auto-runs in-container. Forward-only migrations (no down-migrations). `backup.sh`/`restore.sh` + daily cron exist. This refactor is **high-risk**: destructive schema changes + backfills, an auth cutover that invalidates all tokens, and a big-bang rollout.

**Rollout: single big-bang, manual (Option B), after PR 0–3 merge to main.**

**Backfills:** written as **SQL embedded in the Prisma migrations** → atomic with the schema change, auto-applied by `migrate deploy`, no SSH tunnel / `ts-node`, and fully exercised by the dry-run. Tunnel-run compiled script only as a fallback for any transform too complex for SQL.

**Procedure:**
1. **Pre-checks (Mac):** `npm run build` for **both** frontend and backend (TS errors surface only on prod build); git clean & on `main`.
2. **Dry-run rehearsal:** `pg_dump` prod → restore into a scratch DB → run the full migration+backfill → boot the app → run the smoke checklist. **Do not proceed unless this passes.**
3. **Backup:** verified `pg_dump` stored **off-device**; **tag the current prod image** for rollback.
4. **Deploy:** `git pull` → `docker compose -f docker-compose.prod.yml build` → `up -d` → `migrate deploy` (runs schema + SQL backfills atomically) → health check.
5. **Smoke (prod):** login/register, run + save a workout, overwrite a blueprint, save-as-template, start-from-template + overwrite, analytics render, `/api/health`, container logs clean.
6. **Communicate:** low-usage window; **all users must re-login** (token/cookie cutover).

**Rollback runbook (forward-only migrations):**
- Stop containers → **restore the pre-deploy `pg_dump`** → **redeploy the previously tagged image** → verify health + login. (There is no un-migrate; recovery = restore + previous release.)

---

## 8. Open flags / deferred

- **Volume equipment-sensitivity:** PRs are home-gym-only because weight-based records need equipment consistency; **volume** is equipment-sensitive too but currently defaults to all gyms. Decide whether volume should bias/filter to home-gym like PRs. *(Flagged; no decision taken.)*
- **Timezone:** pick a single basis for date bucketing (recommend one configured app timezone) — addressed in PR 3.
- **`HomeGym → Gym` rename:** optional clarity, low priority.
- **Deferred work:** Prisma 7, TS 6, pnpm (separate PRs); Pi resilience/backups/SSD (future session).

---

## 9. Progress log

> Updated as each PR lands. Not committed automatically — status reflects the working tree at time of writing.

### PR 0 — Foundations & low-risk hardening — ✅ done (2026-07-03)

- **Jest + ts-jest harness fixed.** Root cause: no `jest` config existed, so Jest fell back to defaults, picked up stale compiled specs under `dist/` and couldn't parse `.ts` at all. Added the standard Nest jest block (`rootDir: src`, ts-jest transform) to `apps/backend/package.json`. Fixed two pre-existing bad expected-values in `orm.service.spec.ts` (hand-rounded comment math didn't match the actual Epley-formula result — test bug, not a code bug). Removed the dead `test:e2e` script (pointed at a `test/` dir that doesn't exist; out of scope per §6 anyway). **15/15 tests pass.**
- **Env-validation schema.** New `apps/backend/src/config/env.validation.ts` (class-validator, no new dependency), wired via `ConfigModule.forRoot({ validate })`. Fails fast on missing/malformed `DATABASE_URL`, `JWT_SECRET` < 32 chars, or a JWT_SECRET matching a known placeholder (e.g. the literal value shipped in `.env.example`). Verified against the real `.env.local` and against synthetic bad configs.
- **helmet + throttler + CORS + trust proxy.** `helmet()` on all responses. `@nestjs/throttler`: global default 100 req/min, `/auth/login` + `/auth/register` overridden to 5 req/min (verified live: 6th rapid login attempt → 429). CORS now branches on `NODE_ENV`: production uses a strict `CORS_ORIGIN` allowlist only (throws at boot if unset), dev keeps the existing LAN-friendly behavior unchanged. `trust proxy` set to `1` (Cloudflare Tunnel connects to the container over localhost; the real client IP arrives via the edge's `X-Forwarded-For`).
- **npm audit fix + patch bumps.** `@nestjs/core`/`common`/`platform-express` 11.1.17→11.1.27, `@nestjs/cli` 11.0.16→11.0.23, Prisma 6.19.2→6.19.3. Vulnerabilities 26→2 (workspace-wide `npm audit`); the remaining 2 are Next.js/postcss on the frontend needing a major Next bump (`--force`), correctly deferred (§3.12, §5 "Later/separate"). Had to add a root-level `overrides.multer: 2.2.0` (nested exact-pinned by `@nestjs/platform-express@11.1.27` at `2.1.1`) and fully regenerate `package-lock.json` — npm doesn't retroactively apply new `overrides` entries to an existing lockfile via a plain `npm install`. Confirmed the app has no multipart/file-upload endpoints, so the multer CVEs were unreachable anyway; fixed for hygiene. Both backend and frontend build clean afterward.
- **DB-ping health + connection_limit.** `/api/health` now runs `SELECT 1` and returns 503 (`ServiceUnavailableException`) when the DB is unreachable, instead of always returning 200. Verified live by stopping/restarting the dev DB container. Added explicit `connection_limit=10` to `DATABASE_URL` in both prod compose files (`docker-compose.prod.yml`, `docker-compose.prod.alternative-ports.yml`) and documented it in `apps/backend/.env.example`.
- **Post-PR0 smoke test:** both dev servers started clean, backend/frontend CORS preflight succeeds, `/api/health` reports `database: connected`.
- **Not part of PR 0, noted in passing:** `.claude/skills/refactoring/SKILL.md` shows as deleted in the working tree; not caused by this work — flagged to the user, left untouched.

### PR 1 — Auth overhaul — ✅ done (2026-07-03)

- **argon2id + rehash-on-login.** New `PasswordService` (`apps/backend/src/auth/password.service.ts`): OWASP-floor params (`m=19MiB, t=2, p=1`), ~24ms/hash on the dev Mac (Pi 5 expected slower but well under 200ms). `verify()` detects a `$2[aby]$` bcrypt prefix and falls back to `bcrypt.compare`; on a successful legacy-bcrypt login, `AuthService.login` transparently rehashes to argon2id and persists it. Verified live end-to-end: manually seeded a bcrypt-hash user, logged in, confirmed the stored hash flipped from `$2b$10$...` to `$argon2id$v=...`. 7 unit tests.
- **DB-backed rotating refresh tokens.** New `RefreshToken` model (migration `20260703122930_add_refresh_token`, purely additive — new table + back-relation only, no backfill needed). `RefreshTokenService` issues an opaque 32-byte token, stores only its SHA-256 hash, and rotates it on every `/auth/refresh` call inside a `$transaction` (revoke old + create new atomically). **Reuse detection:** presenting an already-rotated token revokes the user's *entire* token family, not just that token — verified live (replaying an old rotated-out token → 401, and the legitimate just-issued token is also dead afterward, forcing full re-login). Access token dropped from 7d → 15m; session longevity now lives in the 30-day refresh token instead.
- **Cookie-based auth (frozen frontend reopened, as flagged in §3.1).** `access_token`, `refresh_token` (path-scoped to `/api/auth` only), and a non-httpOnly `csrf_token` are all set as `httpOnly`/`Secure` (prod)/`SameSite=Lax` cookies from `AuthController`. `JwtStrategy` now extracts the JWT from the `access_token` cookie instead of an `Authorization` header. `/auth/refresh` and `/auth/logout` (idempotent, no guard needed) added; `access_token` body field dropped from every auth response (never exposed to JS).
- **CSRF protection (double-submit cookie).** New global `CsrfMiddleware`, exempting only `/auth/login`, `/auth/register`, `/auth/refresh` (session-establishing or already protected by the httpOnly refresh cookie itself). Hit one non-obvious NestJS gotcha: `req.path` inside module-level middleware is relative to the global-prefix mount point (`/`, not `/api/auth/login`) — matching had to use `req.originalUrl` instead. Verified live: mutating request with no/wrong CSRF header → 403, matching header → 200, safe methods (GET) and the three exempt auth routes pass without one. 9 unit tests.
- **change-password + email-uniqueness.** `POST /auth/change-password` (guarded, verifies current password, argon2id-hashes the new one) — **design decision:** revokes *every* refresh token for the user, including the current session, forcing re-login everywhere after a credential change (simpler and more defensible than trying to special-case "keep this session alive"). `UsersService.updateUser` now rejects an `email` change that collides with another user's (409), previously unchecked per §2.7/§3.1. Both verified live (wrong current password → 401; correct → 204 + old password stops working + new one works; email collision → 409; re-submitting your own current email is not a false positive).
- **Frontend cookie-flow cutover.** `apiClient` (`lib/api/client.ts`): dropped all `localStorage` token methods, every request now sends `credentials: 'include'`, mutating requests echo the `csrf_token` cookie back as `X-CSRF-Token`, and a 401 on any non-`/auth/*` call triggers one silent `POST /auth/refresh` + retry before falling back to a `/login` redirect (`/auth/*` calls themselves never redirect-loop). `auth-context.tsx`'s bootstrap check (`checkAuth()`) never redirects on a fresh/anonymous visit. **Fixed the documented `workout-context.tsx:262` bug** (`localStorage.getItem('token')` — wrong key, always null) — it now gates on `useAuth().user`.
- **Scope addition (user request, not in the original PR1 plan text):** profile page gained an editable email field and a "Passwort ändern" dialog (shadcn `Card`/`Dialog`/`Field`, matching existing profile-page patterns), since the change-password/email-uniqueness endpoints would otherwise have shipped with no UI. Password change redirects to `/login` after success (every session was just revoked server-side).
- **Found via manual testing, not a regression:** fixing the `workout-context.tsx` token bug means `refreshActiveWorkout()` now actually runs (previously always a no-op for *every* user, silently, the whole time). It surfaced 9 genuinely abandoned `IN_PROGRESS` workouts on the user's own dev account going back to May, which correctly hid the nav per its existing "hide nav during an active workout" logic. Not a bug — cleaned up via a one-off `DISCARDED` status flip mirroring `WorkoutsService.discard`, and now correctly a non-issue. **Flagged for PR 2:** since logging moves fully client-side and the server-side `IN_PROGRESS` status disappears entirely (§3.3), this whole class of stale-state issue goes away on its own — no fix needed beyond the schema change already planned.
- **Testing:** 40 backend unit tests total (up from 15 after PR 0) — `PasswordService`, `token.util` (opaque-token generation/hashing/timing-safe compare), `CsrfMiddleware`. Manually verified per §6's "highest risk" list: full cookie/refresh/CSRF flow, change-password, email-uniqueness. Both apps typecheck and build clean.
- **Deploy note (per §5):** this invalidates all existing sessions — confirmed by design (access token 7d→15m, refresh tokens didn't exist before). All users re-login after this ships to prod, as flagged in the original plan.

### PR 2 — Unified data-model core + BOLA — ✅ done (2026-07-05)

**2a — Schema & migration:** done. Before writing any SQL, spawned a research pass to map the *exact* current implementation (file:line references) so the migration wouldn't miss behavior — it confirmed every gap the plan called out by inspection (the `deleteSet`/`removeExercise`/`updateCompletedWorkout` BOLA holes, the dual-source blueprint propagation reading numbers from history, the `dashboard.calculateTotalVolume` bug reading a nonexistent `set.isUnilateral`, three divergent cycle-week formulas, and the ~14-site muscleGroup-enum vs. 2-site percent-distribution filter split).

Four design decisions were confirmed with the user before touching the DB:
- `Workout.status`/`WorkoutStatus` enum **dropped entirely** (not just collapsed) — a `Workout(kind=WORKOUT)` row's existence now means "complete"; no server-side draft state.
- `ExerciseBenchmark` **dropped now** (schema-level), even though the ORM%→Intensity metric rewrite itself is PR 3 work — the analytics page loses its ORM chart for the duration of PR 2 (dev-only gap; both PRs land on `main` before any prod deploy per §7).
- Own-object authorization errors (403→404 per §3.1) are being fixed **as part of 2a/2b**, not deferred to 2c, since the same modules are being rewritten anyway.
- Migration written and applied directly to the local dev DB (not prod) after a rehearsal pass.

**New unified schema:** one `Workout` model discriminated by `kind: BLUEPRINT | TEMPLATE | WORKOUT`, sharing `WorkoutExercise(order)` → `WorkoutSet(order, setType, reps, weight, rir, rest, completedAt)`. Kind-specific fields are nullable (`date`/`totalDuration`/`isFreeWorkout`/`cycleId` for WORKOUT; `name`/`isCustom` for TEMPLATE; blueprint reuses `workoutDayId` with a **partial unique index** — `WHERE kind='BLUEPRINT'` — enforcing the 1:1, since kind=WORKOUT rows may share a `workoutDayId` across many performed sessions but a blueprint may not). `Workout.homeGymId` now does double duty as "performed-at gym" (WORKOUT) and "recommended gym" (TEMPLATE, replacing `WorkoutTemplate.recommendedGymId`). Added `originTemplateId` (self-relation) so a performed workout records which template it was started from, driving the "overwrite template" auto-detect UX in 2b/2d. `WorkoutDay.order` added (rotation position for the canonical next-workout service, §3.6) and backfilled from the existing implicit weekday-ascending order. `HomeGym.deletedAt` added (soft-delete, §3.8). `Exercise.muscleGroup` column and the `MuscleGroup` enum **dropped entirely** — the 12-column percent distribution is now the only source of truth, with "primary muscle" becoming a derived (max-percent) value computed in application code rather than stored; also dropped the orphaned, already-unused `GymLocation` enum found along the way.

**Migration** (`20260705133757_unify_workout_model`): single Prisma migration, SQL backfill embedded per §7. Sequencing required care — e.g. `status` had to be dropped *before* inserting the folded-in BLUEPRINT/TEMPLATE rows (they have no value for it), and `ExerciseBenchmark`'s FK to `Workout` had to be dropped before deleting abandoned workout sessions. IDs are preserved across old→new tables (`WorkoutBlueprint.id`→`Workout.id`, `WorkoutTemplate.id`→`Workout.id`, `BlueprintExercise`/`WorkoutTemplateExercise`/`ExerciseLog.id`→`WorkoutExercise.id`, etc.), so existing foreign keys (e.g. `Workout.templateId`→`originTemplateId`) remap for free with no lookup table.

**Data-migration decisions:** only `COMPLETED` workouts (52 of 121) migrate into new `WORKOUT` rows; the 67 `DISCARDED` + 2 `IN_PROGRESS` rows are deleted along with their exercise/set logs (cascade), since the new model has no server-side draft/in-progress concept and these never represented real history. Set `order`/`setNumber` values are **re-derived via `ROW_NUMBER()`** rather than copied verbatim — rehearsing the migration against a scratch clone of the dev DB (via `CREATE DATABASE ... TEMPLATE`) caught a genuine pre-existing data bug: one blueprint had two sets sharing `order=4` (the old model never enforced set-order uniqueness for blueprints in the database, despite `SetLog`'s declared `@@unique` constraint also turning out to be silently absent from the live DB). Re-deriving order from `(legacy order/setNumber, id)` as the sort key preserves relative ordering while guaranteeing the new `@@unique([workoutExerciseId, order])` constraint can never fail on legacy data, in dev or at the eventual prod migration.

**Verification:** rehearsed the full migration against a scratch DB clone first (caught the above bug), fixed it, re-rehearsed clean, then applied to the real dev DB. Post-migration counts verified: 12 BLUEPRINT + 52 WORKOUT + 19 TEMPLATE = 83 `Workout` rows, 513 `WorkoutExercise`, 1470 `WorkoutSet`, 0 orphaned `originTemplateId` references, `WorkoutDay.order` backfilled correctly per cycle, all 9 legacy tables (`WorkoutBlueprint`, `BlueprintExercise`, `BlueprintSet`, `WorkoutTemplate`, `WorkoutTemplateExercise`, `WorkoutTemplateSet`, `ExerciseLog`, `SetLog`, `ExerciseBenchmark`) confirmed dropped, `muscleGroup` column/enum confirmed dropped. `prisma generate` regenerated the client.

**2b — Services/DTOs:** done. Full rewrite of every module touching the unified model:
- **Shared copy primitive** (`WorkoutTreeService.replaceTree`, in its own `workout-tree` module to avoid cross-module coupling): the one place that writes an exercise/set tree into any `Workout` row — used by cycle/blueprint creation, template create/update, and the workouts save endpoint.
- **Exercises**: `MuscleGroup` is now an app-level enum (`common/muscle.util.ts`) derived from the percent distribution — no stored column; "primary muscle" is computed, not persisted. `findById` now respects `deletedAt` (previously a soft-deleted exercise stayed fetchable directly by id — a real pre-existing bug, fixed in passing since §3.7 explicitly calls it out).
- **Cycles/blueprints**: cycle creation posts the whole tree in one `$transaction`; `WorkoutDay.order` (backfilled from weekday-ascending) drives rotation; `autoCompleteExpiredCycles` moved off write-on-read onto an hourly `@nestjs/schedule` cron sweep (`ScheduleModule` added to `AppModule`) — explicit and idempotent instead of a side-effect hidden inside GET handlers.
- **Templates**: `createFromBlueprint`/`createFromWorkout` removed (superseded by save-time flags, §3.4); added the `overwrite` capability that didn't exist before. A supplementary migration (`20260705140745_template_name_unique_per_user`) restores the per-user template-name-uniqueness guarantee that silently disappeared when `WorkoutTemplate` folded into `Workout` — a partial unique index (`WHERE kind='TEMPLATE'`) since Prisma's schema DSL can't express that directly.
- **Workouts**: the ~17 per-set lifecycle endpoints (`start`/`logSet`/`updateSet`/`deleteSet`/`addExercise`/`removeExercise`/`reorder`/`replaceExercise`/`complete`/`discard`/`start-from-template`) are gone, replaced by one transactional `create`/`update` taking the client-built tree plus `overwriteBlueprint`/`saveAsTemplateMode` flags, validated against the §3.4 availability matrix with every referenced id (`homeGymId`/`workoutDayId`/`originTemplateId`/`overwriteTemplateId`) re-verified against `userId` server-side rather than trusted from the client. Added a real `DELETE /workouts/:id` (didn't exist before — historically only `discard`, a status flip, existed).
- **Next-workout**: one rotation-based `WorkoutEngineService`, shared by `/workouts/suggested` and the dashboard, replacing the old weekday-gated engine and the dashboard's independent sequence algorithm. Blueprint is now the single source of truth for the suggestion (structure, values, and rest, verbatim — no more merging in numbers from the last completed session, per §3.6/§4.7).
- **Volume**: one `setWorkingVolume` primitive (`common/utils/volume.util.ts`) used by cycle details, workout list, and dashboard — fixes the dashboard bug described in §4.5 (it read a nonexistent `set.isUnilateral`, never applied `isDoubleWeight`, and never excluded warmups).
- **HomeGym**: soft-delete (`deletedAt`), blocked only when still planned for an active cycle day (§3.8) — used gyms in *past* workouts remain deletable, since immutable history doesn't depend on the gym record still being "active."
- **Analytics/ORM**: `ExerciseBenchmark` + the `/analytics/1rm/:exerciseId`, `/analytics/orm/:cycleId/:workoutDayId`, `/analytics/orm-by-cycle/:cycleId` endpoints removed entirely (the `orm/` module is deleted) — the Intensity replacement metric is PR 3 work, so the analytics page loses this one chart until then, as agreed in 2a. The other 15 endpoints were mechanically adapted (not consolidated — that's still PR 3): `status: 'COMPLETED'` → `kind: 'WORKOUT'`, `actualRestDuration` → `rest`, and every `exercise.muscleGroup` filter/select site converted to derive primary muscle from the percent columns via `derivePrimaryMuscle`.
- A stray, unrelated `analytics.service.ts.bak2` file (dated well before this session) was noticed in the analytics folder — left untouched, flagged here rather than deleted since it predates this work.

Verified: `tsc --noEmit` clean across the whole backend, all 33 existing unit tests pass (down from 40 — the 7 `orm.service.spec.ts` tests were removed along with the ORM module, expected), `nest build` succeeds.

**2c — BOLA audit pass:** done. Swept every service for Prisma lookups on the four "owned" resource types (`Workout`, `WorkoutCycle`, `WorkoutDay`, `HomeGym`) to confirm each is scoped to the authenticated `userId` and that non-owned-but-existing objects 404 rather than leak via 403/409. Found and fixed two real issues in code that predates this session (not introduced by 2b, but only fully exposed once the model was unified enough to audit systematically):
- **`analytics.getRepsByCycle` / `getSetsByCycle`** fetched the cycle by id alone (`workoutCycle.findUnique({ where: { id: cycleId } })`, no `userId`) and always returned `cycleName` in the response — a genuine IDOR: passing another user's `cycleId` would 200 instead of 404 and leak that cycle's name (the nested `workouts` relation was correctly scoped, so no set/rep numbers leaked, just existence + name). Fixed by switching to `findFirst({ where: { id: cycleId, userId } })`, matching the pattern already correct in the other five `-by-cycle` methods.
- **Exercise-reference validation gap**: `workouts.service.ts` (save endpoint) and `workout-cycles.service.ts` (cycle create, blueprint overwrite) didn't validate submitted `exerciseId`s at all; `workout-templates.service.ts` validated only *existence*, not *accessibility*. All three would silently accept another user's private custom exercise id, and since the tree response echoes back `exercise.name`, a user who somehow learned another user's private-exercise UUID could exfiltrate its name through their own workout/template/blueprint. Added `ExercisesService.validateAccessible(exerciseIds, userId)` (exists, not soft-deleted, and either a system exercise or owned by the caller) and wired it into all three write paths.

Both fixes verified: `tsc --noEmit` clean, all 33 tests still pass after each change.

**2d — Frontend cutover:** done. This is the piece the plan flagged as highest-risk (§6: "newly load-bearing and untested"), since the whole client-side workout state machine is new. Mapped the remaining frontend surface (active-workout-screen, exercise-card, timers, six modals, cycle wizard, template editor, history pages — ~20 files) via research pass before touching anything, since `ExerciseCard` turned out to be a single ~1000-line component reused everywhere (live workout, history view/edit, template editor, cycle wizard/blueprint editor) driven by `mode`/`allow*`/`readonly` props — the actual surface to get right.

- **Types + API client**: rewritten to match the new backend contract; every removed endpoint (`startWorkout`, `logSet`, `completeWorkout`, `discardWorkout`, ORM methods, etc.) gone from the client. Deliberately kept `ExerciseLog`/`SetLog`/`PlannedSet` as the client-side working shape (near-identical to the pre-PR2 shape, just renamed `restAfterSet`/`actualRestDuration` → `rest` and dropped `target*`) rather than forcing 1:1 alignment with the new backend wire shape (`WorkoutExercise`/`WorkoutSet`, which uses `order` not `setNumber` and has no `plannedSets` concept) — this kept `ExerciseCard`'s already-complex swipe/logging/editing logic almost entirely untouched. The wire↔client conversion happens at exactly two boundary points (`workout-context`'s `loadWorkoutForEdit`, and the read-only history page), both explicitly documented since the `Workout` type technically doesn't describe the raw API response precisely there.
- **`workout-context.tsx`**: fully rewritten as a local-first draft builder (§3.3). No API calls during a workout — starting (from blueprint/template/free), logging/discarding/editing sets, add/remove/replace exercise, and reordering are all local state updates. The whole tree is submitted once via a new `createWorkout`/`updateWorkout` call with side-effect flags.
- **Rest attribution (§3.5)**: a completion log tracks real timestamps per logged set, globally across the whole workout (not per-exercise, matching how the old rest timer already worked across exercises). When a new set logs, the *previous* set gets its measured rest assigned (`now - previousCompletedAt`); the last set of a live session has no follow-up, so it's defaulted to its planned value (or 90) at save time. Past-tracking/history-edit skip this measurement path entirely and just write planned/90 directly at log-time, since there's no real elapsed time to measure when a user is backfilling a workout in one sitting — this fixes the plan's documented "off-by-one + first-set placeholder" by construction rather than patching the old timer logic.
- **Crash-resume**: the in-progress draft (not just the timer timestamps, which already persisted) now also persists to `localStorage`, so a refresh mid-workout doesn't lose logged progress — matching the plan's "no durability regression" bar (§4.3) without a server-side draft table.
- **Overwrite-template UX (§3.4, didn't exist before)**: the complete-confirmation dialog now auto-detects the origin template (via `originTemplateId`/`originTemplateName`/`originTemplateIsCustom` carried on the draft from `startWorkoutFromTemplate`) and offers "overwrite '<name>'" only when the origin is a custom template (system templates correctly show only "save as new"), collected in the same dialog as the existing "overwrite blueprint" checkbox so both side-effect decisions land in one atomic save call — no more separate post-completion "name your template" step.
- **`exercise-card.tsx`**: kept almost entirely intact by design (see above) — only field renames and removing now-dead status-based branching (`activeWorkout.status === 'COMPLETED'`-style checks replaced by a single `isHistoryEdit` context flag, since `status` doesn't exist server-side anymore).
- Mechanical field renames across cycle wizard, blueprint editor (both the wizard step and the standalone `cycles/[id]/edit/[workoutDayId]` page, which duplicates similar logic independently), template editor, and all exercise-selection/muscle-filter call sites (`muscleGroup` → `primaryMuscle`).
- Removed the ORM chart UI from both the analytics page and cycle-detail page (2 call sites each) — backing endpoints are gone; returns as "Intensity" in PR 3.
- **Bugs found and fixed along the way** (pre-existing, exposed rather than caused by this work):
  - `start-screen.tsx` rendered an identical "Workout-Details" dialog twice back-to-back — dead duplicate, removed.
  - `exercise-card.tsx`'s `renderLoggedExtraRow` (the render path for any set not matched to a `plannedSets` entry) never applied `readOnly`/`disabled` to its value inputs — only the "planned sets" row path did. Since the new history read-only view has no `plannedSets` at all (that concept doesn't exist in the wire format), *every* historical set now renders through this path, which suddenly made every value in every past workout look editable in read-only view (nothing actually persisted, since there's no save action there, but visually wrong and confusing). Fixed by respecting `isReadonly` in that render path too, closing the bug at the root rather than working around it.
  - `DELETE /workouts/:id` existed server-side (added in 2b, part of the new CRUD surface) but had no UI — added a delete button + confirmation dialog to the workout history detail page.
  - The template save/overwrite radio options rendered as native circular radio buttons, inconsistent with the rest of the app's square checkbox styling — switched from `type="radio"` to `type="checkbox"` (the three options are already fully controlled via `templateAction` state, so a checkbox with manual mutual exclusion behaves identically and renders square, matching the adjacent "overwrite blueprint" checkbox).

**Verification**: `tsc --noEmit` and `next build` both clean; manual pass through the app (start/log/save a live workout, cycle-day workout with overwrite-blueprint, template-started workout with the new overwrite-template UX, save-as-new-template, past-workout tracking, history view/edit/delete, cycle wizard creation, template creation/editing) confirmed working, including the three fixes above found during that pass.

### PR 3 — Analytics + dashboard consolidation — not started
