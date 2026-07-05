-- ============================================================================
-- PR2a: Unify data model into one Workout(kind) + WorkoutExercise + WorkoutSet tree.
--
-- Replaces WorkoutBlueprint/BlueprintExercise/BlueprintSet,
-- WorkoutTemplate/WorkoutTemplateExercise/WorkoutTemplateSet, and
-- Workout/ExerciseLog/SetLog with one unified hierarchy discriminated by "kind".
-- Also: drops ExerciseBenchmark (ORM/Intensity rework lands in PR3), collapses
-- Exercise.muscleGroup into the percent-distribution (single source of truth),
-- adds WorkoutDay.order (rotation position) and HomeGym.deletedAt (soft-delete).
--
-- Data-migration notes:
--  * Only COMPLETED workouts are migrated into the new WORKOUT rows. IN_PROGRESS/
--    DISCARDED rows are deleted along with their exercise/set logs, since the new
--    model has no server-side draft/in-progress concept (logging is fully client-side).
--  * IDs are preserved across old -> new tables (WorkoutBlueprint.id -> Workout.id,
--    WorkoutTemplate.id -> Workout.id, BlueprintExercise/WorkoutTemplateExercise/
--    ExerciseLog.id -> WorkoutExercise.id, etc.) so existing foreign keys (e.g.
--    Workout.templateId) remap for free without a lookup table.
-- ============================================================================

-- 1. New enum for the discriminator.
CREATE TYPE "WorkoutKind" AS ENUM ('BLUEPRINT', 'TEMPLATE', 'WORKOUT');

-- 2. Drop ExerciseBenchmark first (removes the FK to Workout that would otherwise
--    block deleting non-completed workouts below; the ORM/benchmark mechanism is
--    retired per plan §3.10 -- Intensity replaces it in PR3).
ALTER TABLE "ExerciseBenchmark" DROP CONSTRAINT "ExerciseBenchmark_cycleId_fkey";
ALTER TABLE "ExerciseBenchmark" DROP CONSTRAINT "ExerciseBenchmark_exerciseId_fkey";
ALTER TABLE "ExerciseBenchmark" DROP CONSTRAINT "ExerciseBenchmark_setAtWorkoutId_fkey";
ALTER TABLE "ExerciseBenchmark" DROP CONSTRAINT "ExerciseBenchmark_workoutDayId_fkey";
DROP TABLE "ExerciseBenchmark";

-- 3. Delete abandoned (never-completed) workout sessions -- the new model has no
--    server-side IN_PROGRESS/DISCARDED state, and these never represent real history.
--    Cascades to ExerciseLog/SetLog automatically (onDelete: Cascade on both FKs).
DELETE FROM "Workout" WHERE status != 'COMPLETED';

-- 4. status is no longer needed (surviving rows are all COMPLETED by construction).
--    Drop it now, before inserting the folded-in BLUEPRINT/TEMPLATE rows below, so
--    their inserts don't have to satisfy a NOT NULL status they have no value for.
ALTER TABLE "Workout" DROP COLUMN "status";
DROP TYPE "WorkoutStatus";

-- 5. Extend Workout with the new unified-model columns.
ALTER TABLE "Workout"
  ADD COLUMN "kind" "WorkoutKind",
  ADD COLUMN "name" TEXT,
  ADD COLUMN "isCustom" BOOLEAN,
  ADD COLUMN "originTemplateId" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  ALTER COLUMN "date" DROP NOT NULL,
  ALTER COLUMN "date" DROP DEFAULT,
  ALTER COLUMN "isFreeWorkout" DROP NOT NULL,
  ALTER COLUMN "isFreeWorkout" DROP DEFAULT,
  ALTER COLUMN "userId" DROP NOT NULL;

-- 6. Backfill: all surviving rows are performed workouts.
UPDATE "Workout" SET "kind" = 'WORKOUT' WHERE "kind" IS NULL;

-- 7. Fold WorkoutBlueprint rows into Workout as kind=BLUEPRINT, reusing their id
--    (userId derived via WorkoutDay -> WorkoutCycle, since blueprints had no direct
--    owner column before).
INSERT INTO "Workout" ("id", "kind", "userId", "workoutDayId", "createdAt", "updatedAt")
SELECT wb."id", 'BLUEPRINT', wc."userId", wb."workoutDayId", now(), wb."updatedAt"
FROM "WorkoutBlueprint" wb
JOIN "WorkoutDay" wd ON wd."id" = wb."workoutDayId"
JOIN "WorkoutCycle" wc ON wc."id" = wd."cycleId";

-- 8. Fold WorkoutTemplate rows into Workout as kind=TEMPLATE, reusing their id
--    (recommendedGymId -> homeGymId: the same field now doubles as "recommended gym").
INSERT INTO "Workout" ("id", "kind", "userId", "name", "isCustom", "homeGymId", "createdAt", "updatedAt")
SELECT "id", 'TEMPLATE', "userId", "name", "isCustom", "recommendedGymId", "createdAt", "createdAt"
FROM "WorkoutTemplate";

