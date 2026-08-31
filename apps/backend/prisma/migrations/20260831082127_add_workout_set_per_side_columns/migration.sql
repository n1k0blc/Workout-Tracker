-- Add six nullable per-side columns to WorkoutSet (issue #65 / #97): repsLeft, repsRight,
-- weightLeft, weightRight, rirLeft, rirRight.
--
-- This is the expand step. `isUnilateral` stops being an `×2` volume multiplier and becomes
-- a set shape: a unilateral set has two sides that can differ. `reps` / `weight` / `rir`
-- stay on the row, redefined as server-derived aggregates over the two sides. Nothing reads
-- or writes the per-side columns meaningfully yet -- later tickets build on this.
--
-- Backfill: every pre-existing set whose exercise has isUnilateral = true gets
-- L = R = the value already stored, for reps, weight and rir alike (rir may be null, in
-- which case both sides stay null). WorkoutSet does not carry `kind`, so a single join
-- reaches sets of every workout kind at once -- performed workouts, templates and
-- blueprints all share this table and all need per-side data.
--
-- The backfill is symmetric by construction, so no historical metric moves:
--   volume  (reps×w)+(reps×w) == today's reps×w×2
--   reps    round(avg(reps, reps)) == reps
--   weight  avg(w, w) == w
--   rir     min(rir, rir) == rir
--   PRs / set counts unchanged
--
-- Sets of bilateral exercises are left untouched: all six columns stay null.
--
-- Reversibility: fully reversible. `ALTER TABLE "WorkoutSet" DROP COLUMN "repsLeft", ...`
-- restores the prior shape with no loss -- the backfilled values are a symmetric copy of
-- reps/weight/rir and carry no information that is not still on those columns.

-- AlterTable
ALTER TABLE "WorkoutSet" ADD COLUMN     "repsLeft" INTEGER,
ADD COLUMN     "repsRight" INTEGER,
ADD COLUMN     "rirLeft" INTEGER,
ADD COLUMN     "rirRight" INTEGER,
ADD COLUMN     "weightLeft" DOUBLE PRECISION,
ADD COLUMN     "weightRight" DOUBLE PRECISION;

-- Backfill unilateral sets: L = R = the pre-existing aggregate.
UPDATE "WorkoutSet" s
SET "repsLeft"    = s."reps",
    "repsRight"   = s."reps",
    "weightLeft"  = s."weight",
    "weightRight" = s."weight",
    "rirLeft"     = s."rir",
    "rirRight"    = s."rir"
FROM "WorkoutExercise" we
JOIN "Exercise" e ON e."id" = we."exerciseId"
WHERE s."workoutExerciseId" = we."id"
  AND e."isUnilateral" = true;
