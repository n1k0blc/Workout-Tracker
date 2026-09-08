-- Nutrition tracking, first slice (#141): the Abschnitt (MealSlot) and Eintrag (DiaryEntry)
-- models behind the Ernährung section.
--
-- MealSlot.order is 1-based and contiguous within a user, enforced by the unique index below
-- plus a service-level check -- the same invariant WorkoutDay.order carries.
--
-- DiaryEntry snapshots its nutrients: a quantity edit rescales the stored kcal/carbs/protein/
-- fat proportionally, they are never recomputed from a Food. `foodId` / `mealId` are nullable
-- and unused in this ticket (a Schnelleintrag has foodId = NULL); they exist now so #144/#147
-- can attach foods and meals without migrating existing rows.

-- CreateTable
CREATE TABLE "MealSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiaryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "localDate" TEXT NOT NULL,
    "mealSlotId" TEXT NOT NULL,
    "foodId" TEXT,
    "mealId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "quantityLabel" TEXT,
    "kcal" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiaryEntry_pkey" PRIMARY KEY ("id")
);

-- localDate is a calendar day in the user's own timezone, never an instant -- the same rule
-- as Workout.localDate. The column is already NOT NULL; this pins the shape so a stray
-- timestamp or empty string cannot slip in past the DTO.
ALTER TABLE "DiaryEntry"
  ADD CONSTRAINT "DiaryEntry_localDate_is_calendar_day"
  CHECK ("localDate" ~ '^\d{4}-\d{2}-\d{2}$');

-- CreateIndex
CREATE INDEX "MealSlot_userId_idx" ON "MealSlot"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MealSlot_userId_order_key" ON "MealSlot"("userId", "order");

-- CreateIndex
CREATE INDEX "DiaryEntry_userId_localDate_idx" ON "DiaryEntry"("userId", "localDate");

-- CreateIndex
CREATE INDEX "DiaryEntry_mealSlotId_idx" ON "DiaryEntry"("mealSlotId");

-- AddForeignKey
ALTER TABLE "MealSlot" ADD CONSTRAINT "MealSlot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_mealSlotId_fkey" FOREIGN KEY ("mealSlotId") REFERENCES "MealSlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill the four default Abschnitte for every existing user, order 1..4. New users get the
-- same four through the registration path (defaultMealSlotCreateData), so the two paths share
-- one definition of "the defaults". The MealSlot table is created in this migration, so every
-- existing user has zero slots here and the unique (userId, order) index cannot collide.
-- gen_random_uuid() is core in PostgreSQL 13+.
INSERT INTO "MealSlot" ("id", "userId", "name", "order", "createdAt")
SELECT gen_random_uuid(), u."id", d."name", d."order", CURRENT_TIMESTAMP
FROM "User" u
CROSS JOIN (VALUES
  ('Frühstück', 1),
  ('Mittagessen', 2),
  ('Abendessen', 3),
  ('Snacks', 4)
) AS d("name", "order");