-- 9. Remap performed workouts' template origin (old templateId already points at
--    WorkoutTemplate.id, which step 8 just reused as Workout.id -- no lookup needed).
UPDATE "Workout" SET "originTemplateId" = "templateId"
WHERE "kind" = 'WORKOUT' AND "templateId" IS NOT NULL;

-- 10. Drop now-obsolete Workout columns and enforce kind NOT NULL.
ALTER TABLE "Workout" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "Workout" DROP COLUMN "templateId";
ALTER TABLE "Workout" DROP COLUMN "templateName";

-- 11. Create the unified exercise/set tree tables.
CREATE TABLE "WorkoutExercise" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    CONSTRAINT "WorkoutExercise_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkoutSet" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "workoutExerciseId" TEXT NOT NULL,
    "setType" "SetType" NOT NULL DEFAULT 'WORKING',
    "reps" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "rir" INTEGER,
    "rest" INTEGER,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "WorkoutSet_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkoutExercise" ADD CONSTRAINT "WorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkoutSet" ADD CONSTRAINT "WorkoutSet_workoutExerciseId_fkey" FOREIGN KEY ("workoutExerciseId") REFERENCES "WorkoutExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "WorkoutExercise_workoutId_idx" ON "WorkoutExercise"("workoutId");
CREATE UNIQUE INDEX "WorkoutSet_workoutExerciseId_order_key" ON "WorkoutSet"("workoutExerciseId", "order");

-- 12. Populate the tree from the three legacy hierarchies (ids preserved).
--     Set "order" is re-derived via ROW_NUMBER() rather than copied verbatim: the old
--     model never enforced (blueprintExerciseId, order) uniqueness in the database
--     (only SetLog had a declared unique constraint, and even that turned out to be
--     absent from the live DB), and at least one existing blueprint has a genuine
--     duplicate order value. Re-deriving from (legacy order/setNumber, id) as the sort
--     key preserves the original relative ordering while guaranteeing the new
--     `@@unique([workoutExerciseId, order])` constraint can never fail on legacy data.
INSERT INTO "WorkoutExercise" ("id", "order", "workoutId", "exerciseId")
SELECT "id", "order", "blueprintId", "exerciseId" FROM "BlueprintExercise";

INSERT INTO "WorkoutSet" ("id", "order", "workoutExerciseId", "setType", "reps", "weight", "rir", "rest", "completedAt")
SELECT "id",
       ROW_NUMBER() OVER (PARTITION BY "blueprintExerciseId" ORDER BY "order", "id") - 1,
       "blueprintExerciseId", "setType", "reps", "weight", "rir", "restAfterSet", NULL
FROM "BlueprintSet";

INSERT INTO "WorkoutExercise" ("id", "order", "workoutId", "exerciseId")
SELECT "id", "order", "templateId", "exerciseId" FROM "WorkoutTemplateExercise";

INSERT INTO "WorkoutSet" ("id", "order", "workoutExerciseId", "setType", "reps", "weight", "rir", "rest", "completedAt")
SELECT "id",
       ROW_NUMBER() OVER (PARTITION BY "templateExerciseId" ORDER BY "order", "id") - 1,
       "templateExerciseId",
       CASE WHEN "isWarmup" THEN 'WARMUP' ELSE 'WORKING' END::"SetType",
       "targetReps", "targetWeight", "targetRir", 90, NULL
FROM "WorkoutTemplateSet";

INSERT INTO "WorkoutExercise" ("id", "order", "workoutId", "exerciseId")
SELECT "id", "order", "workoutId", "exerciseId" FROM "ExerciseLog";

INSERT INTO "WorkoutSet" ("id", "order", "workoutExerciseId", "setType", "reps", "weight", "rir", "rest", "completedAt")
SELECT "id",
       ROW_NUMBER() OVER (PARTITION BY "exerciseLogId" ORDER BY "setNumber", "id") - 1,
       "exerciseLogId", "setType", "reps", "weight", "rir", "actualRestDuration", "completedAt"
FROM "SetLog";

-- 13. Drop the now-fully-migrated legacy tables (children before parents).
ALTER TABLE "BlueprintSet" DROP CONSTRAINT "BlueprintSet_blueprintExerciseId_fkey";
ALTER TABLE "BlueprintExercise" DROP CONSTRAINT "BlueprintExercise_blueprintId_fkey";
ALTER TABLE "BlueprintExercise" DROP CONSTRAINT "BlueprintExercise_exerciseId_fkey";
ALTER TABLE "WorkoutBlueprint" DROP CONSTRAINT "WorkoutBlueprint_workoutDayId_fkey";
DROP TABLE "BlueprintSet";
DROP TABLE "BlueprintExercise";
DROP TABLE "WorkoutBlueprint";

