-- Normalize WorkoutExercise.order and WorkoutSet.order to contiguous 1..n per parent.
--
-- Why: `order` never had an enforced base. The unify migration (20260705133757) wrote
-- every folded-in row 0-based (`ROW_NUMBER() - 1`), while every tree saved since through
-- the template editor is 1-based, and `replaceTree` persists whatever the client sends --
-- so both conventions (plus gaps, and bases above 1) coexist in the same tables.
--
-- The visible symptom was in the template editor, which compensated for 0-based data with
-- an `order === 0 ? index + 1 : order` fixup. That maps a set at order 0 and a set at
-- order 1 onto the same number: the collapsed card de-duplicates set numbers when drawing
-- its progress bars (two sets -> one bar), and the expanded card resolves each row's
-- warm-up/working type by looking that number up, so the shadowed set rendered with its
-- neighbour's type. The active-workout path has no such fixup, which is why the same
-- template loaded correctly for performing.
--
-- ROW_NUMBER() is used rather than an offset because the data is not a clean two-base
-- split -- there are already parents with gaps and with bases above 1. Ordering by
-- ("order", "id") keeps the existing sequence and makes the previously-arbitrary
-- resolution of duplicate orders deterministic. No other column is touched.

-- 1. WorkoutSet: renumber in two passes.
--    WorkoutSet carries a unique index on ("workoutExerciseId", "order"), which Postgres
--    checks per row *within* a statement -- a direct renumber would raise a duplicate-key
--    error the moment it moved a set from 0 to 1 while its neighbour still held 1. Parking
--    the target in the negative range first keeps every intermediate state collision-free:
--    pass 1 writes only negatives (disjoint from the non-negative values still to be read),
--    pass 2 writes only positives (disjoint from the negatives still to be read).
UPDATE "WorkoutSet" s
SET "order" = -t.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "workoutExerciseId" ORDER BY "order", "id") AS rn
  FROM "WorkoutSet"
) t
WHERE s.id = t.id;

UPDATE "WorkoutSet" SET "order" = -"order" WHERE "order" < 0;

-- 2. WorkoutExercise: no unique index on ("workoutId", "order"), so a single pass is safe.
UPDATE "WorkoutExercise" we
SET "order" = t.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "workoutId" ORDER BY "order", "id") AS rn
  FROM "WorkoutExercise"
) t
WHERE we.id = t.id;
