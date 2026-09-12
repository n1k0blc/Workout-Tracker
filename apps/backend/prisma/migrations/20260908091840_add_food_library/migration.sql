-- The shared Lebensmittel library (#143). Every Food is visible to every user; only the
-- creator can edit a `source = USER` food, and SEED / OPEN_FOOD_FACTS foods are read-only for
-- everyone (enforced in FoodsService). Deletion is soft (`deletedAt`) so DiaryEntry and Meal
-- references keep resolving. `barcode` is globally unique across every row, soft-deleted
-- included. No seed data here -- the curated CSV and the Open Food Facts import land in later
-- tickets.

-- CreateEnum
CREATE TYPE "FoodSource" AS ENUM ('SEED', 'OPEN_FOOD_FACTS', 'USER');

-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "barcode" TEXT,
    "isLiquid" BOOLEAN NOT NULL DEFAULT false,
    "kcal" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "source" "FoodSource" NOT NULL DEFAULT 'USER',
    "createdById" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Food_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodPortion" (
    "id" TEXT NOT NULL,
    "foodId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "grams" DOUBLE PRECISION NOT NULL,
    "order" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FoodPortion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Food_barcode_key" ON "Food"("barcode");

-- CreateIndex
CREATE INDEX "Food_createdById_idx" ON "Food"("createdById");

-- CreateIndex
CREATE INDEX "Food_deletedAt_idx" ON "Food"("deletedAt");

-- CreateIndex
CREATE INDEX "FoodPortion_foodId_idx" ON "FoodPortion"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodPortion_foodId_order_key" ON "FoodPortion"("foodId", "order");

-- AddForeignKey
ALTER TABLE "Food" ADD CONSTRAINT "Food_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodPortion" ADD CONSTRAINT "FoodPortion_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food"("id") ON DELETE CASCADE ON UPDATE CASCADE;