ALTER TABLE "WorkoutTemplateSet" DROP CONSTRAINT "WorkoutTemplateSet_templateExerciseId_fkey";
ALTER TABLE "WorkoutTemplateExercise" DROP CONSTRAINT "WorkoutTemplateExercise_templateId_fkey";
ALTER TABLE "WorkoutTemplateExercise" DROP CONSTRAINT "WorkoutTemplateExercise_exerciseId_fkey";
ALTER TABLE "WorkoutTemplate" DROP CONSTRAINT "WorkoutTemplate_userId_fkey";
DROP TABLE "WorkoutTemplateSet";
DROP TABLE "WorkoutTemplateExercise";
DROP TABLE "WorkoutTemplate";

ALTER TABLE "SetLog" DROP CONSTRAINT "SetLog_exerciseLogId_fkey";
ALTER TABLE "ExerciseLog" DROP CONSTRAINT "ExerciseLog_exerciseId_fkey";
ALTER TABLE "ExerciseLog" DROP CONSTRAINT "ExerciseLog_workoutId_fkey";
DROP TABLE "SetLog";
DROP TABLE "ExerciseLog";

-- 14. Origin-template FK + lookup index now that both sides are settled.
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_originTemplateId_fkey" FOREIGN KEY ("originTemplateId") REFERENCES "Workout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Workout_userId_kind_idx" ON "Workout"("userId", "kind");

-- 15. Enforce blueprint 1:1-per-day (partial unique index -- Prisma's schema DSL can't
--     express this directly; kind=WORKOUT rows may share a workoutDayId across many
--     performed sessions, kind=BLUEPRINT rows may not, exactly one per day).
CREATE UNIQUE INDEX "Workout_blueprint_workoutDay_unique" ON "Workout"("workoutDayId") WHERE "kind" = 'BLUEPRINT'::"WorkoutKind";

-- 16. Exercise muscle model: distribution-as-source-of-truth. Safety-net backfill for
--     any exercise with an all-zero distribution (none exist in current data, but this
--     keeps the migration correct if that ever changes before it's applied), mirroring
--     exercises.service.ts's existing coarse/fine -> percent-column map, then drop the
--     now-redundant column/enum.
UPDATE "Exercise" SET "abdomenPercent" = 100
  WHERE "muscleGroup" IN ('ABDOMEN','ABS')
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "latissimusPercent" = 100
  WHERE "muscleGroup" IN ('LATISSIMUS','BACK')
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "trapeziusPercent" = 100
  WHERE "muscleGroup" = 'TRAPEZIUS'
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "lowerBackPercent" = 100
  WHERE "muscleGroup" = 'LOWER_BACK'
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "hamstringsPercent" = 100
  WHERE "muscleGroup" = 'HAMSTRINGS'
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "glutesPercent" = 100
  WHERE "muscleGroup" = 'GLUTES'
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "shouldersPercent" = 100
  WHERE "muscleGroup" = 'SHOULDERS'
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "bicepsPercent" = 100
  WHERE "muscleGroup" = 'BICEPS'
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "chestPercent" = 100
  WHERE "muscleGroup" = 'CHEST'
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "quadricepsPercent" = 100
  WHERE "muscleGroup" IN ('QUADRICEPS','LEGS')
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "calvesPercent" = 100
  WHERE "muscleGroup" = 'CALVES'
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;
UPDATE "Exercise" SET "tricepsPercent" = 100
  WHERE "muscleGroup" = 'TRICEPS'
    AND "abdomenPercent"+"latissimusPercent"+"trapeziusPercent"+"lowerBackPercent"+"hamstringsPercent"+"glutesPercent"+"shouldersPercent"+"bicepsPercent"+"chestPercent"+"quadricepsPercent"+"calvesPercent"+"tricepsPercent" = 0;

ALTER TABLE "Exercise" DROP COLUMN "muscleGroup";
DROP TYPE "MuscleGroup";
DROP TYPE "GymLocation"; -- unused orphan enum; no column ever referenced it

-- 17. WorkoutDay.order: rotation position for the "next workout" service (plan §3.6),
--     backfilled from the current implicit weekday-ascending ordering.
ALTER TABLE "WorkoutDay" ADD COLUMN "order" INTEGER;

UPDATE "WorkoutDay" wd SET "order" = ranked.rn
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "cycleId" ORDER BY "weekday" ASC) - 1 AS rn
  FROM "WorkoutDay"
) ranked
WHERE ranked."id" = wd."id";

ALTER TABLE "WorkoutDay" ALTER COLUMN "order" SET NOT NULL;
CREATE UNIQUE INDEX "WorkoutDay_cycleId_order_key" ON "WorkoutDay"("cycleId", "order");

-- 18. HomeGym soft-delete (plan §3.8).
ALTER TABLE "HomeGym" ADD COLUMN "deletedAt" TIMESTAMP(3);
