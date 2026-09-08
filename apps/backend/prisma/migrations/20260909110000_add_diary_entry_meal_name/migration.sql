-- Snapshot the meal's name onto each expanded ingredient entry (#147).
--
-- The Abschnitt page groups a meal's entries under a "MAHLZEIT <name>" header. Resolving
-- that name live from the Meal row on every `getDay` would make a later meal rename rewrite
-- the header on past days -- exactly the "diary becomes a view over mutable data" that
-- ADR-0002 rejects. So `mealName` is copied at expansion time, next to the snapshotted
-- `name` / kcal / macros, and never read back from the Meal.
--
-- Nullable: every existing row (and every Schnelleintrag / single-food entry) has it NULL.

-- AlterTable
ALTER TABLE "DiaryEntry" ADD COLUMN "mealName" TEXT;
