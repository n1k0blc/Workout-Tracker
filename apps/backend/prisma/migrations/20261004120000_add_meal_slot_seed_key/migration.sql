-- AlterTable
ALTER TABLE "MealSlot" ADD COLUMN "seedKey" TEXT;

-- Backfill (#189): an existing user's untouched defaults acquire their seedKey so they follow
-- the locale. "Untouched" = still carrying the German default name; a renamed row no longer
-- matches and stays null. If a user holds two rows with the same default name (one renamed
-- back, or created by hand) only the oldest -- the original -- is tagged.
UPDATE "MealSlot" m
SET "seedKey" = d."seedKey"
FROM (VALUES
    ('Frühstück', 'breakfast'),
    ('Mittagessen', 'lunch'),
    ('Abendessen', 'dinner'),
    ('Snacks', 'snacks')
) AS d("name", "seedKey"),
(
    SELECT DISTINCT ON ("userId", "name") "id"
    FROM "MealSlot"
    ORDER BY "userId", "name", "createdAt", "id"
) first
WHERE m."id" = first."id" AND m."name" = d."name";
