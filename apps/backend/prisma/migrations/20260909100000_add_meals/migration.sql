-- Mahlzeiten (#147): a shared Meal library and its ingredient lines (MealItem).
--
-- Same sharing rules as Food (docs/adr/0003-user-created-foods-and-meals-are-shared.md):
-- every Meal is visible to every user, only its `createdById` can edit or delete it
-- (enforced in MealsService, 403 otherwise), and deletion is soft (`deletedAt`) so logged
-- entries keep grouping under the meal's name. `createdById` is nullable with ON DELETE SET
-- NULL for the same reason a Food's is -- the shared row outlives the account that made it.
--
-- `DiaryEntry.mealId` already existed (nullable, no relation, added in
-- 20260908071941_add_nutrition_meal_slots_and_diary_entries for exactly this ticket); this
-- migration only attaches the foreign key. Every existing row has `mealId` NULL, so the
-- constraint is satisfied without a data backfill.
--
-- MealItem.foodId has no cascade: a Food is soft-deleted, so the row stays and the meal
-- keeps resolving and computing.

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealItem" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "MealItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Meal_createdById_idx" ON "Meal"("createdById");

-- CreateIndex
CREATE INDEX "Meal_deletedAt_idx" ON "Meal"("deletedAt");

-- CreateIndex
CREATE INDEX "MealItem_mealId_idx" ON "MealItem"("mealId");

-- CreateIndex
CREATE INDEX "MealItem_foodId_idx" ON "MealItem"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "MealItem_mealId_order_key" ON "MealItem"("mealId", "order");

-- AddForeignKey
ALTER TABLE "DiaryEntry" ADD CONSTRAINT "DiaryEntry_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealItem" ADD CONSTRAINT "MealItem_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
