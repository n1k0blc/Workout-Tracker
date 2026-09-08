-- Favoriten (#148): a per-user star on a shared Lebensmittel (FoodFavorite) or Mahlzeit
-- (MealFavorite). The row's existence is the favorite; unstarring deletes it. The
-- `(userId, foodId)` / `(userId, mealId)` unique index makes a repeated star a harmless
-- upsert and backs the `isFavorite` lookups the picker's "Alle" tab does per row.
--
-- ON DELETE CASCADE on both FKs: a favorite is meaningless once its user or its food/meal is
-- gone. In practice foods and meals are only ever soft-deleted, so the food/meal cascade is a
-- safety net, not a code path.
--
-- The "Zuletzt" tab needs no table -- it is derived from DiaryEntry.

-- CreateTable
CREATE TABLE "FoodFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoodFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MealFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodFavorite_userId_idx" ON "FoodFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodFavorite_userId_foodId_key" ON "FoodFavorite"("userId", "foodId");

-- CreateIndex
CREATE INDEX "MealFavorite_userId_idx" ON "MealFavorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MealFavorite_userId_mealId_key" ON "MealFavorite"("userId", "mealId");

-- AddForeignKey
ALTER TABLE "FoodFavorite" ADD CONSTRAINT "FoodFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodFavorite" ADD CONSTRAINT "FoodFavorite_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealFavorite" ADD CONSTRAINT "MealFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealFavorite" ADD CONSTRAINT "MealFavorite_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
