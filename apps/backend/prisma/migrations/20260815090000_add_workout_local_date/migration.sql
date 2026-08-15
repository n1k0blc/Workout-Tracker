-- Add Workout.localDate: the calendar day a performed workout happened on, in the user's
-- local timezone, as a plain `YYYY-MM-DD` string.
--
-- Why a string and not a DATE column: a date column comes back through the ORM as a
-- timestamp at UTC midnight, which reintroduces the instant-versus-calendar-day confusion
-- this column exists to remove. The stored `date` instant stays untouched and remains what
-- history, analytics and the cycle views read.
--
-- Why nullable: kind=TEMPLATE and kind=BLUEPRINT rows live in the same table and have no
-- day. The CHECK constraint below makes the column effectively NOT NULL for the only kind
-- it applies to, and doubles as the verification that the backfill left no gaps -- adding
-- it fails loudly if any performed workout is still missing a localDate.
ALTER TABLE "Workout" ADD COLUMN "localDate" TEXT;

-- Backfill: every existing performed workout was logged from Europe/Berlin, so its stored
-- instant interpreted in that zone is its true calendar day. `date` is a TIMESTAMP(3)
-- without time zone holding UTC, hence the two-step conversion: label it UTC first, then
-- read it in Berlin.
UPDATE "Workout"
SET "localDate" = to_char(("date" AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD')
WHERE "kind" = 'WORKOUT'
  AND "date" IS NOT NULL;

ALTER TABLE "Workout"
  ADD CONSTRAINT "Workout_localDate_required_for_performed"
  CHECK ("kind" <> 'WORKOUT' OR "localDate" IS NOT NULL);
