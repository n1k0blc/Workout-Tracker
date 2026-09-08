-- Stable identifier for seeded foods (#145). `prisma db seed` upserts FoodsSeed.csv rows on
-- this key, so re-running updates rows instead of duplicating them. Null for USER and
-- OPEN_FOOD_FACTS foods.

-- AlterTable
ALTER TABLE "Food" ADD COLUMN "seedKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Food_seedKey_key" ON "Food"("seedKey");
