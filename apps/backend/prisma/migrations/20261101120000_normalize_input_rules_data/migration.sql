-- Data migration for the input rules of #221 (ticket #223). No schema change.
--
-- Corrects only what is safe to correct, so that old rows do not break the server rules that
-- go live next (editing a workout resends its whole tree, and a row that breaks a rule would
-- make it impossible to save):
--   * RIR on warm-up sets -- including per-side RIR -- becomes NULL. Warm-ups carry no RIR.
--   * User e-mails are trimmed and lowercased (the server now treats addresses case-insensitively).
--   * Text names are trimmed (the server now stores text trimmed).
--
-- Everything else the rules forbid (too long, out of range, odd characters, more than one active
-- Zyklus, ...) is left alone and has to be fixed by hand. `npm run check:input-rules` lists every
-- such row; it is read-only and MUST be run against the target database first -- for production
-- that is the Raspberry Pi database -- before this migration is applied.
--
-- Two kinds of rows make the corrections above collide with a unique index. Both are detected up
-- front and abort the migration with the offending rows named. Prisma runs the file in one
-- transaction, so an abort leaves the database exactly as it was:
--   * e-mails that are equal once trimmed and lowercased ("Niko@x.com" and "niko@x.com"),
--   * templates of one user whose names are equal once trimmed ("Push" and "Push ").

-- Trims the characters JavaScript's String.prototype.trim() trims, which is what the server does.
-- Lives in this session's temp schema and disappears with it.
CREATE FUNCTION pg_temp.input_rules_trim(value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT btrim(value, E' \t\n\v\f\r                 　﻿')
$$;

DO $$
DECLARE
  conflicts text;
BEGIN
  SELECT string_agg(format('"%s" is held by users %s', address, ids), '; ')
    INTO conflicts
    FROM (
      SELECT lower(pg_temp.input_rules_trim(email)) AS address, string_agg(id, ', ' ORDER BY id) AS ids
        FROM "User"
       GROUP BY 1
      HAVING count(*) > 1
    ) duplicates;

  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot lowercase e-mail addresses, case-insensitive duplicates exist: %. Merge or delete all but one account per address (npm run check:input-rules lists them), then migrate again.', conflicts;
  END IF;

  SELECT string_agg(format('"%s" (user %s) is held by templates %s', name, "userId", ids), '; ')
    INTO conflicts
    FROM (
      SELECT "userId", pg_temp.input_rules_trim(name) AS name, string_agg(id, ', ' ORDER BY id) AS ids
        FROM "Workout"
       WHERE kind = 'TEMPLATE' AND "userId" IS NOT NULL AND name IS NOT NULL
       GROUP BY "userId", pg_temp.input_rules_trim(name)
      HAVING count(*) > 1
    ) duplicates;

  IF conflicts IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot trim template names, they collide once trimmed: %. Rename all but one per user (npm run check:input-rules lists them), then migrate again.', conflicts;
  END IF;
END
$$;

-- Warm-ups carry no RIR.
UPDATE "WorkoutSet"
   SET "rir" = NULL, "rirLeft" = NULL, "rirRight" = NULL
 WHERE "setType" = 'WARMUP'
   AND ("rir" IS NOT NULL OR "rirLeft" IS NOT NULL OR "rirRight" IS NOT NULL);

-- E-mail is trimmed and lowercased.
UPDATE "User"
   SET "email" = lower(pg_temp.input_rules_trim("email"))
 WHERE "email" <> lower(pg_temp.input_rules_trim("email"));

-- Names are trimmed. Catalogue rows (seed exercises, seed and Open Food Facts foods) are never
-- resent by a user and are matched by key rather than name, so only user content is touched.
UPDATE "User" SET "firstName" = pg_temp.input_rules_trim("firstName") WHERE "firstName" <> pg_temp.input_rules_trim("firstName");
UPDATE "User" SET "lastName" = pg_temp.input_rules_trim("lastName") WHERE "lastName" <> pg_temp.input_rules_trim("lastName");
UPDATE "HomeGym" SET "name" = pg_temp.input_rules_trim("name") WHERE "name" <> pg_temp.input_rules_trim("name");
UPDATE "WorkoutCycle" SET "name" = pg_temp.input_rules_trim("name") WHERE "name" <> pg_temp.input_rules_trim("name");
UPDATE "WorkoutDay" SET "name" = pg_temp.input_rules_trim("name") WHERE "name" <> pg_temp.input_rules_trim("name");
UPDATE "Workout" SET "name" = pg_temp.input_rules_trim("name") WHERE "name" <> pg_temp.input_rules_trim("name");
UPDATE "Exercise" SET "name" = pg_temp.input_rules_trim("name") WHERE "isCustom" AND "name" <> pg_temp.input_rules_trim("name");
UPDATE "Food" SET "name" = pg_temp.input_rules_trim("name") WHERE "source" = 'USER' AND "name" <> pg_temp.input_rules_trim("name");
UPDATE "Food" SET "brand" = pg_temp.input_rules_trim("brand") WHERE "source" = 'USER' AND "brand" <> pg_temp.input_rules_trim("brand");
UPDATE "FoodPortion" SET "label" = pg_temp.input_rules_trim("label")
 WHERE "label" <> pg_temp.input_rules_trim("label")
   AND "foodId" IN (SELECT "id" FROM "Food" WHERE "source" = 'USER');
UPDATE "Meal" SET "name" = pg_temp.input_rules_trim("name") WHERE "name" <> pg_temp.input_rules_trim("name");
UPDATE "MealSlot" SET "name" = pg_temp.input_rules_trim("name") WHERE "name" <> pg_temp.input_rules_trim("name");
UPDATE "DiaryEntry" SET "name" = pg_temp.input_rules_trim("name") WHERE "name" <> pg_temp.input_rules_trim("name");
